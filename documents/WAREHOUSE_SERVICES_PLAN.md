# Warehouse Services Feature - Implementation Plan

## 📋 Overview
Her şirket kendi depolarına özel servisler tanımlayabilecek. Müşteriler booking yaparken bu servisleri opsiyonel olarak seçebilecek ve toplam fiyat buna göre güncellenecek.

## 🗄️ Database Schema

### 1. `warehouse_services` Table
Her warehouse için tanımlanabilir servisler.

```sql
CREATE TABLE warehouse_services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL,
  service_description TEXT,
  pricing_type TEXT NOT NULL CHECK (pricing_type IN ('one_time', 'per_pallet', 'per_sqft', 'per_day', 'per_month')),
  base_price NUMERIC(10,2) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_warehouse_services_warehouse_id ON warehouse_services(warehouse_id);
CREATE INDEX idx_warehouse_services_active ON warehouse_services(warehouse_id, is_active);
```

**Pricing Types:**
- `one_time`: Tek seferlik ücret (örn: initial inspection fee)
- `per_pallet`: Pallet başına (örn: shrink wrapping)
- `per_sqft`: Square feet başına (örn: floor coating)
- `per_day`: Günlük (örn: temperature monitoring)
- `per_month`: Aylık (örn: inventory management)

**Example Services:**
- Shrink Wrapping (per_pallet): $2.50
- Labeling (per_pallet): $1.00
- Forklift Service (per_day): $50.00
- Temperature Monitoring (per_month): $100.00
- Inspection Fee (one_time): $25.00
- Climate Control (per_sqft): $0.50

### 2. `booking_services` Table
Booking ile seçilen servisleri ilişkilendiren pivot table.

```sql
CREATE TABLE booking_services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES warehouse_services(id) ON DELETE RESTRICT,
  service_name TEXT NOT NULL, -- Snapshot for historical data
  pricing_type TEXT NOT NULL,
  base_price NUMERIC(10,2) NOT NULL,
  quantity INTEGER DEFAULT 1, -- For services that need quantity (e.g., per_pallet)
  calculated_price NUMERIC(10,2) NOT NULL, -- Final calculated price
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(booking_id, service_id)
);

-- Indexes
CREATE INDEX idx_booking_services_booking_id ON booking_services(booking_id);
CREATE INDEX idx_booking_services_service_id ON booking_services(service_id);
```

### 3. Update `bookings` Table
Add a column to track services subtotal separately.

```sql
ALTER TABLE bookings ADD COLUMN services_amount NUMERIC(10,2) DEFAULT 0;
ALTER TABLE bookings ADD COLUMN base_storage_amount NUMERIC(10,2);

-- base_storage_amount = storage rental price
-- services_amount = sum of selected services
-- total_amount = base_storage_amount + services_amount
```

## 🎨 UI Changes

### 1. Dashboard - Warehouse Services Management
**Location:** `/dashboard/warehouses/[id]/services`

**Features:**
- List all services for the warehouse
- Add new service (modal/form)
- Edit existing service
- Deactivate/Activate service
- Delete service (with confirmation)
- Preview how customers will see it

**Components:**
- `app/(dashboard)/dashboard/warehouses/[id]/services/page.tsx`
- `components/warehouse/service-form.tsx`
- `components/warehouse/service-list.tsx`

### 2. Booking Flow - Service Selection
**Location:** `/warehouse/[id]` (detail page)

**Features:**
- Show available services in a collapsible section
- Checkboxes to select services
- Quantity input for quantity-based services
- Real-time price calculation
- Show service details on hover/click

**Components:**
- `components/booking/service-selector.tsx`
- Update `app/warehouse/[id]/page.tsx`

### 3. Booking Review Page
**Location:** `/warehouses/[id]/review`

**Features:**
- Show selected services
- Breakdown: Base Storage + Services = Total
- Option to go back and modify services

**Updates:**
- Update review page to show services breakdown

### 4. Booking Details (Customer & Company Views)
**Location:** `/dashboard/bookings/[id]`

**Features:**
- Show selected services in booking details
- Services amount breakdown

## 📡 API Endpoints

### Warehouse Services

#### GET `/api/v1/warehouses/[id]/services`
Get all services for a warehouse (public - for customers)

```typescript
Response: {
  success: true,
  data: {
    services: WarehouseService[]
  }
}
```

#### GET `/api/v1/warehouses/[id]/services/manage`
Get all services for management (requires auth + ownership)

