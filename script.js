"use strict";

/*
    WELL TEST ORIFICE SELECTOR
    Final Field Edition

    Important:
    This application estimates the new orifice size while assuming
    approximately constant flow.

    It is not a full ISO 5167 / AGA 3 custody-transfer calculation.
*/


// ======================================================
// APPLICATION DATA
// ======================================================

const PLATE_INCREMENT = 0.0625;
const MINIMUM_PLATE = 0.25;
const MAXIMUM_PLATE = 3.5;

const STORAGE_KEYS = {
    history: "orificeSelectorHistory",
    settings: "orificeSelectorSettings",
    theme: "orificeSelectorTheme"
};

let lastCalculation = null;


// ======================================================
// STANDARD AMERICAN PLATE SIZES
// ======================================================

const standardSizes = [];

for (
    let size = MINIMUM_PLATE;
    size <= MAXIMUM_PLATE + 0.0001;
    size += PLATE_INCREMENT
) {
    standardSizes.push(Number(size.toFixed(4)));
}


// ======================================================
// PAGE NAVIGATION
// ======================================================

function openPage(pageName) {

    const pages = {
        calculator: document.getElementById("calculatorPage"),
        history: document.getElementById("historyPage"),
        plates: document.getElementById("platesPage"),
        settings: document.getElementById("settingsPage")
    };

    const navButtons = {
        calculator: document.getElementById("calculatorNav"),
        history: document.getElementById("historyNav"),
        plates: document.getElementById("platesNav"),
        settings: document.getElementById("settingsNav")
    };

    Object.values(pages).forEach(function (page) {
        page.classList.remove("active-page");
    });

    Object.values(navButtons).forEach(function (button) {
        button.classList.remove("active-nav");
    });

    if (!pages[pageName] || !navButtons[pageName]) {
        return;
    }

    pages[pageName].classList.add("active-page");
    navButtons[pageName].classList.add("active-nav");

    if (pageName === "history") {
        renderHistory();
    }

    if (pageName === "plates") {
        renderStandardPlateTable();
    }

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}


// ======================================================
// PIPE PRESET BUTTONS
// ======================================================

function setPipe(value) {

    const pipeInput = document.getElementById("pipeID");
    const tablePipeInput = document.getElementById("tablePipeID");

    pipeInput.value = Number(value).toFixed(3);

    if (tablePipeInput) {
        tablePipeInput.value = Number(value).toFixed(3);
    }
}


// ======================================================
// CURRENT PLATE STEP BUTTONS
// ======================================================

function stepCurrentPlate(direction) {

    const input = document.getElementById("currentOrifice");

    let currentValue = Number(input.value);

    if (!Number.isFinite(currentValue)) {
        currentValue = MINIMUM_PLATE;
    }

    let newValue =
        currentValue +
        Number(direction) * PLATE_INCREMENT;

    newValue = Math.max(
        MINIMUM_PLATE,
        Math.min(MAXIMUM_PLATE, newValue)
    );

    input.value = Number(newValue.toFixed(4));
}


// ======================================================
// DIFFERENTIAL PRESSURE UNITS
// ======================================================

function getDPUnitLabel(unit) {

    const labels = {
        inH2O: "inH₂O",
        psi: "psi",
        kPa: "kPa"
    };

    return labels[unit] || "inH₂O";
}


function updateDPUnitLabels() {

    const unit =
        document.getElementById("dpUnit").value;

    const label = getDPUnitLabel(unit);

    document.getElementById(
        "currentDPUnit"
    ).textContent = label;

    document.getElementById(
        "desiredDPUnit"
    ).textContent = label;
}


/*
    The sizing calculation uses a pressure ratio.

    Because Current DP and Desired DP are entered using
    the same unit, no unit conversion is required for
    calculating the new bore.
*/


// ======================================================
// GEOMETRY CALCULATION
// ======================================================

function geometryFactor(orificeDiameter, pipeDiameter) {

    const beta = orificeDiameter / pipeDiameter;

    const denominator =
        1 - Math.pow(beta, 4);

    if (denominator <= 0) {
        return Infinity;
    }

    return (
        Math.pow(orificeDiameter, 4) /
        denominator
    );
}


