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

let pendingEndingPayload = null;

let gameState = {
  scenario: null,
  status: null,
  currentSituation: "",
  turn: 1,
  turnLimit: 7,
  history: [],
  gameOver: false
};

function startGame(scenario) {
  gameState = {
    scenario,
    status: { ...scenario.initialStatus },
    currentSituation: scenario.openingText,
    turn: 1,
    turnLimit: scenario.turnLimit || 7,
    history: [],
    gameOver: false
  };

  renderScenario(scenario);
  renderTurn();
  renderStatus();
  renderChoices(scenario.choices);
  scrollToGameTop();
}

generateButton.addEventListener("click", async () => {
  generateButton.disabled = true;
  generateButton.textContent = "生成中...";

  try {
    const res = await fetch("/api/create", {
      method: "POST"
    });

    const data = await res.json();

    if (!res.ok || !data.scenario) {
      throw new Error(data.error || "生成に失敗しました");
    }

    startGame(data.scenario);
  } catch (error) {
    console.log(`エラー: ${error.message}`);
  } finally {
    generateButton.disabled = false;
    generateButton.textContent = "極限状況を生成する";
  }
});

// function renderScenario(scenario) {
//   titleEl.textContent = scenario.title;
//   genreEl.textContent = `ジャンル：${scenario.genre}`;
//   goalEl.textContent = `目的：${scenario.goal}`;
//   openingTextEl.textContent = scenario.openingText;

//   statusEl.innerHTML = "";
//   Object.entries(scenario.initialStatus).forEach(([key, value]) => {
//     const li = document.createElement("li");
//     const label = scenario.statusLabels[key] || key;
//     li.textContent = `${label}: ${value}`;
//     statusEl.appendChild(li);
//   });

//   itemsEl.innerHTML = "";
//   scenario.items.forEach((item) => {
//     const li = document.createElement("li");
//     li.textContent = item;
//     itemsEl.appendChild(li);
//   });

//   choicesEl.innerHTML = "";
//   scenario.choices.forEach((choice) => {
//     const li = document.createElement("li");
//     li.textContent = choice;
//     choicesEl.appendChild(li);
//   });

//   scenarioSection.style.display = "block";
// }

function renderScenario(scenario) {
  titleEl.textContent = scenario.title;
  genreEl.textContent = scenario.genre;
  goalEl.textContent = `目的：${scenario.goal}`;
  openingTextEl.textContent = scenario.openingText;

  lastResultBlockEl.classList.add("hidden");
  reasonBlockEl.classList.add("hidden");
  lastResultTextEl.textContent = "";
  reasonTextEl.textContent = "";

  itemsEl.innerHTML = "";
  scenario.items.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    itemsEl.appendChild(li);
  });

  scenarioSection.classList.remove("hidden");
}


actionButtonEl.addEventListener("click", async () => {
  const action = actionInputEl.value.trim();

  if (!action || gameState.gameOver) return;

  actionButtonEl.disabled = true;
  actionButtonEl.textContent = "判定中...";

  try {
    const res = await fetch("/api/turn", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        scenario: gameState.scenario,
        currentStatus: gameState.status,
        currentSituation: gameState.currentSituation,
        turn: gameState.turn,
        turnLimit: gameState.turnLimit,
        action,
        history: gameState.history
      })
    });

    const data = await res.json();

    if (!res.ok || !data.result) {
      throw new Error(data.error || "ターン判定に失敗しました");
    }

    applyTurnResult(action, data.result);
    actionInputEl.value = "";
  } catch (error) {
    console.log(`エラー: ${error.message}`);
  } finally {
    actionButtonEl.disabled = false;
    actionButtonEl.textContent = "行動する";
  }
});

function renderCurrentTurnResult(result) {
  lastResultTextEl.textContent = result.narration || "";
  reasonTextEl.textContent = result.judgement || result.reason || "";
  openingTextEl.textContent = result.nextSituation || "";

  lastResultBlockEl.classList.remove("hidden");
  reasonBlockEl.classList.remove("hidden");
}

