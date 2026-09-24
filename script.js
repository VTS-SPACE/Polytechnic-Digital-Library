/*
 * Polytechnic Digital Library
 * Vanilla JavaScript state, DOM rendering, and LocalStorage persistence.
 */

const BOOKS_KEY = "poly_library_books";
const ISSUED_KEY = "poly_library_issued";
const FINE_PER_DAY = 2;
const LOAN_DAYS = 14;

const sampleBooks = [
    { id: "book-101", title: "Java Programming", author: "Herbert Schildt", code: "BK-101", category: "Computer Science", quantity: 4 },
    { id: "book-102", title: "Web Technology", author: "Uttam K. Roy", code: "BK-102", category: "IT", quantity: 3 },
    { id: "book-103", title: "Data Structures", author: "Seymour Lipschutz", code: "BK-103", category: "Computer Science", quantity: 5 },
    { id: "book-104", title: "Database Management Systems", author: "Raghu Ramakrishnan", code: "BK-104", category: "IT", quantity: 2 },
    { id: "book-105", title: "Engineering Mathematics - III", author: "B. S. Grewal", code: "BK-105", category: "Mathematics", quantity: 3 }
];

let books = readStorage(BOOKS_KEY, sampleBooks);
let issuedRecords = readStorage(ISSUED_KEY, []);
let editingBookId = null;

const elements = {
    todayLabel: document.querySelector("#todayLabel"),
    heroDate: document.querySelector("#heroDate"),
    notice: document.querySelector("#notice"),
    bookForm: document.querySelector("#bookForm"),
    bookFormTitle: document.querySelector("#bookFormTitle"),
    bookSubmitButton: document.querySelector("#bookSubmitButton"),
    cancelBookEdit: document.querySelector("#cancelBookEdit"),
    bookSearch: document.querySelector("#bookSearch"),
    booksBody: document.querySelector("#booksTableBody"),
    booksEmpty: document.querySelector("#booksEmpty"),
    bookCount: document.querySelector("#bookCount"),
    issueForm: document.querySelector("#issueForm"),
    issueBook: document.querySelector("#issueBook"),
    issueDate: document.querySelector("#issueDate"),
    dueDate: document.querySelector("#dueDate"),
    issuedBody: document.querySelector("#issuedTableBody"),
    issuedEmpty: document.querySelector("#issuedEmpty"),
    issuedCount: document.querySelector("#issuedCount"),
    receiptModal: document.querySelector("#receiptModal")
};

const customSelectControllers = new Map();
const dialog = {
    backdrop: document.querySelector("#appDialog"),
    title: document.querySelector("#dialogTitle"),
    message: document.querySelector("#dialogMessage"),
    cancel: document.querySelector("#dialogCancel"),
    confirm: document.querySelector("#dialogConfirm")
};
let dialogResolver = null;

function readStorage(key, fallback) {
    try {
        const saved = JSON.parse(localStorage.getItem(key));
        return Array.isArray(saved) ? saved : fallback;
    } catch (error) {
        return fallback;
    }
}

function persistState() {
    localStorage.setItem(BOOKS_KEY, JSON.stringify(books));
    localStorage.setItem(ISSUED_KEY, JSON.stringify(issuedRecords));
}

function dateToInputValue(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function parseDate(value) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
}

function formatDate(value) {
    if (!value) return "-";
    return parseDate(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function calculateDueDate(issueDate) {
    const dueDate = parseDate(issueDate);
    dueDate.setDate(dueDate.getDate() + LOAN_DAYS);
    return dateToInputValue(dueDate);
}

function getRecordStatus(record) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = parseDate(record.dueDate);
    const overdueDays = Math.max(0, Math.floor((today - dueDate) / (1000 * 60 * 60 * 24)));
    return { overdueDays, fine: overdueDays * FINE_PER_DAY, isOverdue: overdueDays > 0 };
}

function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}

