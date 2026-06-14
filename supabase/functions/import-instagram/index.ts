import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import {
  createClient,
  SupabaseClient,
} from 'https://esm.sh/@supabase/supabase-js@2';
import { callGemini } from '../_shared/gemini.ts';

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const USER_DAILY_LIMIT = 3;

serve(async (req) => {
  if (req.method === 'OPTIONS')
    return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return errorResponse('Unauthorized', 401);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) return errorResponse('Unauthorized', 401);

    const body = await req.json();
    const sourceUrl: string = body?.source_url ?? '';
    const caption: string | null = body?.caption ?? null;

    if (!isValidInstagramUrl(sourceUrl)) {
      return errorResponse('URL Instagram invalide', 400);
    }

    // Rate limit: 3 imports/user/day
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { count } = await supabase
      .from('import_log')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('imported_at', todayStart.toISOString());

    if ((count ?? 0) >= USER_DAILY_LIMIT) {
      return new Response(JSON.stringify({ error: 'RATE_LIMIT' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: job, error: jobError } = await supabase
      .from('import_jobs')
      .insert({ user_id: user.id, source_url: sourceUrl, status: 'pending' })
      .select('id')
      .single();
    if (jobError || !job) return errorResponse('Internal server error', 500);

    // Log at entry — counts against rate limit regardless of outcome
    await supabase
      .from('import_log')
      .insert({ user_id: user.id, job_id: job.id });

    // Must use waitUntil — worker is killed as soon as Response is returned
    EdgeRuntime.waitUntil(processJob(job.id, sourceUrl, caption, supabase));

    return new Response(JSON.stringify({ jobId: job.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('import-instagram error:', err);
    return errorResponse('Internal server error', 500);
  }
});

async function processJob(
  jobId: string,
  sourceUrl: string,
  providedCaption: string | null,
  supabase: SupabaseClient,
) {
  try {
    await supabase
      .from('import_jobs')
      .update({
        status: 'processing',
        started_at: new Date().toISOString(),
        attempts: 1,
      })
      .eq('id', jobId);

    // Use provided caption (paste-manual flow) or attempt auto-fetch
    const caption = providedCaption ?? (await fetchInstagramCaption(sourceUrl));

    if (!caption || caption.trim().length < 10) {
      return await failJob(
        supabase,
        jobId,
        'INSTAGRAM_PRIVATE',
        'Impossible de récupérer la légende. Collez-la manuellement.',
      );
    }

    const recipeJson = await parseRecipeFromCaption(sourceUrl, caption);

    if (!recipeJson.is_recipe) {
      return await failJob(
        supabase,
        jobId,
        'NOT_A_RECIPE',
        'Ce post ne semble pas contenir une recette.',
      );
    }

    const macros = await estimateMacros(
      recipeJson.name as string,
      (recipeJson.ingredients as string[]) ?? [],
      (recipeJson.servings as number) ?? 2,
    );

    await supabase
      .from('import_jobs')
      .update({
        status: 'done',
        result: { ...recipeJson, macros },
        finished_at: new Date().toISOString(),
      })
      .eq('id', jobId);
  } catch (err) {
    console.error('processJob error:', err);
    await failJob(supabase, jobId, 'GEMINI_PARSE_ERROR', String(err));
  }
}

async function fetchInstagramCaption(url: string): Promise<string | null> {
  // Best-effort oEmbed — requires a Facebook App token in practice;
  // will typically return null and trigger the paste-manual flow.
  try {
    const oembedUrl = `https://graph.facebook.com/v17.0/instagram_oembed?url=${encodeURIComponent(
      url,
    )}&fields=title`;
    const res = await fetch(oembedUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = await res.json();
      return (data?.title as string) ?? null;
    }
  } catch {
    /* fall through to paste-manual flow */
  }
  return null;
}

async function parseRecipeFromCaption(
  url: string,
  caption: string,
): Promise<Record<string, unknown>> {
  const prompt =
    `Tu es un expert en cuisine française. Analyse cette légende Instagram et extrais la recette.\n\n` +
    `URL source : ${url}\n` +
    `Légende :\n${caption}\n\n` +
    `Réponds UNIQUEMENT avec un objet JSON valide, sans texte supplémentaire :\n` +
    `{\n` +
    `  "is_recipe": <true|false>,\n` +
    `  "name": "<nom, première lettre majuscule>",\n` +
    `  "ingredients": ["<quantité + unité + ingrédient en français>"],\n` +
    `  "instructions": ["<étape en français>"],\n` +
    `  "servings": <entier>,\n` +
    `  "prep_time": <minutes ou null>,\n` +
    `  "cook_time": <minutes ou null>,\n` +
    `  "difficulty": "<facile|moyen|difficile>",\n` +
    `  "low_confidence_fields": ["<champ deviné>"]\n` +
    `}\n\n` +
    `Règles : tout en FRANÇAIS, grammes pour les solides, ml pour les liquides.\n` +
    `Si pas une recette : is_recipe: false, autres champs null.`;

  const raw = await callGemini(prompt, 1024);
  return JSON.parse(raw);
}

async function estimateMacros(
  name: string,
  ingredients: string[],
  servings: number,
) {
  const prompt =
    `Tu es diététiste. Estime les valeurs nutritionnelles PAR PORTION.\n\n` +
    `Recette : ${name}\nPortions : ${servings}\n` +
    `Ingrédients :\n${ingredients.map((i) => `- ${i}`).join('\n')}\n\n` +
    `Réponds UNIQUEMENT avec un objet JSON valide :\n` +
    `{"kcal": <entier>, "proteines": <entier>, "glucides": <entier>, "lipides": <entier>}\n\n` +
    `Base sur le poids cuit. Sois réaliste et conservateur.`;

  const raw = await callGemini(prompt, 128);
  const parsed = JSON.parse(raw);
  return {
    kcal: Math.round(Math.abs(Number(parsed.kcal) || 0)),
    proteines: Math.round(Math.abs(Number(parsed.proteines) || 0)),
    glucides: Math.round(Math.abs(Number(parsed.glucides) || 0)),
    lipides: Math.round(Math.abs(Number(parsed.lipides) || 0)),
  };
}

function isValidInstagramUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      ['www.instagram.com', 'instagram.com'].includes(parsed.hostname) &&
      parsed.protocol === 'https:'
    );
  } catch {
    return false;
  }
}

async function failJob(
  supabase: SupabaseClient,
  jobId: string,
  errorCode: string,
  errorMessage: string,
) {
  await supabase
    .from('import_jobs')
    .update({
      status: 'error',
      error_code: errorCode,
      error_message: errorMessage,
      finished_at: new Date().toISOString(),
    })
    .eq('id', jobId);
}

function errorResponse(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
