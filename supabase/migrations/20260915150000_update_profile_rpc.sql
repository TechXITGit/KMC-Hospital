-- ============================================================================
-- SECURE PROFILE UPDATE RPC & POLICIES
-- Ensures patients, doctors, and admins can edit their profiles safely
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_my_profile(
  p_full_name TEXT,
  p_phone TEXT,
  p_gender TEXT DEFAULT NULL,
  p_dob TEXT DEFAULT NULL,
  p_blood_group TEXT DEFAULT NULL,
  p_emergency_contact TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_email TEXT;
  v_profile RECORD;
  v_role TEXT := 'patient';
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;

  -- Get current role if profile exists
  SELECT role INTO v_role FROM public.profiles WHERE id = v_uid::text;
  IF v_role IS NULL THEN
    v_role := 'patient';
  END IF;

  -- 1. Ensure profile exists with id = auth UUID
  INSERT INTO public.profiles (
    id,
    full_name,
    name,
    email,
    phone,
    gender,
    dob,
    blood_group,
    emergency_contact,
    role,
    updated_at
  )
  VALUES (
    v_uid::text,
    COALESCE(p_full_name, 'KMC User'),
    COALESCE(p_full_name, 'KMC User'),
    v_email,
    p_phone,
    p_gender,
    p_dob,
    p_blood_group,
    p_emergency_contact,
    v_role,
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET full_name = COALESCE(p_full_name, public.profiles.full_name),
      name = COALESCE(p_full_name, public.profiles.name),
      phone = COALESCE(p_phone, public.profiles.phone),
      gender = COALESCE(p_gender, public.profiles.gender),
      dob = COALESCE(p_dob, public.profiles.dob),
      blood_group = COALESCE(p_blood_group, public.profiles.blood_group),
      emergency_contact = COALESCE(p_emergency_contact, public.profiles.emergency_contact),
      updated_at = NOW();

  -- 2. If user is a linked doctor, keep doctor table in sync
  UPDATE public.doctors
  SET name = COALESCE(p_full_name, name),
      phone = COALESCE(p_phone, phone),
      updated_at = NOW()
  WHERE auth_user_id = v_uid;

  -- 3. Also update auth.users metadata for full_name and phone
  UPDATE auth.users
  SET raw_user_meta_data = jsonb_set(
    jsonb_set(COALESCE(raw_user_meta_data, '{}'::jsonb), '{full_name}', to_jsonb(p_full_name)),
    '{phone}', to_jsonb(p_phone)
  )
  WHERE id = v_uid;

  -- Return updated profile row
  SELECT * INTO v_profile FROM public.profiles WHERE id = v_uid::text;
  RETURN row_to_json(v_profile);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_my_profile(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