function enhanceSelect(select) {
    const wrapper = document.createElement("div");
    wrapper.className = "custom-select";
    select.parentNode.insertBefore(wrapper, select);
    wrapper.appendChild(select);
    select.classList.add("native-select-hidden");

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "custom-select-trigger";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-controls", `${select.id}-menu`);

    const label = document.createElement("span");
    const chevron = document.createElement("span");
    chevron.className = "select-chevron";
    chevron.setAttribute("aria-hidden", "true");
    trigger.append(label, chevron);

    const menu = document.createElement("div");
    menu.id = `${select.id}-menu`;
    menu.className = "custom-select-menu";
    menu.setAttribute("role", "listbox");
    wrapper.append(trigger, menu);

    const close = () => {
        wrapper.classList.remove("is-open");
        trigger.setAttribute("aria-expanded", "false");
    };

    const refresh = () => {
        const selectedOption = select.options[select.selectedIndex];
        label.textContent = selectedOption ? selectedOption.textContent : "Select an option";
        label.classList.toggle("select-placeholder", !select.value);
        menu.innerHTML = Array.from(select.options).map((option) => `<button class="custom-select-option ${option.value ? "" : "is-placeholder"} ${option.value === select.value && option.value ? "is-selected" : ""}" type="button" role="option" aria-selected="${option.value === select.value}" data-value="${escapeHtml(option.value)}">${escapeHtml(option.textContent)}</button>`).join("");
    };

    trigger.addEventListener("click", () => {
        const shouldOpen = !wrapper.classList.contains("is-open");
        document.querySelectorAll(".custom-select.is-open").forEach((openSelect) => {
            openSelect.classList.remove("is-open");
            openSelect.querySelector(".custom-select-trigger")?.setAttribute("aria-expanded", "false");
        });
        wrapper.classList.toggle("is-open", shouldOpen);
        trigger.setAttribute("aria-expanded", String(shouldOpen));
    });

    trigger.addEventListener("keydown", (event) => {
        if (["Enter", " ", "ArrowDown"].includes(event.key)) {
            event.preventDefault();
            wrapper.classList.add("is-open");
            trigger.setAttribute("aria-expanded", "true");
            menu.querySelector(".custom-select-option")?.focus();
        }
        if (event.key === "Escape") close();
    });

    menu.addEventListener("click", (event) => {
        const option = event.target.closest(".custom-select-option");
        if (!option) return;
        select.value = option.dataset.value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
        refresh();
        close();
        trigger.focus();
    });

    select.addEventListener("change", refresh);
    refresh();
    customSelectControllers.set(select, { refresh });
}

function showNotice(message, isError = false) {
    elements.notice.textContent = message;
    elements.notice.classList.toggle("error", isError);
    window.clearTimeout(showNotice.timer);
    showNotice.timer = window.setTimeout(() => {
        elements.notice.textContent = "";
        elements.notice.classList.remove("error");
    }, 4500);
}

function openDialog(message, { title = "Confirm action", confirmText = "Confirm", showCancel = true } = {}) {
    dialog.title.textContent = title;
    dialog.message.textContent = message;
    dialog.confirm.textContent = confirmText;
    dialog.cancel.hidden = !showCancel;
    dialog.backdrop.hidden = false;
    document.body.style.overflow = "hidden";
    dialog.confirm.focus();
    return new Promise((resolve) => { dialogResolver = resolve; });
}

function closeDialog(result) {
    dialog.backdrop.hidden = true;
    document.body.style.overflow = "";
    if (dialogResolver) {
        dialogResolver(result);
        dialogResolver = null;
    }
}

function renderDashboard() {
    const activeRecords = issuedRecords.filter((record) => !record.returnedAt);
    const overdueCount = activeRecords.filter((record) => getRecordStatus(record).isOverdue).length;
    const collectedFine = issuedRecords.reduce((sum, record) => sum + Number(record.collectedFine || 0), 0);
    const totalVolumes = books.reduce((sum, book) => sum + Number(book.quantity), 0);
    document.querySelector("#totalBooks").textContent = totalVolumes;
    document.querySelector("#issuedBooks").textContent = activeRecords.length;
    document.querySelector("#overdueBooks").textContent = overdueCount;
    document.querySelector("#totalFine").textContent = `₹${collectedFine}`;
    elements.bookCount.textContent = `${books.length} title${books.length === 1 ? "" : "s"}`;
    elements.issuedCount.textContent = `${activeRecords.length} active record${activeRecords.length === 1 ? "" : "s"}`;
}

function renderBooks() {
    const query = elements.bookSearch.value.trim().toLowerCase();
    const visibleBooks = books.filter((book) => `${book.title} ${book.code}`.toLowerCase().includes(query));
    elements.booksBody.innerHTML = visibleBooks.map((book) => `<tr>
    <td><div class="book-detail"><strong>${escapeHtml(book.title)}</strong><span>${escapeHtml(book.author)} · ${escapeHtml(book.code)}</span></div></td>
    <td>${escapeHtml(book.category)}</td>
    <td><span class="stock ${book.quantity === 0 ? "empty" : ""}">${book.quantity}</span></td>
    <td><div class="action-group"><button class="text-button edit" type="button" data-edit-book="${escapeHtml(book.id)}">Edit</button><button class="text-button" type="button" data-delete-book="${escapeHtml(book.id)}">Delete</button></div></td>
  </tr>`).join("");
    elements.booksEmpty.hidden = visibleBooks.length !== 0;
}

function renderBookOptions() {
    const availableBooks = books.filter((book) => book.quantity > 0);
    elements.issueBook.innerHTML = `<option value="">Select a book with available stock</option>${availableBooks.map((book) => `<option value="${escapeHtml(book.id)}">${escapeHtml(book.title)} (${escapeHtml(book.code)}) - ${book.quantity} available</option>`).join("")}`;
    customSelectControllers.get(elements.issueBook)?.refresh();
}

