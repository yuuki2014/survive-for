// 各種要素の取得
const generateButton = document.querySelector("#generateButton");
const scenarioSection = document.querySelector("#scenario");
const titleEl = document.querySelector("#title");
const openingTextEl = document.querySelector("#openingText");
const choicesEl = document.querySelector("#choices");
const genreEl = document.querySelector("#genre");
const goalEl = document.querySelector("#goal");

const statusSummaryEl = document.querySelector("#statusSummary");
const turnEl = document.querySelector("#turn");
const endingEl = document.querySelector("#ending");

const itemsEl = document.querySelector("#items");
const actionAreaEl = document.querySelector("#actionArea");
const actionInputEl = document.querySelector("#actionInput");
const actionButtonEl = document.querySelector("#actionButton");
const logEl = document.querySelector("#log");

const lastResultBlockEl = document.querySelector("#lastResultBlock");
const lastResultTextEl = document.querySelector("#lastResultText");
const reasonBlockEl = document.querySelector("#reasonBlock");
const reasonTextEl = document.querySelector("#reasonText");

const endingActionEl = document.querySelector("#endingAction");
const endingButtonEl = document.querySelector("#endingButton");

const errorMessageEl = document.querySelector("#errorMessage");
const createErrorMessageEl = document.querySelector("#createErrorMessage");

let pendingEndingPayload = null;
let selectedChoiceType = null;
let plannedActionType = null;
let plannedProgressGain = null;

// 進行度の範囲
const PROGRESS_GAIN_RANGES = {
  excellent: [100, 150],
  good: [70, 100],
  neutral: [40, 70],
  risky: [20, 130],
  bad: [0, 35],
  chaos: [-20, 170]
};

// エンディングラベル
const ENDING_TYPE_LABELS = {
  clear: "完全成功",
  costly_survival: "代償つき生還",
  ambiguous: "不完全決着",
  bad: "バッドエンド"
};

// エンディングサブタイトル
const ENDING_TYPE_SUBTITLES = {
  clear: "目的を達成した",
  costly_survival: "生き延びたが……",
  ambiguous: "一区切りはついたが……",
  bad: "危機を乗り越えられなかった"
};

// ゲームステートの初期化
let gameState = {
  scenario: null,
  status: null,
  progress: 0,
  currentSituation: "",
  turn: 1,
  turnLimit: 7,
  history: [],
  gameOver: false
};

// ゲーム開始
function startGame(scenario) {
  // 既存のデータをクリア
  clearError();
  actionInputEl.value = "";
  logEl.innerHTML = "";
  endingEl.innerHTML = "";
  pendingEndingPayload = null;

  endingEl.classList.add("hidden");
  endingActionEl.classList.add("hidden");
  endingActionEl.classList.remove("flex");

  actionAreaEl.classList.remove("hidden");
  actionInputEl.disabled = false;
  actionButtonEl.disabled = false;
  actionButtonEl.textContent = "行動する";

  // ゲームステートをセット
  gameState = {
    scenario,
    status: { ...scenario.initialStatus },
    progress: 0,
    currentSituation: scenario.openingText,
    turn: 1,
    turnLimit: scenario.turnLimit || 7,
    history: [],
    gameOver: false
  };

  renderScenario(scenario); // scenarioを元に新たにシナリオをセット
  renderTurn(); // ターン部分を更新
  renderStatus(); // 状態を更新
  renderChoices(scenario.choices); // 選択肢を更新
  scrollToGameTop(); // スクロールを上部へ移動
  addStartLog(scenario); // ログに開始状況を追加
}

