// public/signup.js
import { supabase } from './supabaseClient.js';

const form  = document.getElementById('signup-form');
const msgEl = document.getElementById('signup-message');

function showMessage(text, type = 'success') {
  msgEl.textContent = text;
  msgEl.className   = `notification ${type}`;
}

form.addEventListener('submit', async e => {
  e.preventDefault();
  msgEl.textContent = '';

  const email    = form.email.value.trim();
  const password = form.password.value;
  const confirm  = form['confirm-password'].value;

  if (password !== confirm) {
    return showMessage('Passwords do not match.', 'error');
  }

  // 1) Create the Auth user
  const { data: authData, error: authErr } = await supabase.auth.signUp({ email, password });
  if (authErr) {
    return showMessage(authErr.message, 'error');
  }

  const user = authData.user;

  // 2) Insert profile row so foreign‑key constraints pass
  const { error: profErr } = await supabase
    .from('profiles')
    .insert([{ id: user.id, email }]);
  if (profErr) {
    console.error('Failed to create profile:', profErr);
    // we can proceed, but preferences will still error until this succeeds
  }

  showMessage('Account created! Please check your email.', 'success');
  setTimeout(() => window.location.href = 'login.html', 1500);
});