import { supabase } from './supabaseClient.js';

const API_BASE = 'https://grub-44om.onrender.com';

document.addEventListener('DOMContentLoaded', async () => {
  const { data: { session }, error: sessErr } = await supabase.auth.getSession();
  if (sessErr || !session) return window.location.href = 'login.html';
  const userId = session.user.id;

  try {
    const { data: profile, error: profFetchErr } = await supabase
      .from('profiles').select('id').eq('id', userId).single();
    if (!profile && (!profFetchErr || profFetchErr.code === 'PGRST116')) {
      const { error: profInsertErr } = await supabase
        .from('profiles').insert([{ id: userId }]);
      if (profInsertErr) console.error('Profile insert error:', profInsertErr);
    }
  } catch (err) {
    console.error('Ensure profile error:', err);
  }

  const form = document.getElementById('preferences-form');
  const msg  = document.getElementById('save-message');

  function showMessage(text, type = 'success') {
    msg.textContent = text;
    msg.className = `notification ${type} show`;
    setTimeout(() => msg.classList.remove('show'), 3000);
  }

  try {
    const { data: prefs, error: loadErr } = await supabase
      .from('preferences').select('*').eq('user_id', userId).single();

    if (prefs) {
      form.diet.value = prefs.diet || 'none';
      form.allergies.value = (prefs.allergies || []).join(', ');
      form['goals-text'].value = prefs.goals_text || '';
      form['calorie-goal'].value = prefs.calorie_goal || '';
      form['protein-goal'].value = prefs.protein_goal || '';
    }
  } catch (err) {
    console.error('Load prefs error:', err);
  }

  document.getElementById('suggest-targets').addEventListener('click', async () => {
    const btn = document.getElementById('suggest-targets');
    btn.disabled = true;
    btn.textContent = 'Suggesting…';

    const diet = form.diet.value;
    const goals = form['goals-text'].value.trim() || 'general health';
    const allergies = form.allergies.value;

    try {
      const aiRes = await fetch(`${API_BASE}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4',
          prompt: `
You are a registered dietitian.

Based on:
{
  "diet": "${diet}",
  "allergies": "${allergies}",
  "goals": "${goals}"
}

Suggest daily calorie and protein targets.

Reply ONLY in valid JSON like:
{ "calorieGoal": 1800, "proteinGoal": 120 }
          `.trim()
        })
      });

      const { content } = await aiRes.json();
      const match = content.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('Invalid JSON from AI');

      const { calorieGoal, proteinGoal } = JSON.parse(match[0]);

      form['calorie-goal'].value = calorieGoal;
      form['protein-goal'].value = proteinGoal;

      showMessage('Targets suggested!', 'success');
    } catch (err) {
      console.error('AI suggest error:', err);
      showMessage('AI suggestion failed. Please try again.', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Suggest Targets';
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const diet = form.diet.value;
    const allergies = form.allergies.value
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    const goalsText = form['goals-text'].value.trim();
    const calorie = Number(form['calorie-goal'].value);
    const protein = Number(form['protein-goal'].value);

    if (!calorie || !protein) {
      return showMessage('Please enter both calorie and protein targets.', 'error');
    }

    try {
      const { error } = await supabase
        .from('preferences')
        .upsert({
          user_id: userId,
          diet,
          allergies,
          goals_text: goalsText,
          calorie_goal: calorie,
          protein_goal: protein,
          updated_at: new Date()
        }, { onConflict: 'user_id' });

      if (error) {
        console.error('Upsert error:', error);
        return showMessage(`Save failed: ${error.message}`, 'error');
      }

      showMessage('Preferences saved!', 'success');

    } catch (err) {
      console.error('Save prefs error:', err);
      showMessage('Unexpected error while saving preferences.', 'error');
    }
  });
});
