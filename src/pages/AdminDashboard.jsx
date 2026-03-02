import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

const CALENDAR_START_HOUR = 8;
const CALENDAR_END_HOUR = 20;
const CALENDAR_TOTAL_MINUTES = (CALENDAR_END_HOUR - CALENDAR_START_HOUR) * 60;

function startOfWeek(date) {
  const value = new Date(date);
  const day = value.getDay();
  value.setHours(0, 0, 0, 0);
  value.setDate(value.getDate() - day);
  return value;
}

function addDays(date, days) {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value;
}

function startOfDay(date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function statusColorClasses(status) {
  if (status === "confirmed") return "bg-green-100 text-green-800 border-green-200";
  if (status === "cancelled") return "bg-gray-100 text-gray-700 border-gray-200";
  return "bg-amber-100 text-amber-800 border-amber-200";
}

export default function AdminDashboard() {
  const [bookings, setBookings] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [highlightedBookingId, setHighlightedBookingId] = useState("");
  const [mobileDay, setMobileDay] = useState(() => startOfDay(new Date()));
  const [mobileModalBookingId, setMobileModalBookingId] = useState("");
  const cardRefs = useRef(new Map());

  const apiBaseUrl =
    process.env.REACT_APP_API_URL || `${window.location.protocol}//${window.location.hostname}:4000`;
  const token = localStorage.getItem("adminToken");

  const registerCardRef = (bookingId, node) => {
    if (node) {
      cardRefs.current.set(bookingId, node);
    } else {
      cardRefs.current.delete(bookingId);
    }
  };

  const focusBookingCard = (bookingId) => {
    setHighlightedBookingId(bookingId);
    const target = cardRefs.current.get(bookingId);
    if (!target) {
      return;
    }
    target.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const getBookingEndTimeMs = (booking) => {
    const endTime = booking.end_time ? new Date(booking.end_time).getTime() : NaN;
    if (!Number.isNaN(endTime)) {
      return endTime;
    }

    const startTime = new Date(booking.start_time).getTime();
    if (Number.isNaN(startTime)) {
      return Number.POSITIVE_INFINITY;
    }

    const minutes = Number(booking.duration_minutes || 60);
    return startTime + minutes * 60 * 1000;
  };

  const canDeleteBooking = (booking) => {
    if (booking.status === "cancelled") {
      return true;
    }
    return getBookingEndTimeMs(booking) < Date.now();
  };

  const getBookingEndDate = (booking) => {
    if (booking.end_time) {
      const end = new Date(booking.end_time);
      if (!Number.isNaN(end.getTime())) {
        return end;
      }
    }

    const start = new Date(booking.start_time);
    if (Number.isNaN(start.getTime())) {
      return start;
    }

    return new Date(start.getTime() + Number(booking.duration_minutes || 60) * 60 * 1000);
  };

  const loadBookings = async () => {
    setErrorMessage("");
    setIsLoading(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/admin/bookings`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to load bookings");
      }

      const data = await response.json();
      setBookings(data);
    } catch (error) {
      setErrorMessage(error.message || "Failed to load bookings");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadBookings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    window.location.href = "/admin/login";
  };

  const handleCancel = async (id) => {
    if (!window.confirm("Cancel this booking?")) {
      return;
    }

    try {
      const response = await fetch(`${apiBaseUrl}/api/admin/bookings/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to cancel booking");
      }

      const data = await response.json();
      setBookings((prev) => prev.map((item) => (item._id === id ? data.booking : item)));
      if (mobileModalBookingId === id) {
        setMobileModalBookingId("");
      }
    } catch (error) {
      setErrorMessage(error.message || "Failed to cancel booking");
    }
  };

  const handleConfirm = async (id) => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/admin/bookings/${id}/confirm`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to confirm booking");
      }

      const data = await response.json();
      setBookings((prev) => prev.map((item) => (item._id === id ? data.booking : item)));
    } catch (error) {
      setErrorMessage(error.message || "Failed to confirm booking");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Permanently delete this booking log? This cannot be undone.")) {
      return;
    }

    try {
      const response = await fetch(`${apiBaseUrl}/api/admin/bookings/${id}/hard-delete`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to delete booking");
      }

      setBookings((prev) => prev.filter((item) => item._id !== id));
      if (mobileModalBookingId === id) {
        setMobileModalBookingId("");
      }
    } catch (error) {
      setErrorMessage(error.message || "Failed to delete booking");
    }
  };

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart]);
  const weekEnd = useMemo(() => addDays(weekStart, 7), [weekStart]);

  const weekBookingsByDay = useMemo(() => {
    const grouped = Array.from({ length: 7 }, () => []);

    bookings.forEach((booking) => {
      const start = new Date(booking.start_time);
      const end = getBookingEndDate(booking);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return;
      }

      if (start >= weekEnd || end <= weekStart) {
        return;
      }

      const dayIndex = Math.floor((startOfDay(start).getTime() - weekStart.getTime()) / (24 * 60 * 60 * 1000));
      if (dayIndex < 0 || dayIndex > 6) {
        return;
      }

      const startMinutes = start.getHours() * 60 + start.getMinutes();
      const endMinutes = end.getHours() * 60 + end.getMinutes();
      const clampedStart = Math.max(startMinutes, CALENDAR_START_HOUR * 60);
      const clampedEnd = Math.min(endMinutes, CALENDAR_END_HOUR * 60);
      if (clampedEnd <= clampedStart) {
        return;
      }

      grouped[dayIndex].push({ booking, start, clampedStart, clampedEnd });
    });

    grouped.forEach((items) =>
      items.sort((a, b) => a.clampedStart - b.clampedStart || a.booking.customer_name.localeCompare(b.booking.customer_name))
    );

    return grouped;
  }, [bookings, weekEnd, weekStart]);

  const weekRangeLabel = `${weekStart.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })} - ${addDays(weekStart, 6).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

  const hourMarks = useMemo(
    () => Array.from({ length: CALENDAR_END_HOUR - CALENDAR_START_HOUR + 1 }, (_, idx) => CALENDAR_START_HOUR + idx),
    []
  );

  const mobileDayEnd = useMemo(() => addDays(mobileDay, 1), [mobileDay]);
  const mobileDayLabel = mobileDay.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  const mobileBookings = useMemo(() => {
    const items = [];

    bookings.forEach((booking) => {
      const start = new Date(booking.start_time);
      const end = getBookingEndDate(booking);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return;
      }
      if (start >= mobileDayEnd || end <= mobileDay) {
        return;
      }

      const startMinutes = start.getHours() * 60 + start.getMinutes();
      const endMinutes = end.getHours() * 60 + end.getMinutes();
      const clampedStart = Math.max(startMinutes, CALENDAR_START_HOUR * 60);
      const clampedEnd = Math.min(endMinutes, CALENDAR_END_HOUR * 60);
      if (clampedEnd <= clampedStart) {
        return;
      }

      items.push({ booking, start, clampedStart, clampedEnd });
    });

    items.sort((a, b) => a.clampedStart - b.clampedStart || a.booking.customer_name.localeCompare(b.booking.customer_name));
    return items;
  }, [bookings, mobileDay, mobileDayEnd]);

  const mobileModalBooking = useMemo(
    () => bookings.find((booking) => booking._id === mobileModalBookingId) || null,
    [bookings, mobileModalBookingId]
  );

  useEffect(() => {
    if (!highlightedBookingId) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setHighlightedBookingId(""), 2200);
    return () => window.clearTimeout(timeoutId);
  }, [highlightedBookingId]);

  useEffect(() => {
    if (!mobileModalBookingId) {
      return;
    }
    if (!mobileModalBooking) {
      setMobileModalBookingId("");
    }
  }, [mobileModalBooking, mobileModalBookingId]);

  return (
    <div className="mx-auto mt-[100px] max-w-[1500px] px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold text-[#c7668b]">Admin Bookings</h1>
        <div className="flex items-center gap-2">
          <Link className="rounded-md border border-[#333] px-3 py-2 text-sm" to="/admin/messages">
            Messages
          </Link>
          <button className="rounded-md border border-[#333] px-3 py-2 text-sm" onClick={handleLogout}>
            Log Out
          </button>
        </div>
      </div>

      {errorMessage && <p className="mt-3 text-sm text-red-600">{errorMessage}</p>}

      {isLoading ? (
        <p className="mt-6 text-[#555]">Loading bookings...</p>
      ) : (
        <div className="mt-6 grid gap-4 xl:grid-cols-[380px_1fr]">
          <section className="rounded-lg bg-white p-4 shadow-[0_4px_12px_rgba(0,0,0,0.08)]">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#666]">Bookings</h2>
            <div className="max-h-[calc(100vh-220px)] space-y-3 overflow-y-auto pr-1">
              {bookings.length === 0 && <p className="text-[#555]">No bookings yet.</p>}
              {bookings.map((booking) => (
                <div
                  key={booking._id}
                  ref={(node) => registerCardRef(booking._id, node)}
                  onClick={() => setHighlightedBookingId(booking._id)}
                  className={`cursor-pointer rounded-lg border p-3 transition ${
                    highlightedBookingId === booking._id
                      ? "border-[#c7668b] bg-[#fff4f8] shadow-[0_0_0_2px_rgba(199,102,139,0.22)]"
                      : "border-[#eee]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{booking.customer_name}</p>
                      <p className="text-sm text-[#666]">{booking.customer_email}</p>
                      {booking.customer_phone && <p className="text-sm text-[#666]">{booking.customer_phone}</p>}
                    </div>
                    <span
                      className={`rounded-full border px-2 py-1 text-[11px] font-semibold uppercase ${statusColorClasses(
                        booking.status || "pending"
                      )}`}
                    >
                      {booking.status || "pending"}
                    </span>
                  </div>
                  <div className="mt-2 text-sm text-[#666]">
                    <p>
                      {new Date(booking.start_time).toLocaleString("en-US", {
                        year: "numeric",
                        month: "numeric",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                    <p className="font-medium text-[#333]">{booking.service}</p>
                    <p>Duration: {booking.duration_minutes || 60} min</p>
                  </div>
                  {booking.notes && <p className="mt-2 text-sm text-[#555]">{booking.notes}</p>}
                  {Array.isArray(booking.selected_services) && booking.selected_services.length > 0 && (
                    <div className="mt-2 text-sm text-[#555]">
                      <p className="font-medium text-[#333]">Selected Services</p>
                      {booking.selected_services.map((item, idx) => (
                        <p key={`${booking._id}-svc-${idx}`}>
                          {item.name} - {item.duration_minutes || "?"} min
                          {item.technician ? ` (Tech: ${item.technician})` : ""}
                        </p>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {booking.status === "pending" && (
                      <button
                        className="rounded-md border border-green-600 px-3 py-1 text-sm text-green-700"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleConfirm(booking._id);
                        }}
                      >
                        Confirm
                      </button>
                    )}
                    {booking.status !== "cancelled" && (
                      <button
                        className="rounded-md border border-red-500 px-3 py-1 text-sm text-red-600"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleCancel(booking._id);
                        }}
                      >
                        Cancel
                      </button>
                    )}
                    {canDeleteBooking(booking) && (
                      <button
                        className="rounded-md border border-[#333] px-3 py-1 text-sm text-[#333]"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDelete(booking._id);
                        }}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg bg-white p-4 shadow-[0_4px_12px_rgba(0,0,0,0.08)]">
            <div className="md:hidden">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[#333]">Day Calendar</h2>
                <div className="flex items-center gap-2">
                  <button
                    className="rounded-md border border-[#ccc] px-3 py-1 text-sm"
                    onClick={() => setMobileDay((prev) => addDays(prev, -1))}
                  >
                    Back
                  </button>
                  <button
                    className="rounded-md border border-[#ccc] px-3 py-1 text-sm"
                    onClick={() => setMobileDay(startOfDay(new Date()))}
                  >
                    Today
                  </button>
                  <button
                    className="rounded-md border border-[#ccc] px-3 py-1 text-sm"
                    onClick={() => setMobileDay((prev) => addDays(prev, 1))}
                  >
                    Next
                  </button>
                </div>
              </div>
              <p className="mb-3 text-sm text-[#666]">{mobileDayLabel}</p>

              <div className="grid grid-cols-[56px_1fr] border border-[#eee]">
                <div className="relative h-[640px] border-r border-[#eee] bg-[#fafafa]">
                  {hourMarks.map((hour) => {
                    const topPct = ((hour - CALENDAR_START_HOUR) / (CALENDAR_END_HOUR - CALENDAR_START_HOUR)) * 100;
                    return (
                      <div
                        key={`mobile-label-${hour}`}
                        className="absolute left-0 w-full -translate-y-1/2 px-1 text-right text-[11px] text-[#777]"
                        style={{ top: `${topPct}%` }}
                      >
                        {new Date(2000, 0, 1, hour).toLocaleString("en-US", { hour: "numeric" })}
                      </div>
                    );
                  })}
                </div>
                <div className="relative h-[640px]">
                  {hourMarks.map((hour) => {
                    const topPct = ((hour - CALENDAR_START_HOUR) / (CALENDAR_END_HOUR - CALENDAR_START_HOUR)) * 100;
                    return (
                      <div
                        key={`mobile-line-${hour}`}
                        className="pointer-events-none absolute left-0 w-full border-t border-dashed border-[#f0f0f0]"
                        style={{ top: `${topPct}%` }}
                      />
                    );
                  })}
                  {mobileBookings.map(({ booking, start, clampedStart, clampedEnd }) => {
                    const topPct = ((clampedStart - CALENDAR_START_HOUR * 60) / CALENDAR_TOTAL_MINUTES) * 100;
                    const heightPct = Math.max(((clampedEnd - clampedStart) / CALENDAR_TOTAL_MINUTES) * 100, 3);
                    const cardColors =
                      booking.status === "confirmed"
                        ? "border-green-300 bg-green-50"
                        : booking.status === "cancelled"
                          ? "border-gray-300 bg-gray-100"
                          : "border-[#c7668b]/40 bg-[#fff1f6]";
                    return (
                      <button
                        key={`mobile-week-${booking._id}`}
                        type="button"
                        className={`absolute left-1 right-1 overflow-hidden rounded-md border px-2 py-1 text-left text-xs shadow-sm ${cardColors}`}
                        style={{ top: `${topPct}%`, height: `${heightPct}%` }}
                        onClick={() => setMobileModalBookingId(booking._id)}
                      >
                        <p className="truncate font-semibold text-[#333]">{booking.customer_name}</p>
                        <p className="truncate text-[#555]">
                          {start.toLocaleString("en-US", { hour: "numeric", minute: "2-digit" })} - {booking.duration_minutes || 60}m
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="hidden md:block">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-[#333]">Week Calendar</h2>
                <div className="flex items-center gap-2">
                  <button
                    className="rounded-md border border-[#ccc] px-3 py-1 text-sm"
                    onClick={() => setWeekStart((prev) => addDays(prev, -7))}
                  >
                    Previous
                  </button>
                  <button
                    className="rounded-md border border-[#ccc] px-3 py-1 text-sm"
                    onClick={() => setWeekStart(startOfWeek(new Date()))}
                  >
                    Today
                  </button>
                  <button
                    className="rounded-md border border-[#ccc] px-3 py-1 text-sm"
                    onClick={() => setWeekStart((prev) => addDays(prev, 7))}
                  >
                    Next
                  </button>
                </div>
              </div>
              <p className="mb-3 text-sm text-[#666]">{weekRangeLabel}</p>

              <div className="overflow-x-auto">
                <div className="min-w-[1000px]">
                  <div className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))] border border-[#eee] border-b-0">
                    <div className="border-r border-[#eee] bg-[#fafafa]" />
                    {weekDays.map((day) => (
                      <div
                        key={day.toISOString()}
                        className="border-r border-[#eee] bg-[#fafafa] p-2 text-center last:border-r-0"
                      >
                        <p className="text-xs font-semibold uppercase text-[#666]">
                          {day.toLocaleDateString("en-US", { weekday: "short" })}
                        </p>
                        <p className="text-sm font-semibold text-[#333]">
                          {day.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))] border border-[#eee]">
                    <div className="relative h-[720px] border-r border-[#eee] bg-[#fafafa]">
                      {hourMarks.map((hour) => {
                        const topPct = ((hour - CALENDAR_START_HOUR) / (CALENDAR_END_HOUR - CALENDAR_START_HOUR)) * 100;
                        return (
                          <div
                            key={`label-${hour}`}
                            className="absolute left-0 w-full -translate-y-1/2 px-2 text-right text-xs text-[#777]"
                            style={{ top: `${topPct}%` }}
                          >
                            {new Date(2000, 0, 1, hour).toLocaleString("en-US", { hour: "numeric" })}
                          </div>
                        );
                      })}
                    </div>

                    {weekDays.map((day, dayIndex) => (
                      <div
                        key={`calendar-${day.toISOString()}`}
                        className="relative h-[720px] border-r border-[#eee] last:border-r-0"
                      >
                        {hourMarks.map((hour) => {
                          const topPct = ((hour - CALENDAR_START_HOUR) / (CALENDAR_END_HOUR - CALENDAR_START_HOUR)) * 100;
                          return (
                            <div
                              key={`line-${dayIndex}-${hour}`}
                              className="pointer-events-none absolute left-0 w-full border-t border-dashed border-[#f0f0f0]"
                              style={{ top: `${topPct}%` }}
                            />
                          );
                        })}

                        {weekBookingsByDay[dayIndex].map(({ booking, start, clampedStart, clampedEnd }) => {
                          const topPct = ((clampedStart - CALENDAR_START_HOUR * 60) / CALENDAR_TOTAL_MINUTES) * 100;
                          const heightPct = Math.max(((clampedEnd - clampedStart) / CALENDAR_TOTAL_MINUTES) * 100, 2.5);

                          const faded = booking.status === "cancelled" ? "opacity-60" : "";
                          const cardColors =
                            booking.status === "confirmed"
                              ? "border-green-300 bg-green-50"
                              : booking.status === "cancelled"
                                ? "border-gray-300 bg-gray-100"
                                : "border-[#c7668b]/40 bg-[#fff1f6]";

                          return (
                            <div
                              key={`week-${booking._id}`}
                              className={`absolute left-1 right-1 cursor-pointer overflow-hidden rounded-md border px-2 py-1 text-xs shadow-sm transition ${cardColors} ${faded} ${
                                highlightedBookingId === booking._id ? "ring-2 ring-[#c7668b]" : ""
                              }`}
                              style={{ top: `${topPct}%`, height: `${heightPct}%` }}
                              title={`${booking.customer_name} - ${new Date(booking.start_time).toLocaleString("en-US", {
                                hour: "numeric",
                                minute: "2-digit",
                              })}`}
                              onClick={() => focusBookingCard(booking._id)}
                            >
                              <p className="truncate font-semibold text-[#333]">{booking.customer_name}</p>
                              <p className="truncate text-[#555]">
                                {start.toLocaleString("en-US", { hour: "numeric", minute: "2-digit" })} - {booking.duration_minutes || 60}m
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {mobileModalBooking && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/45 p-4 md:hidden">
          <div className="max-h-[85vh] w-full max-w-[380px] overflow-y-auto rounded-lg bg-white p-4 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-semibold text-[#333]">Booking Details</h3>
              <button
                type="button"
                className="rounded-md border border-[#ccc] px-2 py-1 text-sm"
                onClick={() => setMobileModalBookingId("")}
              >
                Close
              </button>
            </div>
            <div className="mt-3 space-y-2 text-sm text-[#555]">
              <p className="text-base font-semibold text-[#333]">{mobileModalBooking.customer_name}</p>
              <p>{mobileModalBooking.customer_email}</p>
              {mobileModalBooking.customer_phone && <p>{mobileModalBooking.customer_phone}</p>}
              <p>
                {new Date(mobileModalBooking.start_time).toLocaleString("en-US", {
                  year: "numeric",
                  month: "numeric",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </p>
              <p>Duration: {mobileModalBooking.duration_minutes || 60} min</p>
              <p>Service: {mobileModalBooking.service}</p>
              <p>
                Status: <span className="font-semibold text-[#333]">{mobileModalBooking.status || "pending"}</span>
              </p>
              {mobileModalBooking.notes && <p>Notes: {mobileModalBooking.notes}</p>}
              {Array.isArray(mobileModalBooking.selected_services) &&
                mobileModalBooking.selected_services.length > 0 && (
                  <div>
                    <p className="font-medium text-[#333]">Selected Services</p>
                    {mobileModalBooking.selected_services.map((item, idx) => (
                      <p key={`mobile-modal-svc-${idx}`}>
                        {item.name} - {item.duration_minutes || "?"} min
                        {item.technician ? ` (Tech: ${item.technician})` : ""}
                      </p>
                    ))}
                  </div>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
