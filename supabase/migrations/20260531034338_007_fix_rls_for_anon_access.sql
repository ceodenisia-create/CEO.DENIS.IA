/*
  # Fix RLS policies for anonymous access

  1. Problem
    - Current policies require "authenticated" role
    - The app uses Supabase without explicit authentication
    - Anonymous users (using anon key) cannot INSERT/UPDATE/DELETE

  2. Solution
    - Drop existing restrictive policies
    - Create new permissive policies for anon role
    - Allow full CRUD access with anon key (public API)

  3. Security Note
    - This is acceptable for an internal tool
    - The anon key should be kept secure
    - Production apps should implement proper auth

  4. Tables affected
    - customers
    - orders
    - order_history
    - garment_types
    - inventory_models
    - mold_library
    - internal_catalog
    - employees
    - employee_attendance
    - employee_payments
*/

-- Drop old policies for customers
DROP POLICY IF EXISTS "Authenticated users can read customers" ON customers;
DROP POLICY IF EXISTS "Authenticated users can insert customers" ON customers;
DROP POLICY IF EXISTS "Authenticated users can update customers" ON customers;
DROP POLICY IF EXISTS "Authenticated users can delete customers" ON customers;

-- Create new policies for anon access on customers
CREATE POLICY "Anon can read customers" ON customers FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert customers" ON customers FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update customers" ON customers FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon can delete customers" ON customers FOR DELETE TO anon USING (true);

-- Drop old policies for orders
DROP POLICY IF EXISTS "Authenticated users can read orders" ON orders;
DROP POLICY IF EXISTS "Authenticated users can insert orders" ON orders;
DROP POLICY IF EXISTS "Authenticated users can update orders" ON orders;
DROP POLICY IF EXISTS "Authenticated users can delete orders" ON orders;

-- Create new policies for anon access on orders
CREATE POLICY "Anon can read orders" ON orders FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert orders" ON orders FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update orders" ON orders FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon can delete orders" ON orders FOR DELETE TO anon USING (true);

-- Drop old policies for order_history
DROP POLICY IF EXISTS "Authenticated users can read order history" ON order_history;
DROP POLICY IF EXISTS "Authenticated users can insert order history" ON order_history;
DROP POLICY IF EXISTS "Authenticated users can delete order history" ON order_history;

-- Create new policies for anon access on order_history
CREATE POLICY "Anon can read order_history" ON order_history FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert order_history" ON order_history FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can delete order_history" ON order_history FOR DELETE TO anon USING (true);

-- Drop old policies for garment_types
DROP POLICY IF EXISTS "Authenticated users can read garment types" ON garment_types;
DROP POLICY IF EXISTS "Authenticated users can insert garment types" ON garment_types;
DROP POLICY IF EXISTS "Authenticated users can update garment types" ON garment_types;

-- Create new policies for anon access on garment_types
CREATE POLICY "Anon can read garment_types" ON garment_types FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert garment_types" ON garment_types FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update garment_types" ON garment_types FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- Drop old policies for inventory_models
DROP POLICY IF EXISTS "Authenticated users can read inventory_models" ON inventory_models;
DROP POLICY IF EXISTS "Authenticated users can insert inventory_models" ON inventory_models;
DROP POLICY IF EXISTS "Authenticated users can update inventory_models" ON inventory_models;
DROP POLICY IF EXISTS "Authenticated users can delete inventory_models" ON inventory_models;

-- Create new policies for anon access on inventory_models
CREATE POLICY "Anon can read inventory_models" ON inventory_models FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert inventory_models" ON inventory_models FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update inventory_models" ON inventory_models FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon can delete inventory_models" ON inventory_models FOR DELETE TO anon USING (true);

-- Drop old policies for mold_library
DROP POLICY IF EXISTS "Authenticated users can read mold_library" ON mold_library;
DROP POLICY IF EXISTS "Authenticated users can insert mold_library" ON mold_library;
DROP POLICY IF EXISTS "Authenticated users can update mold_library" ON mold_library;
DROP POLICY IF EXISTS "Authenticated users can delete mold_library" ON mold_library;

-- Create new policies for anon access on mold_library
CREATE POLICY "Anon can read mold_library" ON mold_library FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert mold_library" ON mold_library FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update mold_library" ON mold_library FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon can delete mold_library" ON mold_library FOR DELETE TO anon USING (true);

-- Drop old policies for internal_catalog
DROP POLICY IF EXISTS "Authenticated users can read internal_catalog" ON internal_catalog;
DROP POLICY IF EXISTS "Authenticated users can insert internal_catalog" ON internal_catalog;
DROP POLICY IF EXISTS "Authenticated users can update internal_catalog" ON internal_catalog;
DROP POLICY IF EXISTS "Authenticated users can delete internal_catalog" ON internal_catalog;

-- Create new policies for anon access on internal_catalog
CREATE POLICY "Anon can read internal_catalog" ON internal_catalog FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert internal_catalog" ON internal_catalog FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update internal_catalog" ON internal_catalog FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon can delete internal_catalog" ON internal_catalog FOR DELETE TO anon USING (true);

-- Drop old policies for employees
DROP POLICY IF EXISTS "DEV: Public read employees" ON employees;
DROP POLICY IF EXISTS "DEV: Public insert employees" ON employees;
DROP POLICY IF EXISTS "DEV: Public update employees" ON employees;
DROP POLICY IF EXISTS "DEV: Public delete employees" ON employees;

-- Create new policies for anon access on employees
CREATE POLICY "Anon can read employees" ON employees FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert employees" ON employees FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update employees" ON employees FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon can delete employees" ON employees FOR DELETE TO anon USING (true);

-- Drop old policies for employee_attendance
DROP POLICY IF EXISTS "DEV: Public read attendance" ON employee_attendance;
DROP POLICY IF EXISTS "DEV: Public insert attendance" ON employee_attendance;
DROP POLICY IF EXISTS "DEV: Public update attendance" ON employee_attendance;
DROP POLICY IF EXISTS "DEV: Public delete attendance" ON employee_attendance;

-- Create new policies for anon access on employee_attendance
CREATE POLICY "Anon can read employee_attendance" ON employee_attendance FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert employee_attendance" ON employee_attendance FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update employee_attendance" ON employee_attendance FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon can delete employee_attendance" ON employee_attendance FOR DELETE TO anon USING (true);

-- Drop old policies for employee_payments
DROP POLICY IF EXISTS "DEV: Public read payments" ON employee_payments;
DROP POLICY IF EXISTS "DEV: Public insert payments" ON employee_payments;
DROP POLICY IF EXISTS "DEV: Public update payments" ON employee_payments;
DROP POLICY IF EXISTS "DEV: Public delete payments" ON employee_payments;

-- Create new policies for anon access on employee_payments
CREATE POLICY "Anon can read employee_payments" ON employee_payments FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert employee_payments" ON employee_payments FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update employee_payments" ON employee_payments FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon can delete employee_payments" ON employee_payments FOR DELETE TO anon USING (true);
