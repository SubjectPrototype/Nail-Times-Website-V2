import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

const emptyCardForm = {
  code: "",
  customer_name: "",
  customer_email: "",
  customer_phone: "",
  notes: "",
  status: "active",
  initial_balance: "",
};

function formatMoney(cents) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format((cents || 0) / 100);
}

function normalizeScannedCardCode(value) {
  return String(value || "")
    .replace(/^%+/, "")
    .replace(/\?+$/, "");
}

function formatDate(value) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getCardStatus(card, currentTime) {
  if (card?.expires_at && new Date(card.expires_at).getTime() <= currentTime) return "expired";
  return card?.status || "active";
}

function formatTimeRemaining(expiresAt, currentTime) {
  const remainingMs = new Date(expiresAt).getTime() - currentTime;
  if (!Number.isFinite(remainingMs)) return "Not available";
  if (remainingMs <= 0) return "Expired";

  const totalHours = Math.floor(remainingMs / (60 * 60 * 1000));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  if (days > 0) return `${days} day${days === 1 ? "" : "s"}, ${hours} hour${hours === 1 ? "" : "s"}`;

  const minutes = Math.max(1, Math.floor(remainingMs / (60 * 1000)));
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

function escapeReceiptHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export default function AdminGiftCards() {
  const apiBaseUrl =
    process.env.REACT_APP_API_URL || `${window.location.protocol}//${window.location.hostname}:4000`;
  const token = localStorage.getItem("adminToken");
  const [cards, setCards] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expirationFilter, setExpirationFilter] = useState("all");
  const [balanceFilter, setBalanceFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [createForm, setCreateForm] = useState(emptyCardForm);
  const [editForm, setEditForm] = useState(emptyCardForm);
  const [transaction, setTransaction] = useState({ type: "debit", amount: "", note: "" });
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [receiptCard, setReceiptCard] = useState(null);
  const [receiptAction, setReceiptAction] = useState("");
  const [receiptFeedback, setReceiptFeedback] = useState(null);

  const selectedCard = cards.find((card) => card._id === selectedId) || null;
  const selectedStatus = getCardStatus(selectedCard, currentTime);

  const filteredCards = useMemo(() => {
    const value = search.trim().toLowerCase();
    const dayMs = 24 * 60 * 60 * 1000;

    const matches = cards.filter((card) => {
      const cardStatus = getCardStatus(card, currentTime);
      const textMatches = !value || [card.code, card.customer_name, card.customer_email, card.customer_phone]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(value));
      if (!textMatches || (statusFilter !== "all" && cardStatus !== statusFilter)) return false;

      const balance = Number(card.balance_cents || 0);
      if (balanceFilter === "positive" && balance <= 0) return false;
      if (balanceFilter === "zero" && balance !== 0) return false;

      if (expirationFilter !== "all") {
        const remainingDays = (new Date(card.expires_at).getTime() - currentTime) / dayMs;
        if (!Number.isFinite(remainingDays)) return false;
        if (expirationFilter === "expired" && remainingDays > 0) return false;
        if (expirationFilter === "30" && (remainingDays <= 0 || remainingDays > 30)) return false;
        if (expirationFilter === "60" && (remainingDays <= 30 || remainingDays > 60)) return false;
        if (expirationFilter === "90" && (remainingDays <= 60 || remainingDays > 90)) return false;
        if (expirationFilter === "later" && remainingDays <= 90) return false;
      }

      return true;
    });

    return matches.sort((first, second) => {
      if (balanceFilter === "highest") return Number(second.balance_cents || 0) - Number(first.balance_cents || 0);
      if (balanceFilter === "lowest") return Number(first.balance_cents || 0) - Number(second.balance_cents || 0);
      if (sortBy === "oldest") return new Date(first.created_at) - new Date(second.created_at);
      if (sortBy === "expiring") return new Date(first.expires_at) - new Date(second.expires_at);
      if (sortBy === "name") return String(first.customer_name || "").localeCompare(String(second.customer_name || ""));
      return new Date(second.created_at) - new Date(first.created_at);
    });
  }, [balanceFilter, cards, currentTime, expirationFilter, search, sortBy, statusFilter]);

  const hasActiveFilters = search || statusFilter !== "all" || expirationFilter !== "all" || balanceFilter !== "all" || sortBy !== "newest";

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setExpirationFilter("all");
    setBalanceFilter("all");
    setSortBy("newest");
  };

  const totals = useMemo(
    () => ({
      balance: cards.reduce(
        (sum, card) => getCardStatus(card, currentTime) === "expired"
          ? sum
          : sum + Number(card.balance_cents || 0),
        0
      ),
      active: cards.filter((card) => getCardStatus(card, currentTime) === "active").length,
    }),
    [cards, currentTime]
  );

  const showMessage = (message) => {
    setSuccessMessage(message);
    window.setTimeout(() => setSuccessMessage(""), 2500);
  };

  const apiRequest = async (path, options = {}) => {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Request failed");
    return data;
  };

  const loadCards = async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const data = await apiRequest("/api/admin/gift-cards");
      setCards(data);
      setSelectedId((current) => data.some((card) => card._id === current) ? current : "");
    } catch (error) {
      setErrorMessage(error.message || "Failed to load gift cards");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token) loadCards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!selectedCard && !receiptCard) return undefined;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        if (receiptCard) setReceiptCard(null);
        else setSelectedId("");
      }
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [receiptCard, selectedCard]);

  useEffect(() => {
    if (!selectedCard) return;
    setEditForm({
      code: selectedCard.code || "",
      customer_name: selectedCard.customer_name || "",
      customer_email: selectedCard.customer_email || "",
      customer_phone: selectedCard.customer_phone || "",
      notes: selectedCard.notes || "",
      status: selectedCard.status || "active",
      initial_balance: "",
    });
    setIsEditing(false);
    setTransaction({ type: "debit", amount: "", note: "" });
  }, [selectedCard]);

  const replaceCard = (updatedCard) => {
    setCards((current) =>
      current.map((card) => (card._id === updatedCard._id ? updatedCard : card))
    );
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    setErrorMessage("");
    try {
      const card = await apiRequest("/api/admin/gift-cards", {
        method: "POST",
        body: JSON.stringify(createForm),
      });
      setCards((current) => [card, ...current]);
      setSelectedId("");
      setReceiptCard(card);
      setCreateForm(emptyCardForm);
      setShowCreate(false);
      showMessage("Gift card created");
    } catch (error) {
      setErrorMessage(error.message || "Failed to create gift card");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = async (event) => {
    event.preventDefault();
    if (!selectedCard) return;
    setIsSaving(true);
    setErrorMessage("");
    try {
      const card = await apiRequest(`/api/admin/gift-cards/${selectedCard._id}`, {
        method: "PATCH",
        body: JSON.stringify(editForm),
      });
      replaceCard(card);
      setIsEditing(false);
      showMessage("Gift card updated");
    } catch (error) {
      setErrorMessage(error.message || "Failed to update gift card");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTransaction = async (event) => {
    event.preventDefault();
    if (!selectedCard) return;
    setIsSaving(true);
    setErrorMessage("");
    try {
      const card = await apiRequest(`/api/admin/gift-cards/${selectedCard._id}/transactions`, {
        method: "POST",
        body: JSON.stringify(transaction),
      });
      replaceCard(card);
      setTransaction((current) => ({ ...current, amount: "", note: "" }));
      showMessage(transaction.type === "credit" ? "Balance added" : "Redemption recorded");
    } catch (error) {
      setErrorMessage(error.message || "Failed to record transaction");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedCard) return;
    if (!window.confirm(`Permanently delete gift card ${selectedCard.code} and all of its history?`)) return;
    setIsSaving(true);
    setErrorMessage("");
    try {
      await apiRequest(`/api/admin/gift-cards/${selectedCard._id}`, { method: "DELETE" });
      const remaining = cards.filter((card) => card._id !== selectedCard._id);
      setCards(remaining);
      setSelectedId("");
      showMessage("Gift card deleted");
    } catch (error) {
      setErrorMessage(error.message || "Failed to delete gift card");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendReceipt = async (channel) => {
    if (!receiptCard) return;
    setReceiptAction(channel);
    setReceiptFeedback(null);
    try {
      const result = await apiRequest(`/api/admin/gift-cards/${receiptCard._id}/receipt`, {
        method: "POST",
        body: JSON.stringify({ channel }),
      });
      setReceiptFeedback({ type: "success", text: result.message || "Receipt sent" });
    } catch (error) {
      setReceiptFeedback({ type: "error", text: error.message || "Failed to send receipt" });
    } finally {
      setReceiptAction("");
    }
  };

  const handlePrintReceipt = () => {
    if (!receiptCard) return;
    const printWindow = window.open("", "_blank", "width=720,height=850");
    if (!printWindow) {
      setErrorMessage("Allow pop-ups to print the receipt");
      return;
    }

    printWindow.document.write(`<!doctype html>
      <html><head><title>${escapeReceiptHtml(receiptCard.receipt_number)} - Gift Card Receipt</title>
      <style>
        *{box-sizing:border-box}html,body{width:3in;margin:0;padding:0}body{font-family:Arial,sans-serif;color:#111;background:#fff}.receipt{width:3in;margin:0 auto;padding:.18in}.brand{text-align:center;font-size:22px;font-weight:700;margin:0}.subtitle{text-align:center;font-size:14px;margin:3px 0 16px}.row{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;border-bottom:1px dashed #999;padding:8px 0;font-size:11px;line-height:1.3}.row span:last-child{max-width:1.65in;text-align:right;overflow-wrap:anywhere}.label{font-weight:700}.code{font-family:monospace;font-size:14px;font-weight:700;letter-spacing:1px}.thanks{text-align:center;margin:18px 0 0;font-size:10px;line-height:1.4}.receipt-number{text-align:center;margin:0 0 10px;font-size:10px;color:#555}@media print{@page{size:3in 7in;margin:0}html,body{width:3in}.receipt{padding:.18in}}
      </style></head><body><div class="receipt">
        <p class="brand">Nail Times</p><p class="subtitle">Gift Card Receipt</p>
        <p class="receipt-number">${escapeReceiptHtml(receiptCard.receipt_number)}</p>
        <div class="row"><span class="label">Customer</span><span>${escapeReceiptHtml(receiptCard.customer_name)}</span></div>
        <div class="row"><span class="label">Gift Card Code</span><span class="code">${escapeReceiptHtml(receiptCard.code)}</span></div>
        <div class="row"><span class="label">Original Amount</span><span>${formatMoney(receiptCard.issued_amount_cents)}</span></div>
        <div class="row"><span class="label">Date Issued</span><span>${escapeReceiptHtml(formatDate(receiptCard.created_at))}</span></div>
        <div class="row"><span class="label">Expiration Date</span><span>${escapeReceiptHtml(formatDate(receiptCard.expires_at))}</span></div>
        <p class="thanks">Present the gift card code when redeeming at Nail Times.</p>
      </div></body></html>`);
    printWindow.document.close();
    window.setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 250);
  };

  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    window.location.href = "/admin/login";
  };

  const inputClass = "w-full rounded-md border border-[#ddd] bg-white px-3 py-2 text-sm outline-none focus:border-[#c7668b]";

  return (
    <div className="mx-auto mt-[100px] max-w-[1400px] px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold text-[#c7668b]">Gift Cards</h1>
          <p className="mt-1 text-sm text-[#666]">Manage balances and transaction records.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link className="rounded-md border border-[#333] px-3 py-2 text-sm" to="/admin">Bookings</Link>
          <Link className="rounded-md border border-[#333] px-3 py-2 text-sm" to="/admin/messages">Messages</Link>
          <button className="rounded-md border border-[#333] px-3 py-2 text-sm" onClick={handleLogout}>Log Out</button>
        </div>
      </header>

      {errorMessage && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</p>}
      {successMessage && <p className="mt-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{successMessage}</p>}

      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg bg-white p-4 shadow-sm"><p className="text-xs font-semibold uppercase text-[#777]">Outstanding Balance</p><p className="mt-1 text-2xl font-semibold text-[#333]">{formatMoney(totals.balance)}</p></div>
        <div className="rounded-lg bg-white p-4 shadow-sm"><p className="text-xs font-semibold uppercase text-[#777]">Active Cards</p><p className="mt-1 text-2xl font-semibold text-[#333]">{totals.active}</p></div>
        <div className="rounded-lg bg-white p-4 shadow-sm"><p className="text-xs font-semibold uppercase text-[#777]">Total Records</p><p className="mt-1 text-2xl font-semibold text-[#333]">{cards.length}</p></div>
      </section>

      <div className="mt-4 flex justify-end">
        <button className="rounded-md bg-[#c7668b] px-4 py-2 text-sm font-semibold text-white" onClick={() => setShowCreate((value) => !value)}>
          {showCreate ? "Close Form" : "+ New Gift Card"}
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="mt-4 rounded-lg bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Create Gift Card</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <label className="text-sm font-medium">Customer name *<input className={`${inputClass} mt-1`} required value={createForm.customer_name} onChange={(event) => setCreateForm({ ...createForm, customer_name: event.target.value })} /></label>
            <label className="text-sm font-medium">Card code<input className={`${inputClass} mt-1 uppercase`} placeholder="Generated if blank" value={createForm.code} onChange={(event) => setCreateForm({ ...createForm, code: normalizeScannedCardCode(event.target.value) })} onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }} /></label>
            <label className="text-sm font-medium">Initial balance<input className={`${inputClass} mt-1`} type="number" min="0" step="0.01" placeholder="0.00" value={createForm.initial_balance} onChange={(event) => setCreateForm({ ...createForm, initial_balance: event.target.value })} /></label>
            <label className="text-sm font-medium">Email<input className={`${inputClass} mt-1`} type="email" value={createForm.customer_email} onChange={(event) => setCreateForm({ ...createForm, customer_email: event.target.value })} /></label>
            <label className="text-sm font-medium">Phone<input className={`${inputClass} mt-1`} value={createForm.customer_phone} onChange={(event) => setCreateForm({ ...createForm, customer_phone: event.target.value })} /></label>
            <label className="text-sm font-medium">Notes<input className={`${inputClass} mt-1`} value={createForm.notes} onChange={(event) => setCreateForm({ ...createForm, notes: event.target.value })} /></label>
          </div>
          <button disabled={isSaving} className="mt-4 rounded-md bg-[#c7668b] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{isSaving ? "Creating..." : "Create Card"}</button>
        </form>
      )}

      <section className="mt-6 rounded-lg bg-white p-4 shadow-sm">
        <div>
          <input className={inputClass} placeholder="Search code, name, email, or phone" value={search} onChange={(event) => setSearch(normalizeScannedCardCode(event.target.value))} />
          <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
            <label className="text-xs font-semibold uppercase text-[#777]">
              Status
              <select className={`${inputClass} mt-1 normal-case`} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="expired">Expired</option>
              </select>
            </label>
            <label className="text-xs font-semibold uppercase text-[#777]">
              Expiration
              <select className={`${inputClass} mt-1 normal-case`} value={expirationFilter} onChange={(event) => setExpirationFilter(event.target.value)}>
                <option value="all">Any date</option>
                <option value="expired">Already expired</option>
                <option value="30">Next 30 days</option>
                <option value="60">31–60 days</option>
                <option value="90">61–90 days</option>
                <option value="later">More than 90 days</option>
              </select>
            </label>
            <label className="text-xs font-semibold uppercase text-[#777]">
              Balance
              <select className={`${inputClass} mt-1 normal-case`} value={balanceFilter} onChange={(event) => setBalanceFilter(event.target.value)}>
                <option value="all">Any balance</option>
                <option value="positive">Has balance</option>
                <option value="zero">Zero balance</option>
                <option value="highest">Highest to lowest</option>
                <option value="lowest">Lowest to highest</option>
              </select>
            </label>
            <label className="text-xs font-semibold uppercase text-[#777]">
              Sort By
              <select className={`${inputClass} mt-1 normal-case`} value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="expiring">Expiring soon</option>
                <option value="name">Customer name</option>
              </select>
            </label>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-[#777]">
            <span>Showing {filteredCards.length} of {cards.length}</span>
            {hasActiveFilters && <button type="button" className="font-semibold text-[#b85279] hover:underline" onClick={clearFilters}>Clear filters</button>}
          </div>
          <div className="mt-4 overflow-x-auto rounded-lg border border-[#eee]">
            {isLoading && <p className="py-4 text-sm text-[#666]">Loading gift cards...</p>}
            {!isLoading && filteredCards.length === 0 && <p className="py-8 text-center text-sm text-[#666]">No gift cards found.</p>}
            {!isLoading && filteredCards.length > 0 && (
              <table className="w-full min-w-[1180px] text-left text-sm">
                <thead className="bg-[#fafafa] text-xs uppercase tracking-wide text-[#777]">
                  <tr>
                    <th className="px-4 py-3">Card Code</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Contact</th>
                    <th className="px-4 py-3 text-right">Balance</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Date Issued</th>
                    <th className="px-4 py-3">Expiration</th>
                    <th className="px-4 py-3">Time Left</th>
                    <th className="px-4 py-3 text-center">Transactions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eee]">
                  {filteredCards.map((card) => {
                    const cardStatus = getCardStatus(card, currentTime);
                    return (
                      <tr
                        key={card._id}
                        tabIndex="0"
                        onClick={() => setSelectedId(card._id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelectedId(card._id);
                          }
                        }}
                        className={`cursor-pointer transition focus:outline-none ${cardStatus === "expired" ? "bg-red-50/80 hover:bg-red-100 focus:bg-red-100" : "hover:bg-[#fff4f8] focus:bg-[#fff4f8]"}`}
                      >
                        <td className={`whitespace-nowrap px-4 py-4 font-mono font-semibold tracking-wide ${cardStatus === "expired" ? "text-red-800 line-through decoration-red-500" : "text-[#333]"}`}>{card.code}</td>
                        <td className="px-4 py-4 font-medium text-[#333]">{card.customer_name}</td>
                        <td className="px-4 py-4 text-[#666]"><p>{card.customer_email || "—"}</p>{card.customer_phone && <p>{card.customer_phone}</p>}</td>
                        <td className="whitespace-nowrap px-4 py-4 text-right font-semibold text-[#333]">{formatMoney(card.balance_cents)}</td>
                        <td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${cardStatus === "active" ? "bg-green-50 text-green-700" : cardStatus === "expired" ? "border border-red-300 bg-red-600 text-white" : "bg-gray-100 text-gray-600"}`}>{cardStatus}</span></td>
                        <td className="whitespace-nowrap px-4 py-4 text-[#666]">{formatDate(card.created_at)}</td>
                        <td className="whitespace-nowrap px-4 py-4 text-[#666]">{formatDate(card.expires_at)}</td>
                        <td className={`whitespace-nowrap px-4 py-4 font-medium ${cardStatus === "expired" ? "text-red-700" : "text-green-700"}`}>{formatTimeRemaining(card.expires_at, currentTime)}</td>
                        <td className="px-4 py-4 text-center text-[#666]">{card.transactions?.length || 0}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </section>

      {selectedCard && (
        <div className="fixed inset-x-0 bottom-0 top-[70px] z-[900] flex items-start justify-center overflow-hidden bg-black/50 p-3 sm:p-6" onMouseDown={() => setSelectedId("")}>
          <main className="flex max-h-full w-full max-w-[1150px] flex-col overflow-hidden rounded-xl bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
            <div className="z-20 flex shrink-0 justify-end border-b border-[#eee] bg-white px-5 py-3 sm:px-6">
              <button type="button" className="rounded-md border border-[#bbb] px-3 py-2 text-sm font-medium text-[#444] hover:bg-[#f7f7f7]" onClick={() => setSelectedId("")}>Close</button>
            </div>
            <div className="min-h-0 overflow-y-auto p-5 sm:p-6">
              {selectedStatus === "expired" && (
                <div className="mb-5 rounded-lg border-2 border-red-500 bg-red-50 px-5 py-4 text-center text-red-800 shadow-sm">
                  <p className="text-2xl font-extrabold uppercase tracking-widest">Expired Gift Card</p>
                  <p className="mt-1 text-sm font-semibold">Expired on {formatDate(selectedCard.expires_at)}. Credits and redemptions are permanently locked.</p>
                </div>
              )}
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#eee] pb-4">
                <div><p className="font-mono text-lg font-semibold tracking-wider">{selectedCard.code}</p><p className="mt-1 text-sm text-[#666]">Created {formatDate(selectedCard.created_at)}</p></div>
                <div className="text-right"><p className="text-xs font-semibold uppercase text-[#777]">Current Balance</p><p className="text-3xl font-semibold text-[#c7668b]">{formatMoney(selectedCard.balance_cents)}</p></div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-md border border-[#eee] bg-[#fafafa] p-3"><p className="text-xs font-semibold uppercase text-[#888]">Date Issued</p><p className="mt-1 text-sm font-medium text-[#333]">{formatDate(selectedCard.created_at)}</p></div>
                <div className="rounded-md border border-[#eee] bg-[#fafafa] p-3"><p className="text-xs font-semibold uppercase text-[#888]">Expiration Date</p><p className="mt-1 text-sm font-medium text-[#333]">{formatDate(selectedCard.expires_at)}</p></div>
                <div className={`rounded-md border p-3 ${selectedStatus === "expired" ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"}`}><p className="text-xs font-semibold uppercase text-[#888]">Time Remaining</p><p className={`mt-1 text-sm font-semibold ${selectedStatus === "expired" ? "text-red-700" : "text-green-700"}`}>{formatTimeRemaining(selectedCard.expires_at, currentTime)}</p></div>
              </div>

              <section className="mt-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold">Card Details</h2>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="rounded-md border border-[#bbb] px-3 py-1.5 text-sm font-medium text-[#444] hover:bg-[#f7f7f7]"
                      onClick={() => {
                        setReceiptFeedback(null);
                        setReceiptCard(selectedCard);
                      }}
                    >
                      Receipt
                    </button>
                    <button
                      type="button"
                      className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                      onClick={handleDelete}
                      disabled={isSaving}
                    >
                      Delete Card
                    </button>
                    <button
                      type="button"
                      className="rounded-md border border-[#d8a0b5] px-3 py-1.5 text-sm font-medium text-[#b85279] hover:bg-[#fff4f8]"
                      onClick={() => setIsEditing((value) => !value)}
                    >
                      {isEditing ? "Cancel" : "Edit"}
                    </button>
                  </div>
                </div>
                {isEditing ? (
                  <form onSubmit={handleEdit} className="mt-3 grid gap-3 md:grid-cols-2">
                    <label className="text-sm font-medium">Customer name *<input className={`${inputClass} mt-1`} required value={editForm.customer_name} onChange={(event) => setEditForm({ ...editForm, customer_name: event.target.value })} /></label>
                    <label className="text-sm font-medium">Card code *<input className={`${inputClass} mt-1 uppercase`} required value={editForm.code} onChange={(event) => setEditForm({ ...editForm, code: normalizeScannedCardCode(event.target.value) })} /></label>
                    <label className="text-sm font-medium">Email<input className={`${inputClass} mt-1`} type="email" value={editForm.customer_email} onChange={(event) => setEditForm({ ...editForm, customer_email: event.target.value })} /></label>
                    <label className="text-sm font-medium">Phone<input className={`${inputClass} mt-1`} value={editForm.customer_phone} onChange={(event) => setEditForm({ ...editForm, customer_phone: event.target.value })} /></label>
                    <label className="text-sm font-medium">Status<select className={`${inputClass} mt-1`} value={selectedStatus === "expired" ? "expired" : editForm.status} disabled={selectedStatus === "expired"} onChange={(event) => setEditForm({ ...editForm, status: event.target.value })}><option value="active">Active</option><option value="inactive">Inactive</option>{selectedStatus === "expired" && <option value="expired">Expired</option>}</select></label>
                    <label className="text-sm font-medium">Notes<input className={`${inputClass} mt-1`} value={editForm.notes} onChange={(event) => setEditForm({ ...editForm, notes: event.target.value })} /></label>
                    <div className="flex gap-2 md:col-span-2"><button disabled={isSaving} className="rounded-md bg-[#c7668b] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Save Changes</button></div>
                  </form>
                ) : (
                  <div className="mt-3 grid gap-3 rounded-md bg-[#fafafa] p-4 text-sm sm:grid-cols-2"><div><p className="text-xs uppercase text-[#888]">Customer</p><p className="font-medium">{selectedCard.customer_name}</p></div><div><p className="text-xs uppercase text-[#888]">Status</p><p className={`font-medium capitalize ${selectedStatus === "expired" ? "text-red-700" : ""}`}>{selectedStatus}</p></div><div><p className="text-xs uppercase text-[#888]">Email</p><p>{selectedCard.customer_email || "—"}</p></div><div><p className="text-xs uppercase text-[#888]">Phone</p><p>{selectedCard.customer_phone || "—"}</p></div>{selectedCard.notes && <div className="sm:col-span-2"><p className="text-xs uppercase text-[#888]">Notes</p><p className="whitespace-pre-line">{selectedCard.notes}</p></div>}</div>
                )}
              </section>

              {selectedStatus === "expired" ? (
                <section className="mt-6 rounded-lg border-2 border-red-300 bg-red-50 p-6 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-600 text-2xl font-bold text-white">!</div>
                  <h2 className="mt-3 text-xl font-bold text-red-800">Transactions Locked</h2>
                  <p className="mt-1 text-sm text-red-700">No funds can be added to or redeemed from this expired gift card.</p>
                </section>
              ) : (
                <section className="mt-6 rounded-lg border border-[#eed5df] bg-[#fff9fb] p-4">
                  <h2 className="text-lg font-semibold">New Transaction</h2>
                  <form onSubmit={handleTransaction} className="mt-3 grid gap-3 md:grid-cols-[160px_160px_1fr_auto] md:items-end">
                    <label className="text-sm font-medium">Type<select className={`${inputClass} mt-1`} value={transaction.type} onChange={(event) => setTransaction({ ...transaction, type: event.target.value })}><option value="debit">Redeem</option><option value="credit">Add balance</option></select></label>
                    <label className="text-sm font-medium">Amount<input className={`${inputClass} mt-1`} required type="number" min="0.01" step="0.01" placeholder="0.00" value={transaction.amount} onChange={(event) => setTransaction({ ...transaction, amount: event.target.value })} /></label>
                    <label className="text-sm font-medium">Note<input className={`${inputClass} mt-1`} maxLength="500" placeholder="Service, receipt, or reason" value={transaction.note} onChange={(event) => setTransaction({ ...transaction, note: event.target.value })} /></label>
                    <button disabled={isSaving || selectedStatus !== "active"} className="rounded-md bg-[#c7668b] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{isSaving ? "Saving..." : "Record"}</button>
                  </form>
                  {selectedStatus === "inactive" && <p className="mt-2 text-xs text-amber-700">Set this card to active before recording a transaction.</p>}
                </section>
              )}

              <section className="mt-6">
                <h2 className="text-lg font-semibold">Transaction History</h2>
                <div className="mt-3 overflow-x-auto rounded-lg border border-[#eee]">
                  <table className="w-full min-w-[620px] text-left text-sm"><thead className="bg-[#fafafa] text-xs uppercase text-[#777]"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Note</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3 text-right">Balance</th></tr></thead>
                    <tbody className="divide-y divide-[#eee]">{(!selectedCard.transactions || selectedCard.transactions.length === 0) && <tr><td colSpan="5" className="px-4 py-6 text-center text-[#777]">No transactions yet.</td></tr>}{[...(selectedCard.transactions || [])].reverse().map((item) => <tr key={item._id}><td className="whitespace-nowrap px-4 py-3 text-[#666]">{formatDate(item.created_at)}</td><td className="px-4 py-3 font-medium capitalize">{item.type === "debit" ? "Redeem" : "Credit"}</td><td className="px-4 py-3 text-[#555]">{item.note || "—"}</td><td className={`px-4 py-3 text-right font-semibold ${item.type === "debit" ? "text-red-600" : "text-green-700"}`}>{item.type === "debit" ? "−" : "+"}{formatMoney(item.amount_cents)}</td><td className="px-4 py-3 text-right">{formatMoney(item.balance_after_cents)}</td></tr>)}</tbody>
                  </table>
                </div>
              </section>
            </div>
          </main>
        </div>
      )}

      {receiptCard && (
        <div className="fixed inset-x-0 bottom-0 top-[70px] z-[950] flex items-start justify-center overflow-hidden bg-black/55 p-3 sm:p-6" onMouseDown={() => setReceiptCard(null)}>
          <section className="flex max-h-full w-full max-w-[680px] flex-col overflow-hidden rounded-xl bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex shrink-0 items-center justify-between border-b border-[#eee] bg-white px-5 py-3 sm:px-6">
              <h2 className="text-lg font-semibold text-[#333]">Gift Card Receipt</h2>
              <button type="button" className="rounded-md border border-[#bbb] px-3 py-2 text-sm text-[#444]" onClick={() => setReceiptCard(null)}>Close</button>
            </div>
            <div className="min-h-0 overflow-y-auto p-5 sm:p-6">
              <div className="rounded-lg border border-[#e5d5dc] p-5 sm:p-7">
                <div className="border-b border-[#eee] pb-5 text-center">
                  <p className="text-3xl font-semibold text-[#c7668b]">Nail Times</p>
                  <p className="mt-1 text-lg text-[#555]">Gift Card Receipt</p>
                  <p className="mt-2 text-sm text-[#777]">{receiptCard.receipt_number}</p>
                </div>
                <div className="divide-y divide-[#eee] text-sm">
                  <div className="flex justify-between gap-4 py-3"><span className="font-semibold text-[#555]">Customer</span><span className="text-right">{receiptCard.customer_name}</span></div>
                  <div className="flex items-center justify-between gap-4 py-3"><span className="font-semibold text-[#555]">Gift Card Code</span><span className="font-mono text-lg font-semibold tracking-wider">{receiptCard.code}</span></div>
                  <div className="flex justify-between gap-4 py-3"><span className="font-semibold text-[#555]">Original Amount</span><span className="text-lg font-semibold">{formatMoney(receiptCard.issued_amount_cents)}</span></div>
                  <div className="flex justify-between gap-4 py-3"><span className="font-semibold text-[#555]">Date Issued</span><span className="text-right">{formatDate(receiptCard.created_at)}</span></div>
                  <div className="flex justify-between gap-4 py-3"><span className="font-semibold text-[#555]">Expiration Date</span><span className="text-right">{formatDate(receiptCard.expires_at)}</span></div>
                </div>
                <p className="mt-5 text-center text-sm text-[#666]">Present the gift card code when redeeming at Nail Times.</p>
              </div>

              {receiptFeedback && <p className={`mt-4 rounded-md px-3 py-2 text-sm ${receiptFeedback.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{receiptFeedback.text}</p>}

              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <button type="button" disabled={!receiptCard.customer_phone || Boolean(receiptAction)} onClick={() => handleSendReceipt("text")} className="rounded-md bg-[#c7668b] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45">{receiptAction === "text" ? "Sending..." : "Text Receipt"}</button>
                <button type="button" disabled={!receiptCard.customer_email || Boolean(receiptAction)} onClick={() => handleSendReceipt("email")} className="rounded-md bg-[#c7668b] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45">{receiptAction === "email" ? "Sending..." : "Email Receipt"}</button>
                <button type="button" disabled={Boolean(receiptAction)} onClick={() => handleSendReceipt("printer")} className="rounded-md bg-[#333] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45">{receiptAction === "printer" ? "Queuing..." : "Print to Salon Printer"}</button>
                <button type="button" disabled={Boolean(receiptAction)} onClick={handlePrintReceipt} className="rounded-md border border-[#333] px-4 py-3 text-sm font-semibold text-[#333] disabled:opacity-45">Browser Print</button>
              </div>
              {!receiptCard.customer_phone && <p className="mt-3 text-xs text-[#777]">Add a phone number to the card to enable texting.</p>}
              {!receiptCard.customer_email && <p className="mt-1 text-xs text-[#777]">Add an email address to the card to enable emailing.</p>}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
