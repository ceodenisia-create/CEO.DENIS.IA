/*
  # Internal Catalog and Enhanced Features

  1. New Tables
    - `internal_catalog` - Private gallery for Modeltex
      - `id` (uuid, primary key)
      - `model_id` (uuid, FK to inventory_models, nullable)
      - `code` (text, unique)
      - `name` (text)
      - `category` (text)
      - `size_curve` (text)
      - `season` (text)
      - `photo_url` (text)
      - `status` (text: active, hidden, archived, no_publish, client_specific)
      - `internal_notes` (text)
      - `tags` (text array)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Modifications
    - `inventory_models` - Add `season` field

  3. Security
    - RLS enabled with DEV policies for public access
*/

-- Add season to inventory_models
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_models' AND column_name = 'season') THEN
    ALTER TABLE inventory_models ADD COLUMN season text DEFAULT '';
  END IF;
END $$;

-- Create internal_catalog table
CREATE TABLE IF NOT EXISTS internal_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid REFERENCES inventory_models(id) ON DELETE SET NULL,
  code text UNIQUE NOT NULL,
  name text NOT NULL DEFAULT '',
  category text DEFAULT 'otros',
  size_curve text DEFAULT '',
  season text DEFAULT '',
  photo_url text DEFAULT '',
  status text NOT NULL DEFAULT 'active',
  internal_notes text DEFAULT '',
  tags text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE internal_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read internal_catalog"
  ON internal_catalog FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert internal_catalog"
  ON internal_catalog FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update internal_catalog"
  ON internal_catalog FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete internal_catalog"
  ON internal_catalog FOR DELETE TO authenticated USING (true);

-- DEV policies for public access
CREATE POLICY "DEV: Public read internal_catalog" ON internal_catalog FOR SELECT TO public USING (true);
CREATE POLICY "DEV: Public insert internal_catalog" ON internal_catalog FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "DEV: Public update internal_catalog" ON internal_catalog FOR UPDATE TO public USING (true) WITH CHECK (true);
CREATE POLICY "DEV: Public delete internal_catalog" ON internal_catalog FOR DELETE TO public USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_internal_catalog_code ON internal_catalog(code);
CREATE INDEX IF NOT EXISTS idx_internal_catalog_status ON internal_catalog(status);
CREATE INDEX IF NOT EXISTS idx_internal_catalog_category ON internal_catalog(category);

-- Create storage bucket for internal catalog images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('catalog-images', 'catalog-images', true, 52428800, ARRAY[
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'
])
ON CONFLICT (id) DO NOTHING;

-- Storage policies for catalog-images
CREATE POLICY "Public read catalog images" ON storage.objects FOR SELECT TO public USING (bucket_id = 'catalog-images');
CREATE POLICY "DEV: Public upload catalog images" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = 'catalog-images');
CREATE POLICY "DEV: Public update catalog images" ON storage.objects FOR UPDATE TO public USING (bucket_id = 'catalog-images');
CREATE POLICY "DEV: Public delete catalog images" ON storage.objects FOR DELETE TO public USING (bucket_id = 'catalog-images');
