# Warehouse Search API Verification Report

**Date:** 04.01.2026 14:25:09
**Status:** ✅ Completed



## Code Structure Analysis

✅ **Route File:** `app/api/v1/warehouses/public/search/route.ts`  
✅ **Service File:** `lib/services/warehouse-search-supabase.ts`  
✅ **Zod Schema:** Defined  
✅ **GET Handler:** Implemented  
✅ **Validation:** Using safeParse  
✅ **PostGIS Support:** Available  
✅ **Regular Search:** Available  

---

## API Test Results

### 1. Basic search (no params) ✅ PASS

- **Warehouses Found:** 13

---

### 2. City-based search (İzmir) ✅ PASS

- **Warehouses Found:** 4

---

### 3. Geographic search (PostGIS) ✅ PASS

- **Warehouses Found:** 4

**Results:**
1. KO-GN-YWFYQ (Konak, İzmir) - 1.93 km
2. GA-PH-06RHL (Gaziemir, İzmir) - 7.39 km
3. ME-CS-633ZL (Menemen, İzmir) - 21.71 km
4. AL-GN-7K6WL (Aliağa, İzmir) - 39.94 km

---

### 4. Type filter (pallet, quantity=10) ✅ PASS

- **Warehouses Found:** 10

---

### 5. Multiple filters combined ✅ PASS

- **Warehouses Found:** 0

---

### 6. Response structure verification ✅ PASS

- **Required Fields Present:** Yes
- **Sample Fields:** 19 fields

---

### 7. Zod validation schema ✅ PASS

- **Validation Fields:** 21/21
- **Fields:** lat, lng, radius_km, city, state, zipCode, type, quantity, start_date, end_date, warehouse_type, storage_type, temperature_types, amenities, min_price, max_price, min_rating, page, limit, sort_by, sort_order


---

## Test Summary

- **Total Tests:** 7
- **Passed:** 7 ✅
- **Failed:** 0 ❌
- **Warnings:** 0 ⚠️

**Overall Status:** ✅ PASS

---

## API Response Structure

The API returns the following structure:

```json
{
  "success": true,
  "data": {
    "warehouses": [
      {
        "id": "uuid",
        "name": "string",
        "address": "string",
        "city": "string",
        "latitude": number,
        "longitude": number,
        "distance_km": number,
        "total_sq_ft": number,
        "available_sq_ft": number,
        "total_pallet_storage": number,
        "available_pallet_storage": number,
        "warehouse_type": "string",
        "storage_type": "string",
        "temperature_types": ["string"],
        "amenities": ["string"],
        "photos": ["string"],
        "min_price": number,
        "pricing": [
          {
            "type": "string",
            "price": number,
            "unit": "string"
          }
        ],
        "average_rating": number,
        "total_reviews": number,
        "company_name": "string",
        "company_logo": "string",
        "is_verified": boolean
      }
    ],
    "total": number,
    "page": number,
    "limit": number,
    "total_pages": number,
    "hasMore": boolean,
    "cities": ["string"]
  }
}
```

---

## Supported Search Parameters

### Location-Based
- `lat` / `lng` - Geographic coordinates (triggers PostGIS search)
- `radius_km` - Search radius in kilometers (default: 50)
- `city` - City name (case-insensitive)
- `state` - State/province
- `zipCode` - ZIP/postal code

### Booking Requirements
- `type` - `pallet` or `area-rental`
- `quantity` - Number of pallets or square feet
- `start_date` - YYYY-MM-DD format
- `end_date` - YYYY-MM-DD format

### Filters
- `warehouse_type` - Comma-separated list
- `storage_type` - Comma-separated list
- `temperature_types` - Comma-separated list
- `amenities` - Comma-separated list
- `min_price` / `max_price` - Price range
- `min_rating` - Minimum rating (1-5)

### Pagination & Sorting
- `page` - Page number (default: 1)
- `limit` - Results per page (default: 20, max: 100)
- `sort_by` - `price`, `distance`, `rating`, `availability`, `name` (default: `distance`)
- `sort_order` - `asc` or `desc` (default: `asc`)

### Legacy Support
- `q` - Maps to `city` parameter
- `offset` - Legacy pagination (not recommended)

---

## Recommendations


✅ **All Tests Passed:** The warehouse search API is properly implemented and working correctly.


---

*Report generated automatically by test-search-api.js*
