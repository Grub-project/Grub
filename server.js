// server.js
import express             from 'express';
import cors                from 'cors';
import dotenv              from 'dotenv';
import path                from 'path';
import { fileURLToPath }   from 'url';
import { createClient }    from '@supabase/supabase-js';
import OpenAI              from 'openai';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// OpenAI client 
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const app = express();
app.use(cors());
app.use(express.json());

//  AI proxy for generic prompts 
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

//  Generate two new meal plans 
app.post('/api/meal-plans', async (req, res) => {
  const { userId } = req.body;
  try {
    // 1) Fetch user preferences
    const { data: prefs, error: pErr } = await supabase
      .from('preferences')
      .select('*')
      .eq('user_id', userId)
      .single();
    if (pErr) {
      console.error('Supabase prefs fetch error:', pErr);
      return res.status(500).json({ error: 'Failed to load preferences' });
    }

    // 2) Build AI prompt
    const prompt = `
You are a professional meal-prep chef. Based on these preferences:
${JSON.stringify(prefs)}

Produce TWO distinct 7-day meal plans, each with exactly 3 meals per day:
Breakfast, Lunch, Dinner.  For each meal include only:
  - "name": string
  - "calories": number
  - "protein": number

Return JSON exactly:
{ "plans":[ { "label":"Plan A", /*…*/ }, { "label":"Plan B", /*…*/ } ] }
    `.trim();

    // 3) Request from OpenAI
    const aiRes = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }]
    });

    // 4) Parse and return
    const raw     = aiRes.choices[0].message.content;
    const clean   = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').replace(/,\s*([\]}])/g, '$1');
    const { plans } = JSON.parse(clean);

    res.json({ plans });
  } catch (err) {
    console.error('Meal-plans generation error:', err);
    res.status(500).json({ error: err.message || 'Meal plan generation failed' });
  }
});

//  Fetch the saved plan for a user 
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

//  Save the user’s selected plan 
app.post('/api/meal-plans/:userId', async (req, res) => {
  const { userId } = req.params;
  const { plan }   = req.body;
  try {
    const { error } = await supabase
      .from('meal_plans')
      .insert([{ user_id: userId, plan }]);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('Save plan error:', err);
    res.status(500).json({ error: err.message });
  }
});

//  Serve static front-end 
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
app.use(express.static(path.join(__dirname, 'public')));

//  Start server 
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server listening on port ${PORT}`));


