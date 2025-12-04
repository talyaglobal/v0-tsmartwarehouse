# Business Logic Module

This directory contains all business logic functions for the TSmart Warehouse Management System.

## Overview

The business logic is organized into separate modules, each handling a specific domain:

1. **Pricing** - Calculate prices with volume and membership discounts
2. **Membership** - Determine membership tiers based on pallet count
3. **Capacity** - Manage warehouse capacity and availability
4. **Bookings** - Create bookings with availability checking
5. **Invoices** - Automatically generate invoices for bookings
6. **Tasks** - Intelligent task assignment to workers
7. **Claims** - Process customer claims workflow

## Modules

### 1. Pricing (`pricing.ts`)

Calculates pricing for bookings with automatic discount application.

**Key Functions:**
- `calculatePalletPricing()` - Calculate pallet booking pricing with discounts
- `calculateAreaRentalPricing()` - Calculate area rental pricing with discounts
- `calculateTotalPrice()` - Quick price calculation

**Features:**
- Volume discounts based on pallet count thresholds (50, 100, 250 pallets)
- Membership tier discounts (Bronze 0%, Silver 5%, Gold 10%, Platinum 15%)
- Combined discount application (volume + membership)
- Detailed pricing breakdown

### 2. Membership (`membership.ts`)

Determines customer membership tiers and tracks upgrades.

**Key Functions:**
- `calculateMembershipTier()` - Calculate tier based on pallet count
- `getMembershipTierInfo()` - Get tier info with next tier details
- `checkTierUpgrade()` - Check if customer qualifies for upgrade

**Tier Thresholds:**
- Bronze: 0+ pallets (0% discount)
- Silver: 50+ pallets (5% discount)
- Gold: 100+ pallets (10% discount)
- Platinum: 250+ pallets (15% discount)

### 3. Capacity (`capacity.ts`)

Manages warehouse capacity for pallets and area rentals.

**Key Functions:**
- `checkPalletCapacity()` - Check if warehouse has space for pallets
- `checkAreaRentalCapacity()` - Check if warehouse has space for area rental
- `getWarehouseCapacity()` - Get overall capacity statistics
- `reserveCapacity()` - Reserve capacity when booking is confirmed
- `releaseCapacity()` - Release capacity when booking is cancelled/completed

**Features:**
- Real-time capacity checking
- Automatic capacity reservation/release
- Support for different zone types (pallet, cold-storage, hazmat)
- Area rental limited to Floor 3 (minimum 40,000 sq ft)

### 4. Bookings (`bookings.ts`)

Creates bookings with full availability checking and pricing.

**Key Functions:**
- `createBookingWithAvailability()` - Create booking with capacity check
- `confirmBooking()` - Confirm booking and reserve capacity
- `activateBooking()` - Activate booking when it starts
- `completeBooking()` - Complete booking and release capacity
- `cancelBooking()` - Cancel booking and release capacity

**Workflow:**
1. Check capacity availability
2. Calculate pricing with discounts
3. Create booking (status: pending)
4. Admin confirms → reserves capacity (status: confirmed)
5. Booking starts → activate (status: active)
6. Booking ends → complete and release capacity (status: completed)

### 5. Invoices (`invoices.ts`)

Automatically generates invoices for bookings and recurring charges.

**Key Functions:**
- `generateBookingInvoice()` - Generate invoice for new booking
- `generateMonthlyStorageInvoice()` - Generate monthly storage invoice
- `generateAnnualRentalInvoice()` - Generate annual area rental invoice
- `generateMonthlyInvoicesForActiveBookings()` - Batch generate monthly invoices

**Features:**
- Automatic invoice generation on booking confirmation
- Monthly recurring invoices for storage
- Tax calculation (8% default, configurable)
- Discount line items included
- Prevents duplicate monthly invoices

### 6. Tasks (`tasks.ts`)

Intelligent task assignment to workers based on availability and workload.

