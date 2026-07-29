"use strict";

/* =========================================================
   WELL TEST ORIFICE PRO
   Field engineering estimate only.
   Not a certified custody-transfer calculator.
========================================================= */

const HISTORY_KEY = "wellTestProHistory";
const SETTINGS_KEY = "wellTestProSettings";
const THEME_KEY = "wellTestProTheme";

let lastSelectorResult = null;
let lastGasResult = null;

let settings = {
  minimumBeta: 0.20,
  maximumBeta: 0.75
};

/* =========================================================
   BASIC UTILITIES
========================================================= */

function el(id) {
  return document.getElementById(id);
}

function getNumber(id) {
  const value = parseFloat(el(id)?.value);

  return Number.isFinite(value)
    ? value
    : NaN;
}

function formatNumber(value, decimals = 3) {
  if (!Number.isFinite(value)) {
    return "—";
  }

  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

function clamp(value, minimum, maximum) {
  return Math.min(
    Math.max(value, minimum),
    maximum
  );
}

function showError(id, message) {
  const box = el(id);

  if (!box) return;

  box.textContent = message;
  box.style.display = "block";
}

function clearError(id) {
  const box = el(id);

  if (!box) return;

  box.textContent = "";
  box.style.display = "none";
}

function showCard(id) {
  const card = el(id);

  if (card) {
    card.style.display = "block";
  }
}

function hideCard(id) {
  const card = el(id);

  if (card) {
    card.style.display = "none";
  }
}

function safeText(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function currentTimestamp() {
  return new Date().toISOString();
}

function displayDate(value) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

/* =========================================================
   NAVIGATION
========================================================= */

function openProPage(pageName) {
  const pages = {
    selector: "selectorPage",
    gas: "gasPage",
    history: "historyPage",
    plates: "platesPage",
    settings: "settingsPage"
  };

  const navigationButtons = {
    selector: "selectorNav",
    gas: "gasNav",
    history: "historyNav",
    plates: "platesNav",
    settings: "settingsNav"
  };

  Object.values(pages).forEach(pageId => {
    el(pageId)?.classList.remove("active-page");
  });

  Object.values(navigationButtons).forEach(buttonId => {
    el(buttonId)?.classList.remove("active-nav");
  });

  el(pages[pageName])?.classList.add("active-page");

  el(navigationButtons[pageName])
    ?.classList.add("active-nav");

  if (pageName === "history") {
    renderHistory();
  }

  if (pageName === "plates") {
    renderPlateLibrary();
  }

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

/* =========================================================
   DARK / LIGHT THEME
========================================================= */

function applyTheme(theme) {
  document.body.classList.toggle(
    "light-theme",
    theme === "light"
  );

  localStorage.setItem(
    THEME_KEY,
    theme
  );
}

function toggleTheme() {
  const lightThemeEnabled =
    document.body.classList.contains(
      "light-theme"
    );

  applyTheme(
    lightThemeEnabled
      ? "dark"
      : "light"
  );
}

/* =========================================================
   SETTINGS
========================================================= */

function loadProSettings() {
  try {
    const savedSettings = JSON.parse(
      localStorage.getItem(SETTINGS_KEY) || "{}"
    );

    settings = {
      ...settings,
      ...savedSettings
    };
  } catch {
    settings = {
      minimumBeta: 0.20,
      maximumBeta: 0.75
    };
  }

  if (el("minimumBeta")) {
    el("minimumBeta").value =
      settings.minimumBeta;
  }

  if (el("maximumBeta")) {
    el("maximumBeta").value =
      settings.maximumBeta;
  }
}

function saveProSettings() {
  const minimumBeta =
    getNumber("minimumBeta");

  const maximumBeta =
    getNumber("maximumBeta");

  if (
    !Number.isFinite(minimumBeta) ||
    !Number.isFinite(maximumBeta) ||
    minimumBeta <= 0 ||
    maximumBeta >= 1 ||
    minimumBeta >= maximumBeta
  ) {
    alert(
      "Enter valid beta limits. Minimum beta must be lower than maximum beta."
    );

    return;
  }

  settings = {
    minimumBeta,
    maximumBeta
  };

  localStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify(settings)
  );

  renderPlateLibrary();

  alert("Settings saved.");
}

/* =========================================================
   FRACTION AND STANDARD PLATE FUNCTIONS
========================================================= */

function fractionFromDecimal(
  value,
  denominator = 16
) {
  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {
    return "—";
  }

  let whole = Math.floor(value);

  let numerator = Math.round(
    (value - whole) * denominator
  );

  if (numerator === denominator) {
    whole += 1;
    numerator = 0;
  }

  if (numerator === 0) {
    return `${whole}"`;
  }

  function greatestCommonDivisor(a, b) {
    return b
      ? greatestCommonDivisor(
          b,
          a % b
        )
      : a;
  }

  const divisor =
    greatestCommonDivisor(
      numerator,
      denominator
    );

  numerator /= divisor;

  const reducedDenominator =
    denominator / divisor;

  if (whole > 0) {
    return `${whole} ${numerator}/${reducedDenominator}"`;
  }

  return `${numerator}/${reducedDenominator}"`;
}

function standardPlateSizes(pipeID) {
  const minimumPlate = Math.max(
    1 / 16,

    Math.floor(
      pipeID *
      settings.minimumBeta *
      16
    ) / 16
  );

  const maximumPlate = Math.max(
    minimumPlate,

    Math.ceil(
      pipeID *
      settings.maximumBeta *
      16
    ) / 16
  );

  const plates = [];

  for (
    let plate = minimumPlate;
    plate <= maximumPlate + 0.00001;
    plate += 1 / 16
  ) {
    plates.push(
      Number(
        plate.toFixed(4)
      )
    );
  }

  return plates;
}

function nearestStandardPlate(
  calculatedBore,
  pipeID
) {
  const plates =
    standardPlateSizes(pipeID);

  if (!plates.length) {
    return calculatedBore;
  }

  return plates.reduce(
    (nearestPlate, currentPlate) => {
      const currentDifference =
        Math.abs(
          currentPlate - calculatedBore
        );

      const nearestDifference =
        Math.abs(
          nearestPlate - calculatedBore
        );

      return currentDifference <
        nearestDifference
        ? currentPlate
        : nearestPlate;
    }
  );
}

function betaStatus(beta) {
  if (
    beta < settings.minimumBeta
  ) {
    return {
      text: "Below limit",
      className: "status-warning"
    };
  }

  if (
    beta > settings.maximumBeta
  ) {
    return {
      text: "Above limit",
      className: "status-danger"
    };
  }

  return {
    text: "Acceptable",
    className: "status-ok"
  };
}

/* =========================================================
   SELECTOR INPUT CONTROLS
========================================================= */

function setSelectorPipe(value) {
  el("selectorPipeID").value =
    Number(value).toFixed(3);
}

function stepSelectorPlate(direction) {
  const input =
    el("selectorCurrentPlate");

  const currentValue =
    parseFloat(input.value) || 0;

  const newValue = Math.max(
    1 / 16,

    currentValue +
    direction / 16
  );

  input.value =
    newValue.toFixed(4);
}

function updateSelectorDPUnit() {
  const selectedUnit =
    el("selectorDPUnit")?.value ||
    "inH2O";

  const displayUnit =
    selectedUnit === "inH2O"
      ? "inH₂O"
      : selectedUnit;

  document
    .querySelectorAll(
      ".selector-dp-unit"
    )
    .forEach(unitElement => {
      unitElement.textContent =
        displayUnit;
    });
}
/* =========================================================
   PLATE SELECTOR CALCULATION
========================================================= */

function geometryTerm(orifice, pipeID) {
  const beta = orifice / pipeID;

  if (beta <= 0 || beta >= 1) {
    return NaN;
  }

  return (
    orifice ** 2 /
    Math.sqrt(1 - beta ** 4)
  );
}

function solveNewBore(
  pipeID,
  currentBore,
  currentDP,
  desiredDP
) {
  const currentGeometry =
    geometryTerm(currentBore, pipeID);

  if (!Number.isFinite(currentGeometry)) {
    return NaN;
  }

  const targetGeometry =
    currentGeometry *
    Math.sqrt(currentDP / desiredDP);

  let minimum = 0.001;
  let maximum = pipeID * 0.99;

  for (
    let iteration = 0;
    iteration < 100;
    iteration++
  ) {
    const middle =
      (minimum + maximum) / 2;

    const middleGeometry =
      geometryTerm(middle, pipeID);

    if (middleGeometry < targetGeometry) {
      minimum = middle;
    } else {
      maximum = middle;
    }
  }

  return (minimum + maximum) / 2;
}

function calculateExpectedDP(
  pipeID,
  currentBore,
  currentDP,
  newBore
) {
  const currentGeometry =
    geometryTerm(currentBore, pipeID);

  const newGeometry =
    geometryTerm(newBore, pipeID);

  if (
    !Number.isFinite(currentGeometry) ||
    !Number.isFinite(newGeometry)
  ) {
    return NaN;
  }

  return (
    currentDP *
    (currentGeometry / newGeometry) ** 2
  );
}

function calculatePlateSelector() {
  clearError("selectorError");

  hideCard("selectorResultCard");

  const pipeID =
    getNumber("selectorPipeID");

  const currentBore =
    getNumber("selectorCurrentPlate");

  const currentDP =
    getNumber("selectorCurrentDP");

  const desiredDP =
    getNumber("selectorTargetDP");

  const unit =
    el("selectorDPUnit")?.value ||
    "inH2O";

  const values = [
    pipeID,
    currentBore,
    currentDP,
    desiredDP
  ];

  if (
    values.some(
      value => !Number.isFinite(value)
    )
  ) {
    showError(
      "selectorError",
      "Enter valid numeric values in all fields."
    );

    return;
  }

  if (pipeID <= 0) {
    showError(
      "selectorError",
      "Pipe ID must be greater than zero."
    );

    return;
  }

  if (
    currentBore <= 0 ||
    currentBore >= pipeID
  ) {
    showError(
      "selectorError",
      "Current plate bore must be greater than zero and smaller than the pipe ID."
    );

    return;
  }

  if (
    currentDP <= 0 ||
    desiredDP <= 0
  ) {
    showError(
      "selectorError",
      "Differential pressure values must be greater than zero."
    );

    return;
  }

  const calculatedBore =
    solveNewBore(
      pipeID,
      currentBore,
      currentDP,
      desiredDP
    );

  if (
    !Number.isFinite(calculatedBore)
  ) {
    showError(
      "selectorError",
      "Unable to calculate the required plate bore."
    );

    return;
  }

  const recommendedPlate =
    nearestStandardPlate(
      calculatedBore,
      pipeID
    );

  const expectedDP =
    calculateExpectedDP(
      pipeID,
      currentBore,
      currentDP,
      recommendedPlate
    );

  const beta =
    recommendedPlate / pipeID;

  const status =
    betaStatus(beta);

  if (
    el("selectorRecommendedPlate")
  ) {
    el(
      "selectorRecommendedPlate"
    ).textContent =
      `${formatNumber(
        recommendedPlate,
        4
      )} in`;
  }

  if (
    el("selectorRecommendedFraction")
  ) {
    el(
      "selectorRecommendedFraction"
    ).textContent =
      fractionFromDecimal(
        recommendedPlate
      );
  }

  if (
    el("selectorCalculatedBore")
  ) {
    el(
      "selectorCalculatedBore"
    ).textContent =
      `${formatNumber(
        calculatedBore,
        4
      )} in`;
  }

  if (
    el("selectorExpectedDP")
  ) {
    el(
      "selectorExpectedDP"
    ).textContent =
      `${formatNumber(
        expectedDP,
        2
      )} ${
        unit === "inH2O"
          ? "inH₂O"
          : unit
      }`;
  }

  if (
    el("selectorBeta")
  ) {
    el(
      "selectorBeta"
    ).textContent =
      formatNumber(beta, 3);
  }

  if (
    el("selectorStatus")
  ) {
    el(
      "selectorStatus"
    ).textContent =
      status.text;

    el(
      "selectorStatus"
    ).className =
      status.className;
  }

  const nearbyPlates =
    standardPlateSizes(pipeID)
      .sort(
        (first, second) => {
          const firstDifference =
            Math.abs(
              first - calculatedBore
            );

          const secondDifference =
            Math.abs(
              second - calculatedBore
            );

          return (
            firstDifference -
            secondDifference
          );
        }
      )
      .slice(0, 7)
      .sort(
        (first, second) =>
          first - second
      );

  renderSelectorPlateTable(
    nearbyPlates,
    pipeID,
    currentBore,
    currentDP,
    recommendedPlate,
    unit
  );

  lastSelectorResult = {
    type: "Plate Selector",

    timestamp:
      currentTimestamp(),

    jobName:
      el(
        "selectorJobName"
      )?.value.trim() ||
      "Unnamed Job",

    pipeID,
    currentBore,
    currentDP,
    desiredDP,
    unit,
    calculatedBore,
    recommendedPlate,
    expectedDP,
    beta,

    status:
      status.text
  };

  showCard(
    "selectorResultCard"
  );

  el(
    "selectorResultCard"
  )?.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function renderSelectorPlateTable(
  plates,
  pipeID,
  currentBore,
  currentDP,
  recommendedPlate,
  unit
) {
  const container =
    el("selectorPlateTable");

  if (!container) {
    return;
  }

  let html = `
    <div class="table-row table-head">

      <span>
        Plate
      </span>

      <span>
        Expected DP
      </span>

      <span>
        Beta
      </span>

    </div>
  `;

  plates.forEach(
    plate => {
      const expectedDP =
        calculateExpectedDP(
          pipeID,
          currentBore,
          currentDP,
          plate
        );

      const beta =
        plate / pipeID;

      const selected =
        Math.abs(
          plate -
          recommendedPlate
        ) < 0.00001;

      html += `
        <div
          class="table-row ${
            selected
              ? "selected"
              : ""
          }"
        >

          <span>

            <strong>
              ${fractionFromDecimal(
                plate
              )}
            </strong>

            <br>

            <small>
              ${formatNumber(
                plate,
                4
              )} in
            </small>

          </span>

          <span>

            ${formatNumber(
              expectedDP,
              2
            )}

            ${
              unit === "inH2O"
                ? "inH₂O"
                : unit
            }

          </span>

          <span>
            ${formatNumber(
              beta,
              3
            )}
          </span>

        </div>
      `;
    }
  );

  container.innerHTML =
    html;
}
