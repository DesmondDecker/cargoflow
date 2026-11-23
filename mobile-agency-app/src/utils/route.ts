export interface LatLng {
  lat: number;
  lng: number;
}

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

// Points along the great-circle (shortest) path between two places, including
// both ends. Longitudes are unwrapped so a path across the Pacific is one
// continuous line instead of jumping from +180 to -180.
export function greatCircle(a: LatLng, b: LatLng, steps = 48): LatLng[] {
  const [φ1, λ1, φ2, λ2] = [rad(a.lat), rad(a.lng), rad(b.lat), rad(b.lng)];
  const d = 2 * Math.asin(Math.sqrt(Math.sin((φ2 - φ1) / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin((λ2 - λ1) / 2) ** 2));
  if (d === 0) return [a, b];

  const points: LatLng[] = [];
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
    const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
    const z = A * Math.sin(φ1) + B * Math.sin(φ2);
    points.push({ lat: deg(Math.atan2(z, Math.sqrt(x * x + y * y))), lng: deg(Math.atan2(y, x)) });
  }
  for (let i = 1; i < points.length; i++) {
    while (points[i].lng - points[i - 1].lng > 180) points[i].lng -= 360;
    while (points[i].lng - points[i - 1].lng < -180) points[i].lng += 360;
  }
  return points;
}

export function distanceKm(a: LatLng, b: LatLng): number {
  const [φ1, φ2] = [rad(a.lat), rad(b.lat)];
  const h = Math.sin((φ2 - φ1) / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return Math.round(2 * 6371 * Math.asin(Math.sqrt(h)));
}