function calculateExpectedDP(
    newOrifice,
    pipeID,
    currentOrifice,
    currentDP
) {

    const currentGeometry =
        geometryFactor(currentOrifice, pipeID);

    const newGeometry =
        geometryFactor(newOrifice, pipeID);

    if (
        !Number.isFinite(currentGeometry) ||
        !Number.isFinite(newGeometry) ||
        newGeometry <= 0
    ) {
        return NaN;
    }

    return (
        currentDP *
        currentGeometry /
        newGeometry
    );
}


function calculateRequiredDiameter(
    pipeID,
    currentOrifice,
    currentDP,
    desiredDP
) {

    const currentGeometry =
        geometryFactor(currentOrifice, pipeID);

    const targetGeometry =
        currentDP *
        currentGeometry /
        desiredDP;

    let minimum = 0.001;
    let maximum = pipeID * 0.99;

    for (let iteration = 0; iteration < 120; iteration++) {

        const middle =
            (minimum + maximum) / 2;

        const middleGeometry =
            geometryFactor(middle, pipeID);

        if (middleGeometry < targetGeometry) {
            minimum = middle;
        } else {
            maximum = middle;
        }
    }

    return (minimum + maximum) / 2;
}


// ======================================================
// STANDARD PLATE SELECTION
// ======================================================

function getAvailableSizes(pipeID) {

    return standardSizes.filter(function (size) {
        return size < pipeID;
    });
}


function getNearestStandardSize(
    calculatedDiameter,
    pipeID
) {

    const availableSizes =
        getAvailableSizes(pipeID);

    if (availableSizes.length === 0) {
        return {
            nearestSize: null,
            availableSizes: []
        };
    }

    let nearestSize = availableSizes[0];

    availableSizes.forEach(function (size) {

        const currentDifference =
            Math.abs(size - calculatedDiameter);

        const nearestDifference =
            Math.abs(nearestSize - calculatedDiameter);

        if (currentDifference < nearestDifference) {
            nearestSize = size;
        }
    });

    return {
        nearestSize: nearestSize,
        availableSizes: availableSizes
    };
}


// ======================================================
// NUMBER AND FRACTION FORMATTING
// ======================================================

function cleanSize(value) {

    return Number(value)
        .toFixed(4)
        .replace(/0+$/, "")
        .replace(/\.$/, "");
}


function greatestCommonDivisor(a, b) {

    while (b !== 0) {

        const remainder = a % b;

        a = b;
        b = remainder;
    }

    return Math.abs(a);
}


function getFractionName(value) {

    let wholeNumber =
        Math.floor(Number(value));

    let numerator =
        Math.round(
            (Number(value) - wholeNumber) * 16
        );

    let denominator = 16;

    if (numerator === 16) {
        wholeNumber += 1;
        numerator = 0;
    }

    if (numerator === 0) {
        return wholeNumber + '"';
    }

    const divisor =
        greatestCommonDivisor(
            numerator,
            denominator
        );

    numerator /= divisor;
    denominator /= divisor;

    if (wholeNumber > 0) {

        return (
            wholeNumber +
            "-" +
            numerator +
            "/" +
            denominator +
            '"'
        );
    }

    return (
        numerator +
        "/" +
        denominator +
        '"'
    );
}


// ======================================================
// ERROR HANDLING
// ======================================================

function showError(message) {

    const errorBox =
        document.getElementById("errorBox");

    const resultCard =
        document.getElementById("resultCard");

    errorBox.textContent = message;
    errorBox.style.display = "block";

    resultCard.style.display = "none";
}


function hideError() {

    const errorBox =
        document.getElementById("errorBox");

    errorBox.textContent = "";
    errorBox.style.display = "none";
}


// ======================================================
// SETTINGS
// ======================================================

function getDefaultSettings() {

    return {
        minimumBeta: 0.20,
        maximumBeta: 0.75
    };
}


