-- ============================================================================
-- FIX ADMIN ROLE RESOLUTION & ROOT ADMIN BOOTSTRAP
-- Target: techxitservices65@gmail.com
-- ============================================================================

-- 1. Ensure any existing profile matching techxitservices65@gmail.com has role = 'admin'
UPDATE public.profiles
SET role = 'admin',
    updated_at = NOW()
WHERE LOWER(email) = 'techxitservices65@gmail.com';

-- 2. Link auth.users record for techxitservices65@gmail.com into public.profiles with id = auth.users.id
INSERT INTO public.profiles (id, full_name, email, role, updated_at)
SELECT 
  id::text,
  COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', 'Hospital Admin'),
  email,
  'admin',
  NOW()
FROM auth.users
WHERE LOWER(email) = 'techxitservices65@gmail.com'
ON CONFLICT (id) DO UPDATE
SET role = 'admin',
    updated_at = NOW();

-- 3. Set auth.users raw_user_meta_data role = 'admin'
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{role}',
  '"admin"'
)
WHERE LOWER(email) = 'techxitservices65@gmail.com';

-- 4. Update public.is_admin() to check UUID, email, and root admin guarantee
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = (select auth.uid()) 
      AND LOWER(email) = 'techxitservices65@gmail.com'
  ) OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE (id = (select auth.uid())::text OR LOWER(email) = (SELECT LOWER(email) FROM auth.users WHERE id = (select auth.uid())))
      AND role = 'admin'
  );
$$;

-- 5. Update get_my_role() to match by both UUID and email with root admin guarantee
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
  v_email TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('role', 'anon', 'authenticated', false);
  END IF;

  -- 1. Get email of authenticated user
  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;

  -- 2. Root hospital admin guarantee
  IF LOWER(v_email) = 'techxitservices65@gmail.com' THEN
    v_role := 'admin';
  END IF;

  -- 3. Find profile by UUID or email
  SELECT * INTO v_profile FROM public.profiles 
  WHERE id = v_uid::text OR (v_email IS NOT NULL AND LOWER(email) = LOWER(v_email))
  ORDER BY (CASE WHEN role = 'admin' THEN 1 WHEN role = 'doctor' THEN 2 ELSE 3 END) ASC
  LIMIT 1;

  IF FOUND AND v_profile.role IS NOT NULL THEN
    v_role := v_profile.role;
  END IF;

  -- Enforce root admin
  IF LOWER(v_email) = 'techxitservices65@gmail.com' THEN
    v_role := 'admin';
  END IF;

  -- 4. If doctor, get linked doctor record
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

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated, anon;
