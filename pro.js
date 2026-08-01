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
  tapType: "flange",
  minimumBeta: 0.15,
  maximumBeta: 0.70
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

function tapLimits(tapType) {
  if (tapType === "pipe") {
    return {
      minimumBeta: 0.20,
      maximumBeta: 0.67
    };
  }

  return {
    minimumBeta: 0.15,
    maximumBeta: 0.70
  };
}

function previewTapTypeLimits() {
  const tapType =
    el("tapType")?.value ||
    "flange";

  const limits =
    tapLimits(tapType);

  if (el("minimumBeta")) {
    el("minimumBeta").value =
      limits.minimumBeta.toFixed(2);
  }

  if (el("maximumBeta")) {
    el("maximumBeta").value =
      limits.maximumBeta.toFixed(2);
  }
}

function loadProSettings() {
  try {
    const savedSettings = JSON.parse(
      localStorage.getItem(SETTINGS_KEY) || "{}"
    );

    const tapType =
      savedSettings.tapType === "pipe"
        ? "pipe"
        : "flange";

    settings = {
      tapType,
      ...tapLimits(tapType)
    };
  } catch {
    settings = {
      tapType: "flange",
      ...tapLimits("flange")
    };
  }

  if (el("tapType")) {
    el("tapType").value =
      settings.tapType;
  }

  previewTapTypeLimits();
}

