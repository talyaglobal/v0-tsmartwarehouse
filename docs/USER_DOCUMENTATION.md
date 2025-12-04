# TSmart Warehouse Management System - User Documentation

**Version:** 1.0.0  
**Last Updated:** December 2024

Welcome to the TSmart Warehouse Management System! This guide will help you use the system effectively.

---

## Table of Contents

- [Getting Started](#getting-started)
- [User Roles](#user-roles)
- [Customer Guide](#customer-guide)
  - [Dashboard](#dashboard)
  - [Bookings](#bookings)
  - [Claims](#claims)
  - [Invoices](#invoices)
  - [Membership](#membership)
  - [Settings](#settings)
- [Worker Guide](#worker-guide)
  - [Tasks](#tasks)
  - [Inventory](#inventory)
  - [Scanning](#scanning)
- [Admin Guide](#admin-guide)
  - [Overview](#overview)
  - [Bookings Management](#bookings-management)
  - [Customer Management](#customer-management)
  - [Task Management](#task-management)
  - [Incident Management](#incident-management)
- [FAQs](#faqs)
- [Support](#support)

---

## Getting Started

### Creating an Account

1. Go to the registration page
2. Fill in your information:
   - Full Name
   - Email Address
   - Password (minimum 8 characters)
   - Company Name (optional)
3. Click **Register**
4. Check your email for verification link
5. Click the verification link to activate your account

### Logging In

1. Go to the login page
2. Enter your email and password
3. Click **Login**
4. You'll be redirected to your dashboard based on your role

### Forgot Password

1. Click **Forgot Password** on the login page
2. Enter your email address
3. Check your email for reset link
4. Click the link and set a new password

---

## User Roles

The system supports three user roles:

### Customer
- Create and manage bookings
- Submit claims
- View invoices and payment history
- Manage membership tier
- View notifications

### Worker
- View assigned tasks
- Update task status
- Scan inventory items
- Check in/out for shifts
- Report incidents

### Admin
- Full system access
- Manage all bookings
- Manage customers and workers
- Create and assign tasks
- Handle incidents and claims
- Configure pricing and settings
- View analytics

---

## Customer Guide

### Dashboard

Your dashboard provides an overview of your account:

- **Statistics Cards:**
  - Total Bookings
  - Active Bookings
  - Pending Invoices
  - Membership Tier

- **Recent Bookings:**
  - List of your most recent bookings
  - Quick status overview
  - Links to booking details

- **Recent Invoices:**
  - Latest invoices
  - Payment status
  - Due dates

### Bookings

#### Creating a Booking

1. Navigate to **Bookings** → **New Booking**
2. Select booking type:
   - **Pallet Storage:** For storing individual pallets
   - **Area Rental:** For renting warehouse space (minimum 40,000 sq ft, Floor 3 only)

3. **For Pallet Storage:**
   - Enter number of pallets
   - Select start date
   - Enter end date (optional)
   - Add notes (optional)
   - Click **Create Booking**

4. **For Area Rental:**
   - Enter area in square feet (minimum 40,000)
   - Select floor (must be Floor 3)
   - Select hall (A or B)
   - Select start date
   - Enter end date (optional)
   - Add notes (optional)
   - Click **Create Booking**

#### Viewing Bookings

- Go to **Bookings** to see all your bookings
- Filter by:
  - Status (Pending, Confirmed, Active, Completed, Cancelled)
  - Type (Pallet, Area Rental)
- Click on a booking to view details

#### Booking Statuses

- **Pending:** Awaiting admin approval
- **Confirmed:** Approved and ready
- **Active:** Currently in use
- **Completed:** Booking period ended
- **Cancelled:** Booking was cancelled

### Claims

#### Submitting a Claim

1. Navigate to **Claims** → **New Claim**
2. Fill in claim details:
   - **Type:** Damage, Loss, or Other
   - **Description:** Detailed description of the issue
   - **Booking:** Select related booking
   - **Amount:** Claimed amount
   - **Evidence:** Upload photos or documents (optional)
3. Click **Submit Claim**

#### Viewing Claims

- Go to **Claims** to see all your claims
- Filter by status:
  - Submitted
  - Under Review
  - Approved
  - Rejected
  - Paid

#### Claim Statuses

- **Submitted:** Claim has been submitted
- **Under Review:** Being reviewed by admin
- **Approved:** Claim approved, awaiting payment
- **Rejected:** Claim was rejected
- **Paid:** Payment has been processed

### Invoices

#### Viewing Invoices

1. Navigate to **Invoices**
2. View all invoices with:
   - Invoice number
   - Booking reference
   - Amount
   - Status
   - Due date

#### Invoice Statuses

- **Draft:** Invoice being prepared
- **Pending:** Awaiting payment
- **Paid:** Payment received
- **Overdue:** Past due date
- **Cancelled:** Invoice cancelled

#### Paying an Invoice

1. Click on an invoice to view details
2. Review invoice items and total
3. Click **Pay Now** (if payment gateway is configured)
4. Complete payment process

### Membership

#### Membership Tiers

- **Bronze:** Default tier (0% discount)
- **Silver:** 5% discount (50+ pallets)
- **Gold:** 10% discount (100+ pallets)
- **Platinum:** 15% discount (250+ pallets)

#### Viewing Membership

- Go to **Membership** to see:
  - Current tier
  - Benefits
  - Progress to next tier
  - Total pallets stored

### Settings

#### Account Settings

1. Navigate to **Settings**
2. Update:
   - Name
   - Email
   - Phone
   - Company
   - Avatar
3. Click **Save Changes**

#### Notification Preferences

1. Go to **Settings** → **Notifications**
2. Configure preferences for:
   - Email notifications
   - SMS notifications
   - Push notifications
   - WhatsApp notifications
3. Select notification types:
   - Booking updates
   - Invoice reminders
   - Task assignments
   - System announcements

---

## Worker Guide

### Tasks

#### Viewing Tasks

1. Navigate to **Tasks**
2. View all assigned tasks
3. Filter by:
   - Status (Pending, Assigned, In Progress, Completed)
   - Priority (Low, Medium, High, Urgent)
   - Type (Receiving, Putaway, Picking, etc.)

#### Task Types

- **Receiving:** Receive incoming shipments
- **Putaway:** Store items in warehouse
- **Picking:** Pick items for orders
- **Packing:** Pack items for shipping
- **Shipping:** Prepare shipments
- **Inventory Check:** Count inventory
- **Maintenance:** Maintenance tasks

#### Updating Task Status

1. Click on a task to view details
2. Update status:
   - **Start Task:** Change to "In Progress"
   - **Complete Task:** Mark as "Completed"
   - **Add Notes:** Document any issues
3. Click **Save**

### Inventory

#### Viewing Inventory

1. Navigate to **Inventory**
2. View inventory items by:
   - Location (Floor, Hall, Zone)
   - Booking
   - Status
3. Search for specific items

### Scanning

#### Using the Scanner

1. Navigate to **Scan**
2. Allow camera permissions
3. Point camera at barcode/QR code
4. System will automatically:
   - Identify the item
   - Show item details
   - Allow status updates

#### Manual Entry

If scanning fails:
1. Click **Manual Entry**
2. Enter barcode/QR code manually
3. Click **Search**

---

## Admin Guide

### Overview

The admin dashboard provides:
- **Warehouse Statistics:**
  - Total capacity
  - Utilization percentage
  - Active bookings
  - Available space

- **Recent Activity:**
  - New bookings
  - Completed tasks
  - Reported incidents
  - Pending claims

### Bookings Management

#### Viewing All Bookings

1. Navigate to **Bookings**
2. View all customer bookings
3. Filter by:
   - Customer
   - Status
   - Type
   - Date range

#### Approving Bookings

1. Click on a pending booking
2. Review details
3. Click **Approve** or **Reject**
4. Add notes if needed

#### Updating Bookings

1. Click on a booking
2. Update:
   - Status
   - Dates
   - Notes
3. Click **Save Changes**

### Customer Management

#### Viewing Customers

1. Navigate to **Customers**
2. View all registered customers
3. Filter by:
   - Membership tier
   - Status
   - Company

#### Customer Details

Click on a customer to view:
- Profile information
- Booking history
- Invoice history
- Claims history
- Credit balance

### Task Management

#### Creating Tasks

1. Navigate to **Tasks** → **Create Task**
2. Fill in:
   - Type
   - Title
   - Description
   - Priority
   - Assign to worker
   - Due date
   - Location
3. Click **Create Task**

#### Assigning Tasks

1. View pending tasks
2. Click **Assign**
3. Select worker
4. Set priority and due date
5. Click **Assign**

### Incident Management

#### Viewing Incidents

1. Navigate to **Incidents**
2. View all reported incidents
3. Filter by:
   - Status
   - Severity
   - Reporter
   - Date

#### Handling Incidents

1. Click on an incident
2. Review details
3. Update status:
   - **Investigating:** Under review
   - **Resolved:** Issue resolved
   - **Closed:** Case closed
4. Add resolution notes
5. Click **Save**

---

## FAQs

### General

**Q: How do I change my password?**
A: Go to Settings → Security → Change Password

**Q: Can I cancel a booking?**
A: Yes, contact admin or use the cancel option if available

**Q: How do I contact support?**
A: Use the contact form or email support@tsmart.com

### Bookings

**Q: What's the minimum area rental?**
A: 40,000 square feet (Floor 3 only)

**Q: Can I extend a booking?**
A: Yes, contact admin or update through the system

**Q: How is pricing calculated?**
A: Based on pallet count, area size, membership tier, and volume discounts

### Payments

**Q: What payment methods are accepted?**
A: Credit card, bank transfer (contact admin for details)

**Q: When are invoices due?**
A: Typically 30 days from invoice date (check invoice for exact due date)

**Q: Can I pay multiple invoices at once?**
A: Contact admin for bulk payment options

### Technical

**Q: The page won't load**
A: Check your internet connection, clear browser cache, or contact support

**Q: I can't upload files**
A: Check file size (max 10MB) and format (images: jpg, png, gif, webp; documents: pdf, doc, docx)

**Q: Notifications aren't working**
A: Check notification preferences in Settings and verify email/SMS configuration

---

## Support

### Getting Help

- **Email:** support@tsmart.com
- **Phone:** +1 (555) 123-4567
- **Hours:** Monday-Friday, 9 AM - 5 PM EST

### Reporting Issues

1. Go to Settings → Help & Support
2. Fill out the support form
3. Include:
   - Description of issue
   - Steps to reproduce
   - Screenshots (if applicable)
   - Browser and device information

### Feature Requests

Have an idea for improvement?
1. Contact support with your suggestion
2. Include use case and benefits
3. We'll review and consider for future updates

---

## Additional Resources

- [Terms of Service](/terms)
- [Privacy Policy](/privacy)
- [API Documentation](../docs/API_DOCUMENTATION.md) (for developers)

---

**Thank you for using TSmart Warehouse Management System!**

For the latest updates and announcements, check your notifications dashboard regularly.

