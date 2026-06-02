/*
  # Fix admin detection and Biblioteca uploads

  1. Admin profiles
    - Keeps using public.user_profiles.role as the canonical admin field.
    - Replaces recursive profile policies with SECURITY DEFINER helpers.
    - Backfills missing user_profiles rows for existing auth users.
    - Accepts 'admin' and 'administrador' in metadata helpers, while the table role remains 'admin'/'staff'.

  2. Biblioteca storage
    - Ensures mold-files and library-files buckets exist and are public.
    - Removes restrictive MIME allow-lists that reject common design files saved as application/octet-stream.
    - Recreates idempotent authenticated storage policies for those buckets.
*/

-- ============================================
-- 1. USER PROFILE ADMIN HELPERS
-- ============================================
CREATE OR REPLACE FUNCTION public.normalize_user_role(raw_role text)
RETURNS text AS $$
BEGIN
  CASE lower(trim(coalesce(raw_role, '')))
    WHEN 'admin' THEN RETURN 'admin';
    WHEN 'administrator' THEN RETURN 'admin';
    WHEN 'administrador' THEN RETURN 'admin';
    ELSE RETURN 'staff';
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text AS $$
DECLARE
  profile_role text;
  metadata_role text;
BEGIN
  SELECT role INTO profile_role
  FROM public.user_profiles
  WHERE id = auth.uid();

  IF profile_role IS NOT NULL THEN
    RETURN public.normalize_user_role(profile_role);
  END IF;

  SELECT coalesce(raw_app_meta_data->>'role', raw_user_meta_data->>'role') INTO metadata_role
  FROM auth.users
  WHERE id = auth.uid();

  RETURN public.normalize_user_role(metadata_role);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public, auth;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN public.current_user_role() = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public, auth;

-- Existing auth users created before the trigger may not have a profile row.
INSERT INTO public.user_profiles (id, email, full_name, role)
SELECT
  au.id,
  coalesce(au.email, ''),
  coalesce(au.raw_user_meta_data->>'full_name', ''),
  public.normalize_user_role(coalesce(au.raw_app_meta_data->>'role', au.raw_user_meta_data->>'role'))
FROM auth.users au
ON CONFLICT (id) DO UPDATE
SET
  email = excluded.email,
  full_name = coalesce(nullif(user_profiles.full_name, ''), excluded.full_name),
  updated_at = now();

-- Avoid recursive policies on user_profiles by delegating admin checks to SECURITY DEFINER functions.
DROP POLICY IF EXISTS "Users read own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins read all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins insert profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins update all profiles" ON public.user_profiles;

CREATE POLICY "Users read own profile" ON public.user_profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users update own profile" ON public.user_profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND role = public.current_user_role());

CREATE POLICY "Admins read all profiles" ON public.user_profiles
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins insert profiles" ON public.user_profiles
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins update all profiles" ON public.user_profiles
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================
-- 2. BIBLIOTECA STORAGE BUCKETS AND POLICIES
-- ============================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('mold-files', 'mold-files', true, 52428800, NULL),
  ('library-files', 'library-files', true, 52428800, NULL)
ON CONFLICT (id) DO UPDATE
SET
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = NULL;

DROP POLICY IF EXISTS "Public read access for mold files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload mold files" ON storage.objects;
DROP POLICY IF EXISTS "DEV: Public upload mold files" ON storage.objects;
DROP POLICY IF EXISTS "DEV: Public update mold files" ON storage.objects;
DROP POLICY IF EXISTS "DEV: Public delete mold files" ON storage.objects;
DROP POLICY IF EXISTS "Auth biblioteca read" ON storage.objects;
DROP POLICY IF EXISTS "Public biblioteca read" ON storage.objects;
DROP POLICY IF EXISTS "Auth biblioteca upload" ON storage.objects;
DROP POLICY IF EXISTS "Auth biblioteca update" ON storage.objects;
DROP POLICY IF EXISTS "Auth biblioteca delete" ON storage.objects;

CREATE POLICY "Public biblioteca read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id IN ('mold-files', 'library-files'));

CREATE POLICY "Auth biblioteca upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('mold-files', 'library-files'));

CREATE POLICY "Auth biblioteca update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id IN ('mold-files', 'library-files'))
  WITH CHECK (bucket_id IN ('mold-files', 'library-files'));

CREATE POLICY "Auth biblioteca delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id IN ('mold-files', 'library-files'));
