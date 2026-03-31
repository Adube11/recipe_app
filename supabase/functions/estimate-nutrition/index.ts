import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

/** Maximum AI estimations per user per calendar day. */
const USER_DAILY_LIMIT = 10;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return errorResponse('Unauthorized', 401);
    }

    // Service role client bypasses RLS — used for rate-limit logging only.
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify the caller's JWT to get their user ID.
    const jwt = authHeader.replace('Bearer ', '');
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(jwt);
    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // ── Rate limiting ────────────────────────────────────────────────────────
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { count, error: countError } = await supabase
      .from('ai_estimation_log')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('estimated_at', todayStart.toISOString());

    if (!countError && (count ?? 0) >= USER_DAILY_LIMIT) {
      return new Response(JSON.stringify({ error: 'RATE_LIMIT' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Parse request ────────────────────────────────────────────────────────
    const body = await req.json();
    const { name, ingredients, servings } = body as {
      name: string;
      ingredients: string[];
      servings: number;
    };

    if (!name || !Array.isArray(ingredients) || ingredients.length === 0) {
      return errorResponse(
        'Invalid input: name and ingredients are required',
        400,
      );
    }

    // ── Call Gemini Flash ────────────────────────────────────────────────────
    const nutrition = await callGemini(name, ingredients, servings ?? 1);

    // ── Log usage ────────────────────────────────────────────────────────────
    await supabase
      .from('ai_estimation_log')
      .insert({ user_id: user.id, estimated_at: new Date().toISOString() });

    return new Response(JSON.stringify(nutrition), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('estimate-nutrition error:', err);
    return errorResponse('Internal server error', 500);
  }
});

// ── Gemini Flash integration ─────────────────────────────────────────────────

async function callGemini(
  name: string,
  ingredients: string[],
  servings: number,
): Promise<{
  kcal: number;
  proteines: number;
  glucides: number;
  lipides: number;
}> {
  const prompt =
    `Tu es diététiste. Estime les valeurs nutritionnelles PAR PORTION pour cette recette.\n\n` +
    `Recette : ${name}\n` +
    `Nombre de portions : ${servings}\n` +
    `Ingrédients :\n${ingredients.map((i) => `- ${i}`).join('\n')}\n\n` +
    `Réponds UNIQUEMENT avec un objet JSON valide, sans texte supplémentaire :\n` +
    `{"kcal": <entier>, "proteines": <entier en grammes>, "glucides": <entier en grammes>, "lipides": <entier en grammes>}\n\n` +
    `Base l'estimation sur le poids cuit (pas cru). Sois réaliste et conservateur.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 128 },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gemini API ${response.status}: ${text}`);
  }

  const geminiData = await response.json();
  const rawText: string =
    geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  // Extract the JSON object from the response (handles optional markdown fences).
  const match = rawText.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error(`No JSON in Gemini response: ${rawText}`);
  }

  const parsed = JSON.parse(match[0]);

  return {
    kcal: Math.round(Math.abs(Number(parsed.kcal) || 0)),
    proteines: Math.round(Math.abs(Number(parsed.proteines) || 0)),
    glucides: Math.round(Math.abs(Number(parsed.glucides) || 0)),
    lipides: Math.round(Math.abs(Number(parsed.lipides) || 0)),
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function errorResponse(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
