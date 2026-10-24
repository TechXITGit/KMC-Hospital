-- ============================================================================
-- KMC Hospital App - Role-Based Access Control (RBAC) & Doctor Security
-- Migration: 20260914_role_based_access_control.sql
-- Review before executing in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/fhxsiueizpzreoxfrbuy/sql
-- ============================================================================

-- ============================================================================
-- 1. EXTEND PUBLIC.DOCTORS TABLE
-- ============================================================================
-- Add genuinely missing fields for doctor authorization, verification, and link to auth.users
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'verified';
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS invitation_status TEXT DEFAULT 'accepted';
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS phone TEXT;

-- Enforce check constraints safely (drop existing first to avoid duplication errors)
ALTER TABLE public.doctors DROP CONSTRAINT IF EXISTS check_doctor_verification_status;
ALTER TABLE public.doctors ADD CONSTRAINT check_doctor_verification_status 
  CHECK (verification_status IN ('pending', 'verified', 'suspended'));

ALTER TABLE public.doctors DROP CONSTRAINT IF EXISTS check_doctor_invitation_status;
ALTER TABLE public.doctors ADD CONSTRAINT check_doctor_invitation_status 
  CHECK (invitation_status IN ('not_invited', 'invited', 'accepted'));

-- Create index for performance on doctor lookups by auth_user_id
CREATE INDEX IF NOT EXISTS idx_doctors_auth_user_id ON public.doctors (auth_user_id);
CREATE INDEX IF NOT EXISTS idx_doctors_active ON public.doctors (active, verification_status);

-- Ensure all existing seeded doctors are active & verified
UPDATE public.doctors 
SET active = COALESCE(active, true),
    verification_status = COALESCE(verification_status, 'verified'),
    invitation_status = COALESCE(invitation_status, 'accepted')
WHERE active IS NULL OR verification_status IS NULL OR invitation_status IS NULL;

-- ============================================================================
-- 2. SECURITY HELPER FUNCTIONS
-- ============================================================================

-- Helper function to get current user's verified role from profiles
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = (select auth.uid())::text LIMIT 1;
$$;

-- Helper function to check if caller is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role = 'admin' FROM public.profiles WHERE id = (select auth.uid())::text LIMIT 1),
    false
  );
$$;

-- Helper function to get doctor_id for the logged in auth user
CREATE OR REPLACE FUNCTION public.get_current_doctor_id()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.doctors WHERE auth_user_id = (select auth.uid()) LIMIT 1;
$$;

-- Helper function to check if caller is an active verified doctor
CREATE OR REPLACE FUNCTION public.is_active_doctor()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT (active = true AND verification_status = 'verified') 
     FROM public.doctors 
     WHERE auth_user_id = (select auth.uid()) LIMIT 1),
    false
  );
$$;

