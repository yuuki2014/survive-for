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
    - openingTextは400文字程度
    - openingTextは2〜3段落に分けてください。
    - 段落の区切りには改行を入れてください。
    - JSON文字列内では改行を \n として含めてください
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

    選択肢のルール:
    - 3つの選択肢は方向性を大きく変えてください
    - 1つ目は type: "safe"。状況を理解しながら目的へ進む、比較的まともな選択肢
    - 2つ目は type: "bold"。危険だが目的達成に大きく近づく選択肢
    - 3つ目は type: "chaos"。シリアスな状況に対して場違いなほどふざけた選択肢
    - chaosは、神を呼ぶ、歌う、変な儀式をする、敵に自己紹介する、謎のポーズを取るなど荒唐無稽でもよい
    - chaosは基本的にリスクを伴うが、まれに本当に突破口になってもよい
    - どの選択肢を選んでも、次ターンで明確なイベントが起きるようにしてください
    - 選択肢は短く、押したくなる内容にしてください

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
        "resource": 80,
        "safety": 80,
        "mental": 80
      },
      "items": ["string", "string", "string"],
      "choices": [
        { "text": "string", "type": "safe" },
        { "text": "string", "type": "bold" },
        { "text": "string", "type": "chaos" }
      ],
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
  // --- 生死が関わる現実サバイバル ---
  {
    id: "real_survival_forest_lost",
    name: "森で遭難",
    examples: ["深い森で道に迷う", "獣道に入り込む", "日没が迫る", "沢の音だけが聞こえる"]
  },
  {
    id: "real_survival_snow_mountain",
    name: "雪山遭難",
    examples: ["吹雪で視界ゼロ", "低体温の危機", "雪洞を掘る", "仲間とはぐれる"]
  },
  {
    id: "real_survival_desert",
    name: "砂漠遭難",
    examples: ["水が尽きかける", "蜃気楼を見る", "夜の寒さに襲われる", "砂嵐が近づく"]
  },
  {
    id: "real_survival_uninhabited_island",
    name: "無人島漂着",
    examples: ["救命ボートで流れ着く", "飲み水を探す", "狼煙を上げる", "満潮で浜が消える"]
  },
  {
    id: "real_survival_open_sea",
    name: "海上漂流",
    examples: ["救命ボートで漂う", "サメの影が見える", "雨水を集める", "遠くに船影が見える"]
  },
  {
    id: "real_survival_cave",
    name: "洞窟閉じ込め",
    examples: ["入口が崩落する", "水位が上がる", "ライトの電池が切れそう", "奥から風を感じる"]
  },
  {
    id: "real_survival_river_accident",
    name: "川の事故",
    examples: ["増水した川に取り残される", "橋が流される", "濁流が迫る", "対岸に人影が見える"]
  },
  {
    id: "real_survival_bear_encounter",
    name: "野生動物遭遇",
    examples: ["熊と遭遇する", "獣の足跡を見つける", "食料の匂いを嗅ぎつけられる", "夜に唸り声が聞こえる"]
  },
  {
    id: "real_survival_remote_car_breakdown",
    name: "山奥で車が故障",
    examples: ["圏外の山道", "ガソリンが残り少ない", "夜道に謎のライト", "車内で寒さに耐える"]
  },
  {
    id: "real_survival_abandoned_village",
    name: "廃村に迷い込む",
    examples: ["地図にない集落", "誰もいない家々", "古い防災無線が鳴る", "帰り道が消える"]
  },

  // --- 災害・事故 ---
  {
    id: "disaster_earthquake_building",
    name: "地震でビルに閉じ込め",
    examples: ["階段が崩れる", "エレベーターが停止", "非常灯だけが光る", "余震が続く"]
  },
  {
    id: "disaster_subway_collapse",
    name: "地下鉄崩落",
    examples: ["トンネルが崩れる", "車両に閉じ込められる", "暗闇で乗客が混乱", "遠くで水音がする"]
  },
  {
    id: "disaster_flooded_city",
    name: "浸水した街",
    examples: ["道路が川になる", "屋上に避難する", "濁流に車が流される", "救助ヘリの音がする"]
  },
  {
    id: "disaster_typhoon_shelter",
    name: "台風の避難所",
    examples: ["避難所の電気が消える", "窓が割れる", "物資が足りない", "外から助けを求める声"]
  },
  {
    id: "disaster_volcanic_ash_city",
    name: "火山灰に覆われた都市",
    examples: ["空が灰色になる", "交通が止まる", "マスクが足りない", "建物の屋根に灰が積もる"]
  },
  {
    id: "disaster_wildfire_escape",
    name: "山火事からの脱出",
    examples: ["煙で視界が悪い", "火の手が迫る", "道路が封鎖される", "風向きが変わる"]
  },
  {
    id: "disaster_train_accident",
    name: "列車事故",
    examples: ["山中で列車が停止", "車内が傾く", "乗客の一人が怪我", "通信が途絶える"]
  },
  {
    id: "disaster_tunnel_fire",
    name: "トンネル火災",
    examples: ["煙が充満する", "出口が見えない", "非常電話が壊れている", "別の車から人が逃げてくる"]
  },
  {
    id: "disaster_elevator_trapped",
    name: "エレベーター閉じ込め",
    examples: ["高層ビルで停止", "非常ボタンが反応しない", "酸素が薄く感じる", "壁の向こうから音がする"]
  },
  {
    id: "disaster_blackout_metropolis",
    name: "大都市ブラックアウト",
    examples: ["街全体が停電", "信号が消える", "コンビニに人が殺到", "地下街に閉じ込められる"]
  },

  // --- ゾンビ・感染・終末 ---
  {
    id: "zombie_mall",
    name: "ゾンビモール籠城",
    examples: ["シャッターを下ろす", "フードコートに物資", "館内放送が流れる", "ゾンビが階段を上がる"]
  },
  {
    id: "zombie_school_night",
    name: "夜の学校ゾンビ",
    examples: ["校舎に取り残される", "保健室に薬品", "体育館から呻き声", "屋上に救助ヘリ"]
  },
  {
    id: "zombie_convenience_store",
    name: "コンビニ籠城",
    examples: ["自動ドアが壊れる", "棚でバリケード", "バックヤードに通路", "外に感染者が集まる"]
  },
  {
    id: "zombie_hospital",
    name: "感染病棟脱出",
    examples: ["隔離病棟で目覚める", "防護服が落ちている", "ナースコールが鳴り続ける", "誰かがドアを叩く"]
  },
  {
    id: "zombie_train",
    name: "走行中ゾンビ列車",
    examples: ["車両ごとに感染が広がる", "運転席まで進む", "トンネルに突入", "非常停止ボタンを探す"]
  },
  {
    id: "zombie_rural_village",
    name: "感染した田舎町",
    examples: ["防災無線が壊れている", "田んぼ道を逃げる", "納屋に武器がある", "親切な老人が怪しい"]
  },
  {
    id: "zombie_evacuation_center",
    name: "崩壊寸前の避難所",
    examples: ["物資配給で揉める", "感染疑惑の人がいる", "門の外に群れ", "リーダーが隠し事をする"]
  },
  {
    id: "infection_unknown_fever",
    name: "未知の感染拡大",
    examples: ["街が封鎖される", "発熱者が増える", "薬局に人が殺到", "検問を突破するか迷う"]
  },

  // --- SF・宇宙・深海 ---
  {
    id: "space_ship_oxygen",
    name: "宇宙船の酸素低下",
    examples: ["酸素残量が少ない", "冷凍睡眠ポッドが故障", "船外に修理箇所", "AIが沈黙する"]
  },
  {
    id: "space_mars_base",
    name: "火星基地孤立",
    examples: ["通信が途絶える", "砂嵐でソーラーパネル停止", "温室が破損", "地下に謎の信号"]
  },
  {
    id: "space_ai_revolt",
    name: "宇宙船AI暴走",
    examples: ["AIが扉をロック", "酸素配分を操作", "嘘の避難経路を案内", "旧式端末だけが使える"]
  },
  {
    id: "space_alien_infestation",
    name: "宇宙船に異星生物",
    examples: ["通気口から音", "乗員が消える", "未知の粘液", "隔壁を閉じるか迷う"]
  },
  {
    id: "space_time_loop_station",
    name: "宇宙ステーション時間ループ",
    examples: ["同じ警報が繰り返す", "自分のメモを発見", "次の爆発まで数分", "別の自分が現れる"]
  },
  {
    id: "deep_sea_submarine",
    name: "深海潜水艦事故",
    examples: ["船体に亀裂", "酸素残量わずか", "外に発光生物", "母艦との通信が途絶える"]
  },
  {
    id: "deep_sea_research_base",
    name: "深海研究基地浸水",
    examples: ["隔壁が閉じる", "実験体が逃げる", "水圧で窓が軋む", "脱出ポッドが1つだけ"]
  },
  {
    id: "deep_sea_leviathan",
    name: "深海巨大生物",
    examples: ["ソナーに巨大な影", "ライトに反応する目", "基地が揺れる", "静かにしないと見つかる"]
  },

  // --- ポストアポカリプス ---
  {
    id: "post_apocalypse_ruined_city",
    name: "荒廃都市探索",
    examples: ["崩れた高層ビル", "略奪者の痕跡", "水の自販機", "遠くに煙"]
  },
  {
    id: "post_apocalypse_wasteland",
    name: "荒野の物資争奪",
    examples: ["水が通貨になる", "武装集団の検問", "砂嵐", "壊れたバイク"]
  },
  {
    id: "post_apocalypse_frozen_world",
    name: "凍った世界",
    examples: ["街が氷に覆われる", "暖房燃料が尽きる", "地下鉄跡に人々", "氷の下から音"]
  },
  {
    id: "post_apocalypse_plant_overgrowth",
    name: "植物に飲まれた都市",
    examples: ["ビルに巨大樹", "花粉で視界が悪い", "植物が動く", "地下に研究施設"]
  },
  {
    id: "post_apocalypse_robot_patrol",
    name: "無人兵器の街",
    examples: ["ドローンが巡回", "顔認証が作動", "廃墟の中に反乱軍", "EMP装置を探す"]
  },
  {
    id: "post_apocalypse_economic_collapse",
    name: "経済崩壊後の街",
    examples: ["紙幣が無価値", "食料配給所に行列", "自治組織が支配", "倉庫の鍵を巡る交渉"]
  },
  {
    id: "post_apocalypse_disappearance",
    name: "人類消失後の朝",
    examples: ["街から人だけが消える", "スマホに予約投稿だけ届く", "無人電車が走る", "ペットだけが残る"]
  },

  // --- 怪獣・巨大生物 ---
  {
    id: "kaiju_city_rooftop",
    name: "怪獣襲来の屋上",
    examples: ["ビル屋上に孤立", "怪獣の足音", "ヘリが近づく", "非常階段が崩れる"]
  },
  {
    id: "kaiju_subway_shelter",
    name: "怪獣地下避難",
    examples: ["地下シェルターへ逃げる", "地上から轟音", "壁に亀裂", "子どもが泣き出す"]
  },
  {
    id: "giant_insect_swarm",
    name: "巨大昆虫の群れ",
    examples: ["羽音が空を覆う", "明かりに集まる", "倉庫に殺虫剤", "地下道に逃げる"]
  },
  {
    id: "giant_bird_hunt",
    name: "巨大鳥に狙われる",
    examples: ["空から影", "屋根を突き破る嘴", "光るものに反応", "地下駐車場へ逃げる"]
  },
  {
    id: "kaiju_train_escape",
    name: "怪獣から逃げる電車",
    examples: ["線路が破壊される", "運転士が気絶", "乗客がパニック", "怪獣が並走する"]
  },

  // --- 脱出・施設 ---
  {
    id: "escape_locked_lab",
    name: "閉鎖研究所",
    examples: ["実験室で目覚める", "警報が鳴る", "IDカードが必要", "培養槽が割れる"]
  },
  {
    id: "escape_water_lab",
    name: "水没研究所",
    examples: ["水位が上がる", "防水扉が閉まる", "資料室に鍵", "水中から影"]
  },
  {
    id: "escape_prison",
    name: "監獄脱出",
    examples: ["看守の巡回", "隣の囚人が話しかける", "古い排水路", "脱獄計画のメモ"]
  },
  {
    id: "escape_game_deadly",
    name: "命がけの脱出ゲーム",
    examples: ["謎解き部屋", "制限時間の表示", "参加者同士の疑心暗鬼", "司会者の声"]
  },
  {
    id: "escape_closed_station",
    name: "閉鎖駅",
    examples: ["終電後の駅", "改札が開かない", "ホームに謎の影", "案内放送が逆再生"]
  },
  {
    id: "escape_underground_mall",
    name: "地下街迷宮",
    examples: ["シャッターが全部閉まる", "同じ店に戻る", "防災センターを探す", "非常放送が嘘を言う"]
  },

  // --- ホラー・怪異 ---
  {
    id: "horror_abandoned_hospital",
    name: "廃病院の夜",
    examples: ["ナースコールが鳴る", "手術室の明かり", "カルテに自分の名前", "車椅子が動く"]
  },
  {
    id: "horror_old_mansion",
    name: "古い洋館",
    examples: ["肖像画の目が動く", "部屋の配置が変わる", "地下室に鍵", "誰かがピアノを弾く"]
  },
  {
    id: "horror_night_school",
    name: "夜の学校",
    examples: ["放送室から声", "理科室の標本", "廊下が伸びる", "先生の影が歩く"]
  },
  {
    id: "horror_doll_room",
    name: "人形の部屋",
    examples: ["人形の向きが変わる", "箱の中に鍵", "笑い声", "自分そっくりの人形"]
  },
  {
    id: "horror_cursed_video",
    name: "呪いの配信",
    examples: ["視聴者数が増え続ける", "コメントが未来を予言", "画面の奥に何かいる", "配信を切れない"]
  },
  {
    id: "horror_elevator_13th",
    name: "存在しない13階",
    examples: ["ボタンにない階へ止まる", "廊下が無限に続く", "住人が全員同じ顔", "非常口が消える"]
  },

  // --- 異世界・ファンタジー ---
  {
    id: "fantasy_magic_forest",
    name: "魔物の森",
    examples: ["木々が道を塞ぐ", "精霊が話しかける", "魔物の足跡", "泉に星が映る"]
  },
  {
    id: "fantasy_dungeon_collapse",
    name: "崩落ダンジョン",
    examples: ["天井が崩れる", "罠が起動", "古代文字", "宝箱が喋る"]
  },
  {
    id: "fantasy_cursed_village",
    name: "呪われた村",
    examples: ["村人が同じ言葉を繰り返す", "鐘が鳴ると姿が変わる", "井戸から声", "旅人が消える"]
  },
  {
    id: "fantasy_dragon_cave",
    name: "竜の巣穴",
    examples: ["熱気が迫る", "鱗が落ちている", "卵を守る親竜", "盗賊が隠れている"]
  },
  {
    id: "fantasy_castle_siege",
    name: "魔王城包囲戦",
    examples: ["城門が閉じる", "魔族兵が巡回", "捕らわれた王女", "裏切り者がいる"]
  },
  {
    id: "fantasy_summoned_wrong",
    name: "異世界召喚ミス",
    examples: ["勇者ではなく荷物係として召喚", "王様が焦る", "魔法陣が壊れる", "帰還呪文が足りない"]
  },
  {
    id: "fantasy_god_trial",
    name: "神の試練",
    examples: ["白い空間で目覚める", "神が雑に説明する", "選択肢が変", "失敗すると別世界へ落ちる"]
  },

  // --- 地獄・死神・超常 ---
  {
    id: "afterlife_hell_escape",
    name: "地獄からの脱出",
    examples: ["地獄で目覚める", "鬼の受付に並ぶ", "生前の記録が間違っている", "逃げれば死をやり直せる"]
  },
  {
    id: "afterlife_death_reaper",
    name: "死神に憑かれる",
    examples: ["背後に死神がいる", "寿命カウントが見える", "他人に見えない", "死神が妙に親切"]
  },
  {
    id: "afterlife_judgement_court",
    name: "死後裁判",
    examples: ["閻魔の法廷", "弁護士が悪魔", "証人が昔のペット", "判決前に逃げ道"]
  },
  {
    id: "supernatural_time_until_death",
    name: "死の予告時計",
    examples: ["腕に残り時間が表示", "時間を増やす方法を探す", "他人の時計が見える", "時計が嘘をつく"]
  },
  {
    id: "supernatural_body_shadow",
    name: "影に追われる",
    examples: ["自分の影が遅れて動く", "明かりが消えると近づく", "影が他人を真似る", "日没までに逃げる"]
  },

  // --- 学校・通勤・日常系の極限 ---
  {
    id: "daily_late_school_route",
    name: "遅刻寸前の通学路",
    examples: ["始業まで残り10分", "踏切が開かない", "先生が校門にいる", "近道が工事中"]
  },
  {
    id: "daily_exam_no_study",
    name: "ノー勉試験当日",
    examples: ["試験開始まで5分", "友人のノートが読めない", "先生が監視", "謎の山勘が降りてくる"]
  },
  {
    id: "daily_train_last",
    name: "終電を逃せない夜",
    examples: ["乗換時間が1分", "改札で詰まる", "酔客が絡む", "ホームが変更される"]
  },
  {
    id: "daily_lost_child_event",
    name: "イベント会場で迷子対応",
    examples: ["人混みで子どもが泣く", "アナウンスが聞こえない", "スタッフが見つからない", "不審者っぽい人がいる"]
  },
  {
    id: "daily_first_date_disaster",
    name: "初デート大事故",
    examples: ["予約店が閉まっている", "雨が降る", "財布を忘れる", "元恋人と遭遇"]
  },
  {
    id: "daily_wedding_speech",
    name: "結婚式スピーチ直前",
    examples: ["原稿をなくす", "新郎新婦の名前を間違えそう", "マイクが壊れる", "親族がざわつく"]
  },
  {
    id: "daily_toilet_emergency",
    name: "トイレ限界の街中",
    examples: ["どこも満室", "スマホ電池切れ", "コンビニが改装中", "知り合いに呼び止められる"]
  },

  // --- 仕事・社会的修羅場 ---
  {
    id: "work_boss_angry",
    name: "部長に激怒されている",
    examples: ["会議室で詰められる", "資料ミスが発覚", "取引先もいる", "隣の同僚が目を逸らす"]
  },
  {
    id: "work_big_presentation_crisis",
    name: "大事なプレゼン直前",
    examples: ["スライドが消える", "プロジェクターが映らない", "社長が早めに来る", "数字が間違っている"]
  },
  {
    id: "work_production_bug",
    name: "本番障害対応",
    examples: ["深夜にアラート", "ログが読めない", "上司から電話", "ユーザーがSNSで騒ぐ"]
  },
  {
    id: "work_customer_claim",
    name: "クレーム対応地獄",
    examples: ["怒鳴る顧客", "責任者不在", "防犯カメラに証拠", "別の客も集まる"]
  },
  {
    id: "work_layoff_interview",
    name: "突然の退職勧告面談",
    examples: ["人事が2人いる", "録音されている気配", "同意書が出る", "逆転材料を探す"]
  },
  {
    id: "work_remote_meeting_mic_on",
    name: "リモート会議マイク事故",
    examples: ["悪口が聞こえたかも", "画面共有に私物", "猫が乱入", "役員が無言になる"]
  },
  {
    id: "work_restaurant_baito_terror",
    name: "バイトテロされた店長",
    examples: ["動画が拡散", "予約キャンセル殺到", "本部から電話", "厨房に泣くバイト"]
  },
  {
    id: "work_influencer_pr_fire",
    name: "案件投稿が炎上",
    examples: ["企業案件が叩かれる", "過去投稿を掘られる", "スポンサーが連絡", "謝罪文を出すか迷う"]
  },

  // --- ネット・炎上・現代社会 ---
  {
    id: "internet_flamewar",
    name: "ネット炎上",
    examples: ["切り抜きが拡散", "通知が止まらない", "知らない人が家を特定し始める", "謝罪か沈黙か"]
  },
  {
    id: "internet_account_hacked",
    name: "アカウント乗っ取り",
    examples: ["勝手に投稿される", "二段階認証が通らない", "DMで詐欺が送られる", "友人から連絡"]
  },
  {
    id: "internet_streaming_disaster",
    name: "生配信事故",
    examples: ["配信を切り忘れる", "コメント欄が荒れる", "背後に映ってはいけないもの", "切り抜き職人が現れる"]
  },
  {
    id: "internet_leaked_dm",
    name: "DM流出",
    examples: ["スクショが出回る", "文脈が切り取られる", "相手が沈黙", "釈明文を考える"]
  },
  {
    id: "internet_cancelled_creator",
    name: "創作者炎上",
    examples: ["作品の一部が問題視", "ファンが割れる", "編集者から電話", "謝罪するほど燃える"]
  },
  {
    id: "internet_ai_deepfake",
    name: "AI偽動画騒動",
    examples: ["自分そっくりの動画", "職場に問い合わせ", "証明方法を探す", "投稿者が消える"]
  },

  // --- 恋愛・人間関係修羅場 ---
  {
    id: "relationship_affair_scene",
    name: "不倫現場鉢合わせ",
    examples: ["ホテルのロビーで遭遇", "スマホ通知が鳴る", "相手の配偶者が来る", "逃げ道がない"]
  },
  {
    id: "relationship_double_booking_date",
    name: "デート二重予約",
    examples: ["同じ店に2人が来る", "店員が名前を呼ぶ", "LINE通知が見える", "トイレで作戦会議"]
  },
  {
    id: "relationship_proposal_failed",
    name: "プロポーズ失敗危機",
    examples: ["指輪をなくす", "相手の親が来る", "予約席がない", "元恋人が同じ店にいる"]
  },
  {
    id: "relationship_family_meeting",
    name: "結婚挨拶修羅場",
    examples: ["父親が無言", "学歴や年収を聞かれる", "料理をこぼす", "昔の写真を見られる"]
  },
  {
    id: "relationship_group_line_mistake",
    name: "誤爆LINE",
    examples: ["本人がいるグループに送る", "既読が一斉につく", "送信取り消しが間に合わない", "誰かがスクショ"]
  },

  // --- 犯罪・スリラー風 ---
  {
    id: "thriller_witness_chase",
    name: "事件の目撃者",
    examples: ["路地裏で現場を見る", "犯人と目が合う", "スマホの電池が少ない", "交番まで遠い"]
  },
  {
    id: "thriller_locked_room_suspect",
    name: "密室事件の容疑者",
    examples: ["目覚めたら隣に倒れた人", "記憶がない", "警察が来る", "真犯人のメモ"]
  },
  {
    id: "thriller_stalker_escape",
    name: "ストーカーから逃げる",
    examples: ["同じ人が駅にいる", "家の前に花束", "防犯カメラが壊れる", "友人が電話に出ない"]
  },
  {
    id: "thriller_mysterious_package",
    name: "謎の荷物が届く",
    examples: ["差出人不明", "中で何かが動く", "開封期限のメモ", "配達員が存在しない"]
  },

  // --- 歴史・戦場・時代物 ---
  {
    id: "history_castle_battle",
    name: "落城寸前の城",
    examples: ["敵が城門を破る", "密書を届ける", "裏切り者がいる", "抜け穴が塞がる"]
  },
  {
    id: "history_sengoku_escape",
    name: "戦国の敗走",
    examples: ["主君とはぐれる", "追手が迫る", "農村に隠れる", "馬が疲れる"]
  },
  {
    id: "history_pirate_ship",
    name: "海賊船から脱出",
    examples: ["船倉に閉じ込められる", "嵐が来る", "船長が疑う", "宝の地図を持っている"]
  },
  {
    id: "history_plague_town",
    name: "疫病の町から脱出",
    examples: ["門が封鎖", "医者が消える", "薬草商が怪しい", "鐘が鳴り続ける"]
  },

  // --- 変則・コメディ混じり極限 ---
  {
    id: "weird_god_customer_service",
    name: "神様クレーム窓口",
    examples: ["世界のバグを神に報告", "受付番号が無限", "天使が新人", "祈りの内容が漏洩"]
  },
  {
    id: "weird_demon_part_time",
    name: "魔王城バイト初日",
    examples: ["勇者が来店", "レジが呪われる", "先輩悪魔が逃げる", "クレーム対応で世界が危ない"]
  },
  {
    id: "weird_living_convenience_store",
    name: "生きているコンビニ",
    examples: ["棚が移動する", "おにぎりが話す", "レジが試練を出す", "出口がセール会場になる"]
  },
  {
    id: "weird_last_ramen",
    name: "終末のラーメン屋",
    examples: ["最後の一杯を巡る争い", "店主が仙人", "スープが世界を救う", "怪物も並んでいる"]
  },
  {
    id: "weird_haunted_office",
    name: "幽霊だらけの残業",
    examples: ["終電後のオフィス", "退勤打刻ができない", "上司の幽霊がレビュー", "コピー機が予言を出す"]
  },
  {
    id: "weird_death_game_variety_show",
    name: "命がけバラエティ番組",
    examples: ["司会者が陽気", "罰ゲームが本物", "観客の拍手で床が開く", "スポンサーが魔族"]
  },
  {
    id: "weird_court_of_animals",
    name: "動物裁判",
    examples: ["森の動物に裁かれる", "弁護士がタヌキ", "証拠がどんぐり", "判決は追放か共存"]
  },
  {
    id: "weird_sentient_smartphone",
    name: "スマホが自我を持つ",
    examples: ["勝手に通知を送る", "充電しないと脅す", "位置情報を隠す", "AIアシスタントが裏切る"]
  },
  {
    id: "weird_bus_to_afterlife",
    name: "あの世行き深夜バス",
    examples: ["降車ボタンがない", "乗客が全員無言", "運転手が骸骨", "途中下車すれば生還"]
  },
  {
    id: "weird_reverse_hero_summon",
    name: "勇者が現代に召喚される",
    examples: ["部屋に勇者が落ちてくる", "魔王も追ってくる", "コンビニで装備を整える", "家賃の支払いが迫る"]
  }
];

function pickRandom<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}
