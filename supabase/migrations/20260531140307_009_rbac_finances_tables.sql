/*
  # Missing Tables + RBAC Auth System

  1. Creates finances and library_files tables
  2. Creates user_profiles for role management
  3. Links to Supabase auth.users
  4. Roles: 'admin' (full access), 'staff' (limited access)
  5. RLS policies restrict data access based on role
*/

-- ============================================
-- 1. FINANCES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS finances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL DEFAULT 'ingreso',
  category text NOT NULL DEFAULT '',
  description text DEFAULT '',
  amount numeric NOT NULL DEFAULT 0,
  date date NOT NULL DEFAULT CURRENT_DATE,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  employee_id uuid REFERENCES employees(id) ON DELETE SET NULL,
  payment_method text DEFAULT '',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE finances ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. LIBRARY_FILES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS library_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'document',
  category text DEFAULT '',
  file_url text NOT NULL DEFAULT '',
  file_size integer DEFAULT 0,
  description text DEFAULT '',
  tags text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE library_files ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 3. USER PROFILES TABLE (linked to auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text DEFAULT '',
  role text NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_profiles
CREATE POLICY "Users read own profile" ON user_profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON user_profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins read all profiles" ON user_profiles FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admins insert profiles" ON user_profiles FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admins update all profiles" ON user_profiles FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ============================================
-- 4. AUTO-CREATE USER PROFILE ON SIGNUP
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'staff')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 5. HELPER FUNCTION TO CHECK ADMIN ROLE
-- ============================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 6. RLS POLICIES - ROLE-BASED ACCESS
-- ============================================

-- EMPLOYEES: Only admin can access
DROP POLICY IF EXISTS "Anon can read employees" ON employees;
DROP POLICY IF EXISTS "Anon can insert employees" ON employees;
DROP POLICY IF EXISTS "Anon can update employees" ON employees;
DROP POLICY IF EXISTS "Anon can delete employees" ON employees;
DROP POLICY IF EXISTS "DEV: Public read employees" ON employees;
DROP POLICY IF EXISTS "DEV: Public insert employees" ON employees;
DROP POLICY IF EXISTS "DEV: Public update employees" ON employees;
DROP POLICY IF EXISTS "DEV: Public delete employees" ON employees;

CREATE POLICY "Admin read employees" ON employees FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "Admin insert employees" ON employees FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admin update employees" ON employees FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admin delete employees" ON employees FOR DELETE TO authenticated USING (is_admin());

-- EMPLOYEE_ATTENDANCE: Only admin
DROP POLICY IF EXISTS "Anon can read employee_attendance" ON employee_attendance;
DROP POLICY IF EXISTS "Anon can insert employee_attendance" ON employee_attendance;
DROP POLICY IF EXISTS "Anon can update employee_attendance" ON employee_attendance;
DROP POLICY IF EXISTS "Anon can delete employee_attendance" ON employee_attendance;
DROP POLICY IF EXISTS "DEV: Public read attendance" ON employee_attendance;
DROP POLICY IF EXISTS "DEV: Public insert attendance" ON employee_attendance;
DROP POLICY IF EXISTS "DEV: Public update attendance" ON employee_attendance;
DROP POLICY IF EXISTS "DEV: Public delete attendance" ON employee_attendance;

CREATE POLICY "Admin read attendance" ON employee_attendance FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "Admin insert attendance" ON employee_attendance FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admin update attendance" ON employee_attendance FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admin delete attendance" ON employee_attendance FOR DELETE TO authenticated USING (is_admin());

-- EMPLOYEE_PAYMENTS: Only admin
DROP POLICY IF EXISTS "Anon can read employee_payments" ON employee_payments;
DROP POLICY IF EXISTS "Anon can insert employee_payments" ON employee_payments;
DROP POLICY IF EXISTS "Anon can update employee_payments" ON employee_payments;
DROP POLICY IF EXISTS "Anon can delete employee_payments" ON employee_payments;
DROP POLICY IF EXISTS "DEV: Public read payments" ON employee_payments;
DROP POLICY IF EXISTS "DEV: Public insert payments" ON employee_payments;
DROP POLICY IF EXISTS "DEV: Public update payments" ON employee_payments;
DROP POLICY IF EXISTS "DEV: Public delete payments" ON employee_payments;

CREATE POLICY "Admin read payments" ON employee_payments FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "Admin insert payments" ON employee_payments FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admin update payments" ON employee_payments FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admin delete payments" ON employee_payments FOR DELETE TO authenticated USING (is_admin());

