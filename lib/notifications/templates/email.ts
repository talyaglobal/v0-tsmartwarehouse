/**
 * Email Templates for Notifications
 */

export interface EmailTemplateData {
  [key: string]: any
}

export interface EmailTemplate {
  subject: string | ((data: EmailTemplateData) => string)
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

  "booking-request-received": {
    subject: (data: EmailTemplateData) => `New Booking Request - #${data.bookingId || "N/A"}`,
    html: (data: EmailTemplateData) => {
      const content = `
        <p>Dear ${data.warehouseOwnerName || "Warehouse Owner"},</p>
        <p>You have received a new booking request for your warehouse.</p>
        <p><strong>Booking Details:</strong></p>
        <ul>
          <li><strong>Booking ID:</strong> ${data.bookingId || "N/A"}</li>
          <li><strong>Customer:</strong> ${data.customerName || "N/A"}</li>
          <li><strong>Type:</strong> ${data.bookingType || "N/A"}</li>
          ${data.palletCount ? `<li><strong>Pallet Count:</strong> ${data.palletCount}</li>` : ""}
          ${data.areaSqFt ? `<li><strong>Area (sq ft):</strong> ${data.areaSqFt}</li>` : ""}
          <li><strong>Start Date:</strong> ${data.startDate || "N/A"}</li>
          ${data.endDate ? `<li><strong>End Date:</strong> ${data.endDate}</li>` : ""}
        </ul>
        <p>Please review the request and provide a price proposal.</p>
      `
      const actionUrl = data.dashboardUrl || `${process.env.NEXT_PUBLIC_SITE_URL}/warehouse-owner/bookings`
      return baseEmailTemplate("New Booking Request", content, actionUrl, "Review Request")
    },
    text: (data: EmailTemplateData) => {
      return `
New Booking Request - #${data.bookingId || "N/A"}

Dear ${data.warehouseOwnerName || "Warehouse Owner"},

You have received a new booking request for your warehouse.

Booking Details:
- Booking ID: ${data.bookingId || "N/A"}
- Customer: ${data.customerName || "N/A"}
- Type: ${data.bookingType || "N/A"}
${data.palletCount ? `- Pallet Count: ${data.palletCount}` : ""}
${data.areaSqFt ? `- Area (sq ft): ${data.areaSqFt}` : ""}
- Start Date: ${data.startDate || "N/A"}
${data.endDate ? `- End Date: ${data.endDate}` : ""}

Please review the request and provide a price proposal.

View request: ${data.dashboardUrl || `${process.env.NEXT_PUBLIC_SITE_URL}/warehouse-owner/bookings`}
      `.trim()
    },
  },

  "booking-proposal-received": {
    subject: (data: EmailTemplateData) => `Price Proposal Received - #${data.bookingId || "N/A"}`,
    html: (data: EmailTemplateData) => {
      const content = `
        <p>Dear ${data.customerName || "Customer"},</p>
        <p>A price proposal has been created for your booking request.</p>
        <p><strong>Proposal Details:</strong></p>
        <ul>
          <li><strong>Booking ID:</strong> ${data.bookingId || "N/A"}</li>
          <li><strong>Proposed Price:</strong> $${data.proposedPrice || "0.00"}</li>
          ${data.expiresAt ? `<li><strong>Expires At:</strong> ${data.expiresAt}</li>` : ""}
          ${data.terms ? `<li><strong>Terms:</strong> ${data.terms}</li>` : ""}
        </ul>
        <p>Please review and accept or reject the proposal.</p>
      `
      const actionUrl = data.dashboardUrl || `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/bookings`
      return baseEmailTemplate("Price Proposal Received", content, actionUrl, "Review Proposal")
    },
    text: (data: EmailTemplateData) => {
      return `
Price Proposal Received - #${data.bookingId || "N/A"}

Dear ${data.customerName || "Customer"},

A price proposal has been created for your booking request.

Proposal Details:
- Booking ID: ${data.bookingId || "N/A"}
- Proposed Price: $${data.proposedPrice || "0.00"}
${data.expiresAt ? `- Expires At: ${data.expiresAt}` : ""}
${data.terms ? `- Terms: ${data.terms}` : ""}

Please review and accept or reject the proposal.

View proposal: ${data.dashboardUrl || `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/bookings`}
      `.trim()
    },
  },

