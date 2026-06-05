/*
  # Agenda operativa Modeltex

  Crea la tabla agenda_events para planificar pedidos, entregas, reuniones,
  pagos, reclamos y tareas internas. La migración es aditiva y no elimina datos.

  Roles esperados en user_profiles:
  - admin: acceso total
  - empleado / staff: lectura, creación y cambio de estado
  - pendiente: sin acceso a Agenda
*/

-- Compatibilidad con instalaciones que todavía usen el check anterior ('admin', 'staff').
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE user_profiles
  ADD CONSTRAINT user_profiles_role_check
  CHECK (role IN ('admin', 'empleado', 'pendiente', 'staff'));

CREATE TABLE IF NOT EXISTS agenda_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  event_type text NOT NULL CHECK (event_type IN ('pedido', 'entrega', 'reunion', 'corte', 'diseno', 'molderia', 'impresion', 'pago', 'reclamo', 'llamada', 'tarea_interna', 'otro')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('baja', 'normal', 'alta', 'urgente')),
  status text NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'en_proceso', 'completado', 'cancelado')),
  start_at timestamptz NOT NULL,
  end_at timestamptz,
  reminder text DEFAULT 'none' CHECK (reminder IN ('none', '15_min', '1_hour', '1_day')),
  color text DEFAULT '#14b8a6',
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  responsible_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT agenda_events_valid_time CHECK (end_at IS NULL OR end_at >= start_at)
);

CREATE INDEX IF NOT EXISTS idx_agenda_events_start_at ON agenda_events(start_at);
CREATE INDEX IF NOT EXISTS idx_agenda_events_status ON agenda_events(status);
CREATE INDEX IF NOT EXISTS idx_agenda_events_priority ON agenda_events(priority);
CREATE INDEX IF NOT EXISTS idx_agenda_events_type ON agenda_events(event_type);
CREATE INDEX IF NOT EXISTS idx_agenda_events_customer ON agenda_events(customer_id);
CREATE INDEX IF NOT EXISTS idx_agenda_events_order ON agenda_events(order_id);
CREATE INDEX IF NOT EXISTS idx_agenda_events_responsible ON agenda_events(responsible_user_id);

ALTER TABLE agenda_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_agenda_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.can_access_agenda()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'empleado', 'staff')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.set_agenda_events_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_agenda_events_updated_at ON agenda_events;
CREATE TRIGGER set_agenda_events_updated_at
  BEFORE UPDATE ON agenda_events
  FOR EACH ROW
  EXECUTE FUNCTION public.set_agenda_events_updated_at();

CREATE OR REPLACE FUNCTION public.prevent_non_admin_agenda_critical_updates()
RETURNS trigger AS $$
BEGIN
  IF public.is_agenda_admin() THEN
    RETURN NEW;
  END IF;

  -- Los empleados pueden editar completamente sus propias actividades,
  -- pero nunca reasignar auditoría de creación.
  IF OLD.created_by = auth.uid() THEN
    IF NEW.created_by IS DISTINCT FROM OLD.created_by
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
      RAISE EXCEPTION 'No tenés permiso para realizar esta acción.' USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
  END IF;

  -- Sobre actividades creadas por admin u otros usuarios, un empleado solo puede cambiar estado.
  IF NEW.title IS DISTINCT FROM OLD.title
    OR NEW.description IS DISTINCT FROM OLD.description
    OR NEW.event_type IS DISTINCT FROM OLD.event_type
    OR NEW.priority IS DISTINCT FROM OLD.priority
    OR NEW.start_at IS DISTINCT FROM OLD.start_at
    OR NEW.end_at IS DISTINCT FROM OLD.end_at
    OR NEW.reminder IS DISTINCT FROM OLD.reminder
    OR NEW.color IS DISTINCT FROM OLD.color
    OR NEW.customer_id IS DISTINCT FROM OLD.customer_id
    OR NEW.order_id IS DISTINCT FROM OLD.order_id
    OR NEW.responsible_user_id IS DISTINCT FROM OLD.responsible_user_id
    OR NEW.created_by IS DISTINCT FROM OLD.created_by
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'No tenés permiso para realizar esta acción.' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS prevent_non_admin_agenda_critical_updates ON agenda_events;
CREATE TRIGGER prevent_non_admin_agenda_critical_updates
  BEFORE UPDATE ON agenda_events
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_non_admin_agenda_critical_updates();


DROP POLICY IF EXISTS "Agenda members read profiles" ON user_profiles;
CREATE POLICY "Agenda members read profiles"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (public.can_access_agenda());

DROP POLICY IF EXISTS "Agenda admins select" ON agenda_events;
DROP POLICY IF EXISTS "Agenda users select" ON agenda_events;
DROP POLICY IF EXISTS "Agenda users insert" ON agenda_events;
DROP POLICY IF EXISTS "Agenda users update" ON agenda_events;
DROP POLICY IF EXISTS "Agenda admins delete" ON agenda_events;

CREATE POLICY "Agenda users select"
  ON agenda_events FOR SELECT
  TO authenticated
  USING (public.can_access_agenda());

CREATE POLICY "Agenda users insert"
  ON agenda_events FOR INSERT
  TO authenticated
  WITH CHECK (public.can_access_agenda() AND COALESCE(created_by, auth.uid()) = auth.uid());

CREATE POLICY "Agenda users update"
  ON agenda_events FOR UPDATE
  TO authenticated
  USING (public.can_access_agenda())
  WITH CHECK (public.can_access_agenda());

CREATE POLICY "Agenda admins delete"
  ON agenda_events FOR DELETE
  TO authenticated
  USING (public.is_agenda_admin());

COMMENT ON TABLE agenda_events IS 'Agenda operativa de CEO Modeltex para pedidos, entregas, reuniones, pagos, reclamos y tareas internas.';
