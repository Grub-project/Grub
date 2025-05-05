import express             from 'express';
import cors                from 'cors';
import dotenv              from 'dotenv';
import path                from 'path';
import { fileURLToPath }   from 'url';
import { createClient }    from '@supabase/supabase-js';
import OpenAI              from 'openai';

dotenv.config();

// — Supabase client (server-side key) —
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// — OpenAI client —
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const app = express();
app.use(cors());
app.use(express.json());


app.post('/auth/signup', async (req, res) => {
  const { email, password } = req.body;

  try {
    // 1) Create auth user
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
    console.error('Signup endpoint unexpected error:', err);
    return res.status(500).json({ error: 'Internal server error during signup' });
  }
});

//
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

//
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

//
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

//
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
app.use(express.static(path.join(__dirname, 'public')));

//
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
