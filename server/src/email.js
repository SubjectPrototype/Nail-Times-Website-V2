const RESEND_API_URL = "https://api.resend.com/emails";
const businessTimeZone = process.env.BUSINESS_TIMEZONE || "America/Chicago";

function formatBookingDateTime(dateInput) {
  return new Date(dateInput).toLocaleString("en-US", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: businessTimeZone,
  });
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatGiftCardMoney(cents) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(cents || 0) / 100);
}

async function sendGiftCardReceiptEmail({ card }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { skipped: true, reason: "RESEND_API_KEY not set" };
  }
  if (!card.customer_email) {
    throw new Error("This gift card does not have a customer email address");
  }

  const from = process.env.FROM_EMAIL || "Nail Shop <onboarding@resend.dev>";
  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: card.customer_email,
      subject: `Nail Times Gift Card Receipt ${card.receipt_number}`,
      html: `
        <div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;color:#333">
          <h1 style="color:#c7668b;margin-bottom:4px">Nail Times</h1>
          <h2 style="margin-top:0">Gift Card Receipt</h2>
          <p>Hi ${escapeHtml(card.customer_name)},</p>
          <p>Thank you for your gift card purchase. Please keep this receipt and gift card code.</p>
          <table style="width:100%;border-collapse:collapse">
            <tbody>
              <tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Receipt</strong></td><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(card.receipt_number)}</td></tr>
              <tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Gift Card Code</strong></td><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(card.code)}</td></tr>
              <tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Original Amount</strong></td><td style="padding:8px;border-bottom:1px solid #eee">${formatGiftCardMoney(card.issued_amount_cents)}</td></tr>
              <tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Date Issued</strong></td><td style="padding:8px;border-bottom:1px solid #eee">${formatBookingDateTime(card.created_at)}</td></tr>
              <tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Expiration Date</strong></td><td style="padding:8px;border-bottom:1px solid #eee">${formatBookingDateTime(card.expires_at)}</td></tr>
            </tbody>
          </table>
          <p style="margin-top:24px">Present the gift card code when redeeming at Nail Times.</p>
        </div>
      `,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || "Failed to send gift card receipt email");
  }
  return { sent: true };
}

async function sendBookingEmails({ booking, adminEmail }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { skipped: true, reason: "RESEND_API_KEY not set" };
  }

  const from = process.env.FROM_EMAIL || "Nail Shop <onboarding@resend.dev>";
  const notifyEmail = process.env.ADMIN_NOTIFY_EMAIL || adminEmail;
  const subject = "Appointment Request Confirmation";
  const durationText = `${booking.duration_minutes || 60} minutes`;
  const formattedDateTime = formatBookingDateTime(booking.start_time);
  const notesHtml = booking.notes
    ? String(booking.notes)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br/>")
    : "N/A";
  const servicesHtml = Array.isArray(booking.selected_services) && booking.selected_services.length > 0
    ? booking.selected_services
        .map(
          (item) =>
            `<li>${item.name} (${item.duration_minutes || "?"} min${item.technician ? `, Tech: ${item.technician}` : ""})</li>`
        )
        .join("")
    : `<li>${booking.service}</li>`;

  const customerHtml = `
    <h2>Appointment Request Received</h2>
    <p>Hi ${booking.customer_name},</p>
    <p>We received your appointment request. Here are the details:</p>
    <ul>
      <li>Date/Time: ${formattedDateTime}</li>
      <li>Total Duration: ${durationText}</li>
      <li>Services:</li>
      <ul>${servicesHtml}</ul>
    </ul>
    <p>We will confirm shortly. Thank you!</p>
  `;

  const adminHtml = `
    <h2>New Appointment Request</h2>
    <ul>
      <li>Name: ${booking.customer_name}</li>
      <li>Email: ${booking.customer_email}</li>
      <li>Phone: ${booking.customer_phone || "N/A"}</li>
      <li>Date/Time: ${formattedDateTime}</li>
      <li>Total Duration: ${durationText}</li>
      <li>Services:</li>
      <ul>${servicesHtml}</ul>
      <li>Notes: ${notesHtml}</li>
    </ul>
  `;

  const requests = [];

  requests.push(
    fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: booking.customer_email,
        subject,
        html: customerHtml,
      }),
    })
  );

  if (notifyEmail) {
    requests.push(
      fetch(RESEND_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: notifyEmail,
          subject: "New Appointment Request",
          html: adminHtml,
        }),
      })
    );
  }

  await Promise.all(requests);
  return { sent: true };
}

