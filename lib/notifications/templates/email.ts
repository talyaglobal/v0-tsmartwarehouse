/**
 * Email Templates for Notifications
 */

export interface EmailTemplateData {
  [key: string]: any
}

export interface EmailTemplate {
  subject: string
  html: (data: EmailTemplateData) => string
  text?: (data: EmailTemplateData) => string
}

const baseEmailStyles = `
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #1a1a1a; color: white; padding: 20px; text-align: center; }
    .content { background: #f9f9f9; padding: 30px; }
    .footer { background: #1a1a1a; color: white; padding: 15px; text-align: center; font-size: 12px; }
    .button { display: inline-block; padding: 12px 24px; background: #007bff; color: white; text-decoration: none; border-radius: 4px; margin: 10px 0; }
    .button:hover { background: #0056b3; }
  </style>
`

function baseEmailTemplate(title: string, content: string, actionUrl?: string, actionText?: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${baseEmailStyles}
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>TSmart Warehouse</h1>
    </div>
    <div class="content">
      <h2>${title}</h2>
      ${content}
      ${actionUrl && actionText ? `<p><a href="${actionUrl}" class="button">${actionText}</a></p>` : ""}
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} TSmart Warehouse. All rights reserved.</p>
      <p>This is an automated notification. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
  `.trim()
}

export const emailTemplates: Record<string, EmailTemplate> = {
  "booking-confirmed": {
    subject: (data: EmailTemplateData) => `Booking Confirmed - #${data.bookingId || "N/A"}`,
    html: (data: EmailTemplateData) => {
      const content = `
        <p>Dear ${data.customerName || "Customer"},</p>
        <p>Your booking has been confirmed!</p>
        <p><strong>Booking Details:</strong></p>
        <ul>
          <li><strong>Booking ID:</strong> ${data.bookingId || "N/A"}</li>
          <li><strong>Type:</strong> ${data.bookingType || "N/A"}</li>
          <li><strong>Quantity:</strong> ${data.quantity || "N/A"}</li>
          <li><strong>Status:</strong> ${data.status || "Confirmed"}</li>
          ${data.expectedDate ? `<li><strong>Expected Date:</strong> ${data.expectedDate}</li>` : ""}
        </ul>
        <p>You can view your booking details in your dashboard.</p>
      `
      const actionUrl = data.dashboardUrl || `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/bookings`
      return baseEmailTemplate("Booking Confirmed", content, actionUrl, "View Booking")
    },
    text: (data: EmailTemplateData) => {
      return `
Booking Confirmed - #${data.bookingId || "N/A"}

Dear ${data.customerName || "Customer"},

Your booking has been confirmed!

Booking Details:
- Booking ID: ${data.bookingId || "N/A"}
- Type: ${data.bookingType || "N/A"}
- Quantity: ${data.quantity || "N/A"}
- Status: ${data.status || "Confirmed"}
${data.expectedDate ? `- Expected Date: ${data.expectedDate}` : ""}

View your booking: ${data.dashboardUrl || `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/bookings`}
      `.trim()
    },
  },

  "booking-reminder": {
    subject: (data: EmailTemplateData) => `Booking Reminder - #${data.bookingId || "N/A"}`,
    html: (data: EmailTemplateData) => {
      const content = `
        <p>Dear ${data.customerName || "Customer"},</p>
        <p>This is a reminder about your upcoming booking.</p>
        <p><strong>Booking Details:</strong></p>
        <ul>
          <li><strong>Booking ID:</strong> ${data.bookingId || "N/A"}</li>
          <li><strong>Type:</strong> ${data.bookingType || "N/A"}</li>
          <li><strong>Scheduled Date:</strong> ${data.scheduledDate || "N/A"}</li>
        </ul>
        <p>Please ensure you're prepared for your scheduled booking.</p>
      `
      const actionUrl = data.dashboardUrl || `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/bookings`
      return baseEmailTemplate("Booking Reminder", content, actionUrl, "View Booking")
    },
  },

  "invoice-created": {
    subject: (data: EmailTemplateData) => `New Invoice - #${data.invoiceId || "N/A"}`,
    html: (data: EmailTemplateData) => {
      const content = `
        <p>Dear ${data.customerName || "Customer"},</p>
        <p>A new invoice has been generated for your account.</p>
        <p><strong>Invoice Details:</strong></p>
        <ul>
          <li><strong>Invoice ID:</strong> ${data.invoiceId || "N/A"}</li>
          <li><strong>Amount:</strong> ${data.amount || "$0.00"}</li>
          <li><strong>Due Date:</strong> ${data.dueDate || "N/A"}</li>
          <li><strong>Status:</strong> ${data.status || "Pending"}</li>
        </ul>
        <p>Please review and pay your invoice before the due date.</p>
      `
      const actionUrl = data.dashboardUrl || `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/invoices`
      return baseEmailTemplate("New Invoice", content, actionUrl, "View Invoice")
    },
  },

  "invoice-due": {
    subject: (data: EmailTemplateData) => `Invoice Due Soon - #${data.invoiceId || "N/A"}`,
    html: (data: EmailTemplateData) => {
      const content = `
        <p>Dear ${data.customerName || "Customer"},</p>
        <p>This is a reminder that your invoice is due soon.</p>
        <p><strong>Invoice Details:</strong></p>
        <ul>
          <li><strong>Invoice ID:</strong> ${data.invoiceId || "N/A"}</li>
          <li><strong>Amount:</strong> ${data.amount || "$0.00"}</li>
          <li><strong>Due Date:</strong> ${data.dueDate || "N/A"}</li>
          ${data.daysUntilDue ? `<li><strong>Days Until Due:</strong> ${data.daysUntilDue}</li>` : ""}
        </ul>
        <p>Please make payment before the due date to avoid any late fees.</p>
      `
      const actionUrl = data.dashboardUrl || `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/invoices`
      return baseEmailTemplate("Invoice Due Reminder", content, actionUrl, "Pay Invoice")
    },
  },

  "task-assigned": {
    subject: (data: EmailTemplateData) => `New Task Assigned - ${data.taskTitle || "Task"}`,
    html: (data: EmailTemplateData) => {
      const content = `
        <p>Dear ${data.workerName || "Worker"},</p>
        <p>A new task has been assigned to you.</p>
        <p><strong>Task Details:</strong></p>
        <ul>
          <li><strong>Task:</strong> ${data.taskTitle || "N/A"}</li>
          <li><strong>Type:</strong> ${data.taskType || "N/A"}</li>
          <li><strong>Priority:</strong> ${data.priority || "Normal"}</li>
          ${data.dueDate ? `<li><strong>Due Date:</strong> ${data.dueDate}</li>` : ""}
        </ul>
        <p>Please review and complete the task as soon as possible.</p>
      `
      const actionUrl = data.dashboardUrl || `${process.env.NEXT_PUBLIC_SITE_URL}/worker/tasks`
      return baseEmailTemplate("Task Assigned", content, actionUrl, "View Task")
    },
  },

  "incident-reported": {
    subject: (data: EmailTemplateData) => `Incident Reported - #${data.incidentId || "N/A"}`,
    html: (data: EmailTemplateData) => {
      const content = `
        <p>Dear ${data.recipientName || "User"},</p>
        <p>A new incident has been reported${data.severity ? ` with ${data.severity} severity` : ""}.</p>
        <p><strong>Incident Details:</strong></p>
        <ul>
          <li><strong>Incident ID:</strong> ${data.incidentId || "N/A"}</li>
          <li><strong>Type:</strong> ${data.incidentType || "N/A"}</li>
          <li><strong>Description:</strong> ${data.description || "N/A"}</li>
          ${data.location ? `<li><strong>Location:</strong> ${data.location}</li>` : ""}
          ${data.reportedBy ? `<li><strong>Reported By:</strong> ${data.reportedBy}</li>` : ""}
        </ul>
        <p>Please review and take appropriate action.</p>
      `
      const actionUrl = data.dashboardUrl || `${process.env.NEXT_PUBLIC_SITE_URL}/admin/incidents`
      return baseEmailTemplate("Incident Reported", content, actionUrl, "View Incident")
    },
  },

  "system": {
    subject: (data: EmailTemplateData) => data.title || "System Notification",
    html: (data: EmailTemplateData) => {
      const content = `
        <p>Dear ${data.userName || "User"},</p>
        <p>${data.message || "You have a new system notification."}</p>
        ${data.details ? `<p><strong>Details:</strong></p><p>${data.details}</p>` : ""}
      `
      return baseEmailTemplate(data.title || "System Notification", content)
    },
  },
}

export function getEmailTemplate(templateName: string): EmailTemplate | null {
  return emailTemplates[templateName] || null
}

