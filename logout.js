import { supabase } from './supabaseClient.js';

(async () => {
  const { error } = await supabase.auth.signOut();
  window.location.href = 'index.html';
})();
