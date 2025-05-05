import express            from 'express';
import cors               from 'cors';
import dotenv             from 'dotenv';
import path               from 'path';
import { fileURLToPath }  from 'url';
import { Configuration, OpenAIApi } from 'openai';
import { createClient }   from '@supabase/supabase-js';

// Load env vars from .env (locally) or Render env
dotenv.config();

// Supabase client (server key)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// OpenAI client
const openai = new OpenAIApi(new Configuration({
  apiKey: process.env.OPENAI_API_KEY
}));

const app = express();
app.use(cors());
app.use(express.json());

// ─── 1) AI proxy endpoint ─────────────────────────────────────────
app.post('/api/generate', async (req, res) => {
  const { model, prompt } = req.body;
  try {
    const completion = await openai.createChatCompletion({
      model,
      messages: [{ role: 'user', content: prompt }]
    });
    const content = completion.data.choices[0].message.content;
    res.json({ content });
  } catch (err) {
    console.error("AI generation error:", err);
    res.status(500).json({ error: "AI generation failed" });
  }
});

// ─── 2) Preferences routes ────────────────────────────────────────
app.post('/api/preferences', async (req, res) => {
  const { userId, diet, allergies, goalsText, calorieGoal, proteinGoal } = req.body;
  const { error } = await supabase
    .from('preferences')
    .upsert({
      user_id:       userId,
      diet,
      allergies,
      goals_text:    goalsText,
      calorie_goal:  calorieGoal,
      protein_goal:  proteinGoal,
      updated_at:    new Date()
    }, { onConflict: 'user_id' });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.get('/api/preferences/:userId', async (req, res) => {
  const { data, error } = await supabase
    .from('preferences')
    .select('*')
    .eq('user_id', req.params.userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    return res.status(500).json({ error: error.message });
  }
  res.json(data || {});
});

// ─── 3) Grocery‑list routes ───────────────────────────────────────
app.get('/api/grocery-list/:userId', async (req, res) => {
  const { data, error } = await supabase
    .from('grocery_items')
    .select('*')
    .eq('user_id', req.params.userId);

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/grocery-list', async (req, res) => {
  const { userId, item } = req.body;
  const { data, error } = await supabase
    .from('grocery_items')
    .insert([{ user_id: userId, item }])
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.delete('/api/grocery-list/:id', async (req, res) => {
  const { error } = await supabase
    .from('grocery_items')
    .delete()
    .eq('id', req.params.id);

  if (error) return res.status(500).json({ error: error.message });
  res.sendStatus(204);
});

app.patch('/api/grocery-list/:id', async (req, res) => {
  const { completed } = req.body;
  const { error } = await supabase
    .from('grocery_items')
    .update({ completed })
    .eq('id', req.params.id);

  if (error) return res.status(500).json({ error: error.message });
  res.sendStatus(200);
});

// ─── 4) Serve Static Front‑End ───────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
app.use(express.static(path.join(__dirname, 'public')));

// ─── Start Server ────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