-- FINANCES: Only admin
CREATE POLICY "Admin read finances" ON finances FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "Admin insert finances" ON finances FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admin update finances" ON finances FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admin delete finances" ON finances FOR DELETE TO authenticated USING (is_admin());

-- CUSTOMERS: All authenticated users
DROP POLICY IF EXISTS "Anon can read customers" ON customers;
DROP POLICY IF EXISTS "Anon can insert customers" ON customers;
DROP POLICY IF EXISTS "Anon can update customers" ON customers;
DROP POLICY IF EXISTS "Anon can delete customers" ON customers;
DROP POLICY IF EXISTS "Authenticated users can read customers" ON customers;
DROP POLICY IF EXISTS "Authenticated users can insert customers" ON customers;
DROP POLICY IF EXISTS "Authenticated users can update customers" ON customers;
DROP POLICY IF EXISTS "Authenticated users can delete customers" ON customers;
DROP POLICY IF EXISTS "DEV: Public read access on customers" ON customers;
DROP POLICY IF EXISTS "DEV: Public insert access on customers" ON customers;
DROP POLICY IF EXISTS "DEV: Public update access on customers" ON customers;
DROP POLICY IF EXISTS "DEV: Public delete access on customers" ON customers;

CREATE POLICY "Auth read customers" ON customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert customers" ON customers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update customers" ON customers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth delete customers" ON customers FOR DELETE TO authenticated USING (true);

-- ORDERS: All authenticated
DROP POLICY IF EXISTS "Anon can read orders" ON orders;
DROP POLICY IF EXISTS "Anon can insert orders" ON orders;
DROP POLICY IF EXISTS "Anon can update orders" ON orders;
DROP POLICY IF EXISTS "Anon can delete orders" ON orders;
DROP POLICY IF EXISTS "Authenticated users can read orders" ON orders;
DROP POLICY IF EXISTS "Authenticated users can insert orders" ON orders;
DROP POLICY IF EXISTS "Authenticated users can update orders" ON orders;
DROP POLICY IF EXISTS "Authenticated users can delete orders" ON orders;
DROP POLICY IF EXISTS "DEV: Public read access on orders" ON orders;
DROP POLICY IF EXISTS "DEV: Public insert access on orders" ON orders;
DROP POLICY IF EXISTS "DEV: Public update access on orders" ON orders;
DROP POLICY IF EXISTS "DEV: Public delete access on orders" ON orders;

CREATE POLICY "Auth read orders" ON orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert orders" ON orders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update orders" ON orders FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth delete orders" ON orders FOR DELETE TO authenticated USING (true);

-- ORDER_HISTORY: All authenticated
DROP POLICY IF EXISTS "Anon can read order_history" ON order_history;
DROP POLICY IF EXISTS "Anon can insert order_history" ON order_history;
DROP POLICY IF EXISTS "Anon can delete order_history" ON order_history;
DROP POLICY IF EXISTS "DEV: Public read access on order_history" ON order_history;
DROP POLICY IF EXISTS "DEV: Public insert access on order_history" ON order_history;
DROP POLICY IF EXISTS "DEV: Public delete access on order_history" ON order_history;

CREATE POLICY "Auth read history" ON order_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert history" ON order_history FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth delete history" ON order_history FOR DELETE TO authenticated USING (true);

-- GARMENT_TYPES: All authenticated
DROP POLICY IF EXISTS "Anon can read garment_types" ON garment_types;
DROP POLICY IF EXISTS "Anon can insert garment_types" ON garment_types;
DROP POLICY IF EXISTS "Anon can update garment_types" ON garment_types;
DROP POLICY IF EXISTS "DEV: Public read access on garment_types" ON garment_types;
DROP POLICY IF EXISTS "DEV: Public insert access on garment_types" ON garment_types;
DROP POLICY IF EXISTS "DEV: Public update access on garment_types" ON garment_types;

CREATE POLICY "Auth read garment" ON garment_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert garment" ON garment_types FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update garment" ON garment_types FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- INVENTORY_MODELS: All authenticated
DROP POLICY IF EXISTS "Anon can read inventory_models" ON inventory_models;
DROP POLICY IF EXISTS "Anon can insert inventory_models" ON inventory_models;
DROP POLICY IF EXISTS "Anon can update inventory_models" ON inventory_models;
DROP POLICY IF EXISTS "Anon can delete inventory_models" ON inventory_models;
DROP POLICY IF EXISTS "DEV: Public read access on inventory_models" ON inventory_models;
DROP POLICY IF EXISTS "DEV: Public insert access on inventory_models" ON inventory_models;
DROP POLICY IF EXISTS "DEV: Public update access on inventory_models" ON inventory_models;
DROP POLICY IF EXISTS "DEV: Public delete access on inventory_models" ON inventory_models;

