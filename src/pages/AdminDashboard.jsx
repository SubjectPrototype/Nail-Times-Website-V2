import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

export default function AdminDashboard() {
  const [bookings, setBookings] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const apiBaseUrl =
    process.env.REACT_APP_API_URL || `${window.location.protocol}//${window.location.hostname}:4000`;
  const token = localStorage.getItem("adminToken");

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

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this booking?")) {
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
        throw new Error(errorData.error || "Failed to delete booking");
      }

      setBookings((prev) => prev.filter((item) => item._id !== id));
    } catch (error) {
      setErrorMessage(error.message || "Failed to delete booking");
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

  return (
    <div className="mx-auto mt-[100px] max-w-[900px] px-4 py-6">
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
        <div className="mt-6 space-y-4">
          {bookings.length === 0 && <p className="text-[#555]">No bookings yet.</p>}
          {bookings.map((booking) => (
            <div
              key={booking._id}
              className="rounded-lg bg-white p-4 shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{booking.customer_name}</p>
                  <p className="text-sm text-[#666]">{booking.customer_email}</p>
                  {booking.customer_phone && <p className="text-sm text-[#666]">{booking.customer_phone}</p>}
                  <p className="mt-1 text-xs uppercase tracking-wide text-[#666]">
                    Status: {booking.status || "pending"}
                  </p>
                </div>
                <div className="text-sm text-[#666]">
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
                <div className="flex items-center gap-2">
                  {booking.status !== "confirmed" && (
                    <button
                      className="rounded-md border border-green-600 px-3 py-1 text-sm text-green-700"
                      onClick={() => handleConfirm(booking._id)}
                    >
                      Confirm
                    </button>
                  )}
                  <button
                    className="rounded-md border border-red-500 px-3 py-1 text-sm text-red-600"
                    onClick={() => handleDelete(booking._id)}
                  >
                    Delete
                  </button>
                </div>
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
