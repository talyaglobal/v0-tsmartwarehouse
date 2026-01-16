// Core Types for Warebnb Platform

// User Types - Restructured Roles (2026-01-11)
export type UserRole = 
  | "root"                    // System Admin - full access
  | "warehouse_admin"         // Warehouse Owner (formerly warehouse_owner) - full warehouse access
  | "warehouse_supervisor"    // Warehouse Manager (formerly warehouse_admin) - booking/service management
  | "warehouse_client"        // Customer (formerly customer) - rents warehouse space
  | "warehouse_staff"         // Warehouse Personnel - operations and tasks
  | "warehouse_finder"        // Warehouse Scout - finds new warehouses for commission
  | "warehouse_broker"        // Reseller (formerly reseller) - commission-based sales
  | "end_delivery_party"      // End Delivery Company - receives products from warehouse
  | "local_transport"         // Local Transport Company - domestic shipping
  | "international_transport" // International Transport - cross-border shipping

export type MembershipTier = "bronze" | "silver" | "gold" | "platinum"

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  companyId?: string
  companyName?: string
  companyRole?: 'warehouse_admin' | 'warehouse_supervisor' | 'warehouse_staff' | null // Role in company (from profiles table)
  phone?: string
  avatar?: string
  membershipTier?: MembershipTier
  creditBalance?: number
  createdAt: string
  updatedAt: string
}

// Warehouse Layout - 3 Floors, 2 Halls x 40,000 sq ft = 240,000 sq ft total
// Hierarchy: Floor → Region → Hall → Zone
export interface WarehouseFloor {
  id: string
  floorNumber: 1 | 2 | 3
  name: string
  halls: WarehouseHall[]
  totalSqFt: number // 80,000 sq ft per floor
}

export interface WarehouseRegion {
  id: string
  floorId: string
  name: string
  description?: string
  createdAt: string
  updatedAt: string
}

export interface WarehouseHall {
  id: string
  floorId: string
  regionId?: string
  hallName: "A" | "B"
  sqFt: number // 40,000 sq ft each
  availableSqFt: number
  occupiedSqFt: number
  zones: WarehouseZone[]
}

export interface WarehouseZone {
  id: string
  hallId: string
  name: string
  type: "pallet" | "area-rental" | "cold-storage" | "hazmat"
  totalSlots?: number
  availableSlots?: number
  totalSqFt?: number
  availableSqFt?: number
}

// Time Slot Interface
export interface TimeSlot {
  start: string // Time in HH:mm format (e.g., "08:00")
  end: string // Time in HH:mm format (e.g., "12:00")
}

// Pallet Pricing Interfaces
export type PalletType = 'euro' | 'standard' | 'custom'
export type PricingPeriod = 'day' | 'week' | 'month'

export interface CustomPalletDimensions {
  length: number // in inches
  width: number // in inches
  height: number // in inches
  unit?: 'cm' | 'in' // Default to 'in' for imperial
}

export interface HeightRangePricing {
  id?: string
  heightMinCm: number // Minimum height in inches (inclusive) - keeping name for backward compatibility
  heightMaxCm: number // Maximum height in inches (exclusive) - keeping name for backward compatibility
  pricePerUnit: number // Price per pallet for this height range
}

export interface WeightRangePricing {
  id?: string
  weightMinKg: number // Minimum weight in lbs (inclusive) - keeping name for backward compatibility
  weightMaxKg: number // Maximum weight in lbs (exclusive) - keeping name for backward compatibility
  pricePerPallet: number // Additional price per pallet for this weight range
}

export interface CustomPalletSize {
  lengthMin: number // in inches
  lengthMax: number // in inches
  widthMin: number // in inches
  widthMax: number // in inches
  stackableAdjustmentType?: PricingAdjustmentType
  stackableAdjustmentValue?: number
  unstackableAdjustmentType?: PricingAdjustmentType
  unstackableAdjustmentValue?: number
  heightRanges: HeightRangePricing[] // Height ranges specific to this custom size
}

