-- Fix foreign key constraint for claims.customer_id
-- Change reference from users(id) to profiles(id)

ALTER TABLE claims 
DROP CONSTRAINT IF EXISTS claims_customer_id_fkey;

ALTER TABLE claims 
ADD CONSTRAINT claims_customer_id_fkey 
FOREIGN KEY (customer_id) 
REFERENCES profiles(id) 
ON DELETE RESTRICT;

