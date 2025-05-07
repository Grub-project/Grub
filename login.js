import { supabase } from './supabaseClient.js';

const form  = document.getElementById('login-form');
const msgEl = document.getElementById('login-message');

function showMessage(text, type = 'error') {
  msgEl.textContent = text;
  msgEl.className   = `notification ${type}`;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  msgEl.textContent = '';

  const email    = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    showMessage(error.message, 'error');
  } else {
    showMessage('Login successful! Redirecting…', 'success');
    setTimeout(() => window.location.href = 'dashboard.html', 1000);
  }
});
