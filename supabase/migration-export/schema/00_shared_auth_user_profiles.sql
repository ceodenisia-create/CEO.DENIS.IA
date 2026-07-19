-- Plan Maestro (CEO DENIS) — Supabase nuevo
-- Extraído a mano SOLO de las partes de user_profiles/roles de las migraciones
-- 009_rbac_finances_tables.sql, 018_roles_asistente.sql y 020_user_profiles_admin_policy.sql
-- del proyecto original (sdlkrcqithhqhwwmeets), que en ese proyecto están MEZCLADAS
-- con RLS de tablas de Modeltex (employees, finances, customers, orders, etc.).
-- Acá solo queda la parte que Plan Maestro necesita para login + roles.
-- Debe aplicarse ANTES de las tablas pm_* (01_...sql en adelante), aunque el orden
-- no es estrictamente crítico porque las tablas pm_ solo referencian auth.users.

-- ============================================
-- 1. USER_PROFILES TABLE (estado final, tras 009 + 018)
-- ============================================
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text DEFAULT '',
  role text NOT NULL DEFAULT 'asistente'
    CHECK (role IN ('admin', 'staff', 'empleado', 'pendiente', 'asistente')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. HELPER FUNCTION: is_admin()
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
-- 3. AUTO-CREATE PROFILE ON SIGNUP (estado final, tras 018)
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    'asistente'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 4. RLS POLICIES (estado final, tras 009 + 020 — sin duplicados)
-- ============================================
DROP POLICY IF EXISTS "Users read own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins read all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins insert profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins update all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admin can read all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admin can update user roles" ON user_profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON user_profiles;

CREATE POLICY "Users update own profile" ON user_profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins insert profiles" ON user_profiles
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admin can read all profiles" ON user_profiles
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admin can update user roles" ON user_profiles
  FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Users can read own profile" ON user_profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

SELECT 'user_profiles + is_admin() + handle_new_user() listos para Plan Maestro' AS status;
