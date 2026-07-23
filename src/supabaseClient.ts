import { createClient } from "@supabase/supabase-js";

const supabaseUrl = ((import.meta as any).env.VITE_SUPABASE_URL as string) || "https://nzuroeumdysdyswkzqlt.supabase.co";
const supabaseAnonKey = ((import.meta as any).env.VITE_SUPABASE_ANON_KEY as string) || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56dXJvZXVtZHlzZHlzd2t6cWx0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2MzYxOTcsImV4cCI6MjEwMDIxMjE5N30.6Kos2Q8o_0qeNoHsA-HPurmc9CGEMGS2FWvQ7-wYtUQ";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
