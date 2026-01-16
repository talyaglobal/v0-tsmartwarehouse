-- Add external ratings for warehouses (SerpAPI / Google Maps)
ALTER TABLE warehouses
ADD COLUMN IF NOT EXISTS serpapi_place_id TEXT,
ADD COLUMN IF NOT EXISTS external_rating NUMERIC(3,2),
ADD COLUMN IF NOT EXISTS external_reviews_count INTEGER,
ADD COLUMN IF NOT EXISTS external_rating_source TEXT,
ADD COLUMN IF NOT EXISTS external_rating_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN warehouses.serpapi_place_id IS 'SerpAPI/Google Maps place_id for external reviews';
COMMENT ON COLUMN warehouses.external_rating IS 'External rating from SerpAPI';
COMMENT ON COLUMN warehouses.external_reviews_count IS 'External review count from SerpAPI';
COMMENT ON COLUMN warehouses.external_rating_source IS 'Source of external rating (e.g., google_maps)';
COMMENT ON COLUMN warehouses.external_rating_updated_at IS 'Last time external rating was refreshed';

-- Update PostGIS search function to expose external ratings
DROP FUNCTION IF EXISTS search_warehouses_by_location(
  double precision,
  double precision,
  integer,
  text[],
  text[],
  integer,
  integer
);

CREATE FUNCTION search_warehouses_by_location(
  search_lat double precision,
  search_lng double precision,
  radius_km integer DEFAULT 50,
  warehouse_type_filter text[] DEFAULT NULL,
  storage_type_filter text[] DEFAULT NULL,
  min_pallet_capacity integer DEFAULT NULL,
  min_area_sqft integer DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  name text,
  address text,
  city text,
  latitude numeric,
  longitude numeric,
  distance_km double precision,
  total_sq_ft integer,
  available_sq_ft integer,
  total_pallet_storage integer,
  available_pallet_storage integer,
  warehouse_type text,
  storage_type text,
  temperature_types text[],
  amenities text[],
  photos text[],
  owner_company_id uuid,
  external_rating numeric,
  external_reviews_count integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    w.id,
    w.name,
    w.address,
    w.city,
    w.latitude,
    w.longitude,
    ST_Distance(
      w.location, 
      ST_SetSRID(ST_MakePoint(search_lng, search_lat), 4326)::geography
    ) / 1000.0 as distance_km,
    w.total_sq_ft,
    w.available_sq_ft,
    w.total_pallet_storage,
    w.available_pallet_storage,
    w.warehouse_type,
    w.storage_type,
    w.temperature_types,
    w.amenities,
    w.photos,
    w.owner_company_id,
    w.external_rating,
    w.external_reviews_count
  FROM public.warehouses w
  WHERE 
    w.status = true
    AND w.location IS NOT NULL
    AND ST_DWithin(
      w.location,
      ST_SetSRID(ST_MakePoint(search_lng, search_lat), 4326)::geography,
      radius_km * 1000
    )
    AND (warehouse_type_filter IS NULL OR w.warehouse_type = ANY(warehouse_type_filter))
    AND (storage_type_filter IS NULL OR w.storage_type = ANY(storage_type_filter))
    AND (min_pallet_capacity IS NULL OR w.available_pallet_storage >= min_pallet_capacity)
    AND (min_area_sqft IS NULL OR w.available_sq_ft >= min_area_sqft)
  ORDER BY distance_km ASC;
END;
$$ LANGUAGE plpgsql;

-- Update warehouse listings view to include external ratings
CREATE OR REPLACE VIEW public.warehouse_listings AS
SELECT 
  w.id,
  w.name,
  w.address,
  w.city,
  NULL as state,
  w.zip_code,
  w.latitude,
  w.longitude,
  w.total_sq_ft,
  w.available_sq_ft,
  w.total_pallet_storage,
  w.available_pallet_storage,
  w.warehouse_type,
  w.storage_type,
  w.temperature_types,
  w.amenities,
  w.photos,
  w.operating_hours,
  w.security,
  w.rent_methods,
  w.warehouse_in_fee,
  w.warehouse_out_fee,
  NULL as description,
  w.owner_company_id,
  c.id as company_id,
  c.name as company_name,
  c.logo_url as company_logo,
  c.verification_status as host_verification,
  COALESCE(rs.average_rating, 0) as average_rating,
  COALESCE(rs.total_reviews, 0) as total_reviews,
  w.external_rating,
  w.external_reviews_count,
  (
    SELECT MIN(base_price::numeric) 
    FROM warehouse_pricing wp 
    WHERE wp.warehouse_id = w.id AND wp.status = true
  ) as min_price,
  ARRAY(
    SELECT jsonb_build_object('type', wp.pricing_type, 'price', wp.base_price, 'unit', wp.unit)
    FROM warehouse_pricing wp
    WHERE wp.warehouse_id = w.id AND wp.status = true
  ) as pricing
FROM public.warehouses w
LEFT JOIN public.companies c ON c.id = w.owner_company_id
LEFT JOIN public.warehouse_review_summary rs ON rs.warehouse_id = w.id
WHERE w.status = true;