CREATE POLICY "Auth read inventory" ON inventory_models FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert inventory" ON inventory_models FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update inventory" ON inventory_models FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth delete inventory" ON inventory_models FOR DELETE TO authenticated USING (true);

-- MOLD_LIBRARY: All authenticated
DROP POLICY IF EXISTS "Anon can read mold_library" ON mold_library;
DROP POLICY IF EXISTS "Anon can insert mold_library" ON mold_library;
DROP POLICY IF EXISTS "Anon can update mold_library" ON mold_library;
DROP POLICY IF EXISTS "Anon can delete mold_library" ON mold_library;
DROP POLICY IF EXISTS "DEV: Public read access on mold_library" ON mold_library;
DROP POLICY IF EXISTS "DEV: Public insert access on mold_library" ON mold_library;
DROP POLICY IF EXISTS "DEV: Public update access on mold_library" ON mold_library;
DROP POLICY IF EXISTS "DEV: Public delete access on mold_library" ON mold_library;

CREATE POLICY "Auth read mold" ON mold_library FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert mold" ON mold_library FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update mold" ON mold_library FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth delete mold" ON mold_library FOR DELETE TO authenticated USING (true);

-- INTERNAL_CATALOG: All authenticated
DROP POLICY IF EXISTS "Anon can read internal_catalog" ON internal_catalog;
DROP POLICY IF EXISTS "Anon can insert internal_catalog" ON internal_catalog;
DROP POLICY IF EXISTS "Anon can update internal_catalog" ON internal_catalog;
DROP POLICY IF EXISTS "Anon can delete internal_catalog" ON internal_catalog;
DROP POLICY IF EXISTS "DEV: Public read internal_catalog" ON internal_catalog;
DROP POLICY IF EXISTS "DEV: Public insert internal_catalog" ON internal_catalog;
DROP POLICY IF EXISTS "DEV: Public update internal_catalog" ON internal_catalog;
DROP POLICY IF EXISTS "DEV: Public delete internal_catalog" ON internal_catalog;

CREATE POLICY "Auth read catalog" ON internal_catalog FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert catalog" ON internal_catalog FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update catalog" ON internal_catalog FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth delete catalog" ON internal_catalog FOR DELETE TO authenticated USING (true);

-- LIBRARY_FILES: All authenticated
CREATE POLICY "Auth read files" ON library_files FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert files" ON library_files FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update files" ON library_files FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth delete files" ON library_files FOR DELETE TO authenticated USING (true);

-- ============================================
-- 7. INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_finances_date ON finances(date);
CREATE INDEX IF NOT EXISTS idx_finances_type ON finances(type);
CREATE INDEX IF NOT EXISTS idx_finances_order ON finances(order_id);
CREATE INDEX IF NOT EXISTS idx_finances_employee ON finances(employee_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_category ON inventory_models(category);
CREATE INDEX IF NOT EXISTS idx_inventory_status ON inventory_models(status);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);
CREATE INDEX IF NOT EXISTS idx_attendance_emp ON employee_attendance(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON employee_attendance(date);
CREATE INDEX IF NOT EXISTS idx_payments_emp ON employee_payments(employee_id);

-- ============================================
-- 8. STORAGE BUCKETS (if not exist)
-- ============================================
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('catalog-images', 'catalog-images', true),
  ('order-files', 'order-files', true),
  ('mold-files', 'mold-files', true),
  ('library-files', 'library-files', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for authenticated users
DROP POLICY IF EXISTS "anon_upload" ON storage.objects;
DROP POLICY IF EXISTS "anon_read" ON storage.objects;
DROP POLICY IF EXISTS "anon_update" ON storage.objects;
DROP POLICY IF EXISTS "anon_delete" ON storage.objects;

CREATE POLICY "Auth upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id IN ('catalog-images', 'order-files', 'mold-files', 'library-files'));
CREATE POLICY "Auth read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id IN ('catalog-images', 'order-files', 'mold-files', 'library-files'));
CREATE POLICY "Auth update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id IN ('catalog-images', 'order-files', 'mold-files', 'library-files'));
CREATE POLICY "Auth delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id IN ('catalog-images', 'order-files', 'mold-files', 'library-files'));

SELECT 'RBAC system ready: user_profiles, finances, library_files created. Role-based RLS policies applied.' AS status;
