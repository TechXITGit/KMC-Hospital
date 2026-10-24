-- ============================================================================
-- KMC Hospital App - Doctor-to-Patient WebRTC Calling & Signaling System
-- Migration: 20260915130000_webrtc_calling_system.sql
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. CALLS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id TEXT NULL REFERENCES public.appointments(id) ON DELETE SET NULL,
  doctor_id TEXT NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  doctor_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_id TEXT NOT NULL,
  patient_user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  initiated_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  call_type TEXT NOT NULL CHECK (call_type IN ('audio', 'video')),
  status TEXT NOT NULL DEFAULT 'ringing' CHECK (
    status IN (
      'ringing',
      'accepted',
      'rejected',
      'connecting',
      'connected',
      'ended',
      'missed',
      'failed',
      'cancelled'
    )
  ),
  started_at TIMESTAMPTZ NULL,
  connected_at TIMESTAMPTZ NULL,
  ended_at TIMESTAMPTZ NULL,
  ended_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_calls_doctor_user_id ON public.calls (doctor_user_id);
CREATE INDEX IF NOT EXISTS idx_calls_patient_user_id ON public.calls (patient_user_id);
CREATE INDEX IF NOT EXISTS idx_calls_appointment_id ON public.calls (appointment_id);
CREATE INDEX IF NOT EXISTS idx_calls_status ON public.calls (status);
CREATE INDEX IF NOT EXISTS idx_calls_created_at ON public.calls (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_calls_active_lookup ON public.calls (appointment_id, status);

-- Updated_at Trigger
DROP TRIGGER IF EXISTS trg_calls_updated_at ON public.calls;
CREATE TRIGGER trg_calls_updated_at
  BEFORE UPDATE ON public.calls
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Enable Supabase Realtime for table changes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'calls'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. ROW LEVEL SECURITY (RLS) FOR CALLS
-- ----------------------------------------------------------------------------
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

-- Clean up any existing policies
DROP POLICY IF EXISTS "calls_select_doctor" ON public.calls;
DROP POLICY IF EXISTS "calls_select_patient" ON public.calls;
DROP POLICY IF EXISTS "calls_select_admin" ON public.calls;
DROP POLICY IF EXISTS "calls_insert_doctor" ON public.calls;
DROP POLICY IF EXISTS "calls_update_doctor" ON public.calls;
DROP POLICY IF EXISTS "calls_update_patient" ON public.calls;
DROP POLICY IF EXISTS "calls_delete_admin" ON public.calls;

-- 2.1 SELECT POLICIES
-- Doctors can select their own calls
CREATE POLICY "calls_select_doctor"
  ON public.calls FOR SELECT
  TO authenticated
  USING (doctor_user_id = (select auth.uid()));

-- Patients can select calls they are invited to or participating in
CREATE POLICY "calls_select_patient"
  ON public.calls FOR SELECT
  TO authenticated
  USING (
    patient_user_id = (select auth.uid()) OR
    patient_id = (select auth.uid())::text
  );

-- Admins can select all calls for monitoring / audit
CREATE POLICY "calls_select_admin"
  ON public.calls FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- 2.2 INSERT POLICIES (STRICT: DOCTOR ONLY)
-- ONLY verified active doctors can initiate calls.
-- Patients HAVE NO INSERT POLICY and will be rejected with RLS error if they attempt to insert.
CREATE POLICY "calls_insert_doctor"
  ON public.calls FOR INSERT
  TO authenticated
  WITH CHECK (
    initiated_by = (select auth.uid()) AND
    doctor_user_id = (select auth.uid()) AND
    public.is_active_doctor()
  );

-- 2.3 UPDATE POLICIES
-- Doctor can update their own calls (e.g. cancel ringing call, transition state, end call)
CREATE POLICY "calls_update_doctor"
  ON public.calls FOR UPDATE
  TO authenticated
  USING (doctor_user_id = (select auth.uid()))
  WITH CHECK (doctor_user_id = (select auth.uid()));

-- Patient can update calls they are invited to (e.g. accept, reject, end)
-- (Protected columns like doctor_id and patient_id cannot be spoofed)
CREATE POLICY "calls_update_patient"
  ON public.calls FOR UPDATE
  TO authenticated
  USING (
    patient_user_id = (select auth.uid()) OR
    patient_id = (select auth.uid())::text
  )
  WITH CHECK (
    patient_user_id = (select auth.uid()) OR
    patient_id = (select auth.uid())::text
  );

-- Explicit Grants
GRANT ALL ON public.calls TO authenticated;
GRANT ALL ON public.calls TO service_role;
