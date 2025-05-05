// Dashboard.js
import { supabase } from './supabaseClient.js';

const API_BASE    = 'https://grub-44om.onrender.com';
const PREFS_API   = `${API_BASE}/api/preferences`;
const AI_API_URL  = `${API_BASE}/api/generate`;

document.addEventListener('DOMContentLoaded', async () => {
  const { data: { session }, error: sessErr } = await supabase.auth.getSession();
  if (sessErr || !session) {
    return window.location.href = 'login.html';
  }
  const userId = session.user.id;

  const todayEl        = document.getElementById('today-meals');
  const weekEl         = document.getElementById('weekly-plan');
  const genBtn         = document.getElementById('generate-meal-plan');
  const ringCircle     = document.getElementById('progress-circle');
  const ringText       = document.getElementById('progress-percent');
  const goalsDescEl    = document.getElementById('goals-description');
  const calorieTargetEl= document.getElementById('calorie-target');
  const proteinTargetEl= document.getElementById('protein-target');
  const chartCtx       = document.getElementById('nutritionChart').getContext('2d');

  let prefs = { diet: '', goals_text: '', calorie_goal: 0, protein_goal: 0 };
  try {
    const res  = await fetch(`${PREFS_API}/${userId}`);
    const data = await res.json();
    if (data) prefs = data;
  } catch (err) {
    console.error('Failed to load preferences', err);
  }

  goalsDescEl.textContent     = `🎯 Goals: ${prefs.goals_text || 'N/A'}`;
  calorieTargetEl.textContent = `🔥 Calories Target: ${prefs.calorie_goal || '--'}/day`;
  proteinTargetEl.textContent = `💪 Protein Target: ${prefs.protein_goal || '--'}g/day`;

  async function generateMealPlan() {
    genBtn.disabled    = true;
    genBtn.textContent = 'Generating…';

    try {
      // Fetch AI‑generated weekly plan
      const aiRes = await fetch(AI_API_URL, {
        method: 'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({
          model: 'gpt-4',
          prompt: `
            Generate a 7-day meal plan tailored to these preferences:
            ${JSON.stringify(prefs)}.
            Include for each meal: name, calories, protein, carbs, fats.
            Return JSON: { "Monday": [ {...} ], … }.
          `
        })
      });
      const { content } = await aiRes.json();
      const mealPlan    = JSON.parse(content);

      // Render Today's Meals
      const todayName   = new Date().toLocaleDateString('en-US',{weekday:'long'});
      const todayMeals  = mealPlan[todayName] || [];
      todayEl.innerHTML = todayMeals
        .map(m => `<div><strong>${m.name}</strong><br/>
                    ${m.calories} cal, ${m.protein}g protein</div>`)
        .join('<hr>');

      // Render Weekly Plan
      weekEl.innerHTML = Object.entries(mealPlan)
        .map(([day, meals]) => `
          <div>
            <h4>${day}</h4>
            <ul>${meals.map(m=>`<li><strong>${m.name}</strong> – ${m.calories} cal</li>`).join('')}</ul>
          </div>
        `).join('');

      // Calculate Today's Totals
      const totals = todayMeals.reduce((acc, m) => ({
        calories: acc.calories + (parseInt(m.calories,10) || 0),
        protein:  acc.protein  + (parseInt(m.protein,10)  || 0),
        carbs:    acc.carbs    + (parseInt(m.carbs,10)    || 0),
        fats:     acc.fats     + (parseInt(m.fats,10)     || 0)
      }), { calories:0, protein:0, carbs:0, fats:0 });

      // Update Progress Ring using user's calorie goal
      const goalCal = prefs.calorie_goal || 1; // avoid div0
      const percent = Math.min((totals.calories / goalCal) * 100, 100);
      const offset  = 314 - (314 * percent) / 100;
      ringCircle.style.strokeDashoffset = offset;
      ringText.textContent = `${Math.round(percent)}%`;

      // Render Nutrition Breakdown Chart
      new Chart(chartCtx, {
        type: 'doughnut',
        data: {
          labels: ['Protein','Carbs','Fats'],
          datasets: [{
            data: [totals.protein, totals.carbs, totals.fats],
            backgroundColor: ['#4caf50','#ffa726','#ef5350']
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { position: 'bottom' } }
        }
      });

    } catch (err) {
      console.error('Error generating meal plan:', err);
      todayEl.textContent = 'Failed to load meals.';
      weekEl.textContent  = 'Failed to load plan.';
    } finally {
      genBtn.disabled    = false;
      genBtn.textContent = 'Regenerate Plan';
    }
  }

  genBtn.addEventListener('click', generateMealPlan);
  generateMealPlan();
});