  "booking-approved": {
    subject: (data: EmailTemplateData) => `Booking Approved - #${data.bookingId || "N/A"}`,
    html: (data: EmailTemplateData) => {
      const content = `
        <p>Dear ${data.customerName || "Customer"},</p>
        <p>Your booking request has been approved!</p>
        <p><strong>Booking Details:</strong></p>
        <ul>
          <li><strong>Booking ID:</strong> ${data.bookingId || "N/A"}</li>
          <li><strong>Type:</strong> ${data.bookingType || "N/A"}</li>
          ${data.palletCount ? `<li><strong>Pallet Count:</strong> ${data.palletCount}</li>` : ""}
          ${data.areaSqFt ? `<li><strong>Area (sq ft):</strong> ${data.areaSqFt}</li>` : ""}
          <li><strong>Start Date:</strong> ${data.startDate || "N/A"}</li>
          ${data.endDate ? `<li><strong>End Date:</strong> ${data.endDate}</li>` : ""}
          <li><strong>Total Amount:</strong> $${data.totalAmount || "0.00"}</li>
        </ul>
        <p>Your booking is now active. You can manage it from your dashboard.</p>
      `
      const actionUrl = data.dashboardUrl || `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/bookings`
      return baseEmailTemplate("Booking Approved", content, actionUrl, "View Booking")
    },
    text: (data: EmailTemplateData) => {
      return `
Booking Approved - #${data.bookingId || "N/A"}

Dear ${data.customerName || "Customer"},

Your booking request has been approved!

Booking Details:
- Booking ID: ${data.bookingId || "N/A"}
- Type: ${data.bookingType || "N/A"}
${data.palletCount ? `- Pallet Count: ${data.palletCount}` : ""}
${data.areaSqFt ? `- Area (sq ft): ${data.areaSqFt}` : ""}
- Start Date: ${data.startDate || "N/A"}
${data.endDate ? `- End Date: ${data.endDate}` : ""}
- Total Amount: $${data.totalAmount || "0.00"}

Your booking is now active. You can manage it from your dashboard.

View booking: ${data.dashboardUrl || `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/bookings`}
      `.trim()
    },
  },

  "booking-rejected": {
    subject: (data: EmailTemplateData) => `Booking Request Rejected - #${data.bookingId || "N/A"}`,
    html: (data: EmailTemplateData) => {
      const content = `
        <p>Dear ${data.customerName || "Customer"},</p>
        <p>Unfortunately, your booking request has been rejected.</p>
        <p><strong>Booking Details:</strong></p>
        <ul>
          <li><strong>Booking ID:</strong> ${data.bookingId || "N/A"}</li>
          <li><strong>Type:</strong> ${data.bookingType || "N/A"}</li>
          ${data.reason ? `<li><strong>Reason:</strong> ${data.reason}</li>` : ""}
        </ul>
        ${data.reason ? `<p><strong>Reason for rejection:</strong> ${data.reason}</p>` : ""}
        <p>If you have any questions, please contact support.</p>
      `
      const actionUrl = data.dashboardUrl || `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/bookings`
      return baseEmailTemplate("Booking Request Rejected", content, actionUrl, "View Booking")
    },
    text: (data: EmailTemplateData) => {
      return `
Booking Request Rejected - #${data.bookingId || "N/A"}

Dear ${data.customerName || "Customer"},

Unfortunately, your booking request has been rejected.

Booking Details:
- Booking ID: ${data.bookingId || "N/A"}
- Type: ${data.bookingType || "N/A"}
${data.reason ? `- Reason: ${data.reason}` : ""}

${data.reason ? `Reason for rejection: ${data.reason}` : ""}

If you have any questions, please contact support.

View booking: ${data.dashboardUrl || `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/bookings`}
      `.trim()
    },
  },