function loadSettings() {

    const defaultSettings =
        getDefaultSettings();

    try {

        const storedSettings =
            localStorage.getItem(
                STORAGE_KEYS.settings
            );

        if (!storedSettings) {
            return defaultSettings;
        }

        const parsedSettings =
            JSON.parse(storedSettings);

        return {
            minimumBeta:
                Number(parsedSettings.minimumBeta) ||
                defaultSettings.minimumBeta,

            maximumBeta:
                Number(parsedSettings.maximumBeta) ||
                defaultSettings.maximumBeta
        };

    } catch (error) {

        return defaultSettings;
    }
}


function displaySettings() {

    const settings = loadSettings();

    document.getElementById(
        "minimumBeta"
    ).value = settings.minimumBeta;

    document.getElementById(
        "maximumBeta"
    ).value = settings.maximumBeta;
}


function saveSettings() {

    const minimumBeta =
        Number(
            document.getElementById(
                "minimumBeta"
            ).value
        );

    const maximumBeta =
        Number(
            document.getElementById(
                "maximumBeta"
            ).value
        );

    if (
        !Number.isFinite(minimumBeta) ||
        !Number.isFinite(maximumBeta) ||
        minimumBeta <= 0 ||
        maximumBeta <= 0 ||
        minimumBeta >= maximumBeta
    ) {
        alert(
            "Enter valid beta limits. Minimum beta must be lower than maximum beta."
        );

        return;
    }

    const settings = {
        minimumBeta: minimumBeta,
        maximumBeta: maximumBeta
    };

    localStorage.setItem(
        STORAGE_KEYS.settings,
        JSON.stringify(settings)
    );

    alert("Settings saved.");
}


// ======================================================
// BETA STATUS
// ======================================================

function getBetaStatus(betaRatio) {

    const settings = loadSettings();

    if (betaRatio >= 1) {

        return {
            text: "INVALID",
            className: "status-danger"
        };
    }

    if (
        betaRatio >= settings.minimumBeta &&
        betaRatio <= settings.maximumBeta
    ) {

        return {
            text: "OK",
            className: "status-ok"
        };
    }

    return {
        text: "CHECK BETA",
        className: "status-warning"
    };
}


// ======================================================
// MAIN CALCULATION
// ======================================================