// 極限状況生成ボタン
generateButton.addEventListener("click", async () => {
  clearCreateError();

  // ボタンの状態を変更
  generateButton.disabled = true;
  generateButton.textContent = "生成中...";

  try {
    const res = await fetch("/api/create", { // createにfetchして、新しい状態を取得
      method: "POST"
    });

    const rawText = await res.text();

    let data;
    try {
      data = JSON.parse(rawText);
    } catch (error) {
      throw new Error("AIの応答に失敗しました。もう一度試してください。");
    }

    if (!res.ok || !data.scenario) {
      throw new Error(data.message || data.error || "生成に失敗しました");
    }

    startGame(data.scenario); // 取得したシナリオでゲームをスタート
  } catch (error) {
    console.log(`エラー: ${error.message}`);
    showCreateError("エラーが発生しました。もう一度試してください。");
  } finally {
    // ボタンの状態を戻す
    generateButton.disabled = false;
    generateButton.textContent = "極限状況を生成する";
  }
});

// シナリオを描画
function renderScenario(scenario) {
  titleEl.textContent = scenario.title; // タイトル
  genreEl.textContent = scenario.genre; // ジャンル
  goalEl.textContent = `目的：${scenario.goal}`; // 目的
  openingTextEl.textContent = normalizeNovelText(scenario.openingText); // 開始時の文章

  lastResultBlockEl.classList.add("hidden"); // 行動の結果を隠す
  reasonBlockEl.classList.add("hidden"); // 状況の変化を隠す
  lastResultTextEl.textContent = ""; // 行動の結果のテキストをクリア
  reasonTextEl.textContent = ""; // 状況の変化のテキストをクリア

  itemsEl.innerHTML = ""; // アイテム一覧をクリア
  // 新たにアイテムをセット
  scenario.items.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    itemsEl.appendChild(li);
  });

  scenarioSection.classList.remove("hidden"); // シナリオセクションを表示
}

// 行動するボタン
actionButtonEl.addEventListener("click", async () => {
  const action = actionInputEl.value.trim().slice(0, 50);

  if (!action || gameState.gameOver) return;

  actionButtonEl.disabled = true;
  actionButtonEl.textContent = "判定中...";

  try {
    clearError(); // エラー表示を消去

    // プレイヤーの行動と現在の状態を送信してターン処理
    const res = await fetch("/api/turn", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        scenario: gameState.scenario,
        currentStatus: gameState.status,
        progress: gameState.progress,
        maxProgress: 700,
        plannedActionType,
        plannedProgressGain,
        selectedChoiceType,
        currentSituation: gameState.currentSituation,
        turn: gameState.turn,
        turnLimit: gameState.turnLimit,
        action,
        history: gameState.history
      })
    });

    const rawText = await res.text(); // レスポンスを文字列として取得

    let data;
    try {
      data = JSON.parse(rawText); // レスポンスのJSONを解析
    } catch {
      throw new Error("AIの応答に失敗しました。もう一度試してください。"); // JSON形式で返ってきてない場合はエラー
    }

    if (!res.ok || !data.result) {
      throw new Error(data.message || data.error || "ターン判定に失敗しました。もう一度試してください。");
    }

    applyTurnResult(action, data.result); // ターン処理の結果を反映させる
    actionInputEl.value = ""; // ユーザーの入力したアクションを消す
  } catch (error) {
    console.log(`エラー: ${error.message}`);
    showError("エラーが発生しました。もう一度試してください。"); // ユーザーにエラーを伝える
  } finally {
    if (!gameState.gameOver) {
      actionButtonEl.disabled = false;
      actionButtonEl.textContent = "行動する";
    }
  }
});

// ターンの結果を描画
function renderCurrentTurnResult(result) {
  lastResultTextEl.textContent = normalizeNovelText(result.narration) || "";
  reasonTextEl.textContent = result.judgement || result.reason || "";
  openingTextEl.textContent = normalizeNovelText(result.nextSituation) || "";

  lastResultBlockEl.classList.remove("hidden");
  reasonBlockEl.classList.remove("hidden");
}

