// server.js
import express           from 'express';
import cors              from 'cors';
import dotenv            from 'dotenv';
import path              from 'path';
import { fileURLToPath } from 'url';
import { createClient }  from '@supabase/supabase-js';
import OpenAI            from 'openai';

dotenv.config();

const FRONTEND_ORIGIN = 'http://grub.freehostspace.com/';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const app = express();
app.use(cors({
  origin: FRONTEND_ORIGIN,
  methods: ['GET','POST','PATCH','DELETE'],
  credentials: true
}));
app.use(express.json());

app.post('/auth/signup', async (req, res) => {
  const { email, password } = req.body;
  try {
    const { data: user, error: authErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });
    if (authErr) {
      console.error('Auth signup error:', authErr);
      return res.status(400).json({ error: authErr.message });
    }

    const { error: profErr } = await supabase
      .from('profiles')
      .insert([{ id: user.id }]);
    if (profErr) {
      console.error('Profile insert error:', profErr);
    }

    return res.json({ user: { id: user.id, email: user.email } });
  } catch (err) {
    console.error('Signup endpoint error:', err);
    return res.status(500).json({ error: 'Internal server error during signup' });
  }
});

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

app.post('/api/preferences', async (req, res) => {
  const { userId, diet, allergies, goalsText, calorieGoal, proteinGoal } = req.body;
  const { error } = await supabase
    .from('preferences')
    .upsert({
      user_id:      userId,
      diet,
      allergies,
      goals_text:   goalsText,
      calorie_goal: calorieGoal,
      protein_goal: proteinGoal,
      updated_at:   new Date()
    }, { onConflict: 'user_id' });
  if (error) {
    console.error('Upsert preferences error:', error);
    return res.status(500).json({ error: error.message });
  }
  res.json({ success: true });
});

app.get('/api/preferences/:userId', async (req, res) => {
  const { data, error } = await supabase
    .from('preferences')
    .select('*')
    .eq('user_id', req.params.userId)
    .single();
  if (error && error.code !== 'PGRST116') {
    console.error('Fetch preferences error:', error);
    return res.status(500).json({ error: error.message });
  }
  res.json(data || {});
});

// ─── Meal Plans (AI‑driven) ─────────────────────────────────────────────
app.post('/api/meal-plans', async (req, res) => {
  const { userId } = req.body;
  try {
    // 1) Fetch preferences
    const { data: prefs, error: pErr } = await supabase
      .from('preferences')
      .select('*')
      .eq('user_id', userId)
      .single();
    if (pErr) {
      console.error('Fetch prefs error:', pErr);
      return res.status(500).json({ error: pErr.message });
    }

    // 2) Ask AI for a weekly meal plan
    const prompt = `
      Generate a 7-day meal plan tailored to these preferences:
      ${JSON.stringify(prefs)}.
      Include for each day: Breakfast, Lunch, Dinner with fields name, calories, protein, carbs, fats.
      Return JSON: { "Monday": [ {...} ], ... }.
    `;
    const aiRes = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }]
    });
    const mealPlan = JSON.parse(aiRes.choices[0].message.content);

    // 3) Return plan
    res.json({ mealPlan });
  } catch (err) {
    console.error('Meal plan endpoint error:', err);
    res.status(500).json({ error: 'Failed to generate meal plan' });
  }
});

app.get('/api/grocery-list/:userId', async (req, res) => {
  const { data, error } = await supabase
    .from('grocery_items')
    .select('*')
    .eq('user_id', req.params.userId);
  if (error) {
    console.error('Fetch grocery error:', error);
    return res.status(500).json({ error: error.message });
  }
  res.json(data);
});

app.post('/api/grocery-list', async (req, res) => {
  const { userId, item } = req.body;
  const { data, error } = await supabase
    .from('grocery_items')
    .insert([{ user_id: userId, item }])
    .single();
  if (error) {
    console.error('Insert grocery error:', error);
    return res.status(500).json({ error: error.message });
  }
  res.json(data);
});

app.delete('/api/grocery-list/:id', async (req, res) => {
  const { error } = await supabase
    .from('grocery_items')
    .delete()
    .eq('id', req.params.id);
  if (error) {
    console.error('Delete grocery error:', error);
    return res.status(500).json({ error: error.message });
  }
  res.sendStatus(204);
});

app.patch('/api/grocery-list/:id', async (req, res) => {
  const { completed } = req.body;
  const { error } = await supabase
    .from('grocery_items')
    .update({ completed })
    .eq('id', req.params.id);
  if (error) {
    console.error('Update grocery error:', error);
    return res.status(500).json({ error: error.message });
  }
  res.sendStatus(200);
});

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