-- Dedicated One-Time Admin Bootstrap Function
-- Callable ONLY from trusted database / SQL Editor / superuser context.
-- Normal authenticated/anon clients cannot invoke this function.
CREATE OR REPLACE FUNCTION public.bootstrap_admin_by_email(p_email TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Strict guard: Only allow direct execution by superusers or service_role
  IF current_user NOT IN ('postgres', 'supabase_admin', 'service_role') THEN
    RAISE EXCEPTION 'Access denied: bootstrap_admin_by_email can only be executed directly from Supabase SQL Editor';
  END IF;

  UPDATE public.profiles
  SET role = 'admin',
      updated_at = NOW()
  WHERE LOWER(email) = LOWER(TRIM(p_email));

  IF NOT FOUND THEN
    RAISE NOTICE 'No profile found for email: %. Ensure user has signed up first.', p_email;
  ELSE
    RAISE NOTICE 'Successfully granted admin role to: %', p_email;
  END IF;
END;
$$;

-- Lock down bootstrap function: revoke from public/authenticated/anon
REVOKE ALL ON FUNCTION public.bootstrap_admin_by_email(TEXT) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.bootstrap_admin_by_email(TEXT) TO postgres, service_role;

-- ============================================================================
-- 3. INTEGRITY & ANTI-ESCALATION TRIGGERS
-- ============================================================================

-- 3.1 ROLE ESCALATION PREVENTION ON PROFILES
-- Prevents clients from updating profiles.role arbitrarily
-- Allows SQL Editor / postgres superuser / service_role and verified admins
CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If role is not being modified, proceed normally
  IF OLD.role IS NOT DISTINCT FROM NEW.role THEN
    RETURN NEW;
  END IF;

  -- 1. Allow direct database context (Supabase SQL Editor, migrations, service_role)
  IF current_user IN ('postgres', 'supabase_admin', 'service_role') THEN
    RETURN NEW;
  END IF;

  -- 2. Allow verified hospital administrators
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- 3. Deny all other modification attempts
  RAISE EXCEPTION 'Unauthorized: Only hospital administrators or database administrators can modify user roles';
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_role ON public.profiles;
CREATE TRIGGER trg_protect_profile_role
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_role();

-- 3.2 AUTOMATIC PROFILE INITIALIZATION TRIGGER ON AUTH.USERS
-- Automatically creates a profile with role = 'patient' when a new auth user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone, role)
  VALUES (
    NEW.id::text,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'KMC Patient'),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    'patient' -- Always default to patient, never escalate!
  )
  ON CONFLICT (id) DO UPDATE
  SET full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
      email = COALESCE(EXCLUDED.email, public.profiles.email),
      phone = COALESCE(NULLIF(EXCLUDED.phone, ''), public.profiles.phone);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 3.3 DOCTOR RECORD PROTECTION TRIGGER
-- Prevents doctors from tampering with auth_user_id, active status, verification status, or invitation status
CREATE OR REPLACE FUNCTION public.protect_doctor_record()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Direct database context or admin can update any doctor field
  IF current_user IN ('postgres', 'supabase_admin', 'service_role') OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- If caller is a doctor updating their own record:
  IF (select auth.uid()) IS NOT NULL AND OLD.auth_user_id = (select auth.uid()) THEN
    -- Doctor cannot modify auth_user_id
    IF OLD.auth_user_id IS DISTINCT FROM NEW.auth_user_id THEN
      RAISE EXCEPTION 'Unauthorized: Doctors cannot change auth_user_id';
    END IF;
    -- Doctor cannot change active status
    IF OLD.active IS DISTINCT FROM NEW.active THEN
      RAISE EXCEPTION 'Unauthorized: Doctors cannot change active status';
    END IF;
    -- Doctor cannot change verification_status
    IF OLD.verification_status IS DISTINCT FROM NEW.verification_status THEN
      RAISE EXCEPTION 'Unauthorized: Doctors cannot change verification_status';
    END IF;
    -- Doctor cannot change invitation_status
    IF OLD.invitation_status IS DISTINCT FROM NEW.invitation_status THEN
      RAISE EXCEPTION 'Unauthorized: Doctors cannot change invitation_status';
    END IF;
    -- Doctor cannot change consultation_fee (hospital policy)
    IF OLD.consultation_fee IS DISTINCT FROM NEW.consultation_fee THEN
      RAISE EXCEPTION 'Unauthorized: Consultation fee can only be modified by hospital administration';
    END IF;
    RETURN NEW;
  END IF;

  -- Anyone else: reject
  RAISE EXCEPTION 'Unauthorized: You do not have permission to modify doctor records';
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_doctor_record ON public.doctors;
CREATE TRIGGER trg_protect_doctor_record
  BEFORE UPDATE ON public.doctors
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_doctor_record();

-- 3.4 APPOINTMENT MODIFICATION PROTECTION TRIGGER
-- Enforces that patients cannot alter doctor_id, fee, slot, or change status to anything other than 'cancelled'
CREATE OR REPLACE FUNCTION public.protect_appointment_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT := public.get_current_user_role();
  v_is_adm BOOLEAN := public.is_admin();
  v_doc_id TEXT := public.get_current_doctor_id();
