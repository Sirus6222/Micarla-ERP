
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://gufjwvqfvprmaekzvkrv.supabase.co';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_YYBOoRb9MB_JQrxPPUlKiA_oheRMw_R';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
