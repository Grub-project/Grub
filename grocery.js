import { supabase } from './supabaseClient.js';

const groceryListEl = document.getElementById("grocery-list");
const generateBtn   = document.getElementById("generate-list");
const sortBtn       = document.getElementById("sort-list");
const clearBtn      = document.getElementById("clear-list");
const msgEl         = document.getElementById("grocery-msg");

let items = [];

function showMessage(text, type = "success") {
  msgEl.textContent = text;
  msgEl.className = `notification ${type} show`;
  setTimeout(() => msgEl.classList.remove("show"), 3000);
}

function renderList() {
  groceryListEl.innerHTML = "";
  const totals = { calories: 0, protein: 0, carbs: 0, fats: 0 };
  const itemMap = {};

  items.forEach(({ id, item, nutrition }) => {
    const key = item.toLowerCase();
    if (!itemMap[key]) {
      itemMap[key] = { id, item, nutrition: { ...nutrition } };
    } else {
      const n = itemMap[key].nutrition;
      n.calories += nutrition.calories || 0;
      n.protein  += nutrition.protein  || 0;
      n.carbs    += nutrition.carbs    || 0;
      n.fats     += nutrition.fats     || 0;
    }
  });

  const deduped = Object.values(itemMap);

  deduped.forEach(({ item, nutrition }) => {
    const li = document.createElement("li");

    totals.calories += nutrition.calories;
    totals.protein  += nutrition.protein;
    totals.carbs    += nutrition.carbs;
    totals.fats     += nutrition.fats;

    const text = document.createElement("div");
    text.innerHTML = `
      <strong>${item}</strong><br/>
      ${Math.round(nutrition.calories)} cal |
      ${Math.round(nutrition.protein)}g protein |
      ${Math.round(nutrition.carbs)}g carbs |
      ${Math.round(nutrition.fats)}g fats
    `;

    li.appendChild(text);
    groceryListEl.appendChild(li);
  });

  const summary = document.createElement("li");
  summary.innerHTML = `
    <div><strong>Total:</strong><br/>
    ${Math.round(totals.calories)} cal |
    ${Math.round(totals.protein)}g protein |
    ${Math.round(totals.carbs)}g carbs |
    ${Math.round(totals.fats)}g fats</div>
  `;
  summary.style.background = '#d0f0d8';
  groceryListEl.append(summary);
}

async function generateListFromLastPlan() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Not signed in");
    const userId = session.user.id;

    const res = await fetch(`https://grub-44om.onrender.com/api/meal-plans/${userId}`);
    const { plans } = await res.json();
    const plan = plans?.[0];
    if (!plan) return showMessage("No plan found.", "error");

    const allMeals = Object.values(plan).flat();
    const allIngredients = [];

    for (const meal of allMeals) {
      for (const ingredient of meal.ingredients || []) {
        allIngredients.push({
          name: ingredient,
          calories: meal.calories || 0,
          protein: meal.protein  || 0,
          carbs:   meal.carbs    || 0,
          fats:    meal.fats     || 0
        });
      }
    }

    for (const ing of allIngredients) {
      await supabase.from("grocery_items").insert({
        user_id: userId,
        item: ing.name,
        nutrition: {
          calories: ing.calories,
          protein:  ing.protein,
          carbs:    ing.carbs,
          fats:     ing.fats
        }
      });
    }

    showMessage("Grocery list created!");
    await fetchList();
  } catch (err) {
    console.error("Generate list error:", err);
    showMessage("Failed to generate grocery list.", "error");
  }
}

async function fetchList() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  const userId = session.user.id;
  const { data, error } = await supabase
    .from("grocery_items")
    .select("id,item,nutrition")
    .eq("user_id", userId);

  if (!error) {
    items = data;
    renderList();
  }
}

generateBtn.addEventListener("click", generateListFromLastPlan);
sortBtn.addEventListener("click", () => {
  items.sort((a, b) => a.item.localeCompare(b.item));
  renderList();
});
clearBtn.addEventListener("click", async () => {
  if (!confirm("Clear your entire grocery list?")) return;
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session.user.id;
  await supabase.from("grocery_items").delete().eq("user_id", userId);
  items = [];
  renderList();
  showMessage("Cleared all items.");
});

fetchList();