BEGIN
  -- Superuser, migrations, service_role, or hospital admin have full management
  IF current_user IN ('postgres', 'supabase_admin', 'service_role') OR v_is_adm THEN
    RETURN NEW;
  END IF;

  -- If caller is a doctor:
  IF v_role = 'doctor' THEN
    IF OLD.doctor_id <> v_doc_id THEN
      RAISE EXCEPTION 'Unauthorized: Doctors can only modify appointments assigned to them';
    END IF;
    IF OLD.doctor_id IS DISTINCT FROM NEW.doctor_id OR OLD.patient_id IS DISTINCT FROM NEW.patient_id THEN
      RAISE EXCEPTION 'Unauthorized: Doctors cannot reassign appointments or alter patient IDs';
    END IF;
    RETURN NEW;
  END IF;

  -- If caller is a patient:
  IF OLD.patient_id IS DISTINCT FROM (select auth.uid())::text THEN
    RAISE EXCEPTION 'Unauthorized: Patients can only modify their own appointments';
  END IF;

  -- Patients cannot manipulate doctor_id, consultation_fee, total_amount, date, slot time, or token
  IF OLD.doctor_id IS DISTINCT FROM NEW.doctor_id
     OR OLD.consultation_fee IS DISTINCT FROM NEW.consultation_fee
     OR OLD.total_amount IS DISTINCT FROM NEW.total_amount
     OR OLD.appointment_date IS DISTINCT FROM NEW.appointment_date
     OR OLD.start_time IS DISTINCT FROM NEW.start_time
     OR OLD.token_number IS DISTINCT FROM NEW.token_number
     OR OLD.patient_id IS DISTINCT FROM NEW.patient_id
  THEN
    RAISE EXCEPTION 'Unauthorized: Patients cannot alter doctor, slot time, token, or financial amounts of an existing appointment';
  END IF;

  -- Patients can ONLY change status to 'cancelled' (cannot self-mark 'completed' or 'confirmed')
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF LOWER(NEW.status) <> 'cancelled' THEN
      RAISE EXCEPTION 'Unauthorized: Patients can only cancel their appointments';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_appointment_modification ON public.appointments;
CREATE TRIGGER trg_protect_appointment_modification
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_appointment_modification();

-- ============================================================================
-- 4. ROW-LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slot_holds ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 4.1 PROFILES POLICIES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow all on profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow public read on profiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own_or_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_admin" ON public.profiles;

-- SELECT: Users view own profile; Doctors view profiles of patients with appointments; Admins view all
CREATE POLICY "profiles_select_policy" ON public.profiles
  FOR SELECT
  TO authenticated, anon
  USING (
    (select auth.uid())::text = id
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.appointments apt
      WHERE apt.patient_id = public.profiles.id
        AND apt.doctor_id = (SELECT id FROM public.doctors WHERE auth_user_id = (select auth.uid()))
    )
  );

-- INSERT: SECURE POLICY — Authenticated users can ONLY insert their own profile with role = 'patient'
-- Anon users CANNOT insert arbitrary profiles
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (select auth.uid()) IS NOT NULL
    AND (select auth.uid())::text = id
    AND (role IS NULL OR role = 'patient')
  );

-- UPDATE: Users can update own profile fields (role column is protected by trigger trg_protect_profile_role)
CREATE POLICY "profiles_update_own_or_admin" ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    (select auth.uid())::text = id
    OR public.is_admin()
  )
  WITH CHECK (
    (select auth.uid())::text = id
    OR public.is_admin()
  );

-- DELETE: Admins only
CREATE POLICY "profiles_delete_admin" ON public.profiles
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- 4.2 DOCTORS POLICIES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow all on doctors" ON public.doctors;
DROP POLICY IF EXISTS "Allow public read on doctors" ON public.doctors;
DROP POLICY IF EXISTS "doctors_select_policy" ON public.doctors;
DROP POLICY IF EXISTS "doctors_insert_admin" ON public.doctors;
DROP POLICY IF EXISTS "doctors_update_policy" ON public.doctors;
DROP POLICY IF EXISTS "doctors_delete_admin" ON public.doctors;