**Key Functions:**
- `createAndAssignTask()` - Create task and auto-assign to best worker
- `reassignTask()` - Reassign task to different worker
- `autoAssignPendingTasks()` - Auto-assign all pending tasks
- `balanceWorkload()` - Balance workload across workers

**Assignment Algorithm:**
1. Filter workers by availability (on shift, < 5 concurrent tasks)
2. Filter by skills (task type match)
3. Calculate workload score (lower = better)
4. Select worker with lowest workload
5. Prefer workers with matching skills if workload is equal

**Workload Scoring:**
- Base score = current task count
- +10 penalty if ≥5 tasks (overloaded)
- +5 penalty if ≥3 tasks (moderate load)

### 7. Claims (`claims.ts`)

Manages customer claim processing workflow.

**Key Functions:**
- `createCustomerClaim()` - Customer submits claim
- `startClaimReview()` - Admin starts review
- `reviewClaim()` - Admin approves/rejects claim
- `getClaimsNeedingReview()` - Get claims pending review
- `getCustomerClaimStats()` - Get customer claim statistics
- `escalateStaleClaims()` - Escalate claims under review too long

**Workflow:**
1. Customer submits claim (status: submitted)
2. Admin starts review (status: under-review)
3. Admin approves/rejects (status: approved/rejected)
4. If approved, payment processed (status: paid)
5. Credit applied to customer account

## Usage Examples

### Create a Booking with Availability Check

```typescript
import { createBookingWithAvailability } from '@/lib/business-logic'

const result = await createBookingWithAvailability({
  customerId: 'user-123',
  customerName: 'John Doe',
  customerEmail: 'john@example.com',
  warehouseId: 'wh-001',
  type: 'pallet',
  palletCount: 75,
  startDate: '2024-07-01',
  months: 1,
  membershipTier: 'gold',
})
```

### Calculate Pricing

```typescript
import { calculatePalletPricing } from '@/lib/business-logic'

const pricing = calculatePalletPricing({
  type: 'pallet',
  palletCount: 100,
  months: 1,
  membershipTier: 'gold',
  existingPalletCount: 50,
})

console.log(`Total: $${pricing.finalAmount}`)
console.log(`Volume Discount: ${pricing.volumeDiscountPercent}%`)
console.log(`Membership Discount: ${pricing.membershipDiscountPercent}%`)
```

### Generate Invoice

```typescript
import { generateBookingInvoice } from '@/lib/business-logic'

const invoice = await generateBookingInvoice({
  bookingId: 'book-123',
  customerId: 'user-123',
  customerName: 'John Doe',
  invoiceType: 'booking',
  membershipTier: 'gold',
})
```

### Assign Task

```typescript
import { createAndAssignTask } from '@/lib/business-logic'

const task = await createAndAssignTask({
  taskType: 'receiving',
  title: 'Receive shipment from Acme Corp',
  description: '75 pallets of electronics',
  priority: 'high',
  warehouseId: 'wh-001',
  bookingId: 'book-123',
  location: 'Dock 3',
})
```

## Integration

All business logic functions are exported from `lib/business-logic/index.ts` for easy importing:

```typescript
import {
  createBookingWithAvailability,
  calculatePalletPricing,
  generateBookingInvoice,
  createAndAssignTask,
  // ... etc
} from '@/lib/business-logic'
```

## Notes

- All functions are async and work with the Supabase database
- Functions include error handling and validation
- Capacity management automatically updates warehouse zones/halls
- Pricing calculations respect both volume and membership discounts
- Task assignment balances workload across workers
- Claims workflow includes automatic payment processing

## Future Enhancements

- [ ] Worker skill tracking in database
- [ ] Location-based task assignment (proximity)
- [ ] Advanced task scheduling algorithms
- [ ] Multi-warehouse capacity management
- [ ] Dynamic pricing based on demand
- [ ] Claim escalation notifications
- [ ] Automated invoice reminders

