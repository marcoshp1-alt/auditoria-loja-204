import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uijltxipibmuucrjejzw.supabase.co';
const supabaseKey = 'sb_publishable_inbwxI-hC2PBz3ZCFTfeZw_gSshCX5C';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true, 
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});