/*
  # Add role column to employees table
  
  Adds a 'role' column to track admin vs staff permissions
  Defaults to 'staff', matches user_profiles role structure
*/

ALTER TABLE employees
ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff'));

CREATE INDEX IF NOT EXISTS idx_employees_role ON employees(role);
