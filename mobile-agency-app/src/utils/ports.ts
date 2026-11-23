// Approximate positions of the world's major container ports, so a shipment's
// route can be drawn between its load and discharge ports. Positions are the
// port area, good enough for a route map and not for navigation. A port that
// is not in this list is simply not drawn; nothing is guessed.
export interface Port {
  name: string;
  lat: number;
  lng: number;
  aliases?: string[];
}

export const PORTS: Port[] = [
  { name: 'Freetown', lat: 8.49, lng: -13.23 },
  { name: 'Conakry', lat: 9.51, lng: -13.71 },
  { name: 'Monrovia', lat: 6.35, lng: -10.8 },
  { name: 'Abidjan', lat: 5.3, lng: -4.02 },
  { name: 'Tema', lat: 5.63, lng: 0.02 },
  { name: 'Lome', lat: 6.13, lng: 1.28 },
  { name: 'Cotonou', lat: 6.35, lng: 2.43 },
  { name: 'Lagos', lat: 6.44, lng: 3.36, aliases: ['Apapa', 'Tin Can', 'Lekki'] },
  { name: 'Dakar', lat: 14.68, lng: -17.43 },
  { name: 'Luanda', lat: -8.8, lng: 13.23 },
  { name: 'Casablanca', lat: 33.6, lng: -7.62 },
  { name: 'Tanger Med', lat: 35.89, lng: -5.5, aliases: ['Tangier'] },
  { name: 'Durban', lat: -29.87, lng: 31.03 },
  { name: 'Cape Town', lat: -33.91, lng: 18.43 },
  { name: 'Mombasa', lat: -4.06, lng: 39.67 },
  { name: 'Dar es Salaam', lat: -6.82, lng: 39.29 },
  { name: 'Port Said', lat: 31.26, lng: 32.3 },
  { name: 'Algeciras', lat: 36.13, lng: -5.44 },
  { name: 'Valencia', lat: 39.45, lng: -0.32 },
  { name: 'Barcelona', lat: 41.35, lng: 2.17 },
  { name: 'Marseille', lat: 43.3, lng: 5.37, aliases: ['Fos', 'Fos-sur-Mer'] },
  { name: 'Genoa', lat: 44.41, lng: 8.93, aliases: ['Genova'] },
  { name: 'Gioia Tauro', lat: 38.43, lng: 15.9 },
  { name: 'Piraeus', lat: 37.94, lng: 23.64 },
  { name: 'Istanbul', lat: 40.96, lng: 28.69, aliases: ['Ambarli'] },
  { name: 'Le Havre', lat: 49.48, lng: 0.11 },
  { name: 'Antwerp', lat: 51.27, lng: 4.35, aliases: ['Antwerpen'] },
  { name: 'Rotterdam', lat: 51.95, lng: 4.14 },
  { name: 'Hamburg', lat: 53.54, lng: 9.97 },
  { name: 'Bremerhaven', lat: 53.55, lng: 8.55 },
  { name: 'Felixstowe', lat: 51.96, lng: 1.35 },
  { name: 'Southampton', lat: 50.9, lng: -1.4 },
  { name: 'Jeddah', lat: 21.49, lng: 39.17 },
  { name: 'Jebel Ali', lat: 25.01, lng: 55.06, aliases: ['Dubai'] },
  { name: 'Salalah', lat: 16.95, lng: 54.0 },
  { name: 'Karachi', lat: 24.84, lng: 66.98 },
  { name: 'Nhava Sheva', lat: 18.95, lng: 72.95, aliases: ['Mumbai', 'JNPT', 'Jawaharlal Nehru'] },
  { name: 'Mundra', lat: 22.74, lng: 69.7 },
  { name: 'Chennai', lat: 13.08, lng: 80.29 },
  { name: 'Colombo', lat: 6.94, lng: 79.85 },
  { name: 'Chittagong', lat: 22.33, lng: 91.8, aliases: ['Chattogram'] },
  { name: 'Port Klang', lat: 3.0, lng: 101.39, aliases: ['Klang'] },
  { name: 'Tanjung Pelepas', lat: 1.36, lng: 103.55 },
  { name: 'Singapore', lat: 1.26, lng: 103.82 },
  { name: 'Jakarta', lat: -6.1, lng: 106.88, aliases: ['Tanjung Priok'] },
  { name: 'Laem Chabang', lat: 13.08, lng: 100.88 },
  { name: 'Ho Chi Minh', lat: 10.76, lng: 106.79, aliases: ['Cat Lai', 'Saigon'] },
  { name: 'Manila', lat: 14.58, lng: 120.97 },
  { name: 'Hong Kong', lat: 22.3, lng: 114.17 },
  { name: 'Shenzhen', lat: 22.55, lng: 114.2, aliases: ['Yantian', 'Shekou', 'Chiwan'] },
  { name: 'Guangzhou', lat: 22.75, lng: 113.6, aliases: ['Nansha'] },
  { name: 'Xiamen', lat: 24.48, lng: 118.08 },
  { name: 'Shanghai', lat: 31.23, lng: 121.5 },
  { name: 'Ningbo', lat: 29.93, lng: 121.85, aliases: ['Ningbo-Zhoushan', 'Zhoushan'] },
  { name: 'Qingdao', lat: 36.07, lng: 120.38 },
  { name: 'Tianjin', lat: 39.0, lng: 117.74, aliases: ['Xingang'] },
  { name: 'Dalian', lat: 38.92, lng: 121.65 },
  { name: 'Kaohsiung', lat: 22.61, lng: 120.27 },
  { name: 'Busan', lat: 35.1, lng: 129.04 },
  { name: 'Tokyo', lat: 35.62, lng: 139.78 },
  { name: 'Yokohama', lat: 35.45, lng: 139.65 },
  { name: 'Sydney', lat: -33.86, lng: 151.21 },
  { name: 'Melbourne', lat: -37.82, lng: 144.92 },
  { name: 'Vancouver', lat: 49.29, lng: -123.11 },
  { name: 'Oakland', lat: 37.8, lng: -122.3 },
  { name: 'Los Angeles', lat: 33.74, lng: -118.27, aliases: ['Long Beach'] },
  { name: 'Houston', lat: 29.73, lng: -95.27 },
  { name: 'Savannah', lat: 32.08, lng: -81.09 },
  { name: 'New York', lat: 40.67, lng: -74.15, aliases: ['Newark', 'New Jersey'] },
  { name: 'Manzanillo', lat: 19.05, lng: -104.32 },
  { name: 'Santos', lat: -23.96, lng: -46.3 },
  { name: 'Buenos Aires', lat: -34.6, lng: -58.37 },
];

const clean = (s: string) =>
  s
    .toUpperCase()
    .replace(/\bPORT OF\b/g, ' ')
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// "QINGDAO, CN", "Port of Qingdao" and "QINGDAO QIANWAN CONTAINER TERMINAL"
// all find Qingdao. Only the part before a comma is used (the rest is the
// country code), and a port is found by its name or any alias at the start of
// the text; anything that does not match is not drawn.
export function resolvePort(place?: string): Port | undefined {
  if (!place) return undefined;
  const text = clean(place.split(',')[0]);
  if (!text) return undefined;
  const matches = (name: string) => {
    const n = clean(name);
    return text === n || text.startsWith(`${n} `);
  };
  return PORTS.find((p) => matches(p.name) || (p.aliases ?? []).some(matches));
}