export interface PalletPricing {
  id?: string
  warehouseId?: string
  goodsType?: string
  palletType: PalletType
  pricingPeriod: PricingPeriod
  customDimensions?: CustomPalletDimensions // Only for custom pallet type (deprecated - use customSizes instead)
  customSizes?: CustomPalletSize[] // Multiple sizes for custom pallet type (each with its own height ranges)
  stackable?: boolean // Stackable or unstackable pallet option
  stackableAdjustmentType?: PricingAdjustmentType
  stackableAdjustmentValue?: number
  unstackableAdjustmentType?: PricingAdjustmentType
  unstackableAdjustmentValue?: number
  heightRanges?: HeightRangePricing[] // Array of height range pricing (for euro/standard pallets, or fallback for custom)
  weightRanges?: WeightRangePricing[] // Array of weight range pricing
}

export type PricingAdjustmentType = 'rate' | 'plus_per_unit'

export interface Warehouse {
  id: string
  name: string
  address: string
  city: string
  zipCode: string
  totalSqFt: number // 240,000 sq ft
  totalPalletStorage?: number // Total pallet storage capacity
  availableSqFt?: number // Currently available square feet for booking
  availablePalletStorage?: number // Currently available pallet storage for booking
  latitude?: number // Google Maps latitude
  longitude?: number // Google Maps longitude
  warehouseType?: string[] // Array of warehouse types (multi-select)
  storageType?: string[] // Array of storage types (multi-select)
  temperatureTypes?: string[] // ambient-with-ac, ambient-without-ac, chilled, frozen, open-area-with-tent, open-area
  photos?: string[] // Array of photo paths in storage
  videos?: string[] // Array of video URLs/paths (optional)
  description?: string // Optional description
  floors: WarehouseFloor[]
  amenities: string[]
  operatingHours: {
    open: string
    close: string
    days: string[]
  }
  // New fields
  customStatus?: 'antrepolu' | 'regular' // Custom status: antrepolu (bonded warehouse) or regular
  minPallet?: number // Minimum pallet order requirement
  maxPallet?: number // Maximum pallet order requirement
  minSqFt?: number // Minimum square feet order requirement
  maxSqFt?: number // Maximum square feet order requirement
  rentMethods?: string[] // Array of rent methods: pallet, sq_ft
  security?: string[] // Array of security options
  accessInfo?: {
    accessType?: string // 24/7, business-hours, by-appointment, gated (restricted removed)
    appointmentRequired?: boolean
    accessControl?: string // e.g., Key card, Biometric, Security code
  }
  productAcceptanceTimeSlots?: TimeSlot[] // Array of time slots for product acceptance
  productDepartureTimeSlots?: TimeSlot[] // Array of time slots for product departure
  workingDays?: string[] // Array of working days (e.g., Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday)
  warehouseInFee?: number // Warehouse in fee (per unit)
  warehouseOutFee?: number // Warehouse out fee (per unit)
  overtimePrice?: {
    afterRegularWorkTime?: {
      in?: number // Price per pallet for in operations after regular work time
      out?: number // Price per pallet for out operations after regular work time
    }
    holidays?: {
      in?: number // Price per pallet for in operations on holidays
      out?: number // Price per pallet for out operations on holidays
    }
  }
  ports?: Array<{
    name: string
    container40DC?: number
    container40HC?: number
    container20DC?: number
  }> // Ports and transportation information
  freeStorageRules?: FreeStorageRule[] // Free storage allowance rules based on booking duration
  pricing?: {
    pallet?: {
      basePrice: number
      unit: string
    }
    palletMonthly?: {
      basePrice: number
      unit: string
    }
    areaRental?: {
      basePrice: number
      unit: string
    }
  }
  palletPricing?: PalletPricing[] // New detailed pallet pricing structure
}

export type DurationUnit = 'day' | 'week' | 'month'

export interface FreeStorageRule {
  minDuration: number
  maxDuration?: number
  durationUnit: DurationUnit
  freeAmount: number
  freeUnit: DurationUnit
}