function renderIssuedRecords() {
    const activeRecords = issuedRecords.filter((record) => !record.returnedAt);
    elements.issuedBody.innerHTML = activeRecords.map((record) => {
        const status = getRecordStatus(record);
        const book = books.find((item) => item.id === record.bookId);
        const title = book ? book.title : record.bookTitle;
        const statusText = status.isOverdue ? `Late / Overdue (₹${status.fine})` : "On Time";
        return `<tr>
      <td><div class="student-detail"><strong>${escapeHtml(record.studentName)}</strong><span>${escapeHtml(record.rollNumber)} · ${escapeHtml(record.branchSemester)}</span></div></td>
      <td><div class="book-detail"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(record.bookCode)}</span></div></td>
      <td>${formatDate(record.issueDate)}</td><td>${formatDate(record.dueDate)}</td>
      <td><span class="status-badge ${status.isOverdue ? "overdue" : "on-time"}">${statusText}</span></td>
      <td><div class="action-group"><button class="print-link" type="button" data-print-record="${escapeHtml(record.id)}">Print slip</button><button class="return-button" type="button" data-return-record="${escapeHtml(record.id)}">Return</button></div></td>
    </tr>`;
    }).join("");
    elements.issuedEmpty.hidden = activeRecords.length !== 0;
}

function renderAll() {
    renderDashboard();
    renderBooks();
    renderBookOptions();
    renderIssuedRecords();
}

function resetIssueDates() {
    const today = dateToInputValue(new Date());
    elements.issueDate.value = today;
    elements.issueDate.max = today;
    elements.dueDate.value = calculateDueDate(today);
}

function resetBookForm() {
    editingBookId = null;
    elements.bookForm.reset();
    document.querySelector("#bookCategory").dispatchEvent(new Event("change"));
    elements.bookFormTitle.textContent = "Add a new book";
    elements.bookSubmitButton.innerHTML = '<span aria-hidden="true">+</span> Add book to library';
    elements.cancelBookEdit.hidden = true;
}

function editBook(bookId) {
    const book = books.find((item) => item.id === bookId);
    if (!book) return;
    editingBookId = bookId;
    elements.bookForm.elements.title.value = book.title;
    elements.bookForm.elements.author.value = book.author;
    elements.bookForm.elements.code.value = book.code;
    elements.bookForm.elements.category.value = book.category;
    elements.bookForm.elements.quantity.value = book.quantity;
    document.querySelector("#bookCategory").dispatchEvent(new Event("change"));
    elements.bookFormTitle.textContent = "Update book details";
    elements.bookSubmitButton.innerHTML = '<span aria-hidden="true">✓</span> Update book';
    elements.cancelBookEdit.hidden = false;
    elements.bookForm.scrollIntoView({ behavior: "smooth", block: "center" });
}

async function deleteBook(bookId) {
    const book = books.find((item) => item.id === bookId);
    if (!book) return;
    const hasActiveLoan = issuedRecords.some((record) => record.bookId === bookId && !record.returnedAt);
    if (hasActiveLoan) {
        showNotice("This book cannot be deleted while it is issued to a student.", true);
        return;
    }
    if (!await openDialog(`Delete “${book.title}” from the library catalogue?`, { title: "Delete book", confirmText: "Delete" })) return;
    books = books.filter((item) => item.id !== bookId);
    persistState();
    renderAll();
    showNotice("Book removed from the library catalogue.");
}

function addBook(event) {
    event.preventDefault();
    const formData = new FormData(elements.bookForm);
    const code = formData.get("code").trim().toUpperCase();
    if (books.some((book) => book.id !== editingBookId && book.code.toUpperCase() === code)) {
        showNotice("That accession / book code already exists. Use a unique code.", true);
        return;
    }
    const updatedBook = { id: editingBookId || `book-${Date.now()}`, title: formData.get("title").trim(), author: formData.get("author").trim(), code, category: formData.get("category"), quantity: Number(formData.get("quantity")) };
    const wasEditing = Boolean(editingBookId);
    if (wasEditing) {
        books = books.map((book) => book.id === editingBookId ? updatedBook : book);
    } else {
        books.push(updatedBook);
    }
    persistState();
    resetBookForm();
    renderAll();
    showNotice(wasEditing ? "Book details updated successfully." : "Book added to the library catalogue.");
}