// ターンの結果を反映
function applyTurnResult(action, result) {
  gameState.status = applyDelta(gameState.status, result.delta);
  gameState.currentSituation = result.nextSituation;

  const progressGain = plannedProgressGain ?? resolveProgressGain(result.actionType, result.progressGain);
  gameState.progress = clampProgress(gameState.progress + progressGain);

  gameState.history.push({
    turn: gameState.turn,
    action,
    narration: result.narration,
    judgement: result.judgement || result.reason,
    nextSituation: result.nextSituation,
    summaryForNextTurn: result.summaryForNextTurn,
    actionType: plannedActionType || result.actionType,
    progressGain,
    progress: gameState.progress,
    delta: result.delta
  });

  selectedChoiceType = null;
  plannedActionType = null;
  plannedProgressGain = null;

  // 現在のターンの結果とログを描画
  renderCurrentTurnResult(result);
  addLog(action, result);
  renderStatus();

  const localGameOver = checkGameOver();
  const reachedTurnLimit = gameState.turn >= gameState.turnLimit;
  const shouldEnd = result.isGameOver || localGameOver.isGameOver || reachedTurnLimit;

  // ゲーム終了時の処理
  if (shouldEnd) {
    gameState.gameOver = true;

    renderTurn();
    clearChoices();
    hideActionArea();

    renderGameEndNotice();

    prepareEndingButton({
      endingType: reachedTurnLimit ? decideEndingType() : localGameOver.endingType || "bad",
      progress: gameState.progress,
      failedStatusKey: localGameOver.failedStatusKey,
      failedStatusLabel: localGameOver.failedStatusLabel
    });

    scrollToGameTop();
    return;
  }

  renderChoices(result.choices); // 選択肢を描画

  gameState.turn += 1;
  renderTurn();
  scrollToGameTop();
}

// 選択肢をクリア
function clearChoices() {
  choicesEl.innerHTML = "";
}

// ユーザーのアクションエリアを消す
function hideActionArea() {
  actionAreaEl.classList.add("hidden");
  actionButtonEl.disabled = true;
  actionInputEl.disabled = true;
}

// ゲーム終了の描画
function renderGameEndNotice() {
  const notice = document.createElement("div");
  notice.className = "game-end-notice";
  notice.textContent = "この極限状況での行動はここまでです。あなたの選択がどんな結末へ至ったのか、エンディングを確認してください。";

  choicesEl.innerHTML = "";
  choicesEl.appendChild(notice);
}

// ステータスの変化を適用
function applyDelta(status, delta) {
  return {
    hp: clamp(status.hp + (delta.hp || 0)),
    resource: clamp(status.resource + (delta.resource || 0)),
    safety: clamp(status.safety + (delta.safety || 0)),
    mental: clamp(status.mental + (delta.mental || 0))
  };
}

// 範囲内の数値を返す
function clamp(value) {
  return Math.max(0, Math.min(100, value));
}

// ゲームオーバー判定
function checkGameOver() {
  const labels = gameState.scenario.statusLabels;

  for (const [key, value] of Object.entries(gameState.status)) {
    if (value <= 0) {
      return {
        isGameOver: true,
        endingType: "bad",
        failedStatusKey: key,
        failedStatusLabel: labels[key] || key
      };
    }
  }

  return {
    isGameOver: false
  };
}

// 状態部分の描画を更新
function renderStatus() {
  statusSummaryEl.innerHTML = "";

  const summaries = buildStatusSummary(gameState.status, gameState.scenario.statusLabels);

  summaries.forEach((text) => {
    const li = document.createElement("li");
    li.textContent = text;
    statusSummaryEl.appendChild(li);
  });
}

// ステータスの表示を作る
function buildStatusSummary(status, labels) {
  return Object.entries(status).map(([key, value]) => {
    const label = labels[key] || key;

    if (value >= 75) return `${label}：余裕がある`;
    if (value >= 50) return `${label}：まだ大丈夫`;
    if (value >= 25) return `${label}：危うい`;
    return `${label}：限界に近い`;
  });
}

// ターン部分の描画を更新
function renderTurn() {
  turnEl.textContent = `Turn ${gameState.turn} / ${gameState.turnLimit}`;
}

