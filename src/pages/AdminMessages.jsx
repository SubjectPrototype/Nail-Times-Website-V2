import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

export default function AdminMessages() {
  const apiBaseUrl =
    process.env.REACT_APP_API_URL || `${window.location.protocol}//${window.location.hostname}:4000`;
  const token = localStorage.getItem("adminToken");

  const [groups, setGroups] = useState([]);
  const [selectedPhone, setSelectedPhone] = useState("");
  const [selectedName, setSelectedName] = useState("");
  const [messages, setMessages] = useState([]);
  const [replyText, setReplyText] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [conversationLoading, setConversationLoading] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const [savingName, setSavingName] = useState(false);

  const loadGroups = async () => {
    setGroupsLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch(`${apiBaseUrl}/api/admin/messages/groups`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to load message groups");
      }

      const data = await response.json();
      setGroups(data);
      if (data.length > 0) {
        setSelectedPhone((prev) => prev || data[0].customer_phone);
      } else {
        setSelectedPhone("");
        setSelectedName("");
        setNameInput("");
        setMessages([]);
      }
    } catch (error) {
      setErrorMessage(error.message || "Failed to load message groups");
    } finally {
      setGroupsLoading(false);
    }
  };

  const loadConversation = async (phone) => {
    if (!phone) {
      setMessages([]);
      return;
    }

    setConversationLoading(true);
    setErrorMessage("");

    try {
      const encodedPhone = encodeURIComponent(phone);
      const response = await fetch(`${apiBaseUrl}/api/admin/messages/${encodedPhone}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to load conversation");
      }

      const data = await response.json();
      setMessages(data.messages || []);
      setSelectedName(data.customer_name || "");
      setNameInput(data.customer_name || "");
      await loadGroups();
    } catch (error) {
      setErrorMessage(error.message || "Failed to load conversation");
    } finally {
      setConversationLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      return;
    }
    loadGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!token || !selectedPhone) {
      return;
    }
    loadConversation(selectedPhone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, selectedPhone]);

  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    window.location.href = "/admin/login";
  };

  const handleReply = async (event) => {
    event.preventDefault();
    const text = replyText.trim();
    if (!selectedPhone || !text) {
      return;
    }

    setSendingReply(true);
    setErrorMessage("");

    try {
      const encodedPhone = encodeURIComponent(selectedPhone);
      const response = await fetch(`${apiBaseUrl}/api/admin/messages/${encodedPhone}/reply`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ body: text }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to send message");
      }

      setReplyText("");
      await loadConversation(selectedPhone);
    } catch (error) {
      setErrorMessage(error.message || "Failed to send message");
    } finally {
      setSendingReply(false);
    }
  };

  const handleSaveName = async (event) => {
    event.preventDefault();

    if (!selectedPhone) {
      return;
    }

    setSavingName(true);
    setErrorMessage("");

    try {
      const encodedPhone = encodeURIComponent(selectedPhone);
      const response = await fetch(`${apiBaseUrl}/api/admin/messages/${encodedPhone}/name`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ customer_name: nameInput.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to save customer name");
      }

      const data = await response.json();
      setSelectedName(data.customer_name || "");
      await loadGroups();
    } catch (error) {
      setErrorMessage(error.message || "Failed to save customer name");
    } finally {
      setSavingName(false);
    }
  };

  return (
    <div className="mx-auto mt-[100px] max-w-[1100px] px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold text-[#c7668b]">Admin Messages</h1>
        <div className="flex items-center gap-2">
          <Link className="rounded-md border border-[#333] px-3 py-2 text-sm" to="/admin">
            Bookings
          </Link>
          <button className="rounded-md border border-[#333] px-3 py-2 text-sm" onClick={handleLogout}>
            Log Out
          </button>
        </div>
      </div>

      {errorMessage && <p className="mt-3 text-sm text-red-600">{errorMessage}</p>}

      <div className="mt-6 grid gap-4 md:grid-cols-[300px_1fr]">
        <div className="rounded-lg bg-white p-3 shadow-[0_4px_12px_rgba(0,0,0,0.08)]">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[#666]">Conversations</h2>
          {groupsLoading ? (
            <p className="text-sm text-[#666]">Loading conversations...</p>
          ) : groups.length === 0 ? (
            <p className="text-sm text-[#666]">No messages yet.</p>
          ) : (
            <div className="space-y-2">
              {groups.map((group) => (
                <button
                  key={group.customer_phone}
                  type="button"
                  onClick={() => setSelectedPhone(group.customer_phone)}
                  className={`w-full rounded-md border p-3 text-left transition-colors ${
                    selectedPhone === group.customer_phone
                      ? "border-[#c7668b] bg-[#fff1f6]"
                      : "border-[#e4e4e4] bg-white hover:border-[#c7668b]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-[#333]">{group.customer_name || "Unnamed"}</p>
                      <p className="text-xs text-[#777]">{group.customer_phone}</p>
                    </div>
                    {group.unread_count > 0 && (
                      <span className="rounded-full bg-[#c7668b] px-2 py-0.5 text-xs text-white">
                        {group.unread_count}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-[#666]">{group.last_message_body}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg bg-white p-4 shadow-[0_4px_12px_rgba(0,0,0,0.08)]">
          {!selectedPhone ? (
            <p className="text-sm text-[#666]">Select a conversation.</p>
          ) : (
            <>
              <div className="mb-3 border-b border-[#eee] pb-3">
                <p className="text-xs uppercase tracking-wide text-[#666]">Customer</p>
                <p className="font-semibold text-[#333]">{selectedName || "Unnamed"}</p>
                <p className="text-sm text-[#777]">{selectedPhone}</p>
                <form className="mt-3 flex gap-2" onSubmit={handleSaveName}>
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(event) => setNameInput(event.target.value)}
                    placeholder="Add customer name"
                    className="w-full max-w-[320px] rounded-md border border-[#ccc] px-3 py-2 text-sm"
                    maxLength={120}
                  />
                  <button
                    type="submit"
                    className="rounded-md border border-[#333] px-3 py-2 text-sm"
                    disabled={savingName}
                  >
                    {savingName ? "Saving..." : "Save Name"}
                  </button>
                </form>
              </div>

              <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                {conversationLoading ? (
                  <p className="text-sm text-[#666]">Loading messages...</p>
                ) : messages.length === 0 ? (
                  <p className="text-sm text-[#666]">No messages in this conversation.</p>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message._id}
                      className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                        message.direction === "outbound"
                          ? "ml-auto bg-[#c7668b] text-white"
                          : "mr-auto bg-[#f3f3f3] text-[#333]"
                      }`}
                    >
                      <p>{message.body}</p>
                      <p
                        className={`mt-1 text-[11px] ${
                          message.direction === "outbound" ? "text-white/80" : "text-[#777]"
                        }`}
                      >
                        {new Date(message.created_at).toLocaleString("en-US", {
                          year: "numeric",
                          month: "numeric",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  ))
                )}
              </div>

              <form className="mt-4 flex gap-2" onSubmit={handleReply}>
                <input
                  type="text"
                  value={replyText}
                  onChange={(event) => setReplyText(event.target.value)}
                  placeholder="Type reply..."
                  className="flex-1 rounded-md border border-[#ccc] px-3 py-2"
                  maxLength={1600}
                  required
                />
                <button
                  type="submit"
                  className="rounded-md bg-black px-4 py-2 text-sm text-white"
                  disabled={sendingReply}
                >
                  {sendingReply ? "Sending..." : "Send"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
