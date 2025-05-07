import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

dotenv.config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const app = express();
const allowedOrigins = ['http://grub.freehostspace.com'];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS not allowed from this origin'));
    }
  },
  credentials: true
}));

app.use(express.json());

app.post('/api/generate', async (req, res) => {
  const { model, prompt } = req.body;
  try {
    const aiRes = await openai.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }]
    });
    res.json({ content: aiRes.choices[0].message.content });
  } catch (err) {
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
    if (pErr) throw pErr;

    const prompt = `
You are a professional meal prep chef.
Create TWO weekly meal plans based on user preferences:
${JSON.stringify(prefs)}

Each plan has:
- label ("Plan A", "Plan B")
- Monday–Sunday with 3 meals/day
- Each meal: name, ingredients[], calories, protein

Return JSON only:
{ "plans": [ { label, Monday: [...], ..., Sunday: [...] }, {...} ] }
    `.trim();

    const aiRes = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      stop: ['```', '\n\n']
    });

    const raw = aiRes.choices[0].message.content;
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Invalid JSON from AI');

    let jsonText = match[0].replace(/,\s*([\]}])/g, '$1');
    const { plans } = JSON.parse(jsonText);
    res.json({ plans });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/meal-plans/:userId', async (req, res) => {
  const { userId } = req.params;
  const { plans } = req.body;

  try {
    const insertData = plans.map(plan => ({
      user_id: userId,
      plan,
      saved_at: new Date()
    }));
    const { error } = await supabase.from('meal_plans').insert(insertData);
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
      .limit(5);
    if (error) throw error;
    res.json({ plans: data.map(d => d.plan) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