function calculateOrifice() {

    hideError();

    const jobName =
        document.getElementById(
            "jobName"
        ).value.trim();

    const pipeID =
        Number(
            document.getElementById(
                "pipeID"
            ).value
        );

    const currentOrifice =
        Number(
            document.getElementById(
                "currentOrifice"
            ).value
        );

    const currentDP =
        Number(
            document.getElementById(
                "currentDP"
            ).value
        );

    const desiredDP =
        Number(
            document.getElementById(
                "desiredDP"
            ).value
        );

    const dpUnit =
        document.getElementById(
            "dpUnit"
        ).value;

    const values = [
        pipeID,
        currentOrifice,
        currentDP,
        desiredDP
    ];

    if (
        !values.every(function (value) {
            return Number.isFinite(value);
        })
    ) {

        showError(
            "Enter valid numeric values in all required fields."
        );

        return;
    }

    if (
        pipeID <= 0 ||
        currentOrifice <= 0 ||
        currentDP <= 0 ||
        desiredDP <= 0
    ) {

        showError(
            "Pipe I.D., plate size and pressure values must be greater than zero."
        );

        return;
    }

    if (currentOrifice >= pipeID) {

        showError(
            "Current orifice bore must be smaller than Pipe I.D."
        );

        return;
    }

    const currentBeta =
        currentOrifice / pipeID;

    if (currentBeta >= 1) {

        showError(
            "Current plate produces an invalid beta ratio."
        );

        return;
    }

    const calculatedDiameter =
        calculateRequiredDiameter(
            pipeID,
            currentOrifice,
            currentDP,
            desiredDP
        );

    if (
        !Number.isFinite(calculatedDiameter) ||
        calculatedDiameter <= 0 ||
        calculatedDiameter >= pipeID
    ) {

        showError(
            "No valid plate could be calculated from the entered values."
        );

        return;
    }

    const plateResult =
        getNearestStandardSize(
            calculatedDiameter,
            pipeID
        );

    const nearestSize =
        plateResult.nearestSize;

    const availableSizes =
        plateResult.availableSizes;

    if (!nearestSize) {

        showError(
            "No standard American plate size is available for this Pipe I.D."
        );

        return;
    }

    const expectedDP =
        calculateExpectedDP(
            nearestSize,
            pipeID,
            currentOrifice,
            currentDP
        );

    const betaRatio =
        nearestSize / pipeID;

    const betaStatus =
        getBetaStatus(betaRatio);

    document.getElementById(
        "nearestPlate"
    ).textContent =
        cleanSize(nearestSize) + '"';

    document.getElementById(
        "fractionPlate"
    ).textContent =
        getFractionName(nearestSize);

    document.getElementById(
        "calculatedBore"
    ).textContent =
        calculatedDiameter.toFixed(3) + '"';

    document.getElementById(
        "expectedDP"
    ).textContent =
        expectedDP.toFixed(1) +
        " " +
        getDPUnitLabel(dpUnit);

    document.getElementById(
        "betaRatio"
    ).textContent =
        betaRatio.toFixed(3);

    const statusElement =
        document.getElementById("status");

    statusElement.textContent =
        betaStatus.text;

    statusElement.className =
        betaStatus.className;

    createNearbyPlateTable(
        availableSizes,
        nearestSize,
        pipeID,
        currentOrifice,
        currentDP,
        dpUnit
    );

    lastCalculation = {
        id: Date.now(),
        jobName:
            jobName || "Unnamed Job",

        pipeID: pipeID,
        currentOrifice: currentOrifice,
        currentDP: currentDP,
        desiredDP: desiredDP,

        calculatedDiameter:
            calculatedDiameter,

        nearestSize:
            nearestSize,

        expectedDP:
            expectedDP,

        betaRatio:
            betaRatio,

        status:
            betaStatus.text,

        dpUnit:
            dpUnit,

        createdAt:
            new Date().toISOString()
    };

    const resultCard =
        document.getElementById("resultCard");

    resultCard.style.display = "block";

    setTimeout(function () {

        resultCard.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

    }, 100);
}


// ======================================================
// NEARBY PLATE TABLE
// ======================================================

function createNearbyPlateTable(
    availableSizes,
    nearestSize,
    pipeID,
    currentOrifice,
    currentDP,
    dpUnit
) {

    const selectedIndex =
        availableSizes.indexOf(nearestSize);

    const startIndex =
        Math.max(
            0,
            selectedIndex - 3
        );

    const endIndex =
        Math.min(
            availableSizes.length,
            selectedIndex + 4
        );

    const nearbySizes =
        availableSizes.slice(
            startIndex,
            endIndex
        );

    let tableHTML = `
        <div class="table-row table-head">
            <div>Plate</div>
            <div>Expected DP</div>
            <div>Beta</div>
        </div>
    `;

    nearbySizes.forEach(function (size) {

        const pressure =
            calculateExpectedDP(
                size,
                pipeID,
                currentOrifice,
                currentDP
            );

        const beta =
            size / pipeID;

        const status =
            getBetaStatus(beta);

        const selectedClass =
            Math.abs(size - nearestSize) < 0.00001
                ? "selected"
                : "";

        tableHTML += `
            <div class="table-row ${selectedClass}">

                <div>
                    <strong>
                        ${cleanSize(size)}"
                    </strong>

                    <br>

                    <small>
                        ${getFractionName(size)}
                    </small>
                </div>

                <div>
                    ${pressure.toFixed(1)}
                    ${getDPUnitLabel(dpUnit)}
                </div>

                <div class="${status.className}">
                    ${beta.toFixed(3)}
                </div>

            </div>
        `;
    });

    document.getElementById(
        "plateTable"
    ).innerHTML = tableHTML;
}


// ======================================================
// HISTORY
// ======================================================

