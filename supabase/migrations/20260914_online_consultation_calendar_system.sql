-- ============================================================================
-- KMC Hospital App - Online Video Consultation, Calendar & Email System Migration
-- Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/fhxsiueizpzreoxfrbuy/sql
-- ============================================================================

-- 1. ADD EMAIL COLUMN TO DOCTORS TABLE
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS email TEXT;

-- Seed default doctor emails
UPDATE public.doctors SET email = 'dr.neeta.khare@kmchospital.in' WHERE id = 'doc1' AND (email IS NULL OR email = '');
UPDATE public.doctors SET email = 'dr.puneet.tulsyan@kmchospital.in' WHERE id = 'doc2' AND (email IS NULL OR email = '');
UPDATE public.doctors SET email = 'prof.ratnesh.kumar@kmchospital.in' WHERE id = 'doc3' AND (email IS NULL OR email = '');
UPDATE public.doctors SET email = 'dr.ajay.verma@kmchospital.in' WHERE id = 'doc4' AND (email IS NULL OR email = '');
UPDATE public.doctors SET email = 'dr.athar.parvez@kmchospital.in' WHERE id = 'doc5' AND (email IS NULL OR email = '');
UPDATE public.doctors SET email = 'dr.megha.tulsyan@kmchospital.in' WHERE id = 'doc6' AND (email IS NULL OR email = '');

-- 2. EVOLVE APPOINTMENTS TABLE FOR ONLINE VIDEO CONSULTATION & CALENDAR SYNC
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS calendar_event_id TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS google_meet_link TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS calendar_sync_status TEXT DEFAULT 'pending';
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS calendar_synced_at TIMESTAMPTZ;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS calendar_error TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS video_consultation BOOLEAN DEFAULT false;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS doctor_email TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS confirmation_email_sent BOOLEAN DEFAULT false;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS confirmation_email_sent_at TIMESTAMPTZ;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS email_error TEXT;

-- Backfill video_consultation and calendar_sync_status for existing appointments
UPDATE public.appointments
SET video_consultation = true
WHERE type ILIKE '%Video%' AND (video_consultation IS NULL OR video_consultation = false);

UPDATE public.appointments
SET calendar_sync_status = 'not_applicable'
WHERE (type IS NULL OR type NOT ILIKE '%Video%') AND (calendar_sync_status IS NULL OR calendar_sync_status = 'pending');

-- 3. INDEXES FOR CALENDAR SYNC & CONSULTATION QUERIES
CREATE INDEX IF NOT EXISTS idx_appointments_calendar_sync
ON public.appointments (calendar_sync_status, video_consultation)
WHERE (video_consultation = true);

CREATE INDEX IF NOT EXISTS idx_appointments_calendar_event
ON public.appointments (calendar_event_id)
WHERE (calendar_event_id IS NOT NULL);

