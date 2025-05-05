// preferences.js
import { supabase } from './supabaseClient.js';

const API_BASE   = 'https://grub-44om.onrender.com';
const PREFS_API  = `${API_BASE}/api/preferences`;
const AI_API_URL = `${API_BASE}/api/generate`;

document.addEventListener('DOMContentLoaded', async () => {
  const { data: { session }, error: sessErr } = await supabase.auth.getSession();
  if (sessErr) {
    console.error('Session error:', sessErr);
  }
  const userId = session?.user?.id;
  if (!userId) {
    console.warn('No user session found – using dev stub');

  }

  const form       = document.getElementById('preferences-form');
  const suggestBtn = document.getElementById('suggest-targets');
  const msgEl      = document.getElementById('save-message');

  function showMessage(text, type = 'success') {
    msgEl.textContent = text;
    msgEl.classList.remove('success', 'error', 'show');
    msgEl.classList.add(type, 'show');
    setTimeout(() => msgEl.classList.remove('show'), 3000);
  }

  if (userId) {
    try {
      const res   = await fetch(`${PREFS_API}/${userId}`);
      const prefs = await res.json() || {};
      document.getElementById('diet').value        = prefs.diet || 'none';
      document.getElementById('allergies').value   = (prefs.allergies||[]).join(', ');
      document.getElementById('goals-text').value  = prefs.goals_text || '';
      document.getElementById('calorie-goal').value  = prefs.calorie_goal || '';
      document.getElementById('protein-goal').value  = prefs.protein_goal || '';
    } catch (err) {
      console.error('Load prefs error:', err);
    }
  }

  suggestBtn.addEventListener('click', async () => {
    suggestBtn.disabled    = true;
    suggestBtn.textContent = 'Suggesting…';

    const diet  = document.getElementById('diet').value;
    const goals = document.getElementById('goals-text').value.trim() || 'general health';

    try {
      const aiRes = await fetch(AI_API_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          model: 'gpt-4',
          prompt: `
            Suggest daily calorie & protein targets for a ${diet} diet with goals "${goals}".
            Reply JSON: { "calorieGoal": number, "proteinGoal": number }.
          `
        })
      });
      const { content } = await aiRes.json();
      const { calorieGoal, proteinGoal } = JSON.parse(content);

      document.getElementById('calorie-goal').value  = calorieGoal;
      document.getElementById('protein-goal').value = proteinGoal;
      showMessage('Targets suggested!', 'success');
    } catch (err) {
      console.error('AI suggestion error:', err);
      showMessage('AI suggestion failed.', 'error');
    } finally {
      suggestBtn.disabled    = false;
      suggestBtn.textContent = 'Suggest Targets';
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const calorie = parseInt(document.getElementById('calorie-goal').value, 10);
    const protein = parseInt(document.getElementById('protein-goal').value, 10);
    if (isNaN(calorie) || isNaN(protein)) {
      return showMessage('Please enter both targets.', 'error');
    }

    showMessage('Preferences saved!', 'success');

    if (userId) {
      try {
        await fetch(PREFS_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            diet:        document.getElementById('diet').value,
            allergies:   document.getElementById('allergies').value.trim().split(',').map(a=>a.trim()),
            goalsText:   document.getElementById('goals-text').value.trim(),
            calorieGoal: calorie,
            proteinGoal: protein
          })
        });
      } catch (err) {
        console.error('Save prefs error:', err);
      }
    }
  });
});
