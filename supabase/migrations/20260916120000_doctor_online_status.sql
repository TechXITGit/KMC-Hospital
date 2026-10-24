-- Migration: Add is_online status column to public.doctors table
-- Author: Antigravity AI
-- Date: 2026-09-16

DO $$
BEGIN
    -- 1. Add is_online column if it does not exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'doctors' 
          AND column_name = 'is_online'
    ) THEN
        ALTER TABLE public.doctors ADD COLUMN is_online BOOLEAN DEFAULT false;
    END IF;
END $$;

-- 2. Create index for high-performance online doctor queries
CREATE INDEX IF NOT EXISTS idx_doctors_is_online ON public.doctors(is_online);

-- 3. Notify pgrst to reload schema cache
NOTIFY pgrst, 'reload schema';
