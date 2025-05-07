import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/generate', async (req, res) => {
  const { model, prompt } = req.body;

  if (!model || !prompt) {
    return res.status(400).json({ error: 'Missing model or prompt' });
  }

  try {
    const aiRes = await openai.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }]
    });

    const content = aiRes.choices[0].message.content;
    res.json({ content });

  } catch (err) {
    console.error('AI generation error:', err);
    res.status(500).json({ error: 'AI generation failed' });
  }
});

app.post('/api/meal-plans', async (req, res) => {
  const { userId } = req.body;

  try {
    const { data: prefs, error: pErr } = await supabase
      .from('preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (pErr || !prefs) throw new Error('No preferences found.');

    const prompt = `
You are a professional meal prep chef.

Create TWO weekly meal plans based on these preferences:
${JSON.stringify(prefs)}

Each plan must include:
- "label": string (e.g., "Plan A", "Plan B")
- ALL 7 days: "Monday" through "Sunday" (do NOT skip any day)
- Each day must include exactly 3 meals
Each meal must contain:
  - "name": string
  - "ingredients": array of 3–5 strings
  - "calories": number
  - "protein": number
  - "carbs": number
  - "fats": number

Return ONLY valid JSON like:
{
  "plans": [
    {
      "label": "Plan A",
      "Monday": [ { "name": "...", "ingredients": [...], "calories": 400, "protein": 30, "carbs": 40, "fats": 10 }, ... ],
      ...
      "Sunday": [ ... ]
    },
    {
      "label": "Plan B",
      ...
    }
  ]
}
Do NOT include comments, markdown, or any explanation.
    `.trim();

    const aiRes = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }]
    });

    const raw = aiRes.choices[0].message.content;
    console.log('🧠 Raw GPT output:\n', raw);

    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Invalid JSON from AI');

    let jsonText = match[0]
      .replace(/([{,])\s*([a-zA-Z0-9_]+)\s*:/g, '$1"$2":')  // quote unquoted keys
      .replace(/,\s*([\]}])/g, '$1');                      // remove trailing commas

    let plans;
    try {
      ({ plans } = JSON.parse(jsonText));
    } catch (parseErr) {
      console.error('❌ JSON Parse Error:\n', jsonText);
      throw new Error('Malformed JSON from AI');
    }

    res.json({ plans });

  } catch (err) {
    console.error('Meal-plan generation failed:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/meal-plans/:userId', async (req, res) => {
  const { userId } = req.params;
  const { plans } = req.body;

  try {
    const rows = plans.map(plan => ({
      user_id: userId,
      plan,
      saved_at: new Date()
    }));

    const { error } = await supabase.from('meal_plans').insert(rows);
    if (error) throw error;
    res.json({ success: true });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/meal-plans/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    const { data, error } = await supabase
      .from('meal_plans')
      .select('plan')
      .eq('user_id', userId)
      .order('saved_at', { ascending: false })
      .limit(10);

    if (error) throw error;
    res.json({ plans: data.map(d => d.plan) });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/meal-plans/:userId/:index', async (req, res) => {
  const { userId, index } = req.params;

  try {
    const { data, error } = await supabase
      .from('meal_plans')
      .select('id')
      .eq('user_id', userId)
      .order('saved_at', { ascending: false });

    if (error) throw error;
    const target = data[Number(index)];
    if (!target) return res.status(404).json({ error: 'Plan not found' });

    const { error: delErr } = await supabase
      .from('meal_plans')
      .delete()
      .eq('id', target.id);

    if (delErr) throw delErr;
    res.json({ success: true });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