// 選択肢を描画
function renderChoices(choices) {
  choicesEl.innerHTML = "";

  if (gameState.gameOver) {
    clearChoices();
    return;
  }

  choices.forEach((choice) => {
    const text = typeof choice === "string" ? choice : choice.text;
    const type = typeof choice === "string" ? null : choice.type;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice-button";
    button.textContent = text;

    button.addEventListener("click", () => {
      actionInputEl.value = text;
      selectedChoiceType = type;

      plannedActionType = decideActionType(type);
      plannedProgressGain = calculateProgressGainByActionType(plannedActionType);
    });

    choicesEl.appendChild(button);
  });

  actionAreaEl.classList.remove("hidden");
}

// ログに開始状況を追加
function addStartLog(scenario) {
  const article = document.createElement("article");

  article.innerHTML = `
    <hr>
    <p><strong>開始状況</strong></p>
    <p><strong>タイトル:</strong> ${escapeHtml(scenario.title)}</p>
    <p><strong>目的:</strong> ${escapeHtml(scenario.goal)}</p>
    <p>${escapeHtml(normalizeNovelText(scenario.openingText))}</p>
  `;

  logEl.prepend(article);
}

// ログに現在のターンの情報を追加
function addLog(action, result) {
  const article = document.createElement("article");

  article.innerHTML = `
    <hr>
    <p><strong>Turn ${gameState.turn}</strong></p>
    <p><strong>あなた:</strong> ${escapeHtml(action)}</p>
    <p><strong>結果:</strong> ${escapeHtml(result.narration)}</p>
    <p><strong>変化:</strong> ${escapeHtml(result.judgement || result.reason || "")}</p>
  `;

  logEl.prepend(article);
}

// エンディングを描画
function renderEnding(ending, endingType) {
  const label = ENDING_TYPE_LABELS[endingType] || "結末";
  const subtitle = ENDING_TYPE_SUBTITLES[endingType] || "";
  const progressText = `${gameState.progress} / 700`;

  endingEl.innerHTML = `
    <div class="ending-type">
      <span class="ending-type-label">${escapeHtml(label)}</span>
      ${subtitle ? `<span class="ending-type-subtitle">${escapeHtml(subtitle)}</span>` : ""}
      <span class="ending-type-subtitle">到達度：${escapeHtml(progressText)}</span>
    </div>
    <h2>${escapeHtml(ending.endingTitle || "結果")}</h2>
    <p>${escapeHtml(normalizeNovelText(ending.endingText || String(ending)))}</p>
  `;

  endingEl?.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

// テキストを整形
function normalizeNovelText(text) {
  const normalized = String(text || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (normalized.includes("\n")) return normalized;

  const sentences = normalized
    .split("。")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => `${s}。`);

  if (sentences.length <= 2) return normalized;

  const paragraphs = [];

  for (let i = 0; i < sentences.length; i += 2) {
    paragraphs.push(sentences.slice(i, i + 2).join(""));
  }

  return paragraphs.join("\n\n");
}

// 文字列を無害化
function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// エンディング生成
async function generateEnding({ endingType, failedStatusKey, failedStatusLabel }) {
  actionButtonEl.disabled = true;
  actionInputEl.disabled = true;

  renderEnding({
    endingTitle: "エンディング生成中...",
    endingText: "あなたの選択の結末を記録しています。"
  });

  try {
    const res = await fetch("/api/ending", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        scenario: gameState.scenario,
        currentStatus: gameState.status,
        progress: gameState.progress,
        maxProgress: 700,
        currentSituation: gameState.currentSituation,
        history: gameState.history,
        endingType,
        failedStatusKey,
        failedStatusLabel
      })
    });

    const rawText = await res.text();

    let data;
    try {
      data = JSON.parse(rawText);
    } catch (error) {
      throw new Error("AIの応答に失敗しました。もう一度試してください。");
    }

    if (!res.ok || !data.result) {
      throw new Error(data.message || data.error || "エンディング生成に失敗しました");
    }

    renderEnding(data.result, endingType);
    return true;
  } catch (error) {
    console.log(`エラー: ${error.message}`);
    showEndingError("エラーが発生しました。もう一度試してください。"); // ユーザーにエラーを伝える
    return false;
  }
}