// Booking Types
export type BookingStatus = "pending" | "pre_order" | "awaiting_time_slot" | "payment_pending" | "confirmed" | "active" | "cancel_request" | "completed" | "cancelled"
export type BookingType = "pallet" | "area-rental"
export type ServiceType = "pallet-in" | "storage" | "pallet-out" | "area-rental"

export interface Booking {
  id: string
  customerId: string
  customerName: string
  customerEmail: string
  warehouseId: string
  warehouseName?: string
  type: BookingType
  status: BookingStatus
  // Pallet booking fields
  palletCount?: number
  // Area rental fields (Level 3 only, min 40,000 sq ft)
  areaSqFt?: number
  floorNumber?: 3
  hallId?: string
  // Common fields
  startDate: string
  endDate?: string
  totalAmount: number
  baseStorageAmount?: number
  servicesAmount?: number
  notes?: string
  // Time slot fields (for pre-orders)
  scheduledDropoffDatetime?: string
  timeSlotSetBy?: string
  timeSlotSetAt?: string
  timeSlotConfirmedAt?: string
  // Date/time change proposal fields (for warehouse staff)
  proposedStartDate?: string
  proposedStartTime?: string
  dateChangeRequestedAt?: string
  dateChangeRequestedBy?: string
  createdAt: string
  updatedAt: string
}

// Pricing Configuration
export interface PricingConfig {
  // Pallet Services
  palletIn: number // $5.00
  palletOut: number // $5.00
  storagePerPalletPerMonth: number // $17.50
  // Space Storage (Level 3 only)
  areaRentalPerSqFtPerYear: number // $20.00
  areaRentalMinSqFt: number // 40,000 sq ft
  // Discounts
  volumeDiscounts: {
    palletThreshold: number
    discountPercent: number
  }[]
  membershipDiscounts: {
    tier: MembershipTier
    discountPercent: number
  }[]
}

// Invoice Types
export type InvoiceStatus = "draft" | "pending" | "paid" | "overdue" | "cancelled"

export interface Invoice {
  id: string
  bookingId?: string
  serviceOrderId?: string
  customerId: string
  customerName: string
  status: InvoiceStatus
  items: InvoiceItem[]
  subtotal: number
  tax: number
  total: number
  dueDate: string
  paidDate?: string
  createdAt: string
}

export interface InvoiceItem {
  description: string
  quantity: number
  unitPrice: number
  total: number
}

// Task Types (Worker Tasks)
export type TaskStatus = "pending" | "assigned" | "in-progress" | "completed" | "cancelled"
export type TaskPriority = "low" | "normal" | "medium" | "high" | "urgent"
export type TaskType = "receiving" | "putaway" | "picking" | "packing" | "shipping" | "inventory-check" | "maintenance"

export interface Task {
  id: string
  type: TaskType
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  assignedTo?: string
  assignedToName?: string
  bookingId?: string
  warehouseId: string
  zone?: string
  location?: string
  dueDate?: string
  completedAt?: string
  createdAt: string
  updatedAt: string
}

// Incident & Claims
export type IncidentSeverity = "low" | "medium" | "high" | "critical"
export type IncidentStatus = "open" | "investigating" | "resolved" | "closed"
export type ClaimStatus = "submitted" | "under-review" | "approved" | "rejected" | "paid"

export interface Incident {
  id: string
  type: string
  title: string
  description: string
  severity: IncidentSeverity
  status: IncidentStatus
  reportedBy: string
  reportedByName: string
  warehouseId: string
  location?: string
  affectedBookingId?: string
  resolution?: string
  createdAt: string
  resolvedAt?: string
}

export interface Claim {
  id: string
  customerId: string
  customerName: string
  incidentId?: string
  bookingId: string
  type: string
  description: string
  amount: number
  status: ClaimStatus
  evidence?: string[]
  resolution?: string
  approvedAmount?: number
  createdAt: string
  resolvedAt?: string
}

