import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://cqutqdlwuhspmzdxthxs.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_lA9FqhGs4ITXPjSAKBnnTw_GE3ls4Y7";

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  }
);