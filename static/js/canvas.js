export const canvas = document.getElementById('curveCanvas');
export const ctx = canvas.getContext('2d');
export const timeSeriesCanvas = document.getElementById('timeSeriesChart');
export const canvasState = {hoveredPoint: null, points: [], history: []};

const clearButton = document.getElementById('clearCanvas');
const undoButton = document.getElementById('undoAction');
const tooltip = document.getElementById('tooltip');

export const ayear = 0.26905829596412556;
export const byear = 1958.2600896860986;
export const aco2 = -0.46204620462046203;
export const bco2 = 140.46864686468646;

let timeSeriesChart;
let draggingPoint = null;
let newPointIndex = null;
let referenceTrajectories = [];


export function initializeCanvas() {
    canvas.style.width = "800px";
    canvas.style.height = "400px";
    timeSeriesCanvas.style.width = "800px"; 
    timeSeriesCanvas.style.height = "400px";
    adjustCanvasResolution();
}


function adjustCanvasResolution() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const timeSeriesRect = timeSeriesCanvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    timeSeriesCanvas.width = timeSeriesRect.width * dpr;
    timeSeriesCanvas.height = timeSeriesRect.height * dpr;
    ctx.scale(dpr, dpr);
    drawCurve();
}

function addReferenceTrajectory(trajectory) {
    referenceTrajectories.push(trajectory);
}


function undoAction() {
    if (canvasState.history.length > 0) {
        canvasState.points = canvasState.history.pop();
        drawCurve();
    }
}

function saveToHistory() {
    canvasState.history.push([...canvasState.points.map(point => ({ ...point }))]);
}

function getMousePos(event) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
    };
}

function getPointIndexAt(pos, radius = 10) {
    return canvasState.points.findIndex(
        (point) => Math.hypot(point.x - pos.x, point.y - pos.y) < radius
    );
}

function getPointOnCurve(pos, threshold = 5) {
    const interpolatedPoints = cubicInterpolation(canvasState.points);
    for (let i = 0; i < interpolatedPoints.length; i++) {
        const canvasPoint = interpolatedPoints[i];
        if (Math.hypot(canvasPoint.x - pos.x, canvasPoint.y - pos.y) < threshold) {
            return canvasPoint;
        }
    }
    return null;
}


function displayTooltip(clientX, clientY, point) {
    const year = ayear * point.x + byear;
    const CO2 = aco2 * point.y + bco2;

    tooltip.style.display = 'block';
    tooltip.style.left = `${clientX + 10}px`;
    tooltip.style.top = `${clientY + 10}px`;
    tooltip.innerHTML = `Year: ${year.toFixed(1)}, CO2: ${CO2.toFixed(1)} GtCO2/yr`;
}



function drawCurve() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid();
    drawReferenceTrajectories(ctx);
    drawXAxis();
    drawYAxis();
    drawBackgroundText('SSP1-1.9', 563, 340, {color: 'rgba(0, 0, 255, 0.5)'});
    drawBackgroundText('SSP5-8.5', 563, 40, {color: 'rgba(0, 0, 255, 0.5)'});

    canvasState.points.forEach((point, index) => {
        drawPoint(point, index === canvasState.hoveredPoint);
    });

    if (canvasState.points.length < 2) return;

    const interpolatedPoints = cubicInterpolation(canvasState.points);

    ctx.beginPath();
    ctx.moveTo(interpolatedPoints[0].x, interpolatedPoints[0].y);
    for (let i = 1; i < interpolatedPoints.length; i++) {
        ctx.lineTo(interpolatedPoints[i].x, interpolatedPoints[i].y);
    }
    ctx.strokeStyle = "black";
    ctx.stroke();
}