function getHistory() {

    try {

        const storedHistory =
            localStorage.getItem(
                STORAGE_KEYS.history
            );

        if (!storedHistory) {
            return [];
        }

        const history =
            JSON.parse(storedHistory);

        if (!Array.isArray(history)) {
            return [];
        }

        return history;

    } catch (error) {

        return [];
    }
}


function saveCalculation() {

    if (!lastCalculation) {

        alert(
            "Calculate a plate before saving."
        );

        return;
    }

    const history = getHistory();

    history.unshift(lastCalculation);

    const limitedHistory =
        history.slice(0, 50);

    localStorage.setItem(
        STORAGE_KEYS.history,
        JSON.stringify(limitedHistory)
    );

    alert("Calculation saved.");
}


function renderHistory() {

    const historyList =
        document.getElementById(
            "historyList"
        );

    const history = getHistory();

    if (history.length === 0) {

        historyList.innerHTML = `
            <div class="history-empty">
                No saved calculations yet.
            </div>
        `;

        return;
    }

    let historyHTML = "";

    history.forEach(function (item) {

        const createdDate =
            new Date(item.createdAt);

        const dateLabel =
            createdDate.toLocaleString();

        historyHTML += `
            <article class="history-item">

                <div class="history-item-top">

                    <div>
                        <h3>
                            ${escapeHTML(
                                item.jobName ||
                                "Unnamed Job"
                            )}
                        </h3>

                        <div class="history-date">
                            ${dateLabel}
                        </div>
                    </div>

                    <button
                        class="small-danger-button"
                        type="button"
                        onclick="deleteHistoryItem(${item.id})"
                    >
                        Delete
                    </button>

                </div>

                <div class="history-data">

                    <div>
                        <span>Pipe I.D.</span>
                        <strong>
                            ${Number(item.pipeID).toFixed(3)}"
                        </strong>
                    </div>

                    <div>
                        <span>Current Plate</span>
                        <strong>
                            ${cleanSize(item.currentOrifice)}"
                        </strong>
                    </div>

                    <div>
                        <span>Recommended</span>
                        <strong>
                            ${cleanSize(item.nearestSize)}"
                        </strong>
                    </div>

                    <div>
                        <span>Expected DP</span>
                        <strong>
                            ${Number(item.expectedDP).toFixed(1)}
                            ${getDPUnitLabel(item.dpUnit)}
                        </strong>
                    </div>

                    <div>
                        <span>Beta</span>
                        <strong>
                            ${Number(item.betaRatio).toFixed(3)}
                        </strong>
                    </div>

                    <div>
                        <span>Status</span>
                        <strong>
                            ${escapeHTML(item.status)}
                        </strong>
                    </div>

                </div>

            </article>
        `;
    });

    historyList.innerHTML = historyHTML;
}


function deleteHistoryItem(id) {

    const history = getHistory();

    const updatedHistory =
        history.filter(function (item) {
            return Number(item.id) !== Number(id);
        });

    localStorage.setItem(
        STORAGE_KEYS.history,
        JSON.stringify(updatedHistory)
    );

    renderHistory();
}


function clearHistory() {

    const confirmed =
        confirm(
            "Delete all saved calculations?"
        );

    if (!confirmed) {
        return;
    }

    localStorage.removeItem(
        STORAGE_KEYS.history
    );

    renderHistory();
}


// ======================================================
// SHARE RESULT
// ======================================================

function buildShareText(calculation) {

    return [
        "WELL TEST ORIFICE SELECTOR",
        "",
        "Job: " + calculation.jobName,
        "Pipe I.D.: " +
            Number(calculation.pipeID).toFixed(3) +
            '"',

        "Current Plate: " +
            cleanSize(calculation.currentOrifice) +
            '"',

        "Current DP: " +
            Number(calculation.currentDP).toFixed(1) +
            " " +
            getDPUnitLabel(calculation.dpUnit),

        "Desired DP: " +
            Number(calculation.desiredDP).toFixed(1) +
            " " +
            getDPUnitLabel(calculation.dpUnit),

        "",
        "Calculated Bore: " +
            Number(
                calculation.calculatedDiameter
            ).toFixed(3) +
            '"',

        "Recommended Plate: " +
            cleanSize(calculation.nearestSize) +
            '" (' +
            getFractionName(
                calculation.nearestSize
            ) +
            ")",

        "Expected DP: " +
            Number(
                calculation.expectedDP
            ).toFixed(1) +
            " " +
            getDPUnitLabel(calculation.dpUnit),

        "Beta Ratio: " +
            Number(
                calculation.betaRatio
            ).toFixed(3),

        "Status: " +
            calculation.status,

        "",
        "Field estimate only."
    ].join("\n");
}


