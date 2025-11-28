-- Seed data for TSmart Warehouse

-- Insert main warehouse
INSERT INTO warehouses (id, name, location, address, city, state, zip_code, total_sqft, max_pallets, max_containers, docks_count)
VALUES (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'Elizabeth Main Facility',
  'Elizabeth, NJ - 5 miles from NJ Port',
  '123 Industrial Blvd',
  'Elizabeth',
  'NJ',
  '07201',
  1200000,
  1000,
  50,
  6
);

-- Insert docks
INSERT INTO docks (warehouse_id, name, number) VALUES
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Dock A', 1),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Dock B', 2),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Dock C', 3),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Dock D', 4),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Dock E', 5),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Dock F', 6);

-- Insert pricing rules
INSERT INTO pricing_rules (product_type, pallet_size, base_price_per_day, price_per_kg, price_per_height_cm, multiplier) VALUES
('GENERAL', 'STANDARD', 15.00, 0.05, 0.10, 1.0),
('GENERAL', 'OVERSIZED', 22.00, 0.05, 0.15, 1.0),
('AMBIENT_FOOD', 'STANDARD', 18.00, 0.06, 0.12, 1.2),
('AMBIENT_FOOD', 'OVERSIZED', 26.00, 0.06, 0.18, 1.2),
('ELECTRONICS', 'STANDARD', 25.00, 0.08, 0.15, 1.5),
('ELECTRONICS', 'OVERSIZED', 35.00, 0.08, 0.20, 1.5),
('FRAGILE', 'STANDARD', 30.00, 0.10, 0.18, 1.8),
('FRAGILE', 'OVERSIZED', 42.00, 0.10, 0.25, 1.8),
('FROZEN', 'STANDARD', 35.00, 0.12, 0.20, 2.0),
('FROZEN', 'OVERSIZED', 50.00, 0.12, 0.28, 2.0);
