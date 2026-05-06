export async function onRequestPost(context: any) {
  const { env } = context;

  if (!env.GEMINI_API_KEY) {
    return Response.json(
      { error: "GEMINI_API_KEY is missing" },
      { status: 500 }
    );
  }

  const genre = pickRandom(GENRES);

  const prompt = `
    あなたは、単一のHTMLページ上で遊ぶノベルゲーム風サバイバルゲームのシナリオ生成AIです。
    「単一ページ」とは、index.htmlひとつで画面遷移せずに遊ぶという意味です。
    文章量が紙1ページ以内という意味ではありません。

    今回は必ず次のジャンルで作ってください。

    ジャンル:
    ${genre.name}

    ジャンル例:
    ${genre.examples.join(" / ")}

    日本語で、短いサバイバルゲームの初期シナリオを作ってください。

    条件:
    - ノベルゲーム風に表示しやすい文章にする
    - openingTextは220文字程度
    - choicesは短い行動文を3つ
    - 7ターン以内で完結する想定
    - 即死や詰み状態にはしない
    - 過度に残酷な描写は避ける
    - 実在の事件・災害は使わない
    - ステータス内部キーは必ず hp, resource, safety, mental の4つだけ
    - 各ステータスは0〜100で、高いほど良い状態
    - statusLabelsでジャンルに合う表示名を指定する
    - 持ち物を3〜5個用意する
    - genreには必ず "${genre.name}" を入れる
    - 必ずJSONだけで返す

    返すJSON形式:
    {
      "title": "string",
      "genre": "${genre.name}",
      "openingText": "string",
      "goal": "string",
      "turnLimit": 7,
      "statusLabels": {
        "hp": "string",
        "resource": "string",
        "safety": "string",
        "mental": "string"
      },
      "initialStatus": {
        "hp": 80,
        "resource": 60,
        "safety": 50,
        "mental": 70
      },
      "items": ["string", "string", "string"],
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


const GENRES = [
  {
    id: "real_survival",
    name: "現実サバイバル",
    examples: ["雪山遭難", "無人島漂着", "山奥で車が故障", "森で迷う"]
  },
  {
    id: "disaster",
    name: "災害・事故",
    examples: ["地下鉄崩落", "停電ビル", "浸水した街", "トンネル事故"]
  },
  {
    id: "zombie",
    name: "ゾンビ世界",
    examples: ["ショッピングモール籠城", "避難所への移動", "薬局で物資回収", "夜の校舎"]
  },
  {
    id: "space_sf",
    name: "宇宙・SF",
    examples: ["宇宙船の酸素低下", "火星基地の通信途絶", "AI管制暴走", "漂流宇宙船"]
  },
  {
    id: "fantasy",
    name: "異世界ファンタジー",
    examples: ["魔物の森", "地下牢脱出", "崩落ダンジョン", "呪われた村"]
  },
  {
    id: "horror",
    name: "ホラー",
    examples: ["廃病院", "古い洋館", "夜の学校", "人形だらけの部屋"]
  },
  {
    id: "kaiju",
    name: "怪獣・巨大生物",
    examples: ["怪獣襲来", "巨大鳥から逃げる", "地下シェルター避難", "ビル屋上に孤立"]
  },
  {
    id: "escape",
    name: "脱出",
    examples: ["監視施設", "水没研究所", "閉鎖駅", "謎の地下室"]
  },
  {
    id: "post_apocalypse",
    name: "ポストアポカリプス",
    examples: ["荒廃した都市", "汚染区域", "無人の高速道路", "物資が尽きた避難所"]
  },
  {
    id: "deep_sea",
    name: "深海・潜水艦",
    examples: ["潜水艦の電力低下", "深海基地の浸水", "通信途絶", "酸素残量わずか"]
  }
];

function pickRandom<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}