  "invoice-overdue": {
    subject: (data: EmailTemplateData) => `Invoice Overdue - #${data.invoiceId || "N/A"}`,
    html: (data: EmailTemplateData) => {
      const content = `
        <p>Dear ${data.customerName || "Customer"},</p>
        <p><strong>Important:</strong> Your invoice is overdue.</p>
        <p><strong>Invoice Details:</strong></p>
        <ul>
          <li><strong>Invoice ID:</strong> ${data.invoiceId || "N/A"}</li>
          <li><strong>Amount Due:</strong> $${data.amount || "0.00"}</li>
          <li><strong>Due Date:</strong> ${data.dueDate || "N/A"}</li>
          ${data.daysOverdue ? `<li><strong>Days Overdue:</strong> ${data.daysOverdue}</li>` : ""}
        </ul>
        <p>Please make payment as soon as possible to avoid any additional fees or service interruptions.</p>
      `
      const actionUrl = data.dashboardUrl || `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/invoices`
      return baseEmailTemplate("Invoice Overdue", content, actionUrl, "Pay Invoice")
    },
    text: (data: EmailTemplateData) => {
      return `
Invoice Overdue - #${data.invoiceId || "N/A"}

Dear ${data.customerName || "Customer"},

IMPORTANT: Your invoice is overdue.

Invoice Details:
- Invoice ID: ${data.invoiceId || "N/A"}
- Amount Due: $${data.amount || "0.00"}
- Due Date: ${data.dueDate || "N/A"}
${data.daysOverdue ? `- Days Overdue: ${data.daysOverdue}` : ""}

Please make payment as soon as possible to avoid any additional fees or service interruptions.

Pay invoice: ${data.dashboardUrl || `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/invoices`}
      `.trim()
    },
  },

  "team-invitation": {
    subject: (data: EmailTemplateData) => `Team Invitation - ${data.companyName || "Company"}`,
    html: (data: EmailTemplateData) => {
      const content = `
        <p>Dear ${data.invitedName || "User"},</p>
        <p>You have been invited to join <strong>${data.companyName || "a company"}</strong> on TSmart Warehouse.</p>
        <p><strong>Invitation Details:</strong></p>
        <ul>
          <li><strong>Company:</strong> ${data.companyName || "N/A"}</li>
          <li><strong>Role:</strong> ${data.role || "Member"}</li>
          <li><strong>Invited By:</strong> ${data.invitedBy || "N/A"}</li>
          ${data.expiresAt ? `<li><strong>Expires At:</strong> ${data.expiresAt}</li>` : ""}
        </ul>
        <p>Click the button below to accept the invitation and create your account.</p>
      `
      const actionUrl = data.acceptUrl || `${process.env.NEXT_PUBLIC_SITE_URL}/accept-invitation/${data.token}`
      return baseEmailTemplate("Team Invitation", content, actionUrl, "Accept Invitation")
    },
    text: (data: EmailTemplateData) => {
      return `
Team Invitation - ${data.companyName || "Company"}

Dear ${data.invitedName || "User"},

You have been invited to join ${data.companyName || "a company"} on TSmart Warehouse.

Invitation Details:
- Company: ${data.companyName || "N/A"}
- Role: ${data.role || "Member"}
- Invited By: ${data.invitedBy || "N/A"}
${data.expiresAt ? `- Expires At: ${data.expiresAt}` : ""}

Click the link below to accept the invitation and create your account.

Accept invitation: ${data.acceptUrl || `${process.env.NEXT_PUBLIC_SITE_URL}/accept-invitation/${data.token}`}
      `.trim()
    },
  },
}

export function getEmailTemplate(templateName: string): EmailTemplate | null {
  return emailTemplates[templateName] || null
}