-- SELECT: Public can see active & verified doctors; Admins and linked doctors can see all
CREATE POLICY "doctors_select_policy" ON public.doctors
  FOR SELECT
  TO authenticated, anon
  USING (
    (active = true AND verification_status = 'verified')
    OR public.is_admin()
    OR auth_user_id = (select auth.uid())
  );

-- INSERT: Admins only (No public doctor registration)
CREATE POLICY "doctors_insert_admin" ON public.doctors
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- UPDATE: Admins can update any doctor; Doctors can update permitted profile fields
-- (Protected columns auth_user_id, active, verification_status, fee enforced by trigger)
CREATE POLICY "doctors_update_policy" ON public.doctors
  FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR auth_user_id = (select auth.uid())
  )
  WITH CHECK (
    public.is_admin()
    OR auth_user_id = (select auth.uid())
  );

-- DELETE: Admins only
CREATE POLICY "doctors_delete_admin" ON public.doctors
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- 4.3 APPOINTMENTS POLICIES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow all on appointments" ON public.appointments;
DROP POLICY IF EXISTS "Allow public read on appointments" ON public.appointments;
DROP POLICY IF EXISTS "appointments_select_policy" ON public.appointments;
DROP POLICY IF EXISTS "appointments_insert_policy" ON public.appointments;
DROP POLICY IF EXISTS "appointments_update_policy" ON public.appointments;
DROP POLICY IF EXISTS "appointments_delete_admin" ON public.appointments;

-- SELECT:
-- 1. Patient views own appointments
-- 2. Doctor views assigned appointments
-- 3. Admin views all appointments
CREATE POLICY "appointments_select_policy" ON public.appointments
  FOR SELECT
  TO authenticated
  USING (
    patient_id = (select auth.uid())::text
    OR patient_email = (select auth.jwt()->>'email')
    OR doctor_id = (SELECT id FROM public.doctors WHERE auth_user_id = (select auth.uid()))
    OR public.is_admin()
  );

-- INSERT:
-- Authenticated patient can ONLY insert an appointment for themselves
-- Anon write access is blocked (booking transactions proceed through confirm_appointment_atomic)
CREATE POLICY "appointments_insert_policy" ON public.appointments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (select auth.uid()) IS NOT NULL
    AND patient_id = (select auth.uid())::text
    OR public.is_admin()
  );

-- UPDATE:
-- Patient can cancel own; Doctor can update assigned; Admin can update all
-- (Protected fields enforced by trigger trg_protect_appointment_modification)
CREATE POLICY "appointments_update_policy" ON public.appointments
  FOR UPDATE
  TO authenticated
  USING (
    patient_id = (select auth.uid())::text
    OR patient_email = (select auth.jwt()->>'email')
    OR doctor_id = (SELECT id FROM public.doctors WHERE auth_user_id = (select auth.uid()))
    OR public.is_admin()
  )
  WITH CHECK (
    patient_id = (select auth.uid())::text
    OR patient_email = (select auth.jwt()->>'email')
    OR doctor_id = (SELECT id FROM public.doctors WHERE auth_user_id = (select auth.uid()))
    OR public.is_admin()
  );

-- DELETE: Admins only
CREATE POLICY "appointments_delete_admin" ON public.appointments
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- 4.4 DOCTOR AVAILABILITY POLICIES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow all on doctor_availability" ON public.doctor_availability;
DROP POLICY IF EXISTS "Allow public read on doctor_availability" ON public.doctor_availability;
DROP POLICY IF EXISTS "doctor_avail_select" ON public.doctor_availability;
DROP POLICY IF EXISTS "doctor_avail_modify" ON public.doctor_availability;

