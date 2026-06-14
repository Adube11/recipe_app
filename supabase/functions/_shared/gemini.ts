const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!;

export async function callGemini(
  prompt: string,
  maxOutputTokens = 256,
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gemini API ${response.status}: ${text}`);
  }

  const data = await response.json();
  const rawText: string =
    data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  const match = rawText.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`No JSON in Gemini response: ${rawText}`);
  return match[0];
}
