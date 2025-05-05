
const API_BASE = 'https://grub-44om.onrender.com';

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

  try {
    const res = await fetch(`${API_BASE}/auth/signup`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password })
    });
    const payload = await res.json();
    if (!res.ok) {
      return showMessage(payload.error || 'Signup failed.', 'error');
    }

    showMessage('Account created! Redirecting…', 'success');
    setTimeout(() => window.location.href = 'dashboard.html', 1000);

  } catch (err) {
    console.error('Signup fetch error:', err);
    showMessage('Network error. Please try again.', 'error');
  }
});
