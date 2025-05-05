  import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

  const SUPABASE_URL      = 'https://aakxzxyktrwaniyjrmop.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFha3h6eHlrdHJ3YW5peWpybW9wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYzMTYxNTYsImV4cCI6MjA2MTg5MjE1Nn0.M-FkKH2ESm9xrzg22ekRTMvu8M43Drptp18PFD8szbo';

  export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