function saveProSettings() {
  const tapType =
    el("tapType")?.value === "pipe"
      ? "pipe"
      : "flange";

  settings = {
    tapType,
    ...tapLimits(tapType)
  };

  localStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify(settings)
  );

  previewTapTypeLimits();
  renderPlateLibrary();

  alert(
    tapType === "flange"
      ? "Settings saved. Flange taps are active with AGA-3 automatic Cd."
      : "Settings saved. Pipe taps are active; entered/manual Cd will be used."
  );
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
  const minimumPlate =
    1 / 16;

  const maximumByBeta =
    Math.floor(
      pipeID *
      settings.maximumBeta *
      16
    ) / 16;

  const maximumPlate = Math.max(
    minimumPlate,
    maximumByBeta
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
      status.text,

    tapType:
      settings.tapType
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
/* =========================================================
   AGA-3 / API MPMS 14.3 (1990 RG FLANGE-TAP Cd)
   Reader-Harris/Gallagher iterative discharge coefficient.
   D is in inches, ReD is dimensionless.
========================================================= */

function aga3FlangeTapCd(
  beta,
  pipeIDIn,
  reynoldsNumber
) {
  if (
    !Number.isFinite(beta) ||
    beta <= 0 ||
    beta >= 1 ||
    !Number.isFinite(pipeIDIn) ||
    pipeIDIn <= 0 ||
    !Number.isFinite(reynoldsNumber) ||
    reynoldsNumber <= 0
  ) {
    return NaN;
  }

  const reD =
    Math.max(reynoldsNumber, 4000);

  const L1 =
    1 / pipeIDIn;

  const L2 =
    1 / pipeIDIn;

  const M1 =
    Math.max(
      2.8 - pipeIDIn,
      0
    );

  const M2 =
    (
      2 *
      L2
    ) /
    (
      1 - beta
    );

  const A =
    (
      19000 *
      beta /
      reD
    ) ** 0.8;

  const B =
    beta ** 4 /
    (
      1 - beta ** 4
    );

  const C =
    (
      1000000 /
      reD
    ) ** 0.35;

  const ciCorner =
    0.5961 +
    0.0291 * beta ** 2 -
    0.2290 * beta ** 8 +
    0.003 *
    (1 - beta) *
    M1;

  const upstream =
    (
      0.0433 +
      0.0712 *
      Math.exp(
        -8.5 * L1
      ) -
      0.1145 *
      Math.exp(
        -6.0 * L1
      )
    ) *
    (
      1 - 0.23 * A
    ) *
    B;

  const downstream =
    -0.0116 *
    (
      M2 -
      0.52 *
      M2 ** 1.3
    ) *
    beta ** 1.1 *
    (
      1 - 0.14 * A
    );

  const ciFlange =
    ciCorner +
    upstream +
    downstream;

  const slopeTerm1 =
    0.000511 *
    (
      1000000 *
      beta /
      reD
    ) ** 0.7;

  const slopeTerm2 =
    (
      0.0210 +
      0.0049 * A
    ) *
    beta ** 4 *
    C;

  return (
    ciFlange +
    slopeTerm1 +
    slopeTerm2
  );
}

function pipeReynoldsNumber(
  massFlowKgSecond,
  pipeIDMeter,
  dynamicViscosityPaSecond
) {
  return (
    4 *
    massFlowKgSecond
  ) /
  (
    Math.PI *
    pipeIDMeter *
    dynamicViscosityPaSecond
  );
}

/* =========================================================
   GAS FLOW CALCULATOR
   Engineering estimate only.
========================================================= */

function calculateGasFlow() {
  clearError("gasError");
  hideCard("gasResultCard");

  const pipeIDIn =
    getNumber("gasPipeID");

  const orificeIn =
    getNumber("gasOrifice");

  const dpInH2O =
    getNumber("gasDP");

  const staticPsig =
    getNumber("gasStaticPressure");

  const temperatureF =
    getNumber("gasTemperature");

  const gasSpecificGravity =
    getNumber("gasSpecificGravity");

  const z =
    getNumber("gasZ");

  const k =
    getNumber("gasK");

  const enteredCd =
    getNumber("gasCd");

  const viscosityCp =
    getNumber("gasViscosity");

  const basePressurePsia =
    getNumber("gasBasePressure");

  const baseTemperatureF =
    getNumber("gasBaseTemperature");

  const inputValues = [
    pipeIDIn,
    orificeIn,
    dpInH2O,
    staticPsig,
    temperatureF,
    gasSpecificGravity,
    z,
    k,
    enteredCd,
    viscosityCp,
    basePressurePsia,
    baseTemperatureF
  ];

  if (
    inputValues.some(
      value => !Number.isFinite(value)
    )
  ) {
    showError(
      "gasError",
      "Enter valid numeric values."
    );

    return;
  }

  if (
    pipeIDIn <= 0 ||
    orificeIn <= 0 ||
    orificeIn >= pipeIDIn
  ) {
    showError(
      "gasError",
      "Orifice bore must be smaller than the pipe ID."
    );

    return;
  }

  if (
    dpInH2O <= 0 ||
    staticPsig < 0 ||
    gasSpecificGravity <= 0 ||
    z <= 0 ||
    k <= 1 ||
    enteredCd <= 0 ||
    enteredCd > 1 ||
    viscosityCp <= 0 ||
    basePressurePsia <= 0
  ) {
    showError(
      "gasError",
      "One or more values are outside the valid range."
    );

    return;
  }

  const inchToMeter =
    0.0254;

  const psiToPascal =
    6894.757293;

  const inH2OToPascal =
    249.08891;

  const pipeID =
    pipeIDIn * inchToMeter;

  const orifice =
    orificeIn * inchToMeter;

  const beta =
    orifice / pipeID;

  const orificeArea =
    Math.PI *
    orifice ** 2 /
    4;

  const absolutePressurePsia =
    staticPsig + 14.6959;

  const absolutePressurePascal =
    absolutePressurePsia *
    psiToPascal;

  const differentialPressurePascal =
    dpInH2O *
    inH2OToPascal;

  const flowingTemperatureKelvin =
    (temperatureF + 459.67) *
    5 / 9;

  const airMolecularWeight =
    28.96546e-3;

  const gasMolecularWeight =
    gasSpecificGravity *
    airMolecularWeight;

  const universalGasConstant =
    8.314462618;

  const gasDensity =
    (
      absolutePressurePascal *
      gasMolecularWeight
    ) /
    (
      z *
      universalGasConstant *
      flowingTemperatureKelvin
    );

  const differentialPressureRatio =
    clamp(
      differentialPressurePascal /
      absolutePressurePascal,
      0,
      0.95
    );

  const expansionFactor =
    clamp(
      1 -
      (
        0.351 +
        0.256 * beta ** 4 +
        0.93 * beta ** 8
      ) *
      differentialPressureRatio /
      k,
      0.50,
      1
    );

  const denominator =
    1 - beta ** 4;

  if (
    denominator <= 0 ||
    gasDensity <= 0
  ) {
    showError(
      "gasError",
      "Unable to calculate gas flow from these inputs."
    );

    return;
  }

  const flowRoot =
    expansionFactor *
    orificeArea *
    Math.sqrt(
      (
        2 *
        gasDensity *
        differentialPressurePascal
      ) /
      denominator
    );

  const dynamicViscosityPaSecond =
    viscosityCp *
    0.001;

  let cd =
    enteredCd;

  let reynoldsNumber =
    NaN;

  if (
    settings.tapType === "flange"
  ) {
    for (
      let iteration = 0;
      iteration < 30;
      iteration++
    ) {
      const trialMassFlow =
        cd *
        flowRoot;

      reynoldsNumber =
        pipeReynoldsNumber(
          trialMassFlow,
          pipeID,
          dynamicViscosityPaSecond
        );

      const nextCd =
        aga3FlangeTapCd(
          beta,
          pipeIDIn,
          reynoldsNumber
        );

      if (
        !Number.isFinite(nextCd)
      ) {
        break;
      }

      if (
        Math.abs(
          nextCd - cd
        ) < 0.0000001
      ) {
        cd = nextCd;
        break;
      }

      cd = nextCd;
    }

    el("gasCd").value =
      cd.toFixed(5);
  }

  const massFlowKgSecond =
    cd *
    flowRoot;

  if (
    !Number.isFinite(reynoldsNumber)
  ) {
    reynoldsNumber =
      pipeReynoldsNumber(
        massFlowKgSecond,
        pipeID,
        dynamicViscosityPaSecond
      );
  }

  const baseTemperatureKelvin =
    (baseTemperatureF + 459.67) *
    5 / 9;

  const basePressurePascal =
    basePressurePsia *
    psiToPascal;

  const baseGasDensity =
    (
      basePressurePascal *
      gasMolecularWeight
    ) /
    (
      universalGasConstant *
      baseTemperatureKelvin
    );

  const standardM3Second =
    massFlowKgSecond /
    baseGasDensity;

  const cubicFeetPerCubicMeter =
    35.3146667;

  const secondsPerDay =
    86400;

  const standardCubicFeetDay =
    standardM3Second *
    cubicFeetPerCubicMeter *
    secondsPerDay;

  const mscfd =
    standardCubicFeetDay /
    1000;

  const mmscfd =
    standardCubicFeetDay /
    1000000;

  const actualM3Second =
    massFlowKgSecond /
    gasDensity;

  const acfm =
    actualM3Second *
    cubicFeetPerCubicMeter *
    60;

  const boreVelocityMeterSecond =
    actualM3Second /
    orificeArea;

  const boreVelocityFeetSecond =
    boreVelocityMeterSecond *
    3.280839895;
      if (el("gasMMSCFD")) {
    el("gasMMSCFD").textContent =
      formatNumber(
        mmscfd,
        3
      );
  }

  if (el("gasMSCFD")) {
    el("gasMSCFD").textContent =
      formatNumber(
        mscfd,
        1
      );
  }

  if (el("gasACFM")) {
    el("gasACFM").textContent =
      formatNumber(
        acfm,
        1
      );
  }

  if (el("gasBeta")) {
    el("gasBeta").textContent =
      formatNumber(
        beta,
        3
      );
  }

  if (el("gasExpansion")) {
    el("gasExpansion").textContent =
      formatNumber(
        expansionFactor,
        4
      );
  }

  if (el("gasDensity")) {
    el("gasDensity").textContent =
      `${formatNumber(
        gasDensity,
        3
      )} kg/m³`;
  }

  if (el("gasVelocity")) {
    el("gasVelocity").textContent =
      `${formatNumber(
        boreVelocityFeetSecond,
        1
      )} ft/s`;
  }

  const warnings = [];

  warnings.push({
    level:
      settings.tapType === "flange"
        ? "success"
        : "warning",

    text:
      settings.tapType === "flange"
        ? `Flange taps: AGA-3 RG Cd = ${formatNumber(cd, 5)}, ReD = ${formatNumber(reynoldsNumber, 0)}.`
        : `Pipe taps selected: manual Cd = ${formatNumber(cd, 5)} is being used.`
  });

  if (
    settings.tapType === "flange" &&
    reynoldsNumber < 4000
  ) {
    warnings.push({
      level: "danger",
      text:
        "Pipe Reynolds number is below 4,000; the implemented RG correlation is outside its stated range."
    });
  }

  const status =
    betaStatus(beta);

  warnings.push({
    level:
      status.text === "Acceptable"
        ? "success"
        : status.text === "Above limit"
          ? "danger"
          : "warning",

    text:
      `Beta ratio ${formatNumber(
        beta,
        3
      )}: ${status.text}.`
  });

  if (
    differentialPressureRatio > 0.10
  ) {
    warnings.push({
      level: "warning",

      text:
        "DP is high compared with absolute pressure. Verify using approved engineering software."
    });
  }

  if (dpInH2O > 400) {
    warnings.push({
      level: "warning",

      text:
        "High differential pressure entered. Confirm transmitter range and units."
    });
  }

  if (
    boreVelocityFeetSecond > 300
  ) {
    warnings.push({
      level: "warning",

      text:
        "Estimated bore velocity is high. Check noise, erosion and vibration limits."
    });
  }

  if (
    z < 0.70 ||
    z > 1.20
  ) {
    warnings.push({
      level: "warning",

      text:
        "Compressibility factor is unusual. Confirm the Z value at flowing conditions."
    });
  }

  renderGasWarnings(
    warnings
  );

  lastGasResult = {
    type: "Gas Flow",

    timestamp:
      currentTimestamp(),

    jobName:
      el(
        "gasJobName"
      )?.value.trim() ||
      "Unnamed Job",

    pipeIDIn,
    orificeIn,
    dpInH2O,
    staticPsig,
    temperatureF,
    gasSpecificGravity,
    z,
    k,
    cd,
    viscosityCp,
    reynoldsNumber,
    tapType: settings.tapType,
    basePressurePsia,
    baseTemperatureF,
    absolutePressurePsia,
    beta,
    expansionFactor,
    gasDensity,
    massFlowKgSecond,
    mmscfd,
    mscfd,
    acfm,
    boreVelocityFeetSecond,

    status:
      status.text
  };

  showCard(
    "gasResultCard"
  );

  el(
    "gasResultCard"
  )?.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function renderGasWarnings(
  warnings
) {
  const container =
    el("gasWarnings");

  if (!container) {
    return;
  }

  container.innerHTML =
    warnings
      .map(item => {
        let className = "";

        if (
          item.level === "danger"
        ) {
          className = "danger";
        }

        if (
          item.level === "success"
        ) {
          className = "success";
        }

        return `
          <div
            class="warning-item ${className}"
          >
            ${safeText(item.text)}
          </div>
        `;
      })
      .join("");
}
/* =========================================================
   HISTORY
========================================================= */

function getHistory() {
  try {
    const saved =
      localStorage.getItem(
        "gasWellHistory"
      );

    return saved
      ? JSON.parse(saved)
      : [];
  } catch (error) {
    return [];
  }
}

function setHistory(history) {
  localStorage.setItem(
    "gasWellHistory",
    JSON.stringify(history)
  );
}

function saveSelectorResult() {
  if (!lastSelectorResult) {
    showError(
      "selectorError",
      "Calculate a plate result before saving."
    );

    return;
  }

  const history =
    getHistory();

  history.unshift({
    id:
      Date.now(),

    ...lastSelectorResult
  });

  setHistory(
    history.slice(0, 100)
  );

  renderHistory();

  showToast(
    "Plate selector result saved."
  );
}

function saveGasResult() {
  if (!lastGasResult) {
    showError(
      "gasError",
      "Calculate gas flow before saving."
    );

    return;
  }

  const history =
    getHistory();

  history.unshift({
    id:
      Date.now(),

    ...lastGasResult
  });

  setHistory(
    history.slice(0, 100)
  );

  renderHistory();

  showToast(
    "Gas flow result saved."
  );
}

function deleteHistoryItem(id) {
  const updatedHistory =
    getHistory().filter(
      item =>
        String(item.id) !==
        String(id)
    );

  setHistory(
    updatedHistory
  );

  renderHistory();
}

function clearAllHistory() {
  const history =
    getHistory();

  if (!history.length) {
    showToast(
      "History is already empty."
    );

    return;
  }

  const confirmed =
    window.confirm(
      "Delete all saved history?"
    );

  if (!confirmed) {
    return;
  }

  localStorage.removeItem(
    "gasWellHistory"
  );

  renderHistory();

  showToast(
    "History cleared."
  );
}

function renderHistory() {
  const container =
    el("historyList");

  if (!container) {
    return;
  }

  const history =
    getHistory();

  if (!history.length) {
    container.innerHTML = `
      <div class="empty-state">
        <strong>No saved results</strong>
        <span>
          Saved calculations will appear here.
        </span>
      </div>
    `;

    return;
  }

  container.innerHTML =
    history
      .map(item => {
        if (
          item.type ===
          "Gas Flow"
        ) {
          return `
            <article class="history-card">
              <div class="history-card-head">
                <div>
                  <span class="history-type">
                    Gas Flow
                  </span>

                  <h3>
                    ${safeText(
                      item.jobName ||
                      "Unnamed Job"
                    )}
                  </h3>

                  <small>
                    ${safeText(
                      item.timestamp ||
                      ""
                    )}
                  </small>
                </div>

                <button
                  class="icon-button danger-button"
                  type="button"
                  onclick="deleteHistoryItem('${item.id}')"
                  aria-label="Delete result"
                >
                  ×
                </button>
              </div>

              <div class="history-values">
                <div>
                  <span>Flow</span>
                  <strong>
                    ${formatNumber(
                      item.mmscfd,
                      3
                    )} MMSCFD
                  </strong>
                </div>

                <div>
                  <span>Plate</span>
                  <strong>
                    ${formatNumber(
                      item.orificeIn,
                      3
                    )} in
                  </strong>
                </div>

                <div>
                  <span>Beta</span>
                  <strong>
                    ${formatNumber(
                      item.beta,
                      3
                    )}
                  </strong>
                </div>

                <div>
                  <span>DP</span>
                  <strong>
                    ${formatNumber(
                      item.dpInH2O,
                      1
                    )} inH₂O
                  </strong>
                </div>
              </div>
            </article>
          `;
        }

        return `
          <article class="history-card">
            <div class="history-card-head">
              <div>
                <span class="history-type">
                  Plate Selector
                </span>

                <h3>
                  ${safeText(
                    item.jobName ||
                    "Unnamed Job"
                  )}
                </h3>

                <small>
                  ${safeText(
                    item.timestamp ||
                    ""
                  )}
                </small>
              </div>

              <button
                class="icon-button danger-button"
                type="button"
                onclick="deleteHistoryItem('${item.id}')"
                aria-label="Delete result"
              >
                ×
              </button>
            </div>

            <div class="history-values">
              <div>
                <span>Recommended plate</span>
                <strong>
                  ${formatNumber(
                    item.recommendedPlateIn,
                    3
                  )} in
                </strong>
              </div>

              <div>
                <span>Pipe ID</span>
                <strong>
                  ${formatNumber(
                    item.pipeIDIn,
                    3
                  )} in
                </strong>
              </div>

              <div>
                <span>Beta</span>
                <strong>
                  ${formatNumber(
                    item.beta,
                    3
                  )}
                </strong>
              </div>

              <div>
                <span>Status</span>
                <strong>
                  ${safeText(
                    item.status ||
                    ""
                  )}
                </strong>
              </div>
            </div>
          </article>
        `;
      })
      .join("");
}

/* =========================================================
   SHARE RESULTS
========================================================= */

async function shareSelectorResult() {
  if (!lastSelectorResult) {
    showError(
      "selectorError",
      "Calculate a plate result before sharing."
    );

    return;
  }

  const result =
    lastSelectorResult;

  const text = [
    "Orifice Plate Selector",
    `Job: ${result.jobName}`,
    `Pipe ID: ${formatNumber(
      result.pipeIDIn,
      3
    )} in`,
    `Recommended Plate: ${formatNumber(
      result.recommendedPlateIn,
      3
    )} in`,
    `Beta Ratio: ${formatNumber(
      result.beta,
      3
    )}`,
    `Status: ${result.status}`,
    `Date: ${result.timestamp}`
  ].join("\n");

  await shareText(
    "Orifice Plate Result",
    text
  );
}

async function shareGasResult() {
  if (!lastGasResult) {
    showError(
      "gasError",
      "Calculate gas flow before sharing."
    );

    return;
  }

  const result =
    lastGasResult;

  const text = [
    "Gas Flow Calculation",
    `Job: ${result.jobName}`,
    `Flow: ${formatNumber(
      result.mmscfd,
      3
    )} MMSCFD`,
    `Flow: ${formatNumber(
      result.mscfd,
      1
    )} MSCFD`,
    `Pipe ID: ${formatNumber(
      result.pipeIDIn,
      3
    )} in`,
    `Orifice: ${formatNumber(
      result.orificeIn,
      3
    )} in`,
    `DP: ${formatNumber(
      result.dpInH2O,
      1
    )} inH₂O`,
    `Beta Ratio: ${formatNumber(
      result.beta,
      3
    )}`,
    `Date: ${result.timestamp}`
  ].join("\n");

  await shareText(
    "Gas Flow Result",
    text
  );
}

async function shareText(
  title,
  text
) {
  try {
    if (
      navigator.share
    ) {
      await navigator.share({
        title,
        text
      });

      return;
    }

    await navigator.clipboard.writeText(
      text
    );

    showToast(
      "Result copied to clipboard."
    );
  } catch (error) {
    if (
      error.name !==
      "AbortError"
    ) {
      showToast(
        "Unable to share the result."
      );
    }
  }
}
/* =========================================================
   ORIFICE PLATE LIBRARY
========================================================= */

function renderPlateLibrary() {
  const container =
    el("plateLibrary");

  if (!container) {
    return;
  }

  const plates = [
    0.250,
    0.3125,
    0.375,
    0.4375,
    0.500,
    0.5625,
    0.625,
    0.6875,
    0.750,
    0.8125,
    0.875,
    0.9375,
    1.000,
    1.0625,
    1.125,
    1.1875,
    1.250,
    1.3125,
    1.375,
    1.4375,
    1.500,
    1.5625,
    1.625,
    1.6875,
    1.750,
    1.8125,
    1.875,
    1.9375,
    2.000,
    2.125,
    2.250,
    2.375,
    2.500,
    2.625,
    2.750,
    2.875,
    3.000,
    3.125,
    3.250,
    3.375,
    3.500,
    3.625,
    3.750,
    3.875,
    4.000
  ];

  container.innerHTML =
    plates
      .map(plate => `
        <button
          type="button"
          class="plate-library-item"
          onclick="selectLibraryPlate(${plate})"
        >
          <strong>
            ${formatNumber(plate, 4)}
          </strong>

          <span>inch</span>
        </button>
      `)
      .join("");
}

function selectLibraryPlate(plate) {
  const selectorInput =
    el("selectorPlate");

  const gasInput =
    el("gasOrifice");

  if (selectorInput) {
    selectorInput.value =
      plate;
  }

  if (gasInput) {
    gasInput.value =
      plate;
  }

  showToast(
    `${formatNumber(
      plate,
      4
    )} in plate selected.`
  );
}

/* =========================================================
   SETTINGS INITIALIZATION
========================================================= */

function loadProSettings() {
  try {
    const saved =
      JSON.parse(
        localStorage.getItem(
          "gasWellSettings"
        ) || "{}"
      );

    if (
      saved.theme === "dark" ||
      saved.theme === "light"
    ) {
      document.documentElement.setAttribute(
        "data-theme",
        saved.theme
      );
    }

    const settingsMap = {
      settingsCompany:
        saved.company,

      settingsEngineer:
        saved.engineer,

      settingsDefaultDPUnit:
        saved.dpUnit,

      settingsDefaultPipe:
        saved.defaultPipe
    };

    Object.entries(
      settingsMap
    ).forEach(
      ([id, value]) => {
        const input =
          el(id);

        if (
          input &&
          value !== undefined &&
          value !== null
        ) {
          input.value =
            value;
        }
      }
    );

    if (
      saved.dpUnit &&
      el("selectorDPUnit")
    ) {
      el(
        "selectorDPUnit"
      ).value =
        saved.dpUnit;
    }
  } catch (error) {
    console.warn(
      "Unable to load settings.",
      error
    );
  }
}

/* =========================================================
   APPLICATION STARTUP
========================================================= */

function initializeProApp() {
  loadProSettings();

  renderHistory();

  renderPlateLibrary();

  updateSelectorDPUnit();

  const firstPage =
    document.querySelector(
      ".pro-page"
    );

  if (
    firstPage &&
    !document.querySelector(
      ".pro-page.active"
    )
  ) {
    firstPage.classList.add(
      "active"
    );
  }

  document
    .querySelectorAll(
      "input[type='number']"
    )
    .forEach(input => {
      input.addEventListener(
        "keydown",
        event => {
          if (
            event.key ===
            "Enter"
          ) {
            input.blur();
          }
        }
      );
    });

  console.log(
    "Gas Well Testing Pro initialized."
  );
}

if (
  document.readyState ===
  "loading"
) {
  document.addEventListener(
    "DOMContentLoaded",
    initializeProApp
  );
} else {
  initializeProApp();
}