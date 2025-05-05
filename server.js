// server.js
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
    // 1️⃣ Create a new auth user (skips email confirmation for demo)
    const { data: user, error: authErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });
    if (authErr) {
      console.error('Auth signup error:', authErr);
      return res.status(400).json({ error: authErr.message });
    }

    // 2️⃣ Insert into your own profiles table
    const { error: profErr } = await supabase
      .from('profiles')
      .insert([{ id: user.id }]);
    if (profErr) {
      console.error('Profile insert error:', profErr);
      // don't block signup—just log
    }

    // 3️⃣ Return the new user record (minus secrets)
    res.json({ user: { id: user.id, email: user.email } });
  } catch (err) {
    console.error('Signup endpoint error:', err);
    res.status(500).json({ error: 'Internal server error during signup' });
  }
});

app.post('/api/generate', async (req, res) => {
  /* ... */
});

//
// ─── Preferences endpoints ─────────────────────────────────────────
app.post('/api/preferences', async (req, res) => { /* ... */ });
app.get('/api/preferences/:userId', async (req, res) => { /* ... */ });

//
// ─── Grocery‑List endpoints ─────────────────────────────────────────
app.get('/api/grocery-list/:userId', async (req, res) => { /* ... */ });
app.post('/api/grocery-list', async (req, res) => { /* ... */ });
app.delete('/api/grocery-list/:id', async (req, res) => { /* ... */ });
app.patch('/api/grocery-list/:id', async (req, res) => { /* ... */ });

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
app.use(express.static(path.join(__dirname, 'public')));

//
// ─── Start server ──────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
