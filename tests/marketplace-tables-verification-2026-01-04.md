# Marketplace Tables Verification Report

**Date:** 04.01.2026 14:21:47
**Status:** ✅ Completed



## Verification Summary

- **Total Tests:** 7
- **Passed:** 7 ✅
- **Failed:** 0 ❌
- **Warnings:** 0 ⚠️
- **Errors:** 0 🔴

**Overall Status:** ✅ PASS

---

## Test Results

### 1. Marketplace Tables Existence ✅ PASS

- **Expected:** 9 tables (with alternative naming)
- **Found:** 9 tables

**Tables Found:**
- ✅ conversations
- ✅ host_payouts
- ✅ inquiries
- ✅ platform_settings
- ✅ warehouse_availability
- ✅ warehouse_review_summary
- ✅ warehouse_reviews (alternative name for 'reviews')
- ✅ warehouse_messages (alternative name for 'messages')
- ✅ warehouse_favorites (alternative name for 'favorites')

**Note:** Migration 106 created tables with `warehouse_` prefix. This is the correct naming convention used throughout the system.

---

### 2. Reviews Table Structure ✅ PASS


**Table:** warehouse_reviews

**Columns (26):**
- `id`: uuid (not null) [default: gen_random_uuid()]
- `warehouse_id`: uuid (not null)
- `booking_id`: text (not null)
- `user_id`: uuid (not null)
- `rating`: integer (not null)
- `title`: text (nullable)
- `comment`: text (nullable)
- `host_response`: text (nullable)
- `host_response_at`: timestamp with time zone (nullable)
- `created_at`: timestamp with time zone (nullable) [default: now()]
- `updated_at`: timestamp with time zone (nullable) [default: now()]
- `communication_rating`: integer (nullable)
- `accuracy_rating`: integer (nullable)
- `location_rating`: integer (nullable)
- `value_rating`: integer (nullable)
- `cleanliness_rating`: integer (nullable)
- `pros`: ARRAY (nullable)
- `cons`: ARRAY (nullable)
- `is_published`: boolean (nullable) [default: false]
- `is_flagged`: boolean (nullable) [default: false]
- `flag_reason`: text (nullable)
- `moderated_by`: uuid (nullable)
- `moderated_at`: timestamp with time zone (nullable)
- `review_type`: text (nullable) [default: 'guest_to_host'::text]
- `status`: boolean (nullable) [default: true]
- `reviewee_id`: uuid (nullable)

---

### 3. Platform Settings ✅ PASS

- **Count:** 7

**Settings:**
- **cancellation_policies:** [object Object] - Cancellation policy options
- **inquiry_expiry_days:** 7 - Days before inquiry expires
- **max_booking_days:** 365 - Maximum booking duration in days
- **min_booking_days:** 1 - Minimum booking duration in days
- **payout_delay_days:** 3 - Days to wait before payout after booking completion
- **platform_fee_percent:** 10 - Platform commission rate (%)
- **review_window_days:** 14 - Days allowed to submit review after booking ends

---

### 4. Companies Stripe Connect Columns ✅ PASS

- **Count:** 5 columns

**Columns:**
- ✅ `stripe_connect_account_id` - TEXT (nullable)
- ✅ `stripe_connect_onboarding_complete` - BOOLEAN (default: false)
- ✅ `stripe_connect_status` - TEXT (default: 'not_connected')
- ✅ `verification_documents` - JSONB (default: '[]')
- ✅ `verification_status` - TEXT (default: 'unverified')

---

### 5. Warehouse Listings View ✅ PASS

- **Exists:** Yes

---

### 6. Table Record Counts ✅ PASS


**Record Counts:**
- ✅ **warehouse_reviews:** 0 record(s) (using alternative table name)
- ✅ **conversations:** 0 record(s)
- ✅ **warehouse_messages:** 0 record(s) (using alternative table name)
- ✅ **warehouse_favorites:** 0 record(s) (using alternative table name)
- ✅ **inquiries:** 0 record(s)
- ✅ **warehouse_availability:** 0 record(s)
- ✅ **host_payouts:** 0 record(s)

---

### 7. Table Indexes ✅ PASS


**Indexes by Table:**
- **conversations:** 6 index(es)
  - conversations_pkey
  - idx_conversations_booking_id
  - idx_conversations_guest_id
  - idx_conversations_host_id
  - idx_conversations_last_message
  - idx_conversations_warehouse_id
- **inquiries:** 5 index(es)
  - idx_inquiries_created_at
  - idx_inquiries_guest_id
  - idx_inquiries_status
  - idx_inquiries_warehouse_id
  - inquiries_pkey
- **warehouse_availability:** 5 index(es)
  - idx_warehouse_availability_date_range
  - idx_warehouse_availability_lookup
  - idx_warehouse_availability_zone
  - warehouse_availability_pkey
  - warehouse_availability_unique
- **warehouse_favorites:** 4 index(es)
  - idx_favorites_user_id
  - idx_favorites_warehouse_id
  - warehouse_favorites_pkey
  - warehouse_favorites_user_id_warehouse_id_key
- **warehouse_messages:** 13 index(es)
  - idx_messages_conversation_id
  - idx_messages_created_at
  - idx_messages_sender_id
  - idx_messages_unread
  - idx_warehouse_messages_booking_id
  - idx_warehouse_messages_conversation_created
  - idx_warehouse_messages_conversation_id
  - idx_warehouse_messages_created_at
  - idx_warehouse_messages_read_at
  - idx_warehouse_messages_receiver_id
  - idx_warehouse_messages_sender_id
  - idx_warehouse_messages_warehouse_id
  - warehouse_messages_pkey
- **warehouse_reviews:** 11 index(es)
  - idx_reviews_booking_id
  - idx_reviews_is_published
  - idx_reviews_reviewer_id
  - idx_reviews_warehouse_id
  - idx_warehouse_reviews_booking_id
  - idx_warehouse_reviews_created_at
  - idx_warehouse_reviews_rating
  - idx_warehouse_reviews_user_id
  - idx_warehouse_reviews_warehouse_id
  - warehouse_reviews_booking_id_user_id_key
  - warehouse_reviews_pkey


---

## Recommendations


✅ **All Verifications Passed:** All marketplace tables from migration 107 are properly created and structured. Table naming follows the `warehouse_` prefix convention from migration 106, which is correct and consistent with the codebase.


---

*Report generated automatically by verify-marketplace-tables.js*
