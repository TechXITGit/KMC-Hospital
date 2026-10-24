import 'react-native-url-polyfill/auto.js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

import { Platform } from 'react-native';

export const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  'https://fhxsiueizpzreoxfrbuy.supabase.co';
export const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_KEY ||
  'sb_publishable_lQ1ojl6Ma5j71ipa72wVvw_eU0sbFa5';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});

// Dedicated client for Super Admin database access (isolated from user auth session)
export const superAdminDbClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});







