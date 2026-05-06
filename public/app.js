const generateButton = document.querySelector("#generateButton");
const scenarioSection = document.querySelector("#scenario");
const titleEl = document.querySelector("#title");
const openingTextEl = document.querySelector("#openingText");
const choicesEl = document.querySelector("#choices");
const debugEl = document.querySelector("#debug");

generateButton.addEventListener("click", async () => {
  generateButton.disabled = true;
  generateButton.textContent = "生成中...";

  try {
    const res = await fetch("/api/test", {
      method: "POST"
    });

    const data = await res.json();

    if (!res.ok || !data.scenario) {
      throw new Error(data.error || "生成に失敗しました");
    }

    renderScenario(data.scenario);
    debugEl.textContent = JSON.stringify(data.usage, null, 2);
  } catch (error) {
    debugEl.textContent = `エラー: ${error.message}`;
  } finally {
    generateButton.disabled = false;
    generateButton.textContent = "極限状況を生成する";
  }
});

function renderScenario(scenario) {
  titleEl.textContent = scenario.title;
  openingTextEl.textContent = scenario.openingText;

  choicesEl.innerHTML = "";
  scenario.choices.forEach((choice) => {
    const li = document.createElement("li");
    li.textContent = choice;
    choicesEl.appendChild(li);
  });

  scenarioSection.style.display = "block";
}
