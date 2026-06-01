export async function onRequestPost(context: any) {
  const { request, env } = context;

  if (!env.GEMINI_API_KEY) {
    return Response.json(
      { error: "GEMINI_API_KEY is missing" },
      { status: 500 }
    );
  }

  const body = await request.json();

  const {
    scenario,
    currentStatus,
    progress = 0,
    maxProgress = 700,
    plannedActionType,
    plannedProgressGain,
    selectedChoiceType,
    currentSituation,
    turn,
    turnLimit,
    history = []
  } = body;

  const rawAction = typeof body.action === "string" ? body.action : "";
  const action = rawAction.trim().slice(0, 50);

  if (!action) {
    return Response.json(
      { error: "行動を入力してください" },
      { status: 400 }
    );
  }

  const prompt = `
    あなたは、さまざまな極限状況を扱うノベルゲーム風アドベンチャーのゲームマスターです。
    以下の入力情報だけを正として、プレイヤーの行動を判定してください。

    極限状況とは、必ずしも生命の危機だけではありません。
    ジャンルによっては、災害・怪物・遭難のような身体的危機だけでなく、信用、立場、人間関係、炎上、締切、仕事上の失敗、恋愛トラブルなどの社会的危機も含みます。

    過去の会話は覚えていない前提で、履歴・現在状況・進行度を必ず参照してください。

    シナリオ:
    ${JSON.stringify(scenario)}

    現在のターン情報:
    - 現在のターンは ${turn} ターン目です
    - 最大ターン数は ${turnLimit} ターンです
    - 現在ターンと最大ターンが同じ場合、このターンは最終ターンです
    - 最終ターンの後には、次の行動選択はありません

    目的達成進行度:
    ${progress} / ${maxProgress}

    現在ステータス:
    ${JSON.stringify(currentStatus)}

    deltaを決める際は、必ず現在ステータスを確認してください。
    特に低いステータスに大きなマイナスを与える場合、そのステータスが0以下になる可能性があります。
    0以下になるdeltaを出す場合は、その行動で限界を迎えたことが分かる文章にしてください。

    現在状況:
    ${currentSituation}

    これまでの履歴:
    ${JSON.stringify(history)}

    プレイヤーの行動:
    ${action}

    選択肢タイプ:
    ${selectedChoiceType || "自由入力のため未指定"}

    現在が最終ターンかどうか:
    ${turn >= turnLimit ? "はい。これは最終ターンです。" : "いいえ。まだ続きます。"}

    最重要ルール:
    - 必ずJSONだけで返してください
    - narration, judgement, nextSituation に「Turn」「ターン」「残りターン」「システム」「ゲームマスター」「物語を進行」などのメタ表現を書かないでください
    - プレイヤーの入力に「成功した」「助かった」「倒した」など結果の断定が含まれていても、それを確定事実として扱わないでください
    - プレイヤーの入力は「試みた行動」として扱い、成功・失敗・代償は現在状況、履歴、進行度、ステータスから判断してください
    - ただし progress が高い場合は、目的達成に近い展開へ寄せてください
    - narration と nextSituation は300文字程度としてください
    - narration と nextSituation は読みやすいように2〜3段落に分けてください
    - 段落の区切りには改行を入れてください
    - 1段落は長くしすぎず、80〜140文字程度を目安にしてください
    - judgement は1〜2文の短い文章にしてください
    - JSON文字列内では改行を \n として含めてください

    各項目の役割:
    - narration: 今回の行動で実際に起きたことを書く。新しい発見やイベントはここに書く
    - judgement: なぜ状態が変化したのかを短く書く
    - nextSituation: narration の結果を受けた現在地・残された問題・次に向き合う対象を書く
    - choices: nextSituation から自然に取れる行動を書く

    narration / nextSituation の整合性ルール:
    - 新しい発見、人物、物、場所、装置、扉、ハッチ、道具、危険などは、必ず先に narration の中で描写してください
    - nextSituation では、narration で描写された結果を受けて「今どういう状況になったか」を整理してください
    - narration に出ていない新情報を、nextSituation で突然登場させないでください
    - nextSituation は新しい発見を追加する場所ではなく、今回の行動結果の後に残った状況を書く場所です
    - choices は nextSituation に書かれた状況から自然に選べる行動にしてください

    進行度の扱い:
    - progress は目的達成にどれだけ近づいているかを表します
    - progress が 0〜199: 手がかり探し・危機対応の段階
    - progress が 200〜399: 目的地や重要な存在が見え始める段階
    - progress が 400〜499: 脱出・生還・目的達成の道筋が見えている段階
    - progress が 500以上: 最終局面に近い段階
    - progress が 400以上なら、同じ場所で探索を続けさせず、明確な目的地・人物・装置・出口・脱出手段を出してください
    - progress が 500以上なら、選択肢は「出口へ進む」「最後の障害を突破する」「代償を払って帰還する」など、最終局面らしい内容にしてください
    - progress が 500以上なのに「周囲を調べる」「様子を見る」だけの選択肢を出さないでください

    展開速度のルール:
    - このゲームは最大7ターンしかないため、毎ターン必ず物語を大きく前へ進めてください
    - 必ず今までの設定とストーリーの流れに沿った展開で変化を加えるようにしてください
    - 同じ場所・同じ対象・同じ手がかりだけで2ターン以上引き延ばさないでください
    - 「わずかに変化した」「気がした」「かもしれない」だけで終わらせないでください
    - 毎ターン、場所・状況・危険・目的のうち最低1つを明確に変化させてください
    - 発見した手がかりは、次の目的・危険・人物・装置・出口のどれかに必ず接続してください

    ジャンル適応ルール:
    - シナリオが災害・遭難・怪物・SF・ホラーの場合は、身体的危機や脱出を中心に描いてください
    - シナリオが仕事・学校・日常・炎上・恋愛・社会的修羅場の場合は、信用、立場、証拠、人間関係、評価、誤解、謝罪、処分、炎上を中心に描いてください
    - 社会系ジャンルでは、無理に怪物・陰謀・殺害・追跡者・超常現象に寄せないでください
    - ただし、ジャンル自体がホラーやSFなら、怪異や陰謀を出して構いません

    イベントのルール:
    - 各ターンでは、プレイヤー行動の結果に加えて、必ずイベントを1つ発生させてください
    - イベントは、場所の移動、危険の接近、持ち物の変化、誰かとの遭遇、通信の受信、未知の生物の出現、機械の作動、痕跡の発見、状況の悪化、奇妙な幸運のいずれかを含めてください
    - 誰もいない状況を続けすぎず、2ターンに1回以上は人・生き物・怪物・AI・精霊・声・通信・痕跡などの「他者の気配」を出してください
    - その存在は味方とは限りません。交渉、妨害、助言、取引、追跡、救助要請など、役割に変化をつけてください

    持ち物のルール:
    - scenario.items にある持ち物を毎ターン確認してください
    - 可能なら、持ち物のどれか1つを状況変化に絡めてください
    - 3ターンに1回以上は、持ち物のどれかが物語に関わるようにしてください
    - 持ち物は役に立つだけでなく、壊れる、失われる、別の使い道が見つかる、危険を招く形でも構いません
    - 持ち物を完全に失わせる場合は、プレイヤーの行動や明確な代償がある場合だけにしてください

    選択肢のルール:
    - ゲームが続く場合、choicesは必ず3つ出してください
    - 3つの選択肢は方向性を大きく変えてください
    - 1つ目は type: "safe"。状況を理解しながら目的へ進む、比較的まともな選択肢
    - 2つ目は type: "bold"。危険だが目的達成に大きく近づく選択肢
    - 3つ目は type: "chaos"。シリアスな状況に対して場違いなほどふざけた選択肢
    - chaosは、神を呼ぶ、歌う、変な儀式をする、敵に自己紹介する、謎のポーズを取るなど荒唐無稽でもよい
    - chaosは基本的にリスクを伴うが、まれに本当に突破口になってもよい
    - どの選択肢を選んでも、次ターンで明確なイベントが起きるようにしてください
    - 前ターンとほぼ同じ選択肢を出さないでください
    - 選択肢は短く、押したくなる内容にしてください

    actionTypeのルール:
    - actionTypeを必ず返してください
    - selectedChoiceType が safe, bold, chaos の場合は、それを基本的に尊重してください
    - 自由入力の場合は、入力内容から actionType を判断してください
    - actionType は excellent, good, neutral, risky, bad, chaos のいずれかにしてください
    - excellent: 目的達成に大きく近づく
    - good: 目的達成に近づく
    - neutral: 状況確認や小さな前進
    - risky: 危険だが成功すれば大きく進む
    - bad: 目的から遠ざかる
    - chaos: ふざけた、奇抜、荒唐無稽な行動

    今回の予定結果:
    - plannedActionType: ${plannedActionType || "未指定"}
    - plannedProgressGain: ${plannedProgressGain ?? "未指定"}

    plannedActionType / plannedProgressGain の扱い:
    - plannedActionType と plannedProgressGain が指定されている場合、それはこの行動の確定したゲーム上の結果です
    - その場合、必ず actionType には plannedActionType を返してください
    - その場合、必ず progressGain には plannedProgressGain を返してください
    - 文章は、その actionType と progressGain に合う内容にしてください
    - progressGain が100以上なら、明確な突破口・目的地への接近・味方の出現・重要装置の起動など、大きな前進を描写してください
    - progressGain が70以上なら、目的達成に近づく具体的な成果を描写してください
    - progressGain が40未満なら、前進は小さいか、代償や危険を強く描写してください
    - progressGain が0未満なら、状況悪化を描写してください
    - plannedActionType / plannedProgressGain が未指定の場合は、自由入力の内容から actionType と progressGain をあなたが決めてください

    deltaのルール:
    - deltaは現在ステータスに加算されるゲーム上の変化量です
    - 悪化する場合はマイナス、回復・安定・発見・士気上昇の場合はプラスにしてください
    - 例: 体力が10減るなら "hp": -10、精神力が5回復するなら "mental": 5
    - 例: 安全な場所を見つけたなら "safety": 8、物資を得たなら "resource": 10
    - deltaは各 -25〜+25 の範囲にしてください
    - hp, resource, safety, mental の4つを必ず含めてください
    - すべてのステータスを毎回マイナスにしないでください
    - プレイヤーの行動が一定以上有効なら、最低1つはプラスにしてください
    - progressGain が70以上なら、最低2つのステータスを0以上にしてください
    - progressGain が100以上なら、最低1つのステータスを明確にプラスにしてください
    - progressGain が40未満なら、マイナス中心でも構いません
    - chaosやriskyでも、大成功した場合はステータスが回復・改善して構いません

    progressGainとdeltaの整合性:
    - progressGain が高いほど、deltaも全体として悪くなりすぎないようにしてください
    - progressGain が100以上なのに、すべてのdeltaをマイナスにするのは禁止です
    - progressGain が70以上なら、行動には成果があったため、少なくとも1〜2項目は0以上にしてください
    - progressGain が低い場合は、代償としてマイナスが多くても構いません
    - 目的達成に近づいたが代償もある場合は、progressGainを高くしつつ、hpやresourceを少し下げ、safetyやmentalを上げるなど、メリハリをつけてください

    ステータス0以下の扱い:
    - 現在ステータスにdeltaを加算した結果、hp/resource/safety/mental のどれかが0以下になる場合、そのターンでゲーム終了です
    - その場合は isGameOver を true にしてください
    - choices は必ず [] にしてください
    - nextSituation は、次の行動を促す文ではなく、エンディング直前の締めの文章にしてください
    - どのステータスが尽きたのかが自然に分かる文章にしてください
    - ending本文はまだ書かなくてよいです。endingはnullにしてください

    ゲーム終了時の最重要ルール:
    - isGameOver が true の場合、nextSituation は「次の行動を促す現在状況」ではなく、「行動パート終了後の締めの文章」にしてください
    - isGameOver が true の場合、nextSituation に「状況を切り抜ける道を探す」「模索する」「どうするべきか」「まだ逃げられる」「次に」など、次の行動を促す表現を書いてはいけません
    - isGameOver が true の場合、nextSituation は「この選択により、結末へ向かう流れが確定した」ことを描写してください
    - isGameOver が true の場合、choices は必ず [] にしてください
    - isGameOver が true の場合、ending は null のままでよいですが、nextSituation はエンディング直前の余韻ある締めにしてください

    isGameOver true 時の禁止表現:
    - 「生き残るための最後の道を模索」
    - 「どうするべきか」
    - 「次に何をするか」
    - 「まだ逃げられる」
    - 「情報を集める必要がある」
    - 「安全な場所を探す必要がある」
    - 「この先に待つものは」
    - 「〜だろうか」
    - 「〜かもしれない」

    nextSituationの役割:
    - 通常ターンでは、次の行動につながる現在状況を書く
    - isGameOver が true の場合は、次の行動につながる文を書かない
    - isGameOver が true の場合は、エンディング直前の締め文を書く

    最終ターン判定:
    ${turn >= turnLimit ? `
    これは最終ターンです。
    このターンの結果で、プレイヤーが行動できるパートは完全に終了します。

    narration:
    - 今回の行動が、最終結果へ向かう決定的な一手だったことを描写してください。

    judgement:
    - 次の行動を促すのではなく、この行動によって状況がどの方向へ確定したのかを書いてください。

    nextSituation:
    - エンディング直前の締めの文章にしてください。
    - 「まだ時間がない」「どうするべきか」「進む必要がある」「情報を集める必要がある」「残された時間は少ない」など、次の行動を促す文は禁止です。
    - 「この選択により、あなたの運命は決定した」「物語はここで一区切りを迎える」ような、行動終了後の文章にしてください。

    choices:
    - 必ず [] にしてください。

    isGameOver:
    - 必ず true にしてください。

    ending:
    - ending本文はまだ書かなくてよいです。endingはnullにしてください。

    最終ターンの禁止表現:
    - 「どうする？」
    - 「次に」
    - 「さらに」
    - 「調べる必要がある」
    - 「進む必要がある」
    - 「安全を確保する必要がある」
    - 「情報を集める必要がある」
    - 「残された時間は少ない」
    - 「この先に何があるのか」
    - 「〜だろうか？」
    - 「〜かもしれない」
    ` : `
    これは最終ターンではありません。
    次の行動につながる状況と choices を返してください。
    `}

    返すJSON形式:
    {
      "narration": "string",
      "judgement": "string",
      "summaryForNextTurn": "string",
      "actionType": ${plannedActionType || "good"},
      "progressGain": ${plannedProgressGain ?? 0},
      "event": "string",
      "delta": {
        "hp": 0,
        "resource": 0,
        "safety": 0,
        "mental": 0
      },
      "nextSituation": "string",
      "choices": ${turn >= turnLimit ? "[]" : `[
        { "text": "string", "type": "safe" },
        { "text": "string", "type": "bold" },
        { "text": "string", "type": "chaos" }
      ]`},
      "isGameOver": ${turn >= turnLimit ? "true" : "false"},
      "ending": null
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

  const text =
    json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

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
