import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

export default function AdminMessages() {
  const apiBaseUrl =
    process.env.REACT_APP_API_URL || `${window.location.protocol}//${window.location.hostname}:4000`;
  const pollIntervalMs = Number(process.env.REACT_APP_ADMIN_CHAT_POLL_MS || 2000);
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
  const [addingContact, setAddingContact] = useState(false);
  const [newContactName, setNewContactName] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");
  const [openingMediaKey, setOpeningMediaKey] = useState("");
  const [mediaPreviewUrls, setMediaPreviewUrls] = useState({});
  const mediaPreviewUrlsRef = useRef({});
  const messageListRef = useRef(null);
  const messageEndRef = useRef(null);
  const nameInputRef = useRef(null);
  const autoScrollToBottomRef = useRef(false);

  const scrollMessagesToBottom = () => {
    const scroll = () => {
      const endNode = messageEndRef.current;
      const container = messageListRef.current;
      if (endNode) {
        endNode.scrollIntoView({ block: "end" });
      } else if (container) {
        container.scrollTop = container.scrollHeight;
      }
    };

    scroll();
    window.requestAnimationFrame(scroll);
    window.setTimeout(scroll, 80);
    window.setTimeout(scroll, 180);
  };

  const queueAutoScrollToBottom = () => {
    autoScrollToBottomRef.current = true;
    scrollMessagesToBottom();
  };

  const sendPresence = async (phone, isActive) => {
    if (!token || !phone) {
      return;
    }

    try {
      await fetch(`${apiBaseUrl}/api/admin/messages/presence`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customer_phone: phone,
          is_active: Boolean(isActive),
        }),
      });
    } catch {
      // Presence ping is best effort.
    }
  };

  const loadGroups = async (options = {}) => {
    if (!options.silent) {
      setGroupsLoading(true);
      setErrorMessage("");
    }

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
      if (!options.silent) {
        setGroupsLoading(false);
      }
    }
  };

  const loadConversation = async (phone, options = {}) => {
    if (!phone) {
      setMessages([]);
      return;
    }

    if (!options.silent) {
      setConversationLoading(true);
      setErrorMessage("");
    }

    try {
      if (options.forceScrollBottom) {
        autoScrollToBottomRef.current = true;
      }
      const container = messageListRef.current;
      const prevScrollTop = container ? container.scrollTop : 0;
      const prevScrollHeight = container ? container.scrollHeight : 0;
      const wasNearBottom = options.forceScrollBottom || (container
        ? prevScrollHeight - (container.scrollTop + container.clientHeight) < 40
        : false);

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
      const isEditingName = document.activeElement === nameInputRef.current;
      if (!options.silent || !isEditingName) {
        setNameInput(data.customer_name || "");
      }
      window.requestAnimationFrame(() => {
        const nextContainer = messageListRef.current;
        if (!nextContainer) {
          return;
        }
        if (wasNearBottom) {
          nextContainer.scrollTop = nextContainer.scrollHeight;
          return;
        }
        const heightDelta = nextContainer.scrollHeight - prevScrollHeight;
        nextContainer.scrollTop = Math.max(0, prevScrollTop + heightDelta);
      });
      if (options.forceScrollBottom) {
        scrollMessagesToBottom();
      }
      if (!options.skipGroupRefresh) {
        await loadGroups({ silent: options.silent });
      }
    } catch (error) {
      setErrorMessage(error.message || "Failed to load conversation");
    } finally {
      if (!options.silent) {
        setConversationLoading(false);
      }
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
    queueAutoScrollToBottom();
    loadConversation(selectedPhone, { forceScrollBottom: true });
    window.setTimeout(() => scrollMessagesToBottom(), 80);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, selectedPhone]);

  useLayoutEffect(() => {
    if (!autoScrollToBottomRef.current || conversationLoading) {
      return;
    }

    const container = messageListRef.current;
    if (!container) {
      return;
    }

    container.scrollTop = container.scrollHeight;
    window.requestAnimationFrame(() => {
      const next = messageListRef.current;
      if (!next) {
        return;
      }
      next.scrollTop = next.scrollHeight;
      autoScrollToBottomRef.current = false;
    });
  }, [messages, conversationLoading, selectedPhone]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const refresh = async () => {
      await loadGroups({ silent: true });
      if (selectedPhone) {
        await loadConversation(selectedPhone, { skipGroupRefresh: true, silent: true });
      }
    };

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        refresh();
      }
    }, pollIntervalMs);

    return () => window.clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, selectedPhone, pollIntervalMs]);

  useEffect(() => {
    if (!token || !selectedPhone) {
      return;
    }

    const sendCurrentPresence = () => {
      const isActive = document.visibilityState === "visible" && document.hasFocus();
      sendPresence(selectedPhone, isActive);
    };

    sendCurrentPresence();
    const intervalId = window.setInterval(sendCurrentPresence, 20000);

    const handleVisibilityChange = () => sendCurrentPresence();
    const handleFocus = () => sendCurrentPresence();
    const handleBlur = () => sendCurrentPresence();

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
      sendPresence(selectedPhone, false);
    };
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

      const data = await response.json().catch(() => ({}));
      setReplyText("");

      if (data?.message?._id) {
        setMessages((prev) => [...prev, data.message]);
        window.requestAnimationFrame(() => {
          const container = messageListRef.current;
          if (container) {
            container.scrollTop = container.scrollHeight;
          }
        });
      }

      await loadGroups({ silent: true });
      await loadConversation(selectedPhone, {
        silent: true,
        skipGroupRefresh: true,
        forceScrollBottom: true,
      });
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

  const handleAddContact = async (event) => {
    event.preventDefault();
    const phone = newContactPhone.trim();
    if (!phone) {
      return;
    }

    setAddingContact(true);
    setErrorMessage("");

    try {
      const response = await fetch(`${apiBaseUrl}/api/admin/messages/contacts`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customer_phone: phone,
          customer_name: newContactName.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to add contact");
      }

      const data = await response.json();
      setNewContactName("");
      setNewContactPhone("");
      const contactPhone = data?.contact?.customer_phone || phone;
      const contactName = data?.contact?.customer_name || "";
      setSelectedPhone(contactPhone);
      setSelectedName(contactName);
      setNameInput(contactName);
      await loadGroups({ silent: true });
      await loadConversation(contactPhone, { silent: true, forceScrollBottom: true });
    } catch (error) {
      setErrorMessage(error.message || "Failed to add contact");
    } finally {
      setAddingContact(false);
    }
  };

  const handleOpenMedia = async (messageId, mediaIndex) => {
    const mediaKey = `${messageId}-${mediaIndex}`;
    setOpeningMediaKey(mediaKey);
    try {
      const response = await fetch(`${apiBaseUrl}/api/admin/messages/media/${messageId}/${mediaIndex}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to load attachment");
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      window.open(objectUrl, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (error) {
      setErrorMessage(error.message || "Failed to load attachment");
    } finally {
      setOpeningMediaKey("");
    }
  };

  const handleLoadMediaPreview = async (messageId, mediaIndex) => {
    const mediaKey = `${messageId}-${mediaIndex}`;
    if (mediaPreviewUrls[mediaKey]) {
      return;
    }

    setOpeningMediaKey(mediaKey);
    try {
      const response = await fetch(`${apiBaseUrl}/api/admin/messages/media/${messageId}/${mediaIndex}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to load attachment");
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      setMediaPreviewUrls((prev) => ({ ...prev, [mediaKey]: objectUrl }));
    } catch (error) {
      setErrorMessage(error.message || "Failed to load attachment");
    } finally {
      setOpeningMediaKey("");
    }
  };

  useEffect(() => {
    mediaPreviewUrlsRef.current = mediaPreviewUrls;
  }, [mediaPreviewUrls]);

  useEffect(() => {
    return () => {
      Object.values(mediaPreviewUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

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
          <form className="mb-3 space-y-2 rounded-md border border-[#eee] p-2" onSubmit={handleAddContact}>
            <input
              type="text"
              value={newContactName}
              onChange={(event) => setNewContactName(event.target.value)}
              placeholder="Contact name (optional)"
              className="w-full rounded-md border border-[#ddd] px-2 py-1.5 text-sm"
              maxLength={120}
            />
            <div className="flex gap-2">
              <input
                type="tel"
                value={newContactPhone}
                onChange={(event) => setNewContactPhone(event.target.value)}
                placeholder="Phone number"
                className="w-full rounded-md border border-[#ddd] px-2 py-1.5 text-sm"
                required
              />
              <button
                type="submit"
                className="rounded-md border border-[#333] px-3 py-1.5 text-sm whitespace-nowrap"
                disabled={addingContact}
              >
                {addingContact ? "Adding..." : "Add"}
              </button>
            </div>
          </form>
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
                    ref={nameInputRef}
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

              <div ref={messageListRef} className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
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
                      {Array.isArray(message.media) && message.media.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {message.media.map((item, mediaIndex) => {
                            const mediaKey = `${message._id}-${mediaIndex}`;
                            const previewUrl = mediaPreviewUrls[mediaKey];
                            const isImage = String(item.content_type || "").toLowerCase().startsWith("image/");
                            return (
                              <div key={mediaKey} className="space-y-1">
                                {isImage && previewUrl ? (
                                  <button type="button" onClick={() => window.open(previewUrl, "_blank", "noopener,noreferrer")}>
                                    <img
                                      src={previewUrl}
                                      alt={`Attachment ${mediaIndex + 1}`}
                                      className="max-h-40 rounded-md border border-white/40 object-cover"
                                    />
                                  </button>
                                ) : isImage ? (
                                  <button
                                    type="button"
                                    className={`block underline ${message.direction === "outbound" ? "text-white" : "text-[#444]"}`}
                                    onClick={() => handleLoadMediaPreview(message._id, mediaIndex)}
                                    disabled={openingMediaKey === mediaKey}
                                  >
                                    {openingMediaKey === mediaKey
                                      ? `Loading preview ${mediaIndex + 1}...`
                                      : `Load image preview ${mediaIndex + 1}`}
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  className={`block underline ${message.direction === "outbound" ? "text-white" : "text-[#444]"}`}
                                  onClick={() => handleOpenMedia(message._id, mediaIndex)}
                                  disabled={openingMediaKey === mediaKey}
                                >
                                  {openingMediaKey === mediaKey
                                    ? `Opening attachment ${mediaIndex + 1}...`
                                    : `Open attachment ${mediaIndex + 1}${
                                        item.content_type ? ` (${item.content_type})` : ""
                                      }`}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
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
                <div ref={messageEndRef} />
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