// Notification Types
export type NotificationChannel = "email" | "sms" | "push" | "whatsapp"
export type NotificationType = "booking" | "invoice" | "task" | "incident" | "system"

export interface Notification {
  id: string
  userId: string
  type: NotificationType
  channel: NotificationChannel
  title: string
  message: string
  read: boolean
  createdAt: string
}

// Worker Shift
export interface WorkerShift {
  id: string
  workerId: string
  workerName: string
  checkInTime: string
  checkOutTime?: string
  hoursWorked?: number
  breaks: { start: string; end: string }[]
  tasksCompleted: number
  warehouseId: string
}

// Analytics Types
export interface DashboardStats {
  totalBookings: number
  activeBookings: number
  totalRevenue: number
  monthlyRevenue: number
  totalCustomers: number
  warehouseUtilization: number
  pendingTasks: number
  openIncidents: number
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// Payment Types
export type PaymentStatus = "pending" | "processing" | "succeeded" | "failed" | "refunded" | "partially_refunded"
export type PaymentMethod = "card" | "credit_balance" | "bank_transfer" | "other"
export type RefundStatus = "pending" | "succeeded" | "failed" | "cancelled"

export interface Payment {
  id: string
  invoiceId: string
  customerId: string
  amount: number
  currency: string
  status: PaymentStatus
  paymentMethod: PaymentMethod
  stripePaymentIntentId?: string
  stripeChargeId?: string
  creditBalanceUsed?: number
  metadata?: Record<string, any>
  createdAt: string
  updatedAt: string
  completedAt?: string
}

export interface PaymentTransaction {
  id: string
  paymentId: string
  type: "payment" | "refund" | "credit_adjustment"
  amount: number
  currency: string
  status: PaymentStatus
  description: string
  metadata?: Record<string, any>
  createdAt: string
}

export interface Refund {
  id: string
  paymentId: string
  invoiceId: string
  customerId: string
  amount: number
  currency: string
  reason?: string
  status: RefundStatus
  stripeRefundId?: string
  metadata?: Record<string, any>
  createdAt: string
  processedAt?: string
}

// Warehouse Management Enhancement Types
export interface CapacityUtilization {
  warehouseId?: string
  zoneId?: string
  customerId?: string
  totalCapacity: number
  usedCapacity: number
  percentageUsed: number
}

export interface CustomerStockLevels {
  customerId: string
  warehouseId: string
  totalPallets: number
  activePallets: number
  inTransitPallets: number
  storedPallets: number
  shippedPallets: number
  damagedPallets: number
  lastUpdated: string
}

export interface PaymentRemaining {
  totalInvoiced: number
  totalPaid: number
  remainingBalance: number
  pendingInvoicesCount: number
  overdueInvoicesCount: number
}

export interface PalletLabelData {
  // Identification
  warehouseTrackingNumber: string
  palletId: string
  barcode?: string
  qrCode?: string
  
  // Customer Information
  customerName: string
  customerEmail: string
  customerLotNumber?: string
  customerBatchNumber?: string
  
  // Dates
  arrivalDate: string // received_date
  expectedReleaseDate?: string
  daysInWarehouse: number
  monthsInWarehouse: number
  
  // Stock Information
  stockDefinition?: string
  numberOfCases?: number
  numberOfUnits?: number
  unitType?: string
  hsCode?: string
  
  // Storage Requirements
  storageRequirements?: string[]
  
  // Location
  location: {
    floor?: {
      id: string
      floorNumber: number
      name: string
    }
    region?: {
      id: string
      name: string
    }
    hall?: {
      id: string
      hallName: string
    }
    zone?: {
      id: string
      name: string
      type: string
    }
    locationCode?: string
    rowNumber?: number
    levelNumber?: number
  }
  
