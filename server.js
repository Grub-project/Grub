// server.js
import express           from 'express';
import cors              from 'cors';
import dotenv            from 'dotenv';
import path              from 'path';
import { fileURLToPath } from 'url';
import { createClient }  from '@supabase/supabase-js';
import OpenAI            from 'openai';

dotenv.config();

// ─── Supabase client (server‑role key) ───────────────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ─── OpenAI client ───────────────────────────────────────────────────────
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const app = express();
app.use(cors());
app.use(express.json());

// ─── AI proxy for generic prompts (used by “Suggest Targets” and elsewhere) ─
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

// ─── Generate TWO distinct 7‑day, 3‑meals/day plans ────────────────────────
app.post('/api/meal-plans', async (req, res) => {
  const { userId } = req.body;
  try {
    // 1) Fetch preferences
    const { data: prefs, error: pErr } = await supabase
      .from('preferences').select('*').eq('user_id', userId).single();
    if (pErr) throw pErr;

    // 2) Build the prompt
    const prompt = `
You are a world‑class meal‑prep chef. Based on these user preferences:
${JSON.stringify(prefs)}

Generate TWO distinct 7‑day meal plans, each with exactly 3 meals per day (Breakfast, Lunch, Dinner).
For each meal include:
  • "name": realistic dish name (e.g. "Grilled Lemon Herb Chicken Breast")
  • "ingredients": array of specific items (e.g. ["skinless chicken breast","fresh rosemary","lemon zest"])
  • "calories": number
  • "protein": number

Return ONLY valid JSON in this exact shape:
{
  "plans":[
    { "label":"Plan A", "Monday":[…], … "Sunday":[…] },
    { "label":"Plan B", /*…*/ }
  ]
}
No comments or trailing commas.
    `.trim();

    // 3) Ask OpenAI
    const aiRes = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }]
    });
    const raw = aiRes.choices[0].message.content;

    // 4) Extract the first {…} block
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) {
      console.error('No JSON found in AI response:', raw);
      throw new Error('Invalid JSON from AI');
    }
    let jsonText = match[0];

    // 5) Remove any trailing commas before ] or }
    jsonText = jsonText.replace(/,\s*([\]}])/g, '$1');

    // 6) Parse
    let plans;
    try {
      ({ plans } = JSON.parse(jsonText));
    } catch (parseErr) {
      console.error('Failed to parse cleaned JSON:', jsonText);
      throw new Error('Malformed JSON from AI');
    }

    // 7) Return the two plans
    res.json({ plans });

  } catch (err) {
    console.error('Meal-plans gen error:', err);
    res.status(500).json({ error: err.message || 'Meal plan generation failed' });
  }
});

// ─── Fetch the last‐saved plan ──────────────────────────────────────────────
app.get('/api/meal-plans/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const { data, error } = await supabase
      .from('meal_plans')
      .select('plan')
      .eq('user_id', userId)
      .order('saved_at', { ascending: false })
      .limit(1)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    res.json({ plan: data?.plan || null });
  } catch (err) {
    console.error('Fetch saved plan error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Save the user’s chosen plan ───────────────────────────────────────────
app.post('/api/meal-plans/:userId', async (req, res) => {
  const { userId } = req.params;
  const { plan }   = req.body;
  try {
    const { error } = await supabase
      .from('meal_plans')
      .insert([{ user_id: userId, plan, saved_at: new Date() }]);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('Save plan error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Serve static front‑end ────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
app.use(express.static(path.join(__dirname, 'public')));

// ─── Start the server ─────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Listening on port ${PORT}`));