function drawGrid() {
    const labelsX = [1980, 2000, 2020, 2040, 2060, 2080, 2100];
    const labelsY = [-20, 0, 20, 40, 60, 80, 100, 120];
    const paddingX = 80;
    const paddingY = 50;

    labelsX.forEach((_, i) => {
        const x = paddingX + (i / (labelsX.length - 1)) * (canvas.width / window.devicePixelRatio - 2 * paddingX);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height / window.devicePixelRatio - 30);
        ctx.strokeStyle = "#ddd";
        ctx.stroke();
    });

    labelsY.forEach((_, i) => {
        const y = canvas.height / window.devicePixelRatio - paddingY - (i / (labelsY.length - 1)) * (canvas.height / window.devicePixelRatio - 2 * paddingY) - 5;
        ctx.beginPath();
        ctx.moveTo(60, y);
        ctx.lineTo(canvas.width / window.devicePixelRatio, y);
        ctx.strokeStyle = "#ddd";
        ctx.stroke();
    });
}

function drawXAxis() {
    ctx.fillStyle = "black";
    ctx.font = "18px Arial";
    ctx.textAlign = "center";

    const labels = [1980, 2000, 2020, 2040, 2060, 2080, 2100];
    const padding = 80;
    const labelPositions = labels.map(
        (year, i) => padding + (i / (labels.length - 1)) * (canvas.width / window.devicePixelRatio - 2 * padding)
    );

    labels.forEach((label, i) => {
        const x = labelPositions[i];
        const y = canvas.height / window.devicePixelRatio - 10;
        ctx.fillText(label, x, y);
    });
}

function drawYAxis() {
    ctx.fillStyle = "black";
    ctx.font = "18px Arial";
    ctx.textAlign = "right";

    const labels = [-20, 0, 20, 40, 60, 80, 100, 120];
    const padding = 50;
    const labelPositions = labels.map(
        (value, i) => canvas.height / window.devicePixelRatio - padding - (i / (labels.length - 1)) * (canvas.height / window.devicePixelRatio - 2 * padding)
    );

    labels.forEach((label, i) => {
        const x = 50;
        const y = labelPositions[i];
        ctx.fillText(label, x, y);
    });

    ctx.save();
    ctx.translate(20, canvas.height / (2 * window.devicePixelRatio));
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.fillText("GtCO2/yr", 0, 0);
    ctx.restore();
}

function drawPoint(point, isHovered = false) {
    ctx.beginPath();
    ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = isHovered ? "blue" : "black";
    ctx.fill();
}

function drawReferenceTrajectories(ctx) {
    referenceTrajectories.forEach((trajectory, index) => {
        ctx.beginPath();
        trajectory.forEach((point, i) => {
            const x = (point.year - byear) / ayear; // Adjust scaling
            const y = (point.emission - bco2) / aco2; // Adjust scaling
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        ctx.strokeStyle = `rgba(0, 0, 255, ${0.4})`; // Different opacity for each file
        ctx.lineWidth = 2;
        ctx.stroke();
    });
}


function drawBackgroundText(text, x, y, options = {}) {
    const { font = '16px Arial', color = 'color: rgba(0, 0, 255, 0.4)', align = 'center' } = options;
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(text, x, y);
}


export function plotTimeSeries(years, co2, ensemble) {
    console.log(ensemble);
    if (timeSeriesChart) {
        timeSeriesChart.data.labels = years;
        timeSeriesChart.data.datasets[0].data = co2;

        // Add ensemble datasets
        ensemble.forEach(series => {
            timeSeriesChart.data.datasets.push({
                label: 'Ensemble Member',
                data: series,
                borderColor: 'rgba(255, 165, 0, 0.3)', // Light orange for ensemble
                borderWidth: 0.5,
                pointRadius: 0, // No points for ensemble
                fill: false,
            });
        });

        timeSeriesChart.update();
    } else {
        const ctx = timeSeriesCanvas.getContext('2d');
        timeSeriesChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: years,
                datasets: [{
                    label: 'ΔT (C)',
                    data: co2,
                    borderColor: 'orange',
                    borderWidth: 0.5,
                    backgroundColor: 'rgba(255, 165, 0, 0.2)',
                    pointRadius: 2, // Size of the dots (smaller than default)
                    pointHoverRadius: 6, // Size of the dots when hovered
                    pointBackgroundColor: 'orange', // Dot color
                    pointBorderColor: 'orange', // Border color of dots
                },
                ...ensemble.map(series => ({
                    label: 'Ensemble Member',
                    data: series,
                    borderColor: 'rgba(255, 165, 0, 0.3)', // Light orange for ensemble
                    borderWidth: 0.5,
                    pointRadius: 0, // No points for ensemble
                    fill: false,
                }))
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false // Disable the legend
                    }
                },
                scales: {
                    x: { title: { display: true, text: 'Year', color: 'black', font: {size: 18}},
                         ticks: { color: 'black', font: {size: 16}}
                    },
                    y: { title: { display: true, text: 'ΔT (C)', color: 'black', font: {size: 18}},
                         ticks: { color: 'black', font: {size: 16}}
                    }
                }
            }
        });
    }
}