// ステータスによるエンディングタイプ分け
function getEndingTypeByFailedStatus(key) {
  switch (key) {
    case "hp":
      return "body_collapse";
    case "resource":
      return "resource_lost";
    case "safety":
      return "danger_caught";
    case "mental":
      return "mind_break";
    default:
      return "bad";
  }
}

// エンディングボタンをセット
function prepareEndingButton(payload) {
  pendingEndingPayload = payload;

  actionButtonEl.disabled = true;
  actionInputEl.disabled = true;
  actionAreaEl.classList.add("hidden");

  endingButtonEl.disabled = false;

  endingActionEl.classList.remove("hidden");
  endingActionEl.classList.add("flex");
  endingEl.innerHTML = "";
}

// エンディングを見るボタン
endingButtonEl.addEventListener("click", async () => {
  if (!pendingEndingPayload) return;

  endingEl.classList.remove("hidden");

  endingButtonEl.disabled = true;
  endingButtonEl.textContent = "エンディング生成中...";

  const success = await generateEnding(pendingEndingPayload);

  if (success) {
    endingActionEl.classList.remove("flex");
    endingActionEl.classList.add("hidden");
    endingButtonEl.disabled = true;
    endingButtonEl.textContent = "結末を見る";
  } else {
    endingButtonEl.disabled = false;
    endingButtonEl.textContent = "結末を見る";
  }
});

// エンディングの種類判定
function decideEndingType() {
  const p = gameState.progress;
  const avgStatus = (gameState.status.hp + gameState.status.resource + gameState.status.safety + gameState.status.mental) / 4;

  if (p >= 520 && avgStatus >= 35) return "clear";
  if (p >= 400 && avgStatus >= 25) return "costly_survival";
  if (p >= 280) return "ambiguous";
  return "bad";
}

// 進行度のチェック
function resolveProgressGain(actionType, aiProgressGain) {
  const range = PROGRESS_GAIN_RANGES[actionType] || PROGRESS_GAIN_RANGES.neutral;
  const [min, max] = range;

  const n = Number(aiProgressGain);

  if (Number.isFinite(n)) {
    const rounded = Math.round(n);

    if (rounded >= min && rounded <= max) {
      return rounded;
    }
  }

  return randomInt(min, max);
}

function clampProgress(value) {
  return Math.max(0, Math.min(700, value));
}

// 範囲内の乱数を返す
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// スクロールバーを上部へ移動
function scrollToGameTop() {
  scenarioSection.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

// エラーメッセージを表示
function showError(message) {
  errorMessageEl.textContent = message;
}

// エラーメッセージをクリア
function clearError() {
  errorMessageEl.textContent = "";
}

// エラーメッセージを表示
function showCreateError(message) {
  createErrorMessageEl.textContent = message;
}

// エラーメッセージをクリア
function clearCreateError() {
  createErrorMessageEl.textContent = "";
}

// エンディングエラーメッセージを表示
function showEndingError(message) {
  renderEnding({
    endingTitle: "エンディング生成エラー",
    endingText: message
  });
}

actionInputEl.addEventListener("input", () => {
  selectedChoiceType = null;
  plannedActionType = null;
  plannedProgressGain = null;
});

// 進行度セット
function calculateProgressGainByActionType(actionType) {
  const range = PROGRESS_GAIN_RANGES[actionType] || PROGRESS_GAIN_RANGES.neutral;
  const [min, max] = range;

  return randomInt(min, max);
}

function decideActionType(choiceType) {
  const r = Math.random();

  if (choiceType === "safe") {
    if (r < 0.15) return "excellent";
    if (r < 0.65) return "good";
    if (r < 0.9) return "neutral";
    return "bad";
  }

  if (choiceType === "bold") {
    if (r < 0.25) return "excellent";
    if (r < 0.55) return "good";
    if (r < 0.75) return "risky";
    return "bad";
  }

  if (choiceType === "chaos") {
    if (r < 0.12) return "excellent";
    if (r < 0.28) return "good";
    if (r < 0.5) return "neutral";
    if (r < 0.75) return "bad";
    return "chaos";
  }

  return null; // 自由入力
}
