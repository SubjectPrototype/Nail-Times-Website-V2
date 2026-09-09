import React, { useEffect, useRef, useState } from "react";

function normalizeCardCode(value) {
  return String(value || "")
    .replace(/^%+/, "")
    .replace(/\?+$/, "")
    .trim()
    .toUpperCase();
}

function formatMoney(cents) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(cents || 0) / 100);
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

function cardStatus(card) {
  if (card?.expires_at && new Date(card.expires_at) <= new Date()) return "expired";
  return card?.status || "active";
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const actions = [
  { id: "issue", title: "Issue New Card", description: "Create and activate a gift card", symbol: "G" },
  { id: "debit", title: "Redeem", description: "Use funds from a gift card", symbol: "−" },
  { id: "credit", title: "Add Balance", description: "Add funds to a gift card", symbol: "+" },
  { id: "balance", title: "Check Balance", description: "View the current card balance", symbol: "$" },
];

export default function GiftCardWorker() {
  const apiBaseUrl =
    process.env.REACT_APP_API_URL || `${window.location.protocol}//${window.location.hostname}:4000`;
  const token = localStorage.getItem("giftCardWorkerToken");
  const [action, setAction] = useState("");
  const [code, setCode] = useState("");
  const [card, setCard] = useState(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [createForm, setCreateForm] = useState({ code: "", customer_name: "", customer_email: "", customer_phone: "", notes: "", initial_balance: "" });
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [receiptAction, setReceiptAction] = useState("");
  const [receiptFeedback, setReceiptFeedback] = useState("");
  const cardIdInputRef = useRef(null);

  useEffect(() => {
    if (!action || receipt || (action !== "issue" && card)) return undefined;
    const focusTimer = window.setTimeout(() => cardIdInputRef.current?.focus(), 0);
    return () => window.clearTimeout(focusTimer);
  }, [action, card, receipt]);

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
    if (response.status === 401) {
      localStorage.removeItem("giftCardWorkerToken");
      window.location.href = "/giftcard";
      throw new Error("Worker session expired");
    }
    if (!response.ok) throw new Error(data.error || "Request failed");
    return data;
  };

  const resetCard = () => {
    setCard(null);
    setCode("");
    setAmount("");
    setNote("");
    setErrorMessage("");
  };

  const chooseAction = (nextAction) => {
    setAction(nextAction);
    resetCard();
  };

  const handleLookup = async (event) => {
    event.preventDefault();
    const normalizedCode = normalizeCardCode(code);
    setCode(normalizedCode);
    setErrorMessage("");
    setCard(null);
    setIsLoading(true);
    try {
      setCard(await apiRequest(`/api/gift-cards/lookup?code=${encodeURIComponent(normalizedCode)}`));
    } catch (error) {
      setErrorMessage(error.message || "Gift card not found");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTransaction = async (event) => {
    event.preventDefault();
    if (!card || !["credit", "debit"].includes(action)) return;
    setErrorMessage("");
    setIsLoading(true);
    try {
      const updatedCard = await apiRequest(`/api/gift-cards/${card._id}/transactions`, {
        method: "POST",
        body: JSON.stringify({ type: action, amount, note }),
      });
      setCard(updatedCard);
      setAmount("");
      setNote("");
      setReceiptFeedback("");
      setReceipt({
        card: updatedCard,
        transaction: updatedCard.transaction_receipt || updatedCard.transactions?.[updatedCard.transactions.length - 1],
      });
    } catch (error) {
      setErrorMessage(error.message || "Failed to record transaction");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    setErrorMessage("");
    setIsLoading(true);
    try {
      const newCard = await apiRequest("/api/gift-cards", {
        method: "POST",
        body: JSON.stringify({ ...createForm, code: normalizeCardCode(createForm.code) }),
      });
      setCreateForm({ code: "", customer_name: "", customer_email: "", customer_phone: "", notes: "", initial_balance: "" });
      setReceiptFeedback("");
      setReceipt({ card: newCard, transaction: null });
    } catch (error) {
      setErrorMessage(error.message || "Failed to create gift card");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReceiptDelivery = async (channel) => {
    if (!receipt?.card) return;
    setReceiptAction(channel);
    setReceiptFeedback("");
    try {
      const result = await apiRequest(`/api/gift-cards/${receipt.card._id}/receipt`, {
        method: "POST",
        body: JSON.stringify({ channel, transaction_id: receipt.transaction?._id }),
      });
      setReceiptFeedback(result.message || "Receipt sent");
    } catch (error) {
      setReceiptFeedback(error.message || "Failed to send receipt");
    } finally {
      setReceiptAction("");
    }
  };

  const handleBrowserPrint = () => {
    if (!receipt?.card) return;
    const transaction = receipt.transaction;
    const previousBalance = transaction
      ? transaction.type === "debit"
        ? transaction.balance_after_cents + transaction.amount_cents
        : transaction.balance_after_cents - transaction.amount_cents
      : 0;
    const receiptNumber = transaction?.receipt_number || receipt.card.receipt_number;
    const receiptTitle = transaction ? "Gift Card Transaction Receipt" : "Gift Card Receipt";
    const receiptDetails = transaction
      ? `<div class="row"><span class="label">Transaction</span><span>${transaction.type === "debit" ? "Redeemed" : "Added"}</span></div><div class="row"><span class="label">Amount</span><span>${formatMoney(transaction.amount_cents)}</span></div><div class="row"><span class="label">Previous Balance</span><span>${formatMoney(previousBalance)}</span></div><div class="row"><span class="label">New Balance</span><span>${formatMoney(transaction.balance_after_cents)}</span></div><div class="row"><span class="label">Date</span><span>${escapeHtml(formatDate(transaction.created_at))}</span></div><div class="row"><span class="label">Note</span><span>${escapeHtml(transaction.note || "—")}</span></div>`
      : `<div class="row"><span class="label">Customer</span><span>${escapeHtml(receipt.card.customer_name)}</span></div><div class="row"><span class="label">Original Amount</span><span>${formatMoney(receipt.card.issued_amount_cents)}</span></div><div class="row"><span class="label">Issued</span><span>${escapeHtml(formatDate(receipt.card.created_at))}</span></div><div class="row"><span class="label">Expires</span><span>${escapeHtml(formatDate(receipt.card.expires_at))}</span></div>`;
    const printWindow = window.open("", "_blank", "width=500,height=800");
    if (!printWindow) return;
    printWindow.document.write(`<!doctype html><html><head><title>${escapeHtml(receiptNumber)}</title><style>*{box-sizing:border-box}html,body{width:3in;margin:0}body{font-family:Arial,sans-serif}.receipt{width:3in;padding:.18in}.center{text-align:center}.brand{font-size:22px;font-weight:700}.row{display:flex;justify-content:space-between;gap:10px;border-bottom:1px dashed #999;padding:8px 0;font-size:11px}.row span:last-child{text-align:right;overflow-wrap:anywhere}.label{font-weight:700}@media print{@page{size:3in 7in;margin:0}}</style></head><body><div class="receipt"><div class="center"><div class="brand">Nail Times</div><p>${receiptTitle}</p><small>${escapeHtml(receiptNumber)}</small></div><div class="row"><span class="label">Gift Card</span><span>${escapeHtml(receipt.card.code)}</span></div>${receiptDetails}</div></body></html>`);
    printWindow.document.close();
    window.setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 250);
  };

  const status = cardStatus(card);
  const selectedAction = actions.find((item) => item.id === action);

  return (
    <main className="mx-auto mt-[100px] max-w-[760px] px-4 py-8">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-[#c7668b]">Gift Cards</h1>
          <p className="mt-1 text-sm text-[#666]">Choose an action to begin.</p>
        </div>
        <button type="button" className="rounded-md border border-[#555] px-3 py-2 text-sm" onClick={() => { localStorage.removeItem("giftCardWorkerToken"); window.location.href = "/giftcard"; }}>Log Out</button>
      </header>

      {!action ? (
        <section className="mt-8 grid gap-4 sm:grid-cols-2">
          {actions.map((item) => (
            <button key={item.id} type="button" onClick={() => chooseAction(item.id)} className="min-h-[180px] rounded-xl border border-[#ead5dd] bg-white p-6 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-[#c7668b] hover:shadow-md">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#fff0f5] text-3xl font-bold text-[#c7668b]">{item.symbol}</span>
              <span className="mt-4 block text-xl font-semibold">{item.title}</span>
              <span className="mt-2 block text-sm text-[#666]">{item.description}</span>
            </button>
          ))}
        </section>
      ) : (
        <section className="mt-8 rounded-xl bg-white p-5 shadow-md sm:p-7">
          <div className="flex items-center justify-between gap-3">
            <div><p className="text-sm font-semibold uppercase tracking-wide text-[#c7668b]">{selectedAction?.title}</p><h2 className="mt-1 text-xl font-semibold">{action === "issue" ? "Enter the new gift card details" : "Scan or enter the gift card"}</h2></div>
            <button type="button" className="rounded-md border border-[#bbb] px-3 py-2 text-sm" onClick={() => setAction("")}>Back</button>
          </div>

          {action !== "issue" && <form className="mt-5 flex flex-col gap-3 sm:flex-row" onSubmit={handleLookup}>
            <input ref={cardIdInputRef} autoFocus required className="min-w-0 flex-1 rounded-md border border-[#ccc] px-4 py-3 font-mono text-lg uppercase tracking-wide outline-none focus:border-[#c7668b]" placeholder="Swipe or enter card ID" value={code} onChange={(event) => setCode(normalizeCardCode(event.target.value))} />
            <button disabled={isLoading} className="rounded-md bg-[#333] px-6 py-3 font-semibold text-white disabled:opacity-50">{isLoading ? "Looking..." : "Find Card"}</button>
          </form>}

          {action === "issue" && (
            <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={handleCreate}>
              <label className="text-sm font-semibold">Customer Name *<input required className="mt-1 w-full rounded-md border border-[#ccc] px-4 py-3 outline-none focus:border-[#c7668b]" value={createForm.customer_name} onChange={(event) => setCreateForm({ ...createForm, customer_name: event.target.value })} /></label>
              <label className="text-sm font-semibold">Card ID *<input ref={cardIdInputRef} required autoFocus className="mt-1 w-full rounded-md border border-[#ccc] px-4 py-3 font-mono uppercase outline-none focus:border-[#c7668b]" placeholder="Swipe a blank card to enter its ID" value={createForm.code} onChange={(event) => setCreateForm({ ...createForm, code: normalizeCardCode(event.target.value) })} onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }} /></label>
              <label className="text-sm font-semibold">Initial Balance<input required type="number" min="0" step="0.01" className="mt-1 w-full rounded-md border border-[#ccc] px-4 py-3 outline-none focus:border-[#c7668b]" placeholder="0.00" value={createForm.initial_balance} onChange={(event) => setCreateForm({ ...createForm, initial_balance: event.target.value })} /></label>
              <label className="text-sm font-semibold">Phone<input className="mt-1 w-full rounded-md border border-[#ccc] px-4 py-3 outline-none focus:border-[#c7668b]" value={createForm.customer_phone} onChange={(event) => setCreateForm({ ...createForm, customer_phone: event.target.value })} /></label>
              <label className="text-sm font-semibold">Email<input type="email" className="mt-1 w-full rounded-md border border-[#ccc] px-4 py-3 outline-none focus:border-[#c7668b]" value={createForm.customer_email} onChange={(event) => setCreateForm({ ...createForm, customer_email: event.target.value })} /></label>
              <label className="text-sm font-semibold">Notes<input maxLength="1000" className="mt-1 w-full rounded-md border border-[#ccc] px-4 py-3 outline-none focus:border-[#c7668b]" value={createForm.notes} onChange={(event) => setCreateForm({ ...createForm, notes: event.target.value })} /></label>
              <button disabled={isLoading} className="rounded-md bg-[#c7668b] px-5 py-4 text-lg font-bold text-white disabled:opacity-50 sm:col-span-2">{isLoading ? "Creating..." : "Create Gift Card"}</button>
            </form>
          )}

          {errorMessage && <p className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{errorMessage}</p>}

          {card && (
            <div className="mt-6">
              <div className={`rounded-xl border-2 p-5 text-center ${status === "expired" ? "border-red-500 bg-red-50" : status === "inactive" ? "border-amber-400 bg-amber-50" : "border-green-300 bg-green-50"}`}>
                <p className="font-mono text-lg font-semibold tracking-wide">{card.code}</p>
                <p className="mt-1 text-sm text-[#666]">{card.customer_name}</p>
                <p className="mt-4 text-sm font-semibold uppercase text-[#666]">Current Balance</p>
                <p className="mt-1 text-5xl font-bold text-[#333]">{formatMoney(card.balance_cents)}</p>
                <p className={`mt-4 text-sm font-bold uppercase ${status === "active" ? "text-green-700" : "text-red-700"}`}>{status}</p>
                {status === "expired" && <p className="mt-1 text-sm text-red-700">Expired {formatDate(card.expires_at)}. Transactions are locked.</p>}
              </div>

              {["credit", "debit"].includes(action) && status === "active" && (
                <form className="mt-5 space-y-4" onSubmit={handleTransaction}>
                  <label className="block text-sm font-semibold">{action === "debit" ? "Redeem Amount" : "Amount to Add"}<input required type="number" min="0.01" step="0.01" className="mt-1 w-full rounded-md border border-[#ccc] px-4 py-3 text-xl outline-none focus:border-[#c7668b]" placeholder="0.00" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
                  <label className="block text-sm font-semibold">Note<input maxLength="500" className="mt-1 w-full rounded-md border border-[#ccc] px-4 py-3 outline-none focus:border-[#c7668b]" placeholder="Service or reason" value={note} onChange={(event) => setNote(event.target.value)} /></label>
                  <button disabled={isLoading} className={`w-full rounded-md px-5 py-4 text-lg font-bold text-white disabled:opacity-50 ${action === "debit" ? "bg-[#c7668b]" : "bg-green-700"}`}>{isLoading ? "Recording..." : action === "debit" ? `Redeem ${amount ? `$${amount}` : "Balance"}` : `Add ${amount ? `$${amount}` : "Balance"}`}</button>
                </form>
              )}

              <button type="button" className="mt-4 w-full rounded-md border border-[#999] px-4 py-3 font-semibold" onClick={resetCard}>Use Another Card</button>
            </div>
          )}
        </section>
      )}

      {receipt?.card && (
        <div className="fixed inset-x-0 bottom-0 top-[70px] z-[950] flex items-start justify-center overflow-y-auto bg-black/55 p-4">
          <section className="my-auto w-full max-w-[560px] rounded-xl bg-white p-6 shadow-2xl">
            <div className="text-center"><h2 className="text-2xl font-semibold text-[#c7668b]">{receipt.transaction ? "Transaction Complete" : "Gift Card Created"}</h2><p className="mt-2 text-sm text-[#666]">{receipt.transaction?.receipt_number || receipt.card.receipt_number}</p></div>
            <div className="mt-5 divide-y divide-[#eee] rounded-lg border border-[#eee] px-4 text-sm">
              <div className="flex justify-between py-3"><strong>Gift Card</strong><span className="font-mono">{receipt.card.code}</span></div>
              {receipt.transaction ? <><div className="flex justify-between py-3"><strong>Transaction</strong><span>{receipt.transaction.type === "debit" ? "Redeemed" : "Added"}</span></div><div className="flex justify-between py-3"><strong>Amount</strong><span>{formatMoney(receipt.transaction.amount_cents)}</span></div><div className="flex justify-between py-3"><strong>New Balance</strong><span className="font-semibold">{formatMoney(receipt.transaction.balance_after_cents)}</span></div></> : <><div className="flex justify-between py-3"><strong>Customer</strong><span>{receipt.card.customer_name}</span></div><div className="flex justify-between py-3"><strong>Initial Balance</strong><span className="font-semibold">{formatMoney(receipt.card.issued_amount_cents)}</span></div><div className="flex justify-between py-3"><strong>Expires</strong><span>{formatDate(receipt.card.expires_at)}</span></div></>}
            </div>
            {receiptFeedback && <p className="mt-4 rounded-md bg-[#f5f5f5] px-3 py-2 text-center text-sm">{receiptFeedback}</p>}
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <button disabled={Boolean(receiptAction) || !receipt.card.customer_phone} onClick={() => handleReceiptDelivery("text")} className="rounded-md bg-[#c7668b] px-4 py-3 font-semibold text-white disabled:opacity-40">Text Receipt</button>
              <button disabled={Boolean(receiptAction) || !receipt.card.customer_email} onClick={() => handleReceiptDelivery("email")} className="rounded-md bg-[#c7668b] px-4 py-3 font-semibold text-white disabled:opacity-40">Email Receipt</button>
              <button disabled={Boolean(receiptAction)} onClick={() => handleReceiptDelivery("printer")} className="rounded-md bg-[#333] px-4 py-3 font-semibold text-white disabled:opacity-40">Print to Salon Printer</button>
              <button disabled={Boolean(receiptAction)} onClick={handleBrowserPrint} className="rounded-md border border-[#333] px-4 py-3 font-semibold">Browser Print</button>
            </div>
            <button type="button" className="mt-3 w-full rounded-md border border-[#aaa] px-4 py-3 font-semibold" onClick={() => { setReceipt(null); resetCard(); }}>Done</button>
          </section>
        </div>
      )}
    </main>
  );
}
