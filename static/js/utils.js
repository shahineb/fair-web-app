function cubicInterpolation(points, numSteps = 100) {
    const interpolatedPoints = [];
    for (let i = 0; i < points.length - 1; i++) {
        const p0 = i > 0 ? points[i - 1] : points[i];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = i < points.length - 2 ? points[i + 2] : points[i + 1];

        for (let t = 0; t <= numSteps; t++) {
            const tNorm = t / numSteps;
            const x = cubicHermite(p0.x, p1.x, p2.x, p3.x, tNorm);
            const y = cubicHermite(p0.y, p1.y, p2.y, p3.y, tNorm);
            interpolatedPoints.push({ x, y });
        }
    }
    return interpolatedPoints;
}

function cubicHermite(p0, p1, p2, p3, t) {
    const a = -0.5 * p0 + 1.5 * p1 - 1.5 * p2 + 0.5 * p3;
    const b = p0 - 2.5 * p1 + 2 * p2 - 0.5 * p3;
    const c = -0.5 * p0 + 0.5 * p2;
    const d = p1;

    return a * t ** 3 + b * t ** 2 + c * t + d;
}