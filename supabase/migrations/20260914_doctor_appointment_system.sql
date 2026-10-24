-- ============================================================================
-- KMC Hospital App - Complete Doctor Appointment System & Sheets Sync Schema
-- Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/fhxsiueizpzreoxfrbuy/sql
-- ============================================================================

-- 1. PROFILES TABLE (Patients, Doctors, Admins)
CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY,
  name TEXT,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  role TEXT DEFAULT 'patient' CHECK (role IN ('patient', 'doctor', 'admin')),
  avatar_url TEXT,
  gender TEXT,
  dob TEXT,
  blood_group TEXT,
  emergency_contact TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure all profile columns exist if table was created previously
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'patient';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dob TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS blood_group TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS emergency_contact TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. DOCTORS TABLE
CREATE TABLE IF NOT EXISTS public.doctors (
  id TEXT PRIMARY KEY, -- e.g. doc1, doc2, or UUID
  profile_id TEXT,
  name TEXT NOT NULL,
  specialization TEXT NOT NULL,
  qualification TEXT NOT NULL,
  experience TEXT NOT NULL,
  consultation_fee NUMERIC NOT NULL DEFAULT 800,
  bio TEXT,
  clinic_name TEXT DEFAULT 'KMC Hospital, Jankipuram, Lucknow',
  department TEXT NOT NULL,
  rating NUMERIC DEFAULT 4.9,
  reviews_count INT DEFAULT 240,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS profile_id TEXT;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS consultation_fee NUMERIC DEFAULT 800;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS clinic_name TEXT DEFAULT 'KMC Hospital, Jankipuram, Lucknow';
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS rating NUMERIC DEFAULT 4.9;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS reviews_count INT DEFAULT 240;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 3. DOCTOR AVAILABILITY TABLE
CREATE TABLE IF NOT EXISTS public.doctor_availability (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id TEXT NOT NULL,
  day_of_week TEXT NOT NULL, -- e.g. 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'
  start_time TEXT NOT NULL, -- e.g. '09:00 AM'
  end_time TEXT NOT NULL, -- e.g. '02:00 PM'
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. APPOINTMENTS TABLE
CREATE TABLE IF NOT EXISTS public.appointments (
  id TEXT PRIMARY KEY,
  token_number TEXT NOT NULL,
  patient_id TEXT,
  patient_name TEXT NOT NULL,
  patient_email TEXT,
  patient_phone TEXT,
  doctor_id TEXT NOT NULL,
  doctor_name TEXT NOT NULL,
  department TEXT,
  appointment_date TEXT NOT NULL,
  start_time TEXT,
  end_time TEXT,
  appointment_time TEXT,
  slot_key TEXT,
  consultation_fee NUMERIC DEFAULT 800,
  total_amount NUMERIC DEFAULT 800,
  payment_status TEXT DEFAULT 'pending',
  payment_method TEXT DEFAULT 'cash',
  payment_id TEXT,
  status TEXT DEFAULT 'confirmed',
  reason TEXT,
  notes TEXT,
  type TEXT DEFAULT 'Hospital Visit',
  meeting_link TEXT,
  calendar_link TEXT,
  hospital_address TEXT DEFAULT 'B-1/6 Sector G, Near Bhawna Complex, Sahara State Road, Jankipuram, Lucknow',
  contact_number TEXT DEFAULT '+918303666400',
  google_sheets_synced BOOLEAN DEFAULT false,
  google_sheets_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Evolve existing appointments table with any missing columns safely
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS start_time TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS end_time TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS appointment_time TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS slot_key TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS consultation_fee NUMERIC DEFAULT 800;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS total_amount NUMERIC DEFAULT 800;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending';
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'cash';
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS payment_id TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'Hospital Visit';
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS meeting_link TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS calendar_link TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS hospital_address TEXT DEFAULT 'B-1/6 Sector G, Near Bhawna Complex, Sahara State Road, Jankipuram, Lucknow';
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS contact_number TEXT DEFAULT '+918303666400';
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS google_sheets_synced BOOLEAN DEFAULT false;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS google_sheets_synced_at TIMESTAMPTZ;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Backfill start_time and appointment_time if either was missing in earlier table versions
UPDATE public.appointments
SET start_time = appointment_time
WHERE start_time IS NULL AND appointment_time IS NOT NULL;

UPDATE public.appointments
SET appointment_time = start_time
WHERE appointment_time IS NULL AND start_time IS NOT NULL;

UPDATE public.appointments
SET start_time = '10:00 AM', appointment_time = '10:00 AM'
WHERE start_time IS NULL;

UPDATE public.appointments
SET end_time = '10:30 AM'
WHERE end_time IS NULL;

UPDATE public.appointments
SET consultation_fee = 800
WHERE consultation_fee IS NULL;

UPDATE public.appointments
SET total_amount = 800
WHERE total_amount IS NULL;

-- Remove legacy strict uppercase check constraint if present and replace with case-insensitive check
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
ALTER TABLE public.appointments ADD CONSTRAINT appointments_status_check 
  CHECK (LOWER(status) IN ('pending', 'confirmed', 'completed', 'cancelled', 'rejected'));

-- 5. DOUBLE-BOOKING PROTECTION AT DATABASE LEVEL
-- Drop previous index versions to avoid conflicts
DROP INDEX IF EXISTS public.unique_active_doctor_slot;
DROP INDEX IF EXISTS public.unique_active_doctor_appointment_slot;

-- Strict PostgreSQL partial unique index:
-- Ensures no two active appointments can exist for the same doctor at the same date & start_time
CREATE UNIQUE INDEX unique_active_doctor_appointment_slot
ON public.appointments (doctor_id, appointment_date, start_time)
WHERE (LOWER(status) IN ('pending', 'confirmed'));

-- Lookup index for query optimization
CREATE INDEX IF NOT EXISTS idx_appointments_lookup
ON public.appointments (doctor_id, appointment_date, start_time, status);

CREATE INDEX IF NOT EXISTS idx_appointments_patient
ON public.appointments (patient_id, created_at DESC);

-- 6. SLOT HOLDS TABLE (Temporary 5-Minute Concurrency Reservation)
CREATE TABLE IF NOT EXISTS public.slot_holds (
  slot_key TEXT PRIMARY KEY,
  doctor_id TEXT NOT NULL,
  appointment_date TEXT NOT NULL,
  start_time TEXT,
  appointment_time TEXT,
  held_by TEXT NOT NULL,
  held_by_name TEXT,
  held_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE public.slot_holds ADD COLUMN IF NOT EXISTS start_time TEXT;
ALTER TABLE public.slot_holds ADD COLUMN IF NOT EXISTS appointment_time TEXT;

UPDATE public.slot_holds
SET start_time = appointment_time
WHERE start_time IS NULL AND appointment_time IS NOT NULL;

UPDATE public.slot_holds
SET appointment_time = start_time
WHERE appointment_time IS NULL AND start_time IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_slot_holds_expires ON public.slot_holds (expires_at);

-- 7. ENABLE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slot_holds ENABLE ROW LEVEL SECURITY;

-- 8. RLS POLICIES (Idempotent)
DROP POLICY IF EXISTS "Allow public read on profiles" ON public.profiles;
CREATE POLICY "Allow public read on profiles" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow all on profiles" ON public.profiles;
CREATE POLICY "Allow all on profiles" ON public.profiles FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read on doctors" ON public.doctors;
CREATE POLICY "Allow public read on doctors" ON public.doctors FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow all on doctors" ON public.doctors;
CREATE POLICY "Allow all on doctors" ON public.doctors FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read on doctor_availability" ON public.doctor_availability;
CREATE POLICY "Allow public read on doctor_availability" ON public.doctor_availability FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow all on doctor_availability" ON public.doctor_availability;
CREATE POLICY "Allow all on doctor_availability" ON public.doctor_availability FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read on appointments" ON public.appointments;
CREATE POLICY "Allow public read on appointments" ON public.appointments FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow all on appointments" ON public.appointments;
CREATE POLICY "Allow all on appointments" ON public.appointments FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read on slot_holds" ON public.slot_holds;
CREATE POLICY "Allow public read on slot_holds" ON public.slot_holds FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow all on slot_holds" ON public.slot_holds;
CREATE POLICY "Allow all on slot_holds" ON public.slot_holds FOR ALL USING (true) WITH CHECK (true);

-- 9. ATOMIC STORED PROCEDURES

-- Hold slot procedure with row-level locking
CREATE OR REPLACE FUNCTION public.hold_slot_atomic(
  p_slot_key TEXT,
  p_doctor_id TEXT,
  p_appointment_date TEXT,
  p_appointment_time TEXT,
  p_user_id TEXT,
  p_user_name TEXT,
  p_duration_seconds INT DEFAULT 300
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_booked BOOLEAN;
  v_existing_hold RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_expires TIMESTAMPTZ := v_now + (p_duration_seconds || ' seconds')::INTERVAL;
BEGIN
  -- 1. Check if already confirmed or pending
  SELECT EXISTS (
    SELECT 1 FROM public.appointments
    WHERE doctor_id = p_doctor_id 
      AND appointment_date = p_appointment_date 
      AND (start_time = p_appointment_time OR appointment_time = p_appointment_time)
      AND LOWER(status) IN ('pending', 'confirmed')
  ) INTO v_is_booked;

  IF v_is_booked THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'already_booked',
      'message', 'Yeh slot already book ho chuka hai (Unable to book).'
    );
  END IF;

  -- 2. Check if held by another user with active hold
  SELECT * INTO v_existing_hold 
  FROM public.slot_holds
  WHERE slot_key = p_slot_key 
  FOR UPDATE;

  IF FOUND AND v_existing_hold.expires_at > v_now AND v_existing_hold.held_by <> p_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'held_by_other',
      'message', 'Yeh slot abhi kisi doosre patient ne hold kiya hai (Locked). Kripya doosra time chunein.',
      'expires_at', v_existing_hold.expires_at
    );
  END IF;

  -- 3. Grant the lock to the first user
  INSERT INTO public.slot_holds (
    slot_key, doctor_id, appointment_date, start_time, appointment_time, held_by, held_by_name, held_at, expires_at
  )
  VALUES (
    p_slot_key, p_doctor_id, p_appointment_date, p_appointment_time, p_appointment_time, p_user_id, p_user_name, v_now, v_expires
  )
  ON CONFLICT (slot_key) DO UPDATE SET
    held_by = EXCLUDED.held_by,
    held_by_name = EXCLUDED.held_by_name,
    held_at = EXCLUDED.held_at,
    expires_at = EXCLUDED.expires_at;

  RETURN jsonb_build_object(
    'success', true,
    'slot_key', p_slot_key,
    'expires_at', v_expires,
    'message', 'Slot 5 minute ke liye hold ho gaya!'
  );
END;
$$;

-- Confirm appointment procedure with dynamic fee snapshot & double-booking protection
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
  v_current_fee NUMERIC;
  v_is_booked BOOLEAN;
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

  -- 2. Fetch current doctor consultation fee for permanent snapshotting
  SELECT consultation_fee INTO v_current_fee
  FROM public.doctors
  WHERE id = v_doctor_id;

  IF v_current_fee IS NULL THEN
    v_current_fee := COALESCE((p_appointment->>'consultation_fee')::NUMERIC, 800);
  END IF;

  -- 3. Insert confirmed appointment with permanent fee snapshot
  INSERT INTO public.appointments (
    id, token_number, patient_id, patient_name, patient_email, patient_phone,
    doctor_id, doctor_name, department,
    appointment_date, start_time, end_time, appointment_time, slot_key,
    consultation_fee, total_amount,
    payment_status, payment_method, payment_id,
    status, reason, notes, type,
    meeting_link, calendar_link, hospital_address, contact_number,
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
    p_appointment->>'department',
    v_date,
    v_start_time,
    COALESCE(p_appointment->>'end_time', v_start_time),
    v_start_time,
    v_slot_key,
    v_current_fee,                                          -- Permanent consultation_fee snapshot!
    COALESCE((p_appointment->>'total_amount')::NUMERIC, v_current_fee), -- total_amount
    COALESCE(p_appointment->>'payment_status', 'pending'),
    COALESCE(p_appointment->>'payment_method', 'cash'),
    p_appointment->>'payment_id',
    COALESCE(p_appointment->>'status', 'confirmed'),
    p_appointment->>'reason',
    p_appointment->>'notes',
    COALESCE(p_appointment->>'type', 'Hospital Visit'),
    p_appointment->>'meeting_link',
    p_appointment->>'calendar_link',
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

-- 10. PRE-SEED DOCTORS & AVAILABILITY
INSERT INTO public.doctors (id, name, specialization, qualification, experience, consultation_fee, department, rating, reviews_count, bio)
VALUES
  ('doc1', 'Dr. Neeta Khare', 'Senior Consultant, OBS & GYNAE', 'MBBS, MS (Obstetrics & Gynaecology)', '20+ Yrs', 800, 'Obstetrics & Gynaecology', 4.9, 340, 'Dr. Neeta Khare is a senior gynecologist renowned for maternal and fetal medicine, high-risk pregnancy care, painless deliveries, and advanced laparoscopic gynecological surgeries at KMC Hospital, Lucknow.'),
  ('doc2', 'Dr. Puneet Kumar Tulsyan', 'Neonatologist & Pediatrician', 'MBBS, MD (Pediatrics), Fellowship in Neonatology', '15+ Yrs', 1000, 'Neonatology (NICU)', 4.9, 420, 'Dr. Puneet Kumar Tulsyan is an expert neonatologist with extensive experience in level-III NICU care, neonatal ventilation, extremely low birth-weight infant care, and pediatric growth counseling.'),
  ('doc3', 'Prof. (Dr.) Ratnesh Kumar', 'Senior Orthopaedic Surgeon', 'MS (Ortho), DNB (Ortho), MCh', '25+ Yrs', 800, 'Orthopaedics', 4.8, 194, 'Prof. (Dr.) Ratnesh Kumar brings exceptional expertise in joint disorders, pediatric bone deformities, fracture management, and physical rehabilitation.'),
  ('doc4', 'Dr. Ajay Kumar Verma', 'Pediatric Surgery Specialist', 'MS, MCh (Pediatric Surgery)', '12+ Yrs', 900, 'Pediatric Surgery', 4.8, 160, 'Dr. Ajay Kumar Verma specializes in neonatal surgical interventions, pediatric minimally invasive laparoscopy, and pediatric urology.'),
  ('doc5', 'Dr. Athar Parvez', 'General & Laparoscopic Surgeon', 'MBBS, DNB (Surgery)', '10+ Yrs', 700, 'General Surgery', 4.7, 142, 'Dr. Athar Parvez provides advanced laparoscopic surgical care, including gall bladder, appendix, hernia, and acute surgical emergencies.'),
  ('doc6', 'Dr. Megha Tulsyan', 'OBS & GYNAE - Gold Medalist', 'MBBS, MS (Obstetrics & Gynaecology)', '14+ Yrs', 800, 'Obstetrics & Gynaecology', 4.9, 380, 'Dr. Megha Tulsyan is an academic gold medalist and gynecologist renowned for compassionate maternal care, adolescent gynecology, and high-risk pregnancy deliveries.')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  specialization = EXCLUDED.specialization,
  qualification = EXCLUDED.qualification,
  experience = EXCLUDED.experience,
  consultation_fee = EXCLUDED.consultation_fee,
  department = EXCLUDED.department,
  bio = EXCLUDED.bio;

-- Seed default availability slots
INSERT INTO public.doctor_availability (doctor_id, day_of_week, start_time, end_time, is_available)
SELECT d.id, day, '09:00 AM', '02:00 PM', true
FROM public.doctors d
CROSS JOIN (VALUES ('Mon'), ('Tue'), ('Wed'), ('Thu'), ('Fri'), ('Sat')) AS days(day)
ON CONFLICT DO NOTHING;

-- 11. ENABLE REALTIME SUBSCRIPTIONS (Safe block without dropping publication)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'appointments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'slot_holds'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.slot_holds;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;
