const standardSizes = [];

// American sizes from 1/4" to 3-1/2"
// Increment = 1/16"
for (let size = 0.25; size <= 3.5; size += 0.0625) {
    standardSizes.push(Number(size.toFixed(4)));
}

function setPipe(value) {
    document.getElementById("pipeID").value = value.toFixed(3);
}

function geometryFactor(orificeDiameter, pipeDiameter) {
    const beta = orificeDiameter / pipeDiameter;

    return Math.pow(orificeDiameter, 4) /
        (1 - Math.pow(beta, 4));
}

function calculateExpectedDP(
    newOrifice,
    pipeID,
    currentOrifice,
    currentDP
) {
    const currentFactor =
        geometryFactor(currentOrifice, pipeID);

    const newFactor =
        geometryFactor(newOrifice, pipeID);

    return currentDP * currentFactor / newFactor;
}

function calculateRequiredDiameter(
    pipeID,
    currentOrifice,
    currentDP,
    desiredDP
) {
    const targetFactor =
        currentDP *
        geometryFactor(currentOrifice, pipeID) /
        desiredDP;

    let minimum = 0.01;
    let maximum = pipeID * 0.95;

    for (let i = 0; i < 100; i++) {
        const middle = (minimum + maximum) / 2;

        if (
            geometryFactor(middle, pipeID)
            < targetFactor
        ) {
            minimum = middle;
        } else {
            maximum = middle;
        }
    }

    return (minimum + maximum) / 2;
}

function getNearestStandardSize(
    calculatedDiameter,
    pipeID
) {
    const availableSizes = standardSizes.filter(
        size => size < pipeID * 0.85
    );

    let nearestSize = availableSizes[0];

    availableSizes.forEach(size => {
        const currentDifference =
            Math.abs(size - calculatedDiameter);

        const nearestDifference =
            Math.abs(nearestSize - calculatedDiameter);

        if (currentDifference < nearestDifference) {
            nearestSize = size;
        }
    });

    return {
        nearestSize,
        availableSizes
    };
}

function getFractionName(value) {
    let wholeNumber = Math.floor(value);

    let numerator =
        Math.round((value - wholeNumber) * 16);

    let denominator = 16;

    if (numerator === 16) {
        wholeNumber++;
        numerator = 0;
    }

    if (numerator === 0) {
        return wholeNumber + '"';
    }

    function greatestCommonDivisor(a, b) {
        while (b !== 0) {
            const remainder = a % b;
            a = b;
            b = remainder;
        }

        return a;
    }

    const divisor =
        greatestCommonDivisor(numerator, denominator);

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

    return numerator + "/" + denominator + '"';
}

function cleanSize(value) {
    return value
        .toFixed(4)
        .replace(/0+$/, "")
        .replace(/\.$/, "");
}

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

    errorBox.style.display = "none";
}

function calculateOrifice() {
    hideError();

    const pipeID = Number(
        document.getElementById("pipeID").value
    );

    const currentOrifice = Number(
        document.getElementById(
            "currentOrifice"
        ).value
    );

    const currentDP = Number(
        document.getElementById("currentDP").value
    );

    const desiredDP = Number(
        document.getElementById("desiredDP").value
    );

    if (
        !Number.isFinite(pipeID) ||
        !Number.isFinite(currentOrifice) ||
        !Number.isFinite(currentDP) ||
        !Number.isFinite(desiredDP)
    ) {
        showError("Enter valid numeric values.");
        return;
    }

    if (
        pipeID <= 0 ||
        currentOrifice <= 0 ||
        currentDP <= 0 ||
        desiredDP <= 0
    ) {
        showError(
            "All values must be greater than zero."
        );
        return;
    }

    if (currentOrifice >= pipeID) {
        showError(
            "Current orifice bore must be smaller than Pipe I.D."
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

    const sizeResult =
        getNearestStandardSize(
            calculatedDiameter,
            pipeID
        );

    const nearestSize =
        sizeResult.nearestSize;

    const availableSizes =
        sizeResult.availableSizes;

    const expectedDP =
        calculateExpectedDP(
            nearestSize,
            pipeID,
            currentOrifice,
            currentDP
        );

    const betaRatio =
        nearestSize / pipeID;

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
        expectedDP.toFixed(1) + " inH₂O";

    document.getElementById(
        "betaRatio"
    ).textContent =
        betaRatio.toFixed(3);

    const status =
        document.getElementById("status");

    if (
        betaRatio >= 0.20 &&
        betaRatio <= 0.75
    ) {
        status.textContent = "OK";
        status.style.color = "#72e29a";
    } else {
        status.textContent = "CHECK BETA";
        status.style.color = "#ffc66d";
    }

    createPlateTable(
        availableSizes,
        nearestSize,
        pipeID,
        currentOrifice,
        currentDP
    );

    const resultCard =
        document.getElementById("resultCard");

    resultCard.style.display = "block";

    resultCard.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

function createPlateTable(
    availableSizes,
    nearestSize,
    pipeID,
    currentOrifice,
    currentDP
) {
    const selectedIndex =
        availableSizes.indexOf(nearestSize);

    const startIndex =
        Math.max(0, selectedIndex - 3);

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
            <div>Plate Size</div>
            <div>Expected DP</div>
        </div>
    `;

    nearbySizes.forEach(size => {
        const pressure =
            calculateExpectedDP(
                size,
                pipeID,
                currentOrifice,
                currentDP
            );

        const selectedClass =
            size === nearestSize
                ? "selected"
                : "";

        tableHTML += `
            <div class="table-row ${selectedClass}">
                <div>
                    ${cleanSize(size)}"
                    <br>
                    <small>
                        ${getFractionName(size)}
                    </small>
                </div>

                <div>
                    ${pressure.toFixed(1)}
                    inH₂O
                </div>
            </div>
        `;
    });

    document.getElementById(
        "plateTable"
    ).innerHTML = tableHTML;
}

document.addEventListener(
    "DOMContentLoaded",
    function () {
        calculateOrifice();
    }
);