-- Public can view doctor availability to select timeslots
CREATE POLICY "doctor_avail_select" ON public.doctor_availability
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- Only doctor or admin can modify availability
CREATE POLICY "doctor_avail_modify" ON public.doctor_availability
  FOR ALL
  TO authenticated
  USING (
    public.is_admin()
    OR doctor_id = (SELECT id FROM public.doctors WHERE auth_user_id = (select auth.uid()))
  )
  WITH CHECK (
    public.is_admin()
    OR doctor_id = (SELECT id FROM public.doctors WHERE auth_user_id = (select auth.uid()))
  );

-- ----------------------------------------------------------------------------
-- 4.5 SLOT HOLDS POLICIES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow all on slot_holds" ON public.slot_holds;
DROP POLICY IF EXISTS "Allow public read on slot_holds" ON public.slot_holds;
DROP POLICY IF EXISTS "slot_holds_select" ON public.slot_holds;
DROP POLICY IF EXISTS "slot_holds_insert_own" ON public.slot_holds;
DROP POLICY IF EXISTS "slot_holds_update_own" ON public.slot_holds;
DROP POLICY IF EXISTS "slot_holds_delete_own" ON public.slot_holds;

-- SELECT: Public can view active holds so UI displays locked slots
CREATE POLICY "slot_holds_select" ON public.slot_holds
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- INSERT: Authenticated users can only hold for their own user_id
-- (Anon slot holds use the hold_slot_atomic SECURITY DEFINER function)
CREATE POLICY "slot_holds_insert_own" ON public.slot_holds
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (select auth.uid()) IS NOT NULL
    AND held_by = (select auth.uid())::text
  );

-- UPDATE: Users can only update their own hold
CREATE POLICY "slot_holds_update_own" ON public.slot_holds
  FOR UPDATE
  TO authenticated
  USING (
    (select auth.uid()) IS NOT NULL
    AND held_by = (select auth.uid())::text
  )
  WITH CHECK (
    (select auth.uid()) IS NOT NULL
    AND held_by = (select auth.uid())::text
  );

-- DELETE: Users can delete their own hold; Admins can clear any hold
CREATE POLICY "slot_holds_delete_own" ON public.slot_holds
  FOR DELETE
  TO authenticated
  USING (
    held_by = (select auth.uid())::text
    OR public.is_admin()
  );

-- ============================================================================
-- 5. FAST SERVER-SIDE ROLE RESOLVER RPC
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_role TEXT := 'patient';
  v_doctor RECORD;
  v_profile RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('role', 'anon', 'authenticated', false);
  END IF;

  -- 1. Get profile role
  SELECT * INTO v_profile FROM public.profiles WHERE id = v_uid::text;
  IF FOUND AND v_profile.role IS NOT NULL THEN
    v_role := v_profile.role;
  END IF;

  -- 2. If doctor, get linked doctor record
  IF v_role = 'doctor' THEN
    SELECT * INTO v_doctor FROM public.doctors WHERE auth_user_id = v_uid;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'role', 'doctor',
        'authenticated', true,
        'active', v_doctor.active,
        'verification_status', v_doctor.verification_status,
        'doctor_id', v_doctor.id,
        'doctor_name', v_doctor.name,
        'department', v_doctor.department,
        'specialization', v_doctor.specialization,
        'email', v_doctor.email,
        'profile', row_to_json(v_profile)
      );
    ELSE
      RETURN jsonb_build_object(
        'role', 'doctor',
        'authenticated', true,
        'unlinked', true,
        'profile', row_to_json(v_profile)
      );
    END IF;
  END IF;

  -- Return patient or admin role
  RETURN jsonb_build_object(
    'role', v_role,
    'authenticated', true,
    'profile', row_to_json(v_profile)
  );
END;
$$;

-- Grant execute permissions to appropriate roles
GRANT EXECUTE ON FUNCTION public.get_current_user_role() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_current_doctor_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_doctor() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated, anon;