async function shareResult() {

    if (!lastCalculation) {

        alert(
            "Calculate a plate before sharing."
        );

        return;
    }

    const shareText =
        buildShareText(lastCalculation);

    if (navigator.share) {

        try {

            await navigator.share({
                title:
                    "Orifice Plate Calculation",
                text:
                    shareText
            });

            return;

        } catch (error) {

            if (error.name === "AbortError") {
                return;
            }
        }
    }

    try {

        await navigator.clipboard.writeText(
            shareText
        );

        alert(
            "Calculation copied to clipboard."
        );

    } catch (error) {

        alert(shareText);
    }
}


// ======================================================
// STANDARD PLATE TABLE PAGE
// ======================================================

function renderStandardPlateTable() {

    const table =
        document.getElementById(
            "standardPlateTable"
        );

    const pipeID =
        Number(
            document.getElementById(
                "tablePipeID"
            ).value
        );

    if (
        !Number.isFinite(pipeID) ||
        pipeID <= 0
    ) {

        table.innerHTML = `
            <div class="history-empty">
                Enter a valid Pipe I.D.
            </div>
        `;

        return;
    }

    const availableSizes =
        getAvailableSizes(pipeID);

    if (availableSizes.length === 0) {

        table.innerHTML = `
            <div class="history-empty">
                No plate sizes are available.
            </div>
        `;

        return;
    }

    let tableHTML = `
        <div class="table-row table-head">
            <div>Decimal</div>
            <div>Fraction</div>
            <div>Beta</div>
        </div>
    `;

    availableSizes.forEach(function (size) {

        const beta =
            size / pipeID;

        const status =
            getBetaStatus(beta);

        tableHTML += `
            <div class="table-row">

                <div>
                    ${cleanSize(size)}"
                </div>

                <div>
                    ${getFractionName(size)}
                </div>

                <div class="${status.className}">
                    ${beta.toFixed(3)}
                </div>

            </div>
        `;
    });

    table.innerHTML = tableHTML;
}


// ======================================================
// THEME
// ======================================================

function applyTheme(theme) {

    if (theme === "light") {
        document.body.classList.add(
            "light-theme"
        );
    } else {
        document.body.classList.remove(
            "light-theme"
        );
    }
}


function loadTheme() {

    const storedTheme =
        localStorage.getItem(
            STORAGE_KEYS.theme
        );

    if (storedTheme) {
        applyTheme(storedTheme);
        return;
    }

    const prefersLight =
        window.matchMedia &&
        window.matchMedia(
            "(prefers-color-scheme: light)"
        ).matches;

    applyTheme(
        prefersLight ? "light" : "dark"
    );
}


function toggleTheme() {

    const isLight =
        document.body.classList.contains(
            "light-theme"
        );

    const newTheme =
        isLight ? "dark" : "light";

    localStorage.setItem(
        STORAGE_KEYS.theme,
        newTheme
    );

    applyTheme(newTheme);
}


// ======================================================
// SECURITY HELPER
// ======================================================

function escapeHTML(value) {

    const element =
        document.createElement("div");

    element.textContent =
        String(value ?? "");

    return element.innerHTML;
}


// ======================================================
// APPLICATION INITIALIZATION
// ======================================================

document.addEventListener(
    "DOMContentLoaded",
    function () {

        loadTheme();
        displaySettings();
        updateDPUnitLabels();
        renderHistory();
        renderStandardPlateTable();

        document.getElementById(
            "resultCard"
        ).style.display = "none";
    }
);
