import { 
    canvasState,
    plotTimeSeries
} from './canvas.js';

const saveButton = document.getElementById('saveCurve');

saveButton.addEventListener('click', () => {
    const interpolatedPoints = cubicInterpolation(canvasState.points);

    let csvContent = "year,CO2\n";
    interpolatedPoints.forEach(point => {
        const year = 0.223214 * point.x + 1982.4;
        const CO2 = -0.1986754966887417 * point.y + 49.0728476821192;
        csvContent += `${year.toFixed(2)},${CO2.toFixed(2)}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const formData = new FormData();
    formData.append('file', blob, 'curve_data.csv');

    fetch('http://127.0.0.1:5000/process', {
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
        plotTimeSeries(data.year, data.co2);
    })
    .catch(error => {
        console.error('Error:', error);
        alert('An error occurred: ' + error.message);
    });
});
