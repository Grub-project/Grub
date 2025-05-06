// server.js
import express             from 'express';
import cors                from 'cors';
import dotenv              from 'dotenv';
import path                from 'path';
import { fileURLToPath }   from 'url';
import { createClient }    from '@supabase/supabase-js';
import OpenAI              from 'openai';

// 1) Load environment variables
dotenv.config();

// 2) Sanity‐check logs (remove or comment out once verified)
console.log('ENV OPENAI_API_KEY:', process.env.OPENAI_API_KEY?.slice(0, 8), '… length:', process.env.OPENAI_API_KEY?.length);
console.log('ENV SUPABASE_URL:', process.env.SUPABASE_URL);
console.log('ENV SUPABASE_SERVICE_ROLE_KEY present?', Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY));

// ─── Supabase (server role key) ───────────────────────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ─── OpenAI client ───────────────────────────────────────────────────────
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const app = express();
app.use(cors());
app.use(express.json());

// ─── AI proxy for generic prompts ────────────────────────────────────────
app.post('/api/generate', async (req, res) => {
  const { model, prompt } = req.body;
  try {
    const aiRes = await openai.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }]
    });
    res.json({ content: aiRes.choices[0].message.content });
  } catch (err) {
    console.error('AI generation error:', err);
    res.status(500).json({ error: 'AI generation failed' });
  }
});

// ─── Generate a meal plan using saved preferences ───────────────────────
app.post('/api/meal-plans', async (req, res) => {
  const { userId } = req.body;
  try {
    // 1) Fetch this user’s preferences
    const { data: prefs, error: pErr } = await supabase
      .from('preferences')
      .select('*')
      .eq('user_id', userId)
      .single();
    if (pErr) {
      console.error('Supabase prefs fetch error:', pErr);
      return res.status(500).json({ error: 'Failed to load preferences' });
    }

    // 2) Build a prompt asking for a 7‑day, 4‑meal/day plan
    const prompt = `
You are a professional meal-prep chef. Given these user preferences:
${JSON.stringify(prefs)}

Produce a 7‑day meal plan (4 meals per day: Breakfast, Morning Snack, Lunch, Dinner). 
Each meal must include: name, calories (number), protein (number), carbs (number), fats (number), ingredients (array of strings).
Reply ONLY in JSON format exactly like:
{
  "Monday": [ { /* meal1 */ }, /* meal2 */ , /* meal3 */ , /* meal4 */ ],
  "Tuesday": [ … ],
  …
}
    `.trim();

    // 3) Ask OpenAI
    const aiRes = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }]
    });
    const rawContent = aiRes.choices[0].message.content;

    // 4) Parse JSON safely
    let mealPlan;
    try {
      mealPlan = JSON.parse(rawContent);
    } catch (parseErr) {
      console.error('Failed to JSON.parse AI response:', rawContent);
      return res.status(500).json({ error: 'Invalid JSON from AI' });
    }

    // 5) Return the meal plan
    res.json({ mealPlan });

  } catch (err) {
    console.error('Meal-plans endpoint error:', err);
    res.status(500).json({ error: err.message || 'Meal plan generation failed' });
  }
});

// ─── Serve static front‑end ───────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
app.use(express.static(path.join(__dirname, 'public')));

// ─── Start server ─────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server listening on port ${PORT}`));

