export async function onRequestPost(context: any) {
  const { env } = context;

  if (!env.GEMINI_API_KEY) {
    return Response.json(
      { error: "GEMINI_API_KEY is missing" },
      { status: 500 }
    );
  }

  const prompt = `
日本語で、短い極限状況ゲームの導入を作ってください。
必ずJSONだけで返してください。

形式:
{
  "title": "string",
  "openingText": "string",
  "choices": ["string", "string", "string"]
}
`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }]
          }
        ]
      })
    }
  );

  const json = await res.json();

  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  const scenario = extractJson(text);

  return Response.json({
    ok: res.ok,
    status: res.status,
    scenario,
    usage: json.usageMetadata
  });
}

function extractJson(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start === -1 || end === -1) {
    throw new Error("JSON not found");
  }

  return JSON.parse(text.slice(start, end + 1));
}
