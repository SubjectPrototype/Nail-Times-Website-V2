const RESEND_API_URL = "https://api.resend.com/emails";

async function sendBookingEmails({ booking, adminEmail }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { skipped: true, reason: "RESEND_API_KEY not set" };
  }

  const from = process.env.FROM_EMAIL || "Nail Shop <onboarding@resend.dev>";
  const notifyEmail = process.env.ADMIN_NOTIFY_EMAIL || adminEmail;
  const subject = "Appointment Request Confirmation";
  const durationText = `${booking.duration_minutes || 60} minutes`;
  const formattedDateTime = new Date(booking.start_time).toLocaleString("en-US", {
    dateStyle: "full",
    timeStyle: "short",
  });
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
      <li>Notes: ${booking.notes || "N/A"}</li>
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

async function sendBookingConfirmedEmail({ booking }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { skipped: true, reason: "RESEND_API_KEY not set" };
  }

  const from = process.env.FROM_EMAIL || "Nail Shop <onboarding@resend.dev>";
  const dateTime = new Date(booking.start_time).toLocaleString("en-US", {
    dateStyle: "full",
    timeStyle: "short",
  });
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
        <p>We look forward to seeing you.</p>
      `,
    }),
  });

  return { sent: true };
}

module.exports = { sendBookingEmails, sendAdminOtpEmail, sendBookingConfirmedEmail };
