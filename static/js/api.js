import { 
    canvasState,
    plotTimeSeries,
    ayear,
    byear,
    aco2,
    bco2,
    getSelectedModels
} from './canvas.js';

const saveButton = document.getElementById('saveCurve');
const apiUrl = "https://fair-web-app-production.up.railway.app/process";
// const apiUrl = 'http://127.0.0.1:5000/process';


saveButton.addEventListener('click', () => {
    const interpolatedPoints = cubicInterpolation(canvasState.points);

    let csvContent = "year,CO2\n";
    interpolatedPoints.forEach(point => {
        const year = ayear * point.x + byear;
        const CO2 = aco2 * point.y + bco2;
        csvContent += `${year.toFixed(2)},${CO2.toFixed(2)}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const formData = new FormData();
    formData.append('file', blob, 'curve_data.csv');

    const otherForcers = document.getElementById('otherForcers').value;
    formData.append('other_forcers', otherForcers);

    const selectedModels = getSelectedModels();
    formData.append('models', JSON.stringify(selectedModels));

    fetch(apiUrl, {
        method: 'POST',
        body: formData
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        console.log('Response from backend:', data);
        plotTimeSeries(data.year, data.co2, data.ensemble, data.ecs);
    })
    .catch(error => {
        console.error('Error:', error);
        alert('An error occurred: ' + error.message);
    });
});