-- 4. UPDATE CONFIRM APPOINTMENT ATOMIC STORED PROCEDURE
CREATE OR REPLACE FUNCTION public.confirm_appointment_atomic(
  p_appointment JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_doctor_id TEXT := p_appointment->>'doctor_id';
  v_date TEXT := p_appointment->>'appointment_date';
  v_start_time TEXT := COALESCE(p_appointment->>'start_time', p_appointment->>'appointment_time');
  v_slot_key TEXT := v_doctor_id || '_' || v_date || '_' || v_start_time;
  v_type TEXT := COALESCE(p_appointment->>'type', 'Hospital Visit');
  v_is_video BOOLEAN := (v_type ILIKE '%Video%' OR COALESCE((p_appointment->>'video_consultation')::BOOLEAN, false));
  v_current_fee NUMERIC;
  v_doctor_email TEXT := p_appointment->>'doctor_email';
  v_is_booked BOOLEAN;
  v_calendar_status TEXT;
  v_meet_link TEXT := p_appointment->>'meeting_link';
BEGIN
  -- 1. Double Booking Check
  SELECT EXISTS (
    SELECT 1 FROM public.appointments
    WHERE doctor_id = v_doctor_id 
      AND appointment_date = v_date 
      AND (start_time = v_start_time OR appointment_time = v_start_time)
      AND LOWER(status) IN ('pending', 'confirmed')
  ) INTO v_is_booked;

  IF v_is_booked THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'already_booked',
      'message', 'Yeh slot usi waqt doosre patient ne book kar liya. First-Come, First-Served rule ke tahat booking cancel hui.'
    );
  END IF;

  -- 2. Fetch current doctor consultation fee & email from doctor registry
  SELECT consultation_fee, email INTO v_current_fee, v_doctor_email
  FROM public.doctors
  WHERE id = v_doctor_id;

  IF v_current_fee IS NULL THEN
    v_current_fee := COALESCE((p_appointment->>'consultation_fee')::NUMERIC, 800);
  END IF;

  -- If doctor email was already passed, keep it, otherwise use registry email
  IF p_appointment->>'doctor_email' IS NOT NULL AND p_appointment->>'doctor_email' <> '' THEN
    v_doctor_email := p_appointment->>'doctor_email';
  END IF;

  -- Set initial calendar sync status
  IF v_is_video THEN
    v_calendar_status := 'pending';
  ELSE
    v_calendar_status := 'not_applicable';
    v_meet_link := NULL; -- Strict: Never store meet link for hospital visit
  END IF;

  -- 3. Insert confirmed appointment with full snapshot
  INSERT INTO public.appointments (
    id, token_number, patient_id, patient_name, patient_email, patient_phone,
    doctor_id, doctor_name, doctor_email, department,
    appointment_date, start_time, end_time, appointment_time, slot_key,
    consultation_fee, total_amount,
    payment_status, payment_method, payment_id,
    status, reason, notes, type,
    meeting_link, google_meet_link, calendar_link,
    video_consultation, calendar_sync_status,
    hospital_address, contact_number,
    created_at, updated_at
  ) VALUES (
    p_appointment->>'id',
    p_appointment->>'token_number',
    p_appointment->>'patient_id',
    p_appointment->>'patient_name',
    p_appointment->>'patient_email',
    p_appointment->>'patient_phone',
    v_doctor_id,
    p_appointment->>'doctor_name',
    v_doctor_email,
    p_appointment->>'department',
    v_date,
    v_start_time,
    COALESCE(p_appointment->>'end_time', v_start_time),
    v_start_time,
    v_slot_key,
    v_current_fee,                                          -- Permanent consultation_fee snapshot!
    COALESCE((p_appointment->>'total_amount')::NUMERIC, v_current_fee),
    COALESCE(p_appointment->>'payment_status', 'pending'),
    COALESCE(p_appointment->>'payment_method', 'cash'),
    p_appointment->>'payment_id',
    COALESCE(p_appointment->>'status', 'confirmed'),
    p_appointment->>'reason',
    p_appointment->>'notes',
    v_type,
    v_meet_link,
    v_meet_link,
    p_appointment->>'calendar_link',
    v_is_video,
    v_calendar_status,
    COALESCE(p_appointment->>'hospital_address', 'KMC Hospital, Jankipuram, Lucknow'),
    COALESCE(p_appointment->>'contact_number', '+918303666400'),
    NOW(),
    NOW()
  );

  -- 4. Clean up temporary slot hold
  DELETE FROM public.slot_holds WHERE slot_key = v_slot_key;

  RETURN jsonb_build_object(
    'success', true,
    'consultation_fee', v_current_fee,
    'video_consultation', v_is_video,
    'doctor_email', v_doctor_email,
    'message', 'Appointment confirmed successfully!'
  );
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object(
    'success', false,
    'reason', 'already_booked',
    'message', 'Conflict detected: Yeh slot usi waqt book ho gaya. First-Come First-Served rule ke according booking cancel hui.'
  );
END;
$$;