  // Additional
  status: string
  itemType?: string
  weightKg?: number
  dimensions?: any
  notes?: string
}

// Service Types
export type {
  ServiceCategory,
  ServiceUnitType,
  ServiceOrderStatus,
  ServiceOrderPriority,
  WarehouseService,
  ServiceOrderItem,
  ServiceOrder,
} from './services'

// Access Log Types
export type AccessLogVisitorType = 'vehicle' | 'staff' | 'customer' | 'visitor' | 'family_friend' | 'delivery_driver' | 'other'
export type AccessLogStatus = 'checked_in' | 'checked_out'
export type VehicleType = 'car' | 'truck' | 'van' | 'motorcycle' | 'suv' | 'other'

// Appointment Types
export type AppointmentStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed'
export type ParticipantRole = 'requester' | 'attendee' | 'staff_assignee'
export type ParticipantStatus = 'pending' | 'accepted' | 'declined'

export interface AppointmentType {
  id: string
  name: string
  slug: string
  description?: string
  color: string
  icon?: string
  durationMinutes: number
  requiresWarehouseStaff: boolean
  isActive: boolean
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface AppointmentParticipant {
  id: string
  appointmentId: string
  userId: string
  role: ParticipantRole
  status: ParticipantStatus
  createdAt: string
  // Joined fields
  userName?: string
  userEmail?: string
}

export interface Appointment {
  id: string
  warehouseId: string
  appointmentTypeId: string
  title: string
  description?: string
  startTime: string
  endTime: string
  status: AppointmentStatus
  createdBy: string
  location?: string
  meetingLink?: string
  phoneNumber?: string
  notes?: string
  createdAt: string
  updatedAt: string
  // Joined fields
  appointmentType?: AppointmentType
  warehouse?: Warehouse
  participants?: AppointmentParticipant[]
  createdByName?: string
  createdByEmail?: string
}

export interface AccessLog {
  id: string
  visitorType: AccessLogVisitorType
  warehouseId: string
  entryTime: string
  exitTime?: string
  status: AccessLogStatus
  // Person Details
  personName: string
  personIdNumber?: string
  personPhone?: string
  personEmail?: string
  companyName?: string
  personId?: string // Link to user profile
  // Vehicle Details
  vehicleLicensePlate?: string
  vehicleMake?: string
  vehicleModel?: string
  vehicleColor?: string
  vehicleType?: VehicleType
  // Visit Details
  purpose?: string
  authorizedBy?: string
  authorizedById?: string
  bookingId?: string
  notes?: string
  photoUrl?: string
  // Metadata
  checkedInBy?: string
  checkedOutBy?: string
  createdAt: string
  updatedAt: string
}

// =====================================================
// CRM Types
// =====================================================

export type ContactType = 'warehouse_supplier' | 'customer_lead'
export type ActivityType = 'visit' | 'call' | 'email' | 'meeting' | 'note' | 'task' | 'proposal_sent' | 'contract_sent' | 'follow_up'
export type ContactStatus = 'active' | 'approved' | 'rejected' | 'converted' | 'inactive' | 'archived'
export type ContactPriority = 'low' | 'medium' | 'high' | 'urgent'
export type CompanySize = 'startup' | 'small' | 'medium' | 'large' | 'enterprise'
export type ActivityOutcome = 'successful' | 'needs_follow_up' | 'not_interested' | 'callback_requested'
export type PropertyCondition = 'excellent' | 'good' | 'fair' | 'poor'
export type InterestLevel = 'very_interested' | 'interested' | 'neutral' | 'not_interested'

export interface CRMContact {
  id: string
  createdBy: string
  assignedTo?: string
  companyId?: string
  contactType: ContactType
  contactName: string
  companyName?: string
  email?: string
  phone?: string
  secondaryPhone?: string
  address?: string
  city?: string
  state?: string
  country?: string
  postalCode?: string
  location?: {
    latitude: number
    longitude: number
  }
  // Warehouse Details (for warehouse_supplier)
  warehouseSizeSqm?: number
  warehouseType?: string[]
  availableServices?: string[]
  estimatedCapacity?: number
  currentUtilizationPercent?: number
  // Customer Details (for customer_lead)
  industry?: string
  companySize?: CompanySize
  estimatedSpaceNeedSqm?: number
  budgetRange?: string
  decisionMakerName?: string
  decisionMakerTitle?: string
  // Pipeline
  pipelineStage: number // 0-100
  pipelineMilestone: string
  // Status
  status: ContactStatus
  priority: ContactPriority
  // Admin Approval
  requiresApproval: boolean
  approvalRequestedAt?: string
  approvedBy?: string
  approvedAt?: string
  approvalNotes?: string
  // Conversion Tracking
  convertedToWarehouseId?: string
  convertedToCustomerId?: string
  firstTransactionDate?: string
  firstTransactionAmount?: number
  // Metadata
  tags?: string[]
  customFields?: Record<string, any>
  // Timestamps
  createdAt: string
  updatedAt: string
  lastContactDate?: string
  nextFollowUpDate?: string
}

export interface CRMActivity {
  id: string
  contactId: string
  createdBy: string
  companyId?: string
  activityType: ActivityType
  subject: string
  description?: string
  outcome?: ActivityOutcome
  // Visit Specific
  visitDate?: string
  visitLocation?: string
  visitDurationMinutes?: number
  visitNotes?: string
  visitPhotos?: string[]
  propertyCondition?: PropertyCondition
  ownerInterestLevel?: InterestLevel
  // Call/Email Specific
  callDurationMinutes?: number
  callRecordingUrl?: string
  emailSentAt?: string
  emailOpened?: boolean
  emailClicked?: boolean
  // Task Management
  isTask?: boolean
  taskDueDate?: string
  taskCompleted?: boolean
  taskCompletedAt?: string
  // Pipeline Impact
  movedToStage?: number
  stageChangeReason?: string
  // Metadata
  attachments?: Array<{ url: string; name: string; type: string }>
  tags?: string[]
  // Timestamps
  createdAt: string
  updatedAt: string
}

export interface PipelineMilestone {
  id: string
  pipelineType: ContactType
  stageNumber: number // 1-10
  stagePercentage: number // 10, 20, 30, ..., 100
  milestoneName: string
  milestoneDescription?: string
  requiredActivities?: string[]
  typicalDurationDays?: number
  autoAdvanceConditions?: Record<string, any>
  notificationTemplate?: string
  icon?: string
  color?: string
  displayOrder?: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface CRMPerformanceMetrics {
  id: string
  userId: string
  companyId?: string
  metricDate: string
  metricMonth: string
  metricQuarter: string
  metricYear: number
  // Activity Metrics
  contactsCreated: number
  callsMade: number
  emailsSent: number
  visitsConducted: number
  meetingsHeld: number
  // Pipeline Metrics
  contactsInPipeline: number
  contactsMovedForward: number
  contactsMovedBackward: number
  contactsConverted: number
  averagePipelineStage?: number
  // Conversion Metrics
  conversionRate?: number
  averageDaysToConvert?: number
  totalRevenueGenerated?: number
  // Quality Metrics
  adminApprovalsRequested: number
  adminApprovalsGranted: number
  adminApprovalRate?: number
  // Timestamps
  createdAt: string
  updatedAt: string
}

export interface PipelineOverview {
  stage: number
  percentage: number
  milestoneName: string
  contactCount: number
  contacts: CRMContact[]
}

export interface WarehouseDiscoveryResult {
  id: string
  name: string
  address: string
  city: string
  latitude: number
  longitude: number
  totalSqFt: number
  distanceKm: number
  inCrm: boolean // Whether this warehouse is already in user's CRM
}

// =====================================================
// Transport Types (2026-01-11)
// =====================================================

export type TransportCompanyType = 'local' | 'international' | 'end_delivery'
export type DriverAvailabilityStatus = 'available' | 'on_job' | 'off_duty' | 'unavailable'
export type VehicleStatus = 'available' | 'in_use' | 'maintenance' | 'out_of_service'
export type ShipmentType = 'inbound' | 'outbound' | 'transfer'
export type ShipmentStatus = 
  | 'pending' 
  | 'confirmed' 
  | 'dispatched' 
  | 'picked_up' 
  | 'in_transit' 
  | 'at_customs' 
  | 'out_for_delivery' 
  | 'delivered' 
  | 'cancelled' 
  | 'on_hold' 
  | 'exception'

export interface TransportCompany {
  id: string
  companyName: string
  companyType: TransportCompanyType
  taxNumber?: string
  registrationNumber?: string
  address?: string
  city?: string
  state?: string
  country?: string
  zipCode?: string
  phone?: string
  email?: string
  website?: string
  contactPersonName?: string
  contactPersonPhone?: string
  contactPersonEmail?: string
  licenseNumber?: string
  licenseExpiry?: string
  insuranceNumber?: string
  insuranceExpiry?: string
  dotNumber?: string // Department of Transportation (US)
  mcNumber?: string  // Motor Carrier (US)
  serviceAreas?: string[]
  serviceCountries?: string[]
  userId?: string // Linked user account
  isActive: boolean
  isVerified: boolean
  verifiedAt?: string
  verifiedBy?: string
  notes?: string
  metadata?: Record<string, any>
  createdAt: string
  updatedAt: string
}

export interface TransportDriver {
  id: string
  transportCompanyId: string
  userId?: string
  fullName: string
  phone?: string
  email?: string
  photoUrl?: string
  licenseNumber: string
  licenseType?: string
  licenseState?: string
  licenseExpiry?: string
  licensePlate?: string
  vehicleType?: string
  vehicleMake?: string
  vehicleModel?: string
  vehicleYear?: number
  vehicleCapacity?: string
  hazmatCertified: boolean
  hazmatExpiry?: string
  twicCard: boolean
  twicExpiry?: string
  isActive: boolean
  availabilityStatus: DriverAvailabilityStatus
  currentLatitude?: number
  currentLongitude?: number
  lastLocationUpdate?: string
  notes?: string
  metadata?: Record<string, any>
  createdAt: string
  updatedAt: string
  // Joined fields
  transportCompany?: TransportCompany
}

export interface TransportVehicle {
  id: string
  transportCompanyId: string
  primaryDriverId?: string
  licensePlate: string
  vehicleType: string
  vehicleMake?: string
  vehicleModel?: string
  vehicleYear?: number
  vinNumber?: string
  capacityWeight?: number
  capacityVolume?: number
  capacityPallets?: number
  maxDimensions?: { length: number; width: number; height: number }
  isRefrigerated: boolean
  temperatureMin?: number
  temperatureMax?: number
  hasLiftGate: boolean
  hasPalletJack: boolean
  registrationExpiry?: string
  insuranceExpiry?: string
  lastInspectionDate?: string
  nextInspectionDue?: string
  isActive: boolean
  status: VehicleStatus
  currentLatitude?: number
  currentLongitude?: number
  lastLocationUpdate?: string
  notes?: string
  metadata?: Record<string, any>
  createdAt: string
  updatedAt: string
  // Joined fields
  transportCompany?: TransportCompany
  primaryDriver?: TransportDriver
}

export interface Shipment {
  id: string
  shipmentNumber: string
  bookingId: string
  shipmentType: ShipmentType
  localTransportId?: string
  internationalTransportId?: string
  endDeliveryPartyId?: string
  driverId?: string
  vehicleId?: string
  // Origin
  originAddress?: string
  originCity?: string
  originState?: string
  originCountry?: string
  originZip?: string
  originLatitude?: number
  originLongitude?: number
  originContactName?: string
  originContactPhone?: string
  // Destination
  destinationAddress?: string
  destinationCity?: string
  destinationState?: string
  destinationCountry?: string
  destinationZip?: string
  destinationLatitude?: number
  destinationLongitude?: number
  destinationContactName?: string
  destinationContactPhone?: string
  // Cargo Details
  cargoDescription?: string
  totalWeight?: number
  weightUnit?: string
  totalVolume?: number
  volumeUnit?: string
  palletCount?: number
  packageCount?: number
  // Special Requirements
  isHazmat: boolean
  hazmatClass?: string
  requiresRefrigeration: boolean
  temperatureRequirement?: { min: number; max: number; unit: string }
  specialHandling?: string
  // Scheduling
  scheduledPickupDate?: string
  scheduledPickupTime?: string
  actualPickupAt?: string
  scheduledDeliveryDate?: string
  scheduledDeliveryTime?: string
  actualDeliveryAt?: string
  estimatedTransitDays?: number
  // Status
  status: ShipmentStatus
  statusHistory?: Array<{ status: string; timestamp: string; note?: string }>
  // Customs
  customsStatus?: string
  customsDeclarationNumber?: string
  customsClearedAt?: string
  // Proof of Delivery
  podSignatureUrl?: string
  podPhotoUrls?: string[]
  podReceivedBy?: string
  podNotes?: string
  // Costs
  transportCost?: number
  customsCost?: number
  insuranceCost?: number
  otherCosts?: number
  totalCost?: number
  currency?: string
  // Tracking
  trackingNumber?: string
  trackingUrl?: string
  currentLatitude?: number
  currentLongitude?: number
  lastTrackingUpdate?: string
  notes?: string
  internalNotes?: string
  metadata?: Record<string, any>
  createdAt: string
  updatedAt: string
  createdBy?: string
  // Joined fields
  booking?: Booking
  localTransport?: TransportCompany
  internationalTransport?: TransportCompany
  endDeliveryParty?: TransportCompany
  driver?: TransportDriver
  vehicle?: TransportVehicle
}

// =====================================================
// Staff Task Types (2026-01-11)
// =====================================================

export type StaffTaskCode = 
  | 'unload_goods'      // 0. Unload incoming goods
  | 'acceptance'        // 1. Accept and verify goods
  | 'placement'         // 2. Place at warehouse location
  | 'customer_contact'  // 3. Contact customer for scheduling
  | 'locate_goods'      // 4. Find goods for shipment
  | 'prepare_loading'   // 5. Prepare for loading
  | 'load_goods'        // 6. Load onto transport
  | 'inventory_count'   // 7. Warehouse inventory
  | 'warehouse_cleaning'// 8. Warehouse cleaning
  | 'reorganization'    // 9. Warehouse optimization
  | 'special_services'  // 10. Labeling, re-palletization, etc.

export type StaffTaskStatus = 'pending' | 'assigned' | 'in_progress' | 'paused' | 'completed' | 'cancelled' | 'blocked'
export type StaffTaskPriority = 'low' | 'normal' | 'high' | 'urgent'

export interface StaffTaskType {
  id: string
  code: StaffTaskCode
  name: string
  description?: string
  workflowOrder: number
  estimatedDurationMinutes: number
  requiresPhoto: boolean
  requiresSignature: boolean
  isActive: boolean
  createdAt: string
}

export interface StaffTask {
  id: string
  taskTypeId: string
  bookingId?: string
  serviceOrderId?: string
  shipmentId?: string
  warehouseId: string
  assignedTo?: string
  assignedBy?: string
  assignedAt?: string
  // Location
  warehouseZone?: string
  warehouseAisle?: string
  warehouseRack?: string
  warehouseLevel?: string
  palletIds?: string[]
  // Scheduling
  scheduledDate?: string
  scheduledTime?: string
  dueDate?: string
  priority: StaffTaskPriority
  // Status
  status: StaffTaskStatus
  startedAt?: string
  completedAt?: string
  // Completion Details
  completionNotes?: string
  completionPhotos?: string[]
  signatureUrl?: string
  verifiedBy?: string
  verifiedAt?: string
  // Time Tracking
  estimatedMinutes?: number
  actualMinutes?: number
  instructions?: string
  notes?: string
  metadata?: Record<string, any>
  createdAt: string
  updatedAt: string
  createdBy?: string
  // Joined fields
  taskType?: StaffTaskType
  booking?: Booking
  shipment?: Shipment
  warehouse?: Warehouse
  assignedToUser?: User
  assignedByUser?: User
}