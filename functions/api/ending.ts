export async function onRequestPost(context: any) {
  const { request, env } = context;

  if (!env.GEMINI_API_KEY) {
    return Response.json(
      { error: "GEMINI_API_KEY is missing" },
      { status: 500 }
    );
  }

  let body;

  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Request body must be valid JSON" },
      { status: 400 }
    );
  }

  const {
    scenario,
    currentStatus,
    currentSituation,
    history = [],
    endingType,
    failedStatusKey,
    failedStatusLabel
  } = body;

  const prompt = `
あなたはノベルゲーム風サバイバルゲームのエンディング作家です。
以下のプレイ内容をもとに、ゲームの結末文を日本語で作ってください。

シナリオ:
${JSON.stringify(scenario)}

最終ステータス:
${JSON.stringify(currentStatus)}

最後の状況:
${currentSituation}

プレイヤーの行動履歴:
${JSON.stringify(history).slice(0, 4000)}

エンディング種別:
${endingType}

尽きたステータス:
${failedStatusLabel || failedStatusKey || "なし"}

条件:
- 必ずJSONだけで返す
- endingTitleは短いタイトルにする
- endingTextは250〜450文字程度
- ただ「死んだ」で終わらせない
- これまでの行動を少し振り返る
- なぜその結末に至ったかを描写する
- その後どうなったかを入れる
- ジャンルに合った結末にする
- バッドエンドでも物語として余韻を残す
- 過度に残酷な描写は避ける
- 実在の事件・災害を連想させる描写は避ける
- 自傷や犯罪の具体的手順は書かない

尽きたステータスごとの方向性:
- hp: 身体的な限界、負傷、行動不能、救助失敗、代償つき生存など
- resource: 物資不足、選択肢の喪失、環境への屈服、取引や代償など
- safety: 危険に捕まる、閉じ込められる、追跡される、支配されるなど
- mental: 心の限界、認識の変化、記憶の混濁、別の役割を受け入れるなど
- survive: 生存、脱出、救助、帰還、ただし小さな代償や後日談を含めてもよい

結末の種類は固定しないでください。
変質、孤立、捕獲、救助失敗、帰還不能、代償つき生存、記憶喪失、別存在化、閉じ込め、取り込まれる、役割の変化など、シナリオに合う形を自由に選んでください。
上記の方向性は発想の軸であり、定型文や固定パターンではありません。シナリオ内容と行動履歴を優先して、毎回異なる結末を作ってください。

返すJSON形式:
{
  "endingTitle": "string",
  "endingText": "string"
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
  const result = extractJson(text);

  return Response.json({
    ok: res.ok,
    status: res.status,
    result,
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
