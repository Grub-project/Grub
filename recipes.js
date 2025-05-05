// recipe-suggestions.js
import { supabase } from './supabaseClient.js';

const API_BASE   = 'https://grub-44om.onrender.com';
const AI_API_URL = `${API_BASE}/api/generate`;

document.addEventListener('DOMContentLoaded', async () => {
  // Auth
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session) return window.location.href = 'login.html';
  const userId = session.user.id;

  const suggestBtn = document.getElementById('get-suggestions');
  const listEl     = document.getElementById('suggestions-list');

  function renderRecipes(recipes) {
    listEl.innerHTML = '';
    recipes.forEach(r => {
      const li = document.createElement('li');
      li.innerHTML = `
        <h4>${r.name}</h4>
        <p><strong>Ingredients:</strong> ${r.ingredients.join(', ')}</p>
        <p><strong>Instructions:</strong> ${r.instructions}</p>
      `;
      listEl.append(li);
    });
  }

  suggestBtn.addEventListener('click', async () => {
    suggestBtn.disabled    = true;
    suggestBtn.textContent = 'Fetching…';
    try {
      const planRes = await fetch(`${API_BASE}/api/meal-plans/${userId}`);
      const { plan } = await planRes.json();
      const prompt   = `Given this plan ${JSON.stringify(plan)}, suggest 5 recipes as JSON { "recipes":[…] }.`;
      const aiRes    = await fetch(AI_API_URL, {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ model:'gpt-4', prompt })
      });
      const { content }   = await aiRes.json();
      const { recipes }   = JSON.parse(content);
      renderRecipes(recipes);
    } catch {
      alert('Failed to fetch recipes.');
    } finally {
      suggestBtn.disabled    = false;
      suggestBtn.textContent = 'Get Suggestions';
    }
  });
});
