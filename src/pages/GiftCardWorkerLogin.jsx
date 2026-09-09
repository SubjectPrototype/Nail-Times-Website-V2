import React, { useState } from "react";

export default function GiftCardWorkerLogin() {
  const apiBaseUrl =
    process.env.REACT_APP_API_URL || `${window.location.protocol}//${window.location.hostname}:4000`;
  const [pin, setPin] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const response = await fetch(`${apiBaseUrl}/api/giftcard/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Unable to sign in");
      }

      localStorage.setItem("giftCardWorkerToken", data.token);
      window.location.href = "/giftcard";
    } catch (error) {
      setErrorMessage(
        error instanceof TypeError
          ? `Cannot reach the gift-card server at ${apiBaseUrl}.`
          : error.message || "Unable to sign in"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="mx-auto mt-[120px] max-w-[440px] rounded-xl bg-white p-6 shadow-[0_4px_18px_rgba(0,0,0,0.12)]">
      <h1 className="text-2xl font-semibold text-[#c7668b]">Gift Card Access</h1>
      <p className="mt-2 text-sm text-[#666]">Enter the employee PIN to manage gift-card transactions.</p>
      <form className="mt-5 flex flex-col gap-4" onSubmit={handleSubmit}>
        <label className="text-sm font-medium text-[#444]">
          Employee PIN
          <input
            autoFocus
            className="mt-1 w-full rounded-md border border-[#ccc] p-3 outline-none focus:border-[#c7668b]"
            inputMode="numeric"
            type="password"
            autoComplete="current-password"
            minLength="4"
            maxLength="64"
            value={pin}
            onChange={(event) => setPin(event.target.value)}
            required
          />
        </label>
        {errorMessage && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</p>}
        <button disabled={isSubmitting} className="rounded-md bg-[#c7668b] p-3 font-semibold text-white disabled:opacity-60">
          {isSubmitting ? "Signing in..." : "Open Gift Cards"}
        </button>
      </form>
    </main>
  );
}
