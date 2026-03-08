import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useCart } from "../context/CartContext";

export default function Checkout() {
  const { cartItems, setCartItems } = useCart();
  const nowForDefaultDate = new Date();
  const defaultDate = `${nowForDefaultDate.getFullYear()}-${String(nowForDefaultDate.getMonth() + 1).padStart(2, "0")}-${String(nowForDefaultDate.getDate()).padStart(2, "0")}`;
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [selectedDate, setSelectedDate] = useState(defaultDate);
  const [selectedTime, setSelectedTime] = useState("");
  const [weekOffset, setWeekOffset] = useState(0);
  const [notes, setNotes] = useState("");
  const [smsConsent, setSmsConsent] = useState(false);
  const [bookedRanges, setBookedRanges] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedCancelUrl, setSubmittedCancelUrl] = useState("");
  const apiBaseUrl =
    process.env.REACT_APP_API_URL || `${window.location.protocol}//${window.location.hostname}:4000`;
  const getItemDurationMinutes = (item) => Number(item.durationMinutes || Number(item.timeValue || 0) * 15 || 0);
  const technicianOffDays = {
    Thy: [2], // Tuesday
    Jenny: [4], // Thursday
    Tina: [0], // Sunday
    Cindy: [1], // Monday
    CK: [0], // Sunday
    Kim: [5], // Friday
  };

  const total = cartItems.reduce((sum, item) => sum + item.price, 0);
  const totalDurationMinutes = cartItems.reduce((sum, item) => sum + getItemDurationMinutes(item), 0);
  const effectiveDurationMinutes = totalDurationMinutes > 0 ? totalDurationMinutes : 60;
  const availabilityDurationMinutes = cartItems.length > 0 ? effectiveDurationMinutes : 15;
  const displayDurationMinutes = cartItems.length > 0 ? effectiveDurationMinutes : 0;
  const days = useMemo(() => {
    const now = new Date();
    const list = [];
    for (let i = 0; i < 7; i += 1) {
      const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + weekOffset * 7 + i);
      const y = day.getFullYear();
      const m = String(day.getMonth() + 1).padStart(2, "0");
      const d = String(day.getDate()).padStart(2, "0");
      list.push({
        iso: `${y}-${m}-${d}`,
        weekday: day.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase(),
        day: day.getDate(),
      });
    }
    return list;
  }, [weekOffset]);
  const selectedTechnicians = useMemo(
    () =>
      cartItems
        .map((item) => item.technician)
        .filter((technician) => technician && technician !== "Any"),
    [cartItems]
  );
  const unavailableDateSet = useMemo(() => {
    const blocked = new Set();
    if (selectedTechnicians.length === 0) {
      return blocked;
    }

    for (const day of days) {
      const weekday = new Date(`${day.iso}T00:00:00`).getDay();
      const blockedForAnySelectedTech = selectedTechnicians.some((technician) =>
        (technicianOffDays[technician] || []).includes(weekday)
      );
      if (blockedForAnySelectedTech) {
        blocked.add(day.iso);
      }
    }

    return blocked;
  }, [days, selectedTechnicians]);

  const getBusinessHoursForDate = (dateIso) => {
    const weekday = dateIso ? new Date(`${dateIso}T00:00:00`).getDay() : new Date().getDay();
    const dayHours = {
      0: { start: 12 * 60, end: 18 * 60 }, // Sunday 12:00 PM - 6:00 PM
      6: { start: 9 * 60, end: 19 * 60 }, // Saturday 9:00 AM - 7:00 PM
    };
    const defaultHours = { start: 9 * 60, end: 19 * 60 + 30 }; // Mon-Fri 9:00 AM - 7:30 PM
    return dayHours[weekday] || defaultHours;
  };

  const timeSlots = useMemo(() => {
    const hours = getBusinessHoursForDate(selectedDate);
    const list = [];
    for (let minutes = hours.start; minutes <= hours.end; minutes += 15) {
      const hour = String(Math.floor(minutes / 60)).padStart(2, "0");
      const minute = String(minutes % 60).padStart(2, "0");
      list.push(`${hour}:${minute}`);
    }
    return list;
  }, [selectedDate]);

  const toDisplayTime = (timeValue) => {
    const [h, m] = timeValue.split(":").map(Number);
    const period = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 || 12;
    return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
  };

  const isPastSlot = (dateIso, timeValue) => {
    if (!dateIso) return false;
    const now = new Date();
    const [h, m] = timeValue.split(":").map(Number);
    const slot = new Date(`${dateIso}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`);
    return slot < now;
  };

  const visibleTimeSlots = timeSlots.filter((slot) => !isPastSlot(selectedDate, slot));

  const getSlotDate = (dateIso, timeValue) => {
    const [h, m] = timeValue.split(":").map(Number);
    return new Date(`${dateIso}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`);
  };

  const exceedsClosingTime = (dateIso, timeValue) => {
    if (!dateIso || !timeValue) return false;
    const [h, m] = timeValue.split(":").map(Number);
    const startMinutes = h * 60 + m;
    const { end: closingMinutes } = getBusinessHoursForDate(dateIso);
    return startMinutes + availabilityDurationMinutes > closingMinutes;
  };

  const isExactBookedSlot = (dateIso, timeValue) => {
    if (!dateIso) return false;
    const slotStart = getSlotDate(dateIso, timeValue);
    const slotEnd = new Date(slotStart.getTime() + 15 * 60 * 1000);
    return bookedRanges.some((range) => {
      const rangeStart = new Date(range.start_time);
      const rangeEnd = new Date(range.end_time);
      return rangeStart < slotEnd && rangeEnd > slotStart;
    });
  };

  const isOverlapSlot = (dateIso, timeValue) => {
    if (!dateIso) return false;
    const slotStart = getSlotDate(dateIso, timeValue);
    const slotEnd = new Date(slotStart.getTime() + availabilityDurationMinutes * 60 * 1000);
    return bookedRanges.some((range) => {
      const rangeStart = new Date(range.start_time);
      const rangeEnd = new Date(range.end_time);
      return rangeStart < slotEnd && rangeEnd > slotStart;
    });
  };

  const getSlotAvailabilityStatus = (dateIso, timeValue) => {
    if (!dateIso) return "available";
    if (isExactBookedSlot(dateIso, timeValue)) {
      return "booked";
    }
    if (isOverlapSlot(dateIso, timeValue)) {
      return "overlap";
    }
    return "available";
  };

  const bookableTimeSlots = visibleTimeSlots.filter((slot) => !exceedsClosingTime(selectedDate, slot));

  React.useEffect(() => {
    if (days.length === 0) return;

    const currentDateInWeek = days.some((day) => day.iso === selectedDate);
    const currentDateUnavailable = selectedDate ? unavailableDateSet.has(selectedDate) : true;
    if (currentDateInWeek && !currentDateUnavailable) {
      return;
    }

    const firstAvailableDate = days.find((day) => !unavailableDateSet.has(day.iso));
    setSelectedDate(firstAvailableDate ? firstAvailableDate.iso : "");
    setSelectedTime("");
  }, [days, selectedDate, unavailableDateSet]);

  React.useEffect(() => {
    let isCancelled = false;

    const loadAvailability = async () => {
      if (!selectedDate) {
        setBookedRanges([]);
        return;
      }

      try {
        const technicianParam =
          selectedTechnicians.length > 0 ? `&technicians=${encodeURIComponent(selectedTechnicians.join(","))}` : "";
        const dayStartUtc = encodeURIComponent(new Date(`${selectedDate}T00:00:00`).toISOString());
        const dayEndUtc = encodeURIComponent(new Date(`${selectedDate}T23:59:59.999`).toISOString());
        const response = await fetch(
          `${apiBaseUrl}/api/bookings/availability?date=${encodeURIComponent(selectedDate)}&day_start_utc=${dayStartUtc}&day_end_utc=${dayEndUtc}${technicianParam}`
        );
        if (!response.ok) {
          throw new Error("Failed to load availability");
        }
        const data = await response.json();
        if (!isCancelled) {
          setBookedRanges(Array.isArray(data.appointments) ? data.appointments : []);
        }
      } catch (error) {
        if (!isCancelled) {
          setBookedRanges([]);
        }
      }
    };

    loadAvailability();
    return () => {
      isCancelled = true;
    };
  }, [apiBaseUrl, selectedDate, selectedTechnicians]);

  React.useEffect(() => {
    if (!selectedDate || !selectedTime) return;
    if (getSlotAvailabilityStatus(selectedDate, selectedTime) !== "available" || exceedsClosingTime(selectedDate, selectedTime)) {
      setSelectedTime("");
    }
  }, [bookedRanges, availabilityDurationMinutes, selectedDate, selectedTime]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    if (!name || !phone || !email || !selectedDate || !selectedTime) {
      setErrorMessage("Please enter your name, phone number, email, and appointment time.");
      return;
    }
    if (!smsConsent) {
      setErrorMessage("Please agree to receive appointment reminders and customer service text messages.");
      return;
    }

    const serviceNames = cartItems.map((item) => item.name).join(", ") || "General Service";
    const selectedServices = cartItems.map((item) => ({
      name: item.name,
      category: item.category,
      category_values: Array.isArray(item.categoryValues) && item.categoryValues.length > 0 ? item.categoryValues : [0],
      technician: item.technician || "Any",
      price: Number(item.price || 0),
      duration_minutes: getItemDurationMinutes(item),
    }));
    const appointmentPayload = {
      customer_name: name,
      customer_email: email,
      customer_phone: phone,
      service: serviceNames,
      selected_services: selectedServices,
      duration_minutes: effectiveDurationMinutes,
      start_time: new Date(`${selectedDate}T${selectedTime}:00`).toISOString(),
      notes: notes ? `${notes}\n\nTotal: $${total}\nDuration: ${effectiveDurationMinutes} min` : `Total: $${total}\nDuration: ${effectiveDurationMinutes} min`,
    };

    try {
      setIsSubmitting(true);
      const response = await fetch(`${apiBaseUrl}/api/bookings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(appointmentPayload),
      });

      const responseData = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(responseData.error || "Booking failed");
      }

      setSubmittedCancelUrl(String(responseData.cancel_url || "").trim());
      setSubmitted(true);
      setCartItems([]);
    } catch (error) {
      setErrorMessage(error.message || "Booking failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <main className="mx-auto w-full max-w-xl px-4 pt-28 pb-12">
        <section className="rounded-2xl border border-[#f0d5df] bg-white/95 p-6 text-center shadow-sm">
          <h1 className="text-3xl font-bold text-[#c76092]">Booking Request Confirmed</h1>
          <p className="mt-4 text-base text-[#444]">Thank you, {name}! Your booking request has been received.</p>
          <p className="mt-1 text-base text-[#444]">We will text and email you once your appointment is confirmed.</p>

          <div className="mt-6 flex flex-col gap-3">
            <Link
              to="/services"
              className="inline-flex w-full items-center justify-center rounded-full bg-black px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#222]"
            >
              Book Another Appointment
            </Link>
            {submittedCancelUrl ? (
              <a
                href={submittedCancelUrl}
                className="inline-flex w-full items-center justify-center rounded-full bg-[#e35e6d] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#cf4e5e]"
              >
                Cancel Appointment
              </a>
            ) : null}
          </div>
        </section>
      </main>
    );
  }

  return (
    <div className="mx-auto mt-[96px] max-w-[1200px] px-4 pb-6">
      <h1 className="text-3xl font-semibold text-[#c7668b]">Confirm Your Booking</h1>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_0.95fr]">
        <section className="order-2 rounded-lg bg-white p-6 shadow-[0_4px_12px_rgba(0,0,0,0.1)] lg:order-1">
          <h2 className="text-xl font-semibold text-[#c7668b]">Your Information</h2>
          <form className="mt-4 flex flex-col gap-4" onSubmit={handleSubmit}>
            <input
              type="text"
              placeholder="Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-md border border-[#ccc] p-3"
              required
            />
            <input
              type="email"
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-md border border-[#ccc] p-3"
              required
            />
            <input
              type="tel"
              placeholder="Phone Number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="rounded-md border border-[#ccc] p-3"
              required
            />
            <div className="rounded-md border border-[#e6e6e6] p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-[#555]">Booking date</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={weekOffset === 0}
                    onClick={() => {
                      setWeekOffset((prevOffset) => Math.max(0, prevOffset - 1));
                      setSelectedTime("");
                    }}
                    className="rounded-full border border-[#d8d8d8] px-3 py-1 text-sm text-[#555] transition-colors enabled:hover:border-[#c7668b] enabled:hover:text-[#c7668b] disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Show previous week"
                  >
                    &larr;
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setWeekOffset((prevOffset) => prevOffset + 1);
                      setSelectedTime("");
                    }}
                    className="rounded-full border border-[#d8d8d8] px-3 py-1 text-sm text-[#555] transition-colors hover:border-[#c7668b] hover:text-[#c7668b]"
                    aria-label="Show next week"
                  >
                    &rarr;
                  </button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {days.map((day) => (
                  <button
                    key={day.iso}
                    type="button"
                    disabled={unavailableDateSet.has(day.iso)}
                    onClick={() => {
                      setSelectedDate(day.iso);
                      setSelectedTime("");
                    }}
                    className={`rounded-full border px-3 py-2 text-sm ${
                      selectedDate === day.iso
                        ? "border-[#c7668b] bg-[#c7668b] text-white"
                        : "border-[#d8d8d8] text-[#555]"
                    } ${unavailableDateSet.has(day.iso) ? "cursor-not-allowed opacity-40" : ""}`}
                  >
                    {day.weekday} {day.day}
                  </button>
                ))}
              </div>
              {selectedTechnicians.length > 0 && days.every((day) => unavailableDateSet.has(day.iso)) && (
                <p className="mt-2 text-xs text-red-600">
                  No available day this week for the selected technician(s). Choose a different week or technician.
                </p>
              )}

              <p className="mt-4 text-sm font-semibold text-[#555]">Booking time</p>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[#666]">
                <span className="inline-flex items-center gap-1">
                  <span className="h-3 w-3 rounded-full bg-[#6b7280]" />
                  Booked
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-3 w-3 rounded-full bg-[#d1d5db]" />
                  Overlaps with your service length
                </span>
              </div>
              <div className="mt-3 grid max-h-[220px] grid-cols-3 gap-2 overflow-y-auto pr-1 md:flex md:max-h-[180px] md:flex-wrap">
                {bookableTimeSlots.map((slot) => {
                  const slotStatus = getSlotAvailabilityStatus(selectedDate, slot);
                  const disabled = slotStatus !== "available";
                  const bookedClass = slotStatus === "booked" ? "border-[#6b7280] bg-[#6b7280] text-white opacity-95" : "";
                  const overlapClass = slotStatus === "overlap" ? "border-[#d1d5db] bg-[#d1d5db] text-[#555] opacity-95" : "";
                  return (
                    <button
                      key={slot}
                      type="button"
                      disabled={disabled || !selectedDate}
                      onClick={() => setSelectedTime(slot)}
                      title={
                        slotStatus === "booked"
                          ? "Booked"
                          : slotStatus === "overlap"
                            ? "Unavailable: overlaps with existing booking for your service length"
                            : ""
                      }
                      className={`w-full rounded-full border px-2 py-2 text-sm md:w-auto md:px-3 ${
                        selectedTime === slot
                          ? "border-[#c7668b] bg-[#c7668b] text-white"
                          : "border-[#d8d8d8] text-[#555]"
                      } ${bookedClass} ${overlapClass} ${disabled || !selectedDate ? "cursor-not-allowed" : ""}`}
                    >
                      {toDisplayTime(slot)}
                    </button>
                  );
                })}
              </div>
            </div>
            <textarea
              placeholder="Notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows="3"
              className="rounded-md border border-[#ccc] p-3"
            />
            <label className="flex items-start gap-3 rounded-md border border-[#e6e6e6] p-3 text-sm text-[#555]">
              <input
                type="checkbox"
                checked={smsConsent}
                onChange={(e) => setSmsConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[#c7668b]"
              />
              <span>
                I agree to receive appointment reminders and customer service text messages from Nail Times. Message
                frequency varies. Message &amp; data rates may apply. Reply STOP to opt out.
              </span>
            </label>
            {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
            <button type="submit" className="rounded-md bg-black p-3 text-white">
              {isSubmitting ? "Submitting..." : "Confirm Booking"}
            </button>
          </form>
        </section>

        <section className="order-1 rounded-lg bg-white p-6 shadow-[0_4px_12px_rgba(0,0,0,0.1)] lg:order-2">
          <h2 className="text-xl font-semibold text-[#c7668b]">Your Services</h2>
          {cartItems.length === 0 && <p className="mt-3 text-[#555]">Your cart is empty.</p>}
          <div className="mt-3 space-y-3">
            {cartItems.map((item) => (
              <div key={item.id} className="grid grid-cols-[1fr_110px] gap-3 border-b border-[#f0f0f0] pb-3">
                <div>
                  <p className="text-[1rem] text-[#333]">{item.name}</p>
                  <p className="text-sm text-[#777]">
                    {item.technician ? `Tech: ${item.technician}` : "Tech: Any"} - {getItemDurationMinutes(item) || "?"} min
                  </p>
                </div>
                <p className="text-right tabular-nums text-[#333]">${item.price}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 border-t border-[#e9e9e9] pt-4">
            <div className="flex justify-between text-[1.05rem]">
              <strong>Total</strong>
              <strong>${total}</strong>
            </div>
            <div className="mt-2 flex justify-between text-[1.05rem]">
              <strong>Total Time</strong>
              <strong>{displayDurationMinutes} min</strong>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
