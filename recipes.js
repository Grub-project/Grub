import { supabase } from './supabaseClient.js';

const BASE_URL = 'https://grub-44om.onrender.com';
const PLAN_API = `${BASE_URL}/api/meal-plans`;
const ING_API  = `${BASE_URL}/api/generate`;

const btnGenerate = document.getElementById('generate-plan');
const resultsEl   = document.getElementById('results-section');
const btnAdd      = document.getElementById('add-grocery');
const msgEl       = document.getElementById('add-message');

let currentPlans = [];

btnGenerate.addEventListener('click', generateNewPlans);
btnAdd.addEventListener('click', addToGrocery);

document.addEventListener('DOMContentLoaded', async () => {
  btnAdd.disabled = true;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return window.location.href = 'login.html';
  const userId = session.user.id;

  const res = await fetch(`${PLAN_API}/${userId}`);
  if (res.ok) {
    const { plans } = await res.json();
    if (plans?.length) {
      renderPlans(plans);
      btnAdd.disabled = false;
    }
  }
});

function showMessage(text, type = 'success') {
  msgEl.textContent = text;
  msgEl.className = `notification ${type} show`;
  setTimeout(() => msgEl.classList.remove('show'), 3000);
}

function renderPlans(plans) {
  currentPlans = plans;
  resultsEl.innerHTML = '';

  const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

  plans.forEach((plan, idx) => {
    const card = document.createElement('div');
    card.className = 'plan-card';

    card.innerHTML = `
      <input type="radio" name="plan-select" id="plan-${idx}" value="${idx}">
      <label for="plan-${idx}"><h2>${plan.label}</h2></label>
      ${days.map(day => {
        const meals = Array.isArray(plan[day]) ? plan[day] : [];
        return `
          <div class="day-block">
            <h3>${day}</h3>
            <p>${meals.length ? meals.map(m => m.name).join(' — ') : '<em>—</em>'}</p>
          </div>
        `;
      }).join('')}
    `;

    resultsEl.append(card);
  });

  document.getElementsByName('plan-select').forEach(radio => {
    radio.addEventListener('change', () => btnAdd.disabled = false);
  });
}

async function generateNewPlans() {
  btnGenerate.disabled = true;
  btnGenerate.textContent = 'Generating…';
  resultsEl.innerHTML = '';
  btnAdd.disabled = true;
  msgEl.textContent = '';

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not signed in');
    const userId = session.user.id;

    const res = await fetch(PLAN_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    });

    if (!res.ok) throw new Error(`Server ${res.status}`);
    const { plans } = await res.json();
    renderPlans(plans);

  } catch (err) {
    console.error('Plan gen error:', err);
    resultsEl.innerHTML = `<p class="error">Failed: ${err.message}</p>`;
  } finally {
    btnGenerate.disabled = false;
    btnGenerate.textContent = 'Generate Weekly Meal Plans';
  }
}

async function addToGrocery() {
  btnAdd.disabled = true;
  msgEl.textContent = '';

  try {
    const sel = document.querySelector('input[name="plan-select"]:checked');
    if (!sel) throw new Error('Select a plan first');
    const plan = currentPlans[Number(sel.value)];

    const prompt = `
Given this 7-day plan:
${JSON.stringify(plan)}

Return ONLY valid JSON:
{ "ingredients":[
  { "name":"chicken breast","calories":165,"protein":31,"carbs":0,"fats":3.6 },
  ...
] }
No explanations. Only JSON.
    `.trim();

    const aiRes = await fetch(ING_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4', prompt })
    });

    if (!aiRes.ok) throw new Error(`AI ${aiRes.status}`);
    const { content: raw } = await aiRes.json();
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Malformed JSON from AI');

    const { ingredients } = JSON.parse(match[0]);

    const { data: { session } } = await supabase.auth.getSession();
    const userId = session.user.id;

    for (const ing of ingredients) {
      await supabase
        .from('grocery_items')
        .insert({
          user_id: userId,
          item: ing.name,
          nutrition: {
            calories: Math.round(ing.calories),
            protein: Math.round(ing.protein),
            carbs: Math.round(ing.carbs),
            fats: Math.round(ing.fats)
          }
        });
    }

    await fetch(`${PLAN_API}/${userId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plans: [plan] })
    });

    showMessage('Added to grocery list & saved plan!');

  } catch (err) {
    console.error('Add to grocery error:', err);
    showMessage(`Failed: ${err.message}`, 'error');
  } finally {
    btnAdd.disabled = false;
  }
}