function issueBook(event) {
    event.preventDefault();
    const formData = new FormData(elements.issueForm);
    const book = books.find((item) => item.id === formData.get("bookId"));
    if (!book || book.quantity < 1) {
        showNotice("This book is no longer available. Please choose another title.", true);
        renderAll();
        return;
    }
    book.quantity -= 1;
    issuedRecords.push({ id: `issue-${Date.now()}`, bookId: book.id, bookTitle: book.title, bookCode: book.code, studentName: formData.get("studentName").trim(), rollNumber: formData.get("rollNumber").trim(), branchSemester: `${formData.get("branch")} - ${formData.get("semester")}`, issueDate: formData.get("issueDate"), dueDate: formData.get("dueDate"), returnedAt: null, collectedFine: 0 });
    persistState();
    elements.issueForm.reset();
    resetIssueDates();
    renderAll();
    showNotice(`“${book.title}” issued successfully. Return it by ${formatDate(formData.get("dueDate"))}.`);
}

async function returnBook(recordId) {
    const record = issuedRecords.find((item) => item.id === recordId);
    if (!record || record.returnedAt) return;
    const status = getRecordStatus(record);
    const fineMessage = status.fine > 0 ? ` A fine of ₹${status.fine} has been collected.` : " No fine is due.";
    if (!await openDialog(`Record return for ${record.studentName}?${fineMessage}`, { title: "Confirm book return", confirmText: "Return book" })) return;
    const book = books.find((item) => item.id === record.bookId);
    if (book) book.quantity += 1;
    record.returnedAt = new Date().toISOString();
    record.collectedFine = status.fine;
    persistState();
    renderAll();
    await openDialog(`Book returned successfully.${fineMessage}`, { title: "Return recorded", confirmText: "Done", showCancel: false });
}

function openReceipt(recordId) {
    const record = issuedRecords.find((item) => item.id === recordId);
    if (!record) return;
    const book = books.find((item) => item.id === record.bookId);
    document.querySelector("#receiptNumber").textContent = record.id.replace("issue-", "LIB-");
    document.querySelector("#receiptIssuedOn").textContent = formatDate(record.issueDate);
    document.querySelector("#receiptStudent").textContent = record.studentName;
    document.querySelector("#receiptRoll").textContent = record.rollNumber;
    document.querySelector("#receiptBranch").textContent = record.branchSemester;
    document.querySelector("#receiptCode").textContent = record.bookCode;
    document.querySelector("#receiptBook").textContent = book ? book.title : record.bookTitle;
    document.querySelector("#receiptIssueDate").textContent = formatDate(record.issueDate);
    document.querySelector("#receiptDueDate").textContent = formatDate(record.dueDate);
    elements.receiptModal.hidden = false;
    document.body.style.overflow = "hidden";
}

function closeReceipt() {
    elements.receiptModal.hidden = true;
    document.body.style.overflow = "";
}

elements.bookForm.addEventListener("submit", addBook);
elements.issueForm.addEventListener("submit", issueBook);
elements.bookSearch.addEventListener("input", renderBooks);
elements.issueDate.addEventListener("change", () => { elements.dueDate.value = calculateDueDate(elements.issueDate.value); });
elements.booksBody.addEventListener("click", (event) => { const editButton = event.target.closest("[data-edit-book]"); const deleteButton = event.target.closest("[data-delete-book]"); if (editButton) editBook(editButton.dataset.editBook); if (deleteButton) deleteBook(deleteButton.dataset.deleteBook); });
elements.cancelBookEdit.addEventListener("click", resetBookForm);
elements.issuedBody.addEventListener("click", (event) => { const returnButton = event.target.closest("[data-return-record]"); const printButton = event.target.closest("[data-print-record]"); if (returnButton) returnBook(returnButton.dataset.returnRecord); if (printButton) openReceipt(printButton.dataset.printRecord); });
document.querySelector("#closeReceipt").addEventListener("click", closeReceipt);
document.querySelector("#printReceipt").addEventListener("click", () => window.print());
elements.receiptModal.addEventListener("click", (event) => { if (event.target === elements.receiptModal) closeReceipt(); });
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !elements.receiptModal.hidden) closeReceipt(); });
dialog.confirm.addEventListener("click", () => closeDialog(true));
dialog.cancel.addEventListener("click", () => closeDialog(false));
dialog.backdrop.addEventListener("click", (event) => { if (event.target === dialog.backdrop && !dialog.cancel.hidden) closeDialog(false); });
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !dialog.backdrop.hidden && !dialog.cancel.hidden) closeDialog(false); });
document.addEventListener("click", (event) => { if (!event.target.closest(".custom-select")) document.querySelectorAll(".custom-select.is-open").forEach((select) => { select.classList.remove("is-open"); select.querySelector(".custom-select-trigger")?.setAttribute("aria-expanded", "false"); }); });

const today = new Date();
elements.todayLabel.textContent = today.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
elements.heroDate.textContent = today.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
[
    document.querySelector("#bookCategory"),
    document.querySelector("#studentBranch"),
    document.querySelector("#studentSemester"),
    document.querySelector("#issueBook")
].forEach(enhanceSelect);
resetIssueDates();
renderAll();