```typescript
Response: {
  success: true,
  data: {
    services: WarehouseService[]
  }
}
```

#### POST `/api/v1/warehouses/[id]/services`
Create new service (requires auth + ownership)

```typescript
Request: {
  serviceName: string
  serviceDescription?: string
  pricingType: 'one_time' | 'per_pallet' | 'per_sqft' | 'per_day' | 'per_month'
  basePrice: number
}

Response: {
  success: true,
  data: {
    service: WarehouseService
  }
}
```

#### PATCH `/api/v1/warehouses/[id]/services/[serviceId]`
Update service (requires auth + ownership)

#### DELETE `/api/v1/warehouses/[id]/services/[serviceId]`
Delete service (requires auth + ownership)

### Booking Services

#### POST `/api/v1/bookings`
Update to include selected services

```typescript
Request: {
  // ... existing fields
  selectedServices?: {
    serviceId: string
    quantity?: number
  }[]
}
```

#### GET `/api/v1/bookings/[id]/services`
Get services for a booking

```typescript
Response: {
  success: true,
  data: {
    services: BookingService[]
    servicesAmount: number
  }
}
```

## 💰 Price Calculation Logic

```typescript
interface ServiceCalculation {
  serviceId: string
  serviceName: string
  pricingType: string
  basePrice: number
  quantity: number
  calculatedPrice: number
}

function calculateServicePrice(
  service: WarehouseService,
  bookingDetails: {
    type: 'pallet' | 'area-rental'
    palletCount?: number
    areaSqFt?: number
    days: number
    months: number
  },
  quantity?: number
): number {
  switch (service.pricingType) {
    case 'one_time':
      return service.basePrice

    case 'per_pallet':
      return service.basePrice * (bookingDetails.palletCount || 0)

    case 'per_sqft':
      return service.basePrice * (bookingDetails.areaSqFt || 0)

    case 'per_day':
      return service.basePrice * bookingDetails.days

    case 'per_month':
      return service.basePrice * bookingDetails.months

    default:
      return 0
  }
}

function calculateTotalBookingPrice(
  baseStoragePrice: number,
  selectedServices: ServiceCalculation[]
): number {
  const servicesTotal = selectedServices.reduce(
    (sum, service) => sum + service.calculatedPrice,
    0
  )
  return baseStoragePrice + servicesTotal
}
```

## 🔄 Implementation Steps

### Phase 1: Database Setup
1. ✅ Create migration for `warehouse_services` table
2. ✅ Create migration for `booking_services` table
3. ✅ Update `bookings` table with service amounts
4. ✅ Add RLS policies for both tables

### Phase 2: API Development
1. ✅ Create warehouse services CRUD endpoints
2. ✅ Update booking creation to handle services
3. ✅ Create booking services endpoint

### Phase 3: UI - Service Management (Dashboard)
1. ✅ Create services management page
2. ✅ Create service form component
3. ✅ Implement CRUD operations

### Phase 4: UI - Customer Booking Flow
1. ✅ Add service selector to warehouse detail page
2. ✅ Update price calculation with services
3. ✅ Update booking review page
4. ✅ Update booking confirmation

### Phase 5: Testing & Polish
1. ✅ Test service creation
2. ✅ Test booking with services
3. ✅ Test price calculations
4. ✅ Add validation and error handling

## 🎯 User Stories

### As a Warehouse Owner:
- ✅ I can create custom services for each of my warehouses
- ✅ I can set different pricing types for each service
- ✅ I can activate/deactivate services without deleting them
- ✅ I can see which services are most popular

### As a Customer:
- ✅ I can see all available services when booking
- ✅ I can select multiple services
- ✅ I can see the price update in real-time as I select services
- ✅ I can see the service breakdown in my booking details

## 📝 Example Services by Warehouse Type

### General Warehouse:
- Shrink Wrapping (per_pallet): $2.50
- Labeling (per_pallet): $1.00
- Forklift Service (per_day): $50.00
- Loading/Unloading (per_pallet): $3.00

### Cold Storage:
- Temperature Monitoring (per_month): $100.00
- Blast Freezing (per_pallet): $5.00
- Temperature Logs (per_month): $25.00

### Hazmat Certified:
- Hazmat Inspection (one_time): $150.00
- Safety Monitoring (per_month): $200.00
- Emergency Response Service (per_month): $300.00

### FDA Registered (Food):
- FSMA Compliance Documentation (per_month): $75.00
- Pest Control Service (per_month): $50.00
- Quality Inspection (per_month): $100.00