function loadReferenceTrajectory(file) {
    fetch(file)
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.text();
    })
    .then(csvText => {
        const trajectory = parseCSV(csvText); 
        addReferenceTrajectory(trajectory);
    })
    .catch(error => console.error('Error loading CSV:', error));
}


export function initializeListeners(){
    loadReferenceTrajectory('static/csv/historical_co2.csv')
    loadReferenceTrajectory('static/csv/ssp119_co2.csv')
    loadReferenceTrajectory('static/csv/ssp585_co2.csv')
    console.log(referenceTrajectories);

    window.addEventListener('resize', () => {
        adjustCanvasResolution();
    });
    
    canvas.addEventListener('mousedown', (e) => {
        saveToHistory();
        const mousePos = getMousePos(e);
        const pointIndex = getPointIndexAt(mousePos);
    
        if (pointIndex !== -1) {
            draggingPoint = pointIndex;
            displayTooltip(e.clientX, e.clientY, canvasState.points[draggingPoint]);
        } else {
            const newPoint = mousePos;
            canvasState.points.push(newPoint);
            newPointIndex = canvasState.points.length - 1;
            draggingPoint = newPointIndex;
            displayTooltip(e.clientX, e.clientY, newPoint);
            drawCurve();
        }
    });
    
    canvas.addEventListener('mousemove', (e) => {
        const mousePos = getMousePos(e);
    
        if (draggingPoint !== null) {
            canvasState.points[draggingPoint] = mousePos;
            displayTooltip(e.clientX, e.clientY, canvasState.points[draggingPoint]);
            drawCurve();
            return;
        }
    
        const pointIndex = getPointIndexAt(mousePos);
        if (pointIndex !== -1) {
            canvasState.hoveredPoint = pointIndex;
            canvas.style.cursor = "pointer";
            displayTooltip(e.clientX, e.clientY, canvasState.points[canvasState.hoveredPoint]);
        } else {
            canvasState.hoveredPoint = null;
            canvas.style.cursor = "crosshair";
    
            const hoveredCurvePoint = getPointOnCurve(mousePos);
            if (hoveredCurvePoint) {
                displayTooltip(e.clientX, e.clientY, hoveredCurvePoint);
            } else {
                tooltip.style.display = 'none';
            }
        }
    
        drawCurve();
    });
    
    canvas.addEventListener('mouseup', () => {
        draggingPoint = null;
        newPointIndex = null;
        tooltip.style.display = 'none';
    });
    
    undoButton.addEventListener('click', undoAction);
    
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
            e.preventDefault();
            undoAction();
        }
    });
    
    
    clearButton.addEventListener('click', () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvasState.points = [];
        canvasState.history = [];
        tooltip.style.display = 'none';
    });

    document.addEventListener('DOMContentLoaded', () => {
        const dropdown = document.getElementById('otherForcers');
        dropdown.value = 'ssp245'; // Set the default value
    });
}
