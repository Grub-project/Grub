// logout.js
import { supabase } from './supabaseClient.js';

(async () => {
  // Sign the user out
  const { error } = await supabase.auth.signOut();
  // Then redirect to home (or login)
  window.location.href = 'index.html';
})();
