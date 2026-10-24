-- ============================================================================
-- KMC Hospital App - Password Reset Security & Role Guard
-- Migration: 20260915140000_password_reset_security.sql
-- Review before executing in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/fhxsiueizpzreoxfrbuy/sql
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_password_reset_eligibility(p_email TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text := 'patient';
  v_is_doctor boolean := false;
  v_is_admin boolean := false;
  v_normalized_email text;
BEGIN
  IF p_email IS NULL OR trim(p_email) = '' THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'invalid_email',
      'message', 'Please enter a valid email address.'
    );
  END IF;

  v_normalized_email := lower(trim(p_email));

  -- 1. Check root hospital administrator email
  IF v_normalized_email = 'techxitservices65@gmail.com' THEN
    v_is_admin := true;
  END IF;

  -- 2. Check profiles table for role
  SELECT role INTO v_role 
  FROM public.profiles 
  WHERE lower(trim(email)) = v_normalized_email 
  LIMIT 1;

  IF v_role = 'admin' THEN
    v_is_admin := true;
  ELSIF v_role = 'doctor' THEN
    v_is_doctor := true;
  END IF;

  -- 3. Check doctors table
  IF NOT v_is_doctor THEN
    IF EXISTS (
      SELECT 1 FROM public.doctors 
      WHERE lower(trim(email)) = v_normalized_email
    ) THEN
      v_is_doctor := true;
    END IF;
  END IF;

  -- 4. Enforce authorization rules
  IF v_is_admin THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'admin',
      'message', 'Password reset is not available for administrator accounts. Please contact the system administrator.'
    );
  ELSIF v_is_doctor THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'doctor',
      'message', 'Password reset is not available for doctor accounts. Please contact the hospital administrator.'
    );
  ELSE
    RETURN jsonb_build_object(
      'allowed', true,
      'reason', 'patient',
      'message', 'Eligible for password reset.'
    );
  END IF;
END;
$$;

-- Grant execution to authenticated and anon clients
GRANT EXECUTE ON FUNCTION public.check_password_reset_eligibility(TEXT) TO anon, authenticated, service_role;
