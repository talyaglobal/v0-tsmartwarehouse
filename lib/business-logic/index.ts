/**
 * Business Logic Module - Centralized Exports
 * 
 * This module exports all business logic functions for:
 * - Pricing calculations with discounts
 * - Membership tier management
 * - Warehouse capacity management
 * - Booking creation and management
 * - Invoice generation
 * - Task assignment
 * - Claim processing
 */

// Pricing
export {
  calculatePalletPricing,
  calculateAreaRentalPricing,
  calculateTotalPrice,
  type PricingCalculationInput,
  type PricingCalculationResult,
} from "./pricing"

// Membership
export {
  calculateMembershipTierFromSpend,
  getMembershipTierInfoFromSpend,
  checkTierUpgradeFromSpend,
  getMembershipTierDiscount,
  isMembershipProgramEnabled,
  type MembershipTierInfo,
} from "./membership"

// Capacity
export {
  checkPalletCapacity,
  checkAreaRentalCapacity,
  getWarehouseCapacity,
  reserveCapacity,
  releaseCapacity,
  type CapacityCheck,
  type WarehouseCapacity,
} from "./capacity"

// Bookings
export {
  createBookingWithAvailability,
  confirmBooking,
  activateBooking,
  completeBooking,
  cancelBooking,
  createBookingOnBehalf,
  approveOnBehalfBooking,
  rejectOnBehalfBooking,
  getPendingBookingApprovals,
  type CreateBookingInput,
  type CreateBookingResult,
  type CreateOnBehalfBookingInput,
  type CreateOnBehalfBookingResult,
} from "./bookings"

// Teams
export {
  createTeamWithValidation,
  updateTeamWithValidation,
  deleteTeamWithValidation,
  addMemberWithValidation,
  removeMemberWithValidation,
  updateMemberRoleWithValidation,
  getCompanyTeams,
  getTeamDetails,
  getUserTeams,
  getTeamMembersForBooking,
  canBookOnBehalf,
  isTeamAdmin,
  isTeamMember,
  type CreateTeamInput,
  type CreateTeamResult,
  type AddMemberInput,
  type AddMemberResult,
} from "./teams"

// Invoices
export {
  generateBookingInvoice,
  generateMonthlyStorageInvoice,
  generateAnnualRentalInvoice,
  generateMonthlyInvoicesForActiveBookings,
  type GenerateInvoiceInput,
  type GenerateInvoiceResult,
} from "./invoices"

// Tasks
export {
  createAndAssignTask,
  reassignTask,
  autoAssignPendingTasks,
  balanceWorkload,
  type TaskAssignmentInput,
  type WorkerAvailability,
} from "./tasks"

// Claims
export {
  submitClaim,
  reviewClaim,
  startClaimReview,
  processClaimPayment,
  createClaimFromIncident,
  getCustomerClaimStats,
  getPendingReviewClaims,
  escalatePendingClaims,
  type SubmitClaimInput,
  type ReviewClaimInput,
  type ClaimProcessingResult,
} from "./claims"

// Payments
export {
  processInvoicePayment,
  confirmPayment,
  processRefund,
  getPaymentHistory,
  type ProcessPaymentInput,
  type ProcessPaymentResult,
  type ProcessRefundInput,
} from "./payments"

