import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

function formatBookingDateTime(dateInput) {
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString("en-US", {
    dateStyle: "full",
    timeStyle: "short",
  });
}

export default function BookingCancel() {
  const { token } = useParams();
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("Checking your appointment...");
  const [booking, setBooking] = useState(null);
  const [canCancel, setCanCancel] = useState(false);
  const apiBaseUrl =
    process.env.REACT_APP_API_URL || `${window.location.protocol}//${window.location.hostname}:4000`;

  const bookingSummary = useMemo(() => {
    if (!booking) {
      return "";
    }

    const dateText = formatBookingDateTime(booking.start_time);
    return dateText ? `${booking.customer_name} - ${dateText}` : booking.customer_name || "";
  }, [booking]);

  useEffect(() => {
    let isMounted = true;

    const run = async () => {
      if (!token) {
        if (!isMounted) return;
        setStatus("error");
        setMessage("Invalid cancellation link.");
        return;
      }

      try {
        const response = await fetch(`${apiBaseUrl}/api/bookings/cancel/${encodeURIComponent(token)}`);

        const data = await response.json().catch(() => ({}));
        if (!isMounted) return;

        if (!response.ok) {
          setStatus("error");
          setMessage(data.error || "Could not cancel this appointment.");
          return;
        }

        setBooking(data.booking || null);
        if (data.already_cancelled) {
          setStatus("success");
          setMessage("This appointment was already cancelled.");
          setCanCancel(false);
          return;
        }

        setStatus("ready");
        setCanCancel(Boolean(data.can_cancel));
        setMessage("Confirm below to cancel this appointment.");
      } catch (error) {
        if (!isMounted) return;
        setStatus("error");
        setMessage("Could not cancel this appointment.");
      }
    };

    run();
    return () => {
      isMounted = false;
    };
  }, [apiBaseUrl, token]);

  const handleCancel = async () => {
    if (!token || !canCancel || status === "submitting") {
      return;
    }

    setStatus("submitting");
    setMessage("Cancelling your appointment...");
    try {
      const response = await fetch(`${apiBaseUrl}/api/bookings/cancel/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setStatus("error");
        setMessage(data.error || "Could not cancel this appointment.");
        return;
      }

      setBooking(data.booking || booking);
      setCanCancel(false);
      setStatus("success");
      setMessage(data.already_cancelled ? "This appointment was already cancelled." : "Your appointment has been cancelled.");
    } catch (error) {
      setStatus("error");
      setMessage("Could not cancel this appointment.");
    }
  };

  return (
    <main className="mx-auto w-full max-w-xl px-4 pt-28 pb-12">
      <section className="rounded-2xl border border-[#f0d5df] bg-white/95 p-6 text-center shadow-sm">
        <h1 className="text-3xl font-bold text-[#c76092]">Appointment Cancellation</h1>
        <p className="mt-4 text-base text-[#444]">{message}</p>
        {status === "loading" ? <p className="mt-3 text-sm text-[#777]">Please wait...</p> : null}
        {status === "ready" && canCancel ? (
          <button
            type="button"
            onClick={handleCancel}
            className="mt-5 w-full rounded-full bg-[#e35e6d] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#cf4e5e]"
          >
            Cancel Appointment
          </button>
        ) : null}
        {status === "submitting" ? <p className="mt-3 text-sm text-[#777]">Please wait...</p> : null}
        {status === "success" && bookingSummary ? (
          <p className="mt-4 text-sm font-medium text-[#333]">{bookingSummary}</p>
        ) : null}
        <div className="mt-6">
          <Link
            to="/services"
            className="inline-flex rounded-full bg-black px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#222]"
          >
            Book Another Appointment
          </Link>
        </div>
      </section>
    </main>
  );
}
