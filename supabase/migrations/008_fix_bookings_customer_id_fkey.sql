-- Fix bookings.customer_id foreign key constraint
-- Change from users(id) to profiles(id) since profiles table is used for user data
-- profiles.id references auth.users(id), so this maintains the relationship

-- Drop the old foreign key constraint
ALTER TABLE bookings 
DROP CONSTRAINT IF EXISTS bookings_customer_id_fkey;

-- Add new foreign key constraint to profiles table
ALTER TABLE bookings 
ADD CONSTRAINT bookings_customer_id_fkey 
FOREIGN KEY (customer_id) 
REFERENCES profiles(id) 
ON DELETE RESTRICT;

-- Note: If there are existing bookings with customer_id that don't exist in profiles,
-- you may need to migrate the data first or handle those cases separately