function applyTurnResult(action, result) {
  gameState.status = applyDelta(gameState.status, result.delta);
  gameState.currentSituation = result.nextSituation;

  gameState.history.push({
    turn: gameState.turn,
    action,
    narration: result.narration,
    judgement: result.judgement || result.reason,
    nextSituation: result.nextSituation,
    summaryForNextTurn: result.summaryForNextTurn,
    delta: result.delta
  });

  renderCurrentTurnResult(result);
  addLog(action, result);
  renderStatus();

  const localGameOver = checkGameOver();
  const reachedTurnLimit = gameState.turn >= gameState.turnLimit;
  const shouldEnd = result.isGameOver || localGameOver.isGameOver || reachedTurnLimit;

  if (shouldEnd) {
    gameState.gameOver = true;

    renderTurn();
    clearChoices();
    hideActionArea();

    renderGameEndNotice();

    prepareEndingButton({
      endingType: reachedTurnLimit ? "survive_or_final" : localGameOver.endingType || "bad",
      failedStatusKey: localGameOver.failedStatusKey,
      failedStatusLabel: localGameOver.failedStatusLabel
    });

    scrollToGameTop();
    return;
  }

  renderChoices(result.choices);

  gameState.turn += 1;
  renderTurn();
  scrollToGameTop();
}

function clearChoices() {
  choicesEl.innerHTML = "";
}

function hideActionArea() {
  actionAreaEl.classList.add("hidden");
  actionButtonEl.disabled = true;
  actionInputEl.disabled = true;
}

function renderGameEndNotice() {
  const notice = document.createElement("div");
  notice.className = "game-end-notice";
  notice.textContent = "この極限状況での行動はここまでです。あなたの選択がどんな結末へ至ったのか、エンディングを確認してください。";

  choicesEl.innerHTML = "";
  choicesEl.appendChild(notice);
}

function applyDelta(status, delta) {
  return {
    hp: clamp(status.hp + (delta.hp || 0)),
    resource: clamp(status.resource + (delta.resource || 0)),
    safety: clamp(status.safety + (delta.safety || 0)),
    mental: clamp(status.mental + (delta.mental || 0))
  };
}

function clamp(value) {
  return Math.max(0, Math.min(100, value));
}

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


function renderStatus() {
  statusSummaryEl.innerHTML = "";

  const summaries = buildStatusSummary(gameState.status, gameState.scenario.statusLabels);

  summaries.forEach((text) => {
    const li = document.createElement("li");
    li.textContent = text;
    statusSummaryEl.appendChild(li);
  });
}

function renderTurn() {
  turnEl.textContent = `Turn ${gameState.turn} / ${gameState.turnLimit}`;
}

function buildStatusSummary(status, labels) {
  return Object.entries(status).map(([key, value]) => {
    const label = labels[key] || key;

    if (value >= 75) return `${label}：余裕がある`;
    if (value >= 50) return `${label}：まだ大丈夫`;
    if (value >= 25) return `${label}：危うい`;
    return `${label}：限界に近い`;
  });
}

function renderChoices(choices) {
  choicesEl.innerHTML = "";

  if (gameState.gameOver) {
    clearChoices();
    return;
  }

  choices.forEach((choice) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice-button";
    button.textContent = choice;

    button.addEventListener("click", () => {
      actionInputEl.value = choice;
    });

    choicesEl.appendChild(button);
  });

  actionAreaEl.classList.remove("hidden");
}

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

function renderEnding(ending) {
  endingEl.innerHTML = `
    <h2>${escapeHtml(ending.endingTitle || "結果")}</h2>
    <p>${escapeHtml(ending.endingText || String(ending))}</p>
  `;

  endingEl.scrollIntoView({
  behavior: "smooth",
  block: "start"
});
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


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
        currentSituation: gameState.currentSituation,
        history: gameState.history,
        endingType,
        failedStatusKey,
        failedStatusLabel
      })
    });

    const data = await res.json();

    if (!res.ok || !data.result) {
      throw new Error(data.error || "エンディング生成に失敗しました");
    }

    renderEnding(data.result);
  } catch (error) {
    renderEnding({
      endingTitle: "終幕",
      endingText: "あなたの旅はここで終わった。だが、その選択の積み重ねは、確かにこの世界に小さな痕跡を残している。"
    });
  }
}



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

function prepareEndingButton(payload) {
  pendingEndingPayload = payload;

  actionButtonEl.disabled = true;
  actionInputEl.disabled = true;
  actionAreaEl.classList.add("hidden");

  endingActionEl.classList.remove("hidden");
  endingActionEl.classList.add("flex");
  endingEl.innerHTML = "";
}

endingButtonEl.addEventListener("click", async () => {
  if (!pendingEndingPayload) return;

  endingButtonEl.disabled = true;
  endingButtonEl.textContent = "エンディング生成中...";

  await generateEnding(pendingEndingPayload);

  endingActionEl.classList.remove("flex");
  endingActionEl.classList.add("hidden");
  endingButtonEl.disabled = true;
  endingButtonEl.textContent = "エンディングを見る";
});


function scrollToGameTop() {
  scenarioSection.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}
