// grocery.js
import { supabase } from './supabaseClient.js';

const API_BASE    = 'https://grub-44om.onrender.com';
const PREFS_API   = `${API_BASE}/api/preferences`;
const GROCERY_API = `${API_BASE}/api/grocery-list`;
const AI_API_URL  = `${API_BASE}/api/generate`;

document.addEventListener('DOMContentLoaded', async () => {
  // 1) Authenticate the user
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session) {
    window.location.href = 'login.html';
    return;
  }
  const userId = session.user.id;

  // 2) Element refs & state
  const groceryListEl  = document.getElementById('grocery-list');
  const addItemForm    = document.getElementById('add-item-form');
  const newItemInput   = document.getElementById('new-item');
  const generateBtn    = document.getElementById('generate-plan');
  const importBtn      = document.getElementById('import-plan');
  const sortBtn        = document.getElementById('sort-list');
  const clearBtn       = document.getElementById('clear-completed');

  let items = [];

  // Render helper
  function renderList() {
    groceryListEl.innerHTML = '';
    items.forEach((text, idx) => {
      const li = document.createElement('li');

      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.addEventListener('change', () => {
        li.classList.toggle('completed', chk.checked);
      });

      const span = document.createElement('span');
      span.textContent = text;

      const btn = document.createElement('button');
      btn.textContent = 'Remove';
      btn.addEventListener('click', () => {
        items.splice(idx, 1);
        renderList();
      });

      li.append(chk, span, btn);
      groceryListEl.append(li);
    });
  }

  // 3) Fetch existing grocery items from backend
  try {
    const res  = await fetch(`${GROCERY_API}/${userId}`);
    const data = await res.json();
    items = data.map(i => i.item);
    renderList();
  } catch (err) {
    console.error('Error loading grocery list:', err);
  }

  // 4️⃣ Add Manual Item
  addItemForm.addEventListener('submit', e => {
    e.preventDefault();
    const txt = newItemInput.value.trim();
    if (!txt) return;
    items.push(txt);
    newItemInput.value = '';
    renderList();

    fetch(GROCERY_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, item: txt })
    }).catch(console.error);
  });

  // 2️⃣ Generate Meal Plan
  generateBtn.addEventListener('click', async () => {
    generateBtn.disabled    = true;
    generateBtn.textContent = 'Generating…';
    try {
      // Fetch user preferences
      const prefsRes = await fetch(`${PREFS_API}/${userId}`);
      const prefs    = await prefsRes.json();

      // Ask AI for a weekly meal plan JSON
      const prompt   = `
        Given these user preferences: ${JSON.stringify(prefs)},
        generate a 7-day meal plan (Breakfast, Lunch, Dinner).
        Format as JSON: { "Monday": [ { "name": "...", "ingredients": [...] } ], … }.
      `;
      const aiRes    = await fetch(AI_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'gpt-4', prompt })
      });
      const { content } = await aiRes.json();
      const mealPlan    = JSON.parse(content);

      // Store for import step
      localStorage.setItem('lastMealPlan', JSON.stringify(mealPlan));
      alert('Meal plan generated! Now click “Import Grocery List.”');
    } catch (err) {
      console.error('Generate plan error:', err);
      alert('Failed to generate meal plan.');
    } finally {
      generateBtn.disabled    = false;
      generateBtn.textContent = 'Generate Meal Plan';
    }
  });

  // 3️⃣ Import Grocery List from last meal plan
  importBtn.addEventListener('click', async () => {
    importBtn.disabled    = true;
    importBtn.textContent = 'Importing…';
    try {
      const planRaw   = localStorage.getItem('lastMealPlan') || '{}';
      const mealPlan  = JSON.parse(planRaw);

      // Ask AI to consolidate all ingredients
      const prompt    = `
        Consolidate a weekly grocery list of unique ingredients
        from this meal plan: ${JSON.stringify(mealPlan)}.
        Return JSON: { "ingredients": ["item1", "item2", …] }.
      `;
      const aiRes     = await fetch(AI_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'gpt-4', prompt })
      });
      const { content }    = await aiRes.json();
      const { ingredients } = JSON.parse(content);

      for (const ing of ingredients) {
        if (!items.includes(ing)) {
          items.push(ing);
          await fetch(GROCERY_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, item: ing })
          });
        }
      }
      renderList();
    } catch (err) {
      console.error('Import error:', err);
      alert('Failed to import grocery list.');
    } finally {
      importBtn.disabled    = false;
      importBtn.textContent = 'Import Grocery List';
    }
  });

  // 4️⃣ Sort & Clear
  sortBtn.addEventListener('click', () => {
    items.sort((a, b) => a.localeCompare(b));
    renderList();
  });
  clearBtn.addEventListener('click', () => {
    items = items.filter((_, i) => {
      const li = groceryListEl.children[i];
      return !li.classList.contains('completed');
    });
    renderList();
  });
});