async function sendAdminOtpEmail({ email, code }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { skipped: true, reason: "RESEND_API_KEY not set" };
  }

  const from = process.env.FROM_EMAIL || "Nail Shop <onboarding@resend.dev>";

  await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: email,
      subject: "Your Admin Login Code",
      html: `<p>Your admin login code is:</p><h2>${code}</h2><p>This code expires in 10 minutes.</p>`,
    }),
  });

  return { sent: true };
}

async function sendBookingConfirmedEmail({ booking, cancelUrl }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { skipped: true, reason: "RESEND_API_KEY not set" };
  }

  const from = process.env.FROM_EMAIL || "Nail Shop <onboarding@resend.dev>";
  const dateTime = formatBookingDateTime(booking.start_time);
  const durationText = `${booking.duration_minutes || 60} minutes`;
  const servicesHtml = Array.isArray(booking.selected_services) && booking.selected_services.length > 0
    ? booking.selected_services
        .map(
          (item) =>
            `<li>${item.name} (${item.duration_minutes || "?"} min${item.technician ? `, Tech: ${item.technician}` : ""})</li>`
        )
        .join("")
    : `<li>${booking.service}</li>`;

  await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: booking.customer_email,
      subject: "Your Appointment Is Confirmed",
      html: `
        <h2>Your appointment is confirmed</h2>
        <p>Hi ${booking.customer_name},</p>
        <p>Your appointment at Nail Times has been confirmed.</p>
        <ul>
          <li>Date/Time: ${dateTime}</li>
          <li>Total Duration: ${durationText}</li>
          <li>Services:</li>
          <ul>${servicesHtml}</ul>
        </ul>
        ${cancelUrl ? `<p>If you need to cancel, use this link: <a href="${cancelUrl}">${cancelUrl}</a></p>` : ""}
        <p>We look forward to seeing you.</p>
      `,
    }),
  });

  return { sent: true };
}

async function sendBookingCancelledEmail({ booking, reason }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { skipped: true, reason: "RESEND_API_KEY not set" };
  }

  const from = process.env.FROM_EMAIL || "Nail Shop <onboarding@resend.dev>";
  const dateTime = formatBookingDateTime(booking.start_time);
  const durationText = `${booking.duration_minutes || 60} minutes`;
  const servicesHtml = Array.isArray(booking.selected_services) && booking.selected_services.length > 0
    ? booking.selected_services
        .map(
          (item) =>
            `<li>${item.name} (${item.duration_minutes || "?"} min${item.technician ? `, Tech: ${item.technician}` : ""})</li>`
        )
        .join("")
    : `<li>${booking.service}</li>`;
  const safeReason = String(reason || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br/>");

  await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: booking.customer_email,
      subject: "Your Appointment Was Cancelled",
      html: `
        <h2>Your appointment was cancelled</h2>
        <p>Hi ${booking.customer_name},</p>
        <p>Your appointment at Nail Times has been cancelled.</p>
        <ul>
          <li>Date/Time: ${dateTime}</li>
          <li>Total Duration: ${durationText}</li>
          <li>Services:</li>
          <ul>${servicesHtml}</ul>
        </ul>
        ${safeReason ? `<p><strong>Reason:</strong> ${safeReason}</p>` : ""}
        <p>Please text us or book online to choose another time.</p>
      `,
    }),
  });

  return { sent: true };
}

async function sendAdminInboundMessageEmail({ from, customerName, body }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { skipped: true, reason: "RESEND_API_KEY not set" };
  }

  const notifyEmail = process.env.ADMIN_NOTIFY_EMAIL || process.env.ADMIN_EMAIL;
  if (!notifyEmail) {
    return { skipped: true, reason: "ADMIN_NOTIFY_EMAIL or ADMIN_EMAIL not set" };
  }

  const fromEmail = process.env.FROM_EMAIL || "Nail Shop <onboarding@resend.dev>";
  const safePreview = String(body || "").replace(/\s+/g, " ").trim().slice(0, 500);
  const senderLabel = customerName || "Customer";

  await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: notifyEmail,
      subject: `New customer text from ${senderLabel}`,
      html: `
        <h2>New Customer Text Message</h2>
        <p><strong>From:</strong> ${senderLabel} (${from})</p>
        <p><strong>Message:</strong></p>
        <p>${safePreview || "(empty message)"}</p>
      `,
    }),
  });

  return { sent: true };
}

module.exports = {
  sendBookingEmails,
  sendAdminOtpEmail,
  sendBookingConfirmedEmail,
  sendBookingCancelledEmail,
  sendAdminInboundMessageEmail,
  sendGiftCardReceiptEmail,
};
