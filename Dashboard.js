import { supabase } from './supabaseClient.js';

const API_BASE = 'https://grub-44om.onrender.com';

document.addEventListener('DOMContentLoaded', loadDashboard);
document.getElementById('generate-meal-plan').addEventListener('click', loadDashboard);

async function loadDashboard() {
  const genBtn     = document.getElementById('generate-meal-plan');
  const todayEl    = document.getElementById('today-meals');
  const weekEl     = document.getElementById('weekly-plan');
  const ringCircle = document.getElementById('progress-circle');
  const ringText   = document.getElementById('progress-percent');
  const chartCtx   = document.getElementById('nutritionChart').getContext('2d');

  genBtn.disabled = true;
  genBtn.textContent = 'Loading…';

  try {
    const { data: { session }, error: sessErr } = await supabase.auth.getSession();
    if (sessErr || !session) throw new Error('Not signed in');
    const userId = session.user.id;

    const { data: prefs, error: prefErr } = await supabase
      .from('preferences')
      .select('*')
      .eq('user_id', userId)
      .single();
    if (prefErr) throw prefErr;

    document.getElementById('calorie-target').textContent = `🔥 Calories Target: ${prefs.calorie_goal || '--'}/day`;
    document.getElementById('protein-target').textContent = `💪 Protein Target: ${prefs.protein_goal || '--'}g/day`;
    document.getElementById('goals-description').textContent = `Tracking progress for today’s meals.`;

    const res = await fetch(`${API_BASE}/api/meal-plans/${userId}`);
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
    const { plans } = await res.json();
    const plan = plans?.[0]; 

    if (!plan) {
      todayEl.textContent = 'No plan saved yet.';
      weekEl.textContent = '';
      return;
    }

    const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    const todayMeals = Array.isArray(plan[todayName]) ? plan[todayName] : [];

    todayEl.innerHTML = todayMeals.map(m =>
      `<div>
         <strong>${m.name}</strong><br/>
         ${m.calories} cal, ${m.protein}g protein
       </div>`
    ).join('<hr>');

    console.log("📦 Weekly plan contents:", plan);

    weekEl.innerHTML = Object.entries(plan).map(([day, meals]) => {
      const validMeals = Array.isArray(meals) ? meals : [];
      return `
        <div class="day-block">
          <h4>${day}</h4>
          <ul>${validMeals.map(m => `<li>${m.name} (${m.calories} cal)</li>`).join('')}</ul>
        </div>
      `;
    }).join('');

    // 6. Totals for progress ring + chart
    const totals = todayMeals.reduce((acc, m) => ({
      calories: acc.calories + (m.calories || 0),
      protein:  acc.protein + (m.protein || 0),
      carbs:    acc.carbs + (m.carbs || 0),
      fats:     acc.fats + (m.fats || 0)
    }), { calories: 0, protein: 0, carbs: 0, fats: 0 });

    const goalCal = prefs.calorie_goal || 1;
    const pct = Math.min((totals.calories / goalCal) * 100, 100);
    const offset = 314 - (314 * pct) / 100;
    ringCircle.style.strokeDashoffset = offset;
    ringText.textContent = `${Math.round(pct)}%`;

    new Chart(chartCtx, {
      type: 'doughnut',
      data: {
        labels: ['Protein', 'Carbs', 'Fats'],
        datasets: [{
          data: [totals.protein, totals.carbs, totals.fats],
          backgroundColor: ['#4caf50', '#ffa726', '#ef5350']
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom' }
        }
      }
    });

  } catch (err) {
    console.error('Dashboard error:', err);
    todayEl.textContent = 'Failed to load meals.';
    weekEl.textContent = 'Failed to load plan.';
  } finally {
    genBtn.disabled = false;
    genBtn.textContent = 'Regenerate Plan';
  }
}
