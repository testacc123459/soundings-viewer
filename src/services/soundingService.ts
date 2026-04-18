import type { SoundingData, SoundingLevel, StationInfo, ModelType } from '../types';

/**
 * Generates realistic model sounding data for demonstration.
 *
 * In production, this would fetch from NOMADS, THREDDS, or similar
 * operational NWP data servers. We generate physically-consistent
 * synthetic profiles that vary by station location, model type,
 * and forecast hour.
 */

const PRESSURE_LEVELS = [
  1000, 975, 950, 925, 900, 875, 850, 825, 800, 775,
  750, 725, 700, 675, 650, 625, 600, 575, 550, 525,
  500, 475, 450, 425, 400, 375, 350, 325, 300, 275,
  250, 225, 200, 175, 150, 125, 100,
];

/** Seeded pseudo-random number generator */
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/** Generate a realistic temperature profile */
function generateTemperatureProfile(
  station: StationInfo,
  rng: () => number,
  model: ModelType,
  forecastHour: number,
): { temperature: number; dewpoint: number }[] {
  const latFactor = (90 - Math.abs(station.lat)) / 90;
  const baseSfcTemp = -10 + latFactor * 40 + (rng() - 0.5) * 15;
  const elevCorrection = station.elevation * 0.0065;
  let sfcTemp = baseSfcTemp - elevCorrection;

  // Diurnal/forecast hour variation
  const diurnal = 5 * Math.sin(((forecastHour % 24) - 6) * Math.PI / 12);
  sfcTemp += diurnal;

  // Model differences
  const modelBias = model === 'HRRR' ? rng() * 2 - 1 :
    model === 'GFS' ? rng() * 3 - 1.5 : 0;
  sfcTemp += modelBias;

  const result: { temperature: number; dewpoint: number }[] = [];
  let temp = sfcTemp;
  let dewp = sfcTemp - (3 + rng() * 8);

  // Generate varying instability pattern
  const hasInversion = rng() > 0.4;
  const inversionBase = 850 + rng() * 100;
  const inversionStrength = 2 + rng() * 6;
  const moistureDepth = 700 + rng() * 200;
  const dryAirAbove = rng() > 0.5;

  for (let i = 0; i < PRESSURE_LEVELS.length; i++) {
    const p = PRESSURE_LEVELS[i];

    if (i > 0) {
      const dp = PRESSURE_LEVELS[i - 1] - p;
      let lapseRate = 6.5 + rng() * 2 - 1;

      // Cap inversion
      if (hasInversion && Math.abs(p - inversionBase) < 30) {
        lapseRate = -inversionStrength;
      }

      // Tropopause
      if (p < 250) {
        lapseRate = -2 + rng();
      } else if (p < 300) {
        lapseRate = 2;
      }

      const dh = (dp / p) * 8000;
      temp -= lapseRate * dh / 1000;

      // Dewpoint depression
      let ddep = 3 + rng() * 5;
      if (p > moistureDepth) {
        ddep = 2 + rng() * 4; // moist low levels
      } else if (dryAirAbove && p < moistureDepth && p > 400) {
        ddep = 15 + rng() * 20; // dry air aloft
      }
      if (p < 300) {
        ddep = 20 + rng() * 30; // very dry upper levels
      }

      dewp = temp - ddep;
    }

    result.push({
      temperature: Math.round(temp * 10) / 10,
      dewpoint: Math.round(dewp * 10) / 10,
    });
  }

  return result;
}

/** Generate a realistic wind profile */
function generateWindProfile(
  _station: StationInfo,
  rng: () => number,
  model: ModelType,
): { windSpeed: number; windDir: number }[] {
  const result: { windSpeed: number; windDir: number }[] = [];

  // Surface wind
  let baseDir = 180 + rng() * 180;
  let baseSpeed = 5 + rng() * 15;

  // Veering with height (common in severe weather setups)
  const veerRate = (rng() > 0.4) ? (15 + rng() * 30) : (5 + rng() * 10);
  const speedIncrease = model === 'HRRR' ? (2 + rng() * 4) : (1.5 + rng() * 3);

  // Jet stream characteristics
  const jetLevel = 250 + rng() * 100;
  const jetSpeed = 40 + rng() * 80;
  const jetDir = 240 + rng() * 60;

  for (let i = 0; i < PRESSURE_LEVELS.length; i++) {
    const p = PRESSURE_LEVELS[i];

    if (i === 0) {
      result.push({
        windSpeed: Math.round(baseSpeed),
        windDir: Math.round(baseDir) % 360,
      });
    } else {
      const h = 44330 * (1 - Math.pow(p / 1013.25, 0.19029));
      const hKm = h / 1000;

      // Speed increases with height, peaks at jet level
      let speed = baseSpeed + speedIncrease * hKm;
      const jetProximity = Math.exp(-((p - jetLevel) ** 2) / 5000);
      speed += jetSpeed * jetProximity;

      // Direction veers with height
      let dir = baseDir + veerRate * hKm / 10;
      dir += (jetDir - baseDir) * jetProximity * 0.5;

      // Add some noise
      speed += (rng() - 0.5) * 5;
      dir += (rng() - 0.5) * 15;

      result.push({
        windSpeed: Math.max(0, Math.round(speed)),
        windDir: Math.round(((dir % 360) + 360) % 360),
      });
    }
  }

  return result;
}

/** Fetch (generate) sounding data for a station */
export async function fetchSoundingData(
  station: StationInfo,
  model: ModelType,
  forecastHour: number = 0
): Promise<SoundingData> {
  // Simulate network delay
  await new Promise(r => setTimeout(r, 300 + Math.random() * 500));

  const seed = hashString(`${station.id}-${model}-${forecastHour}`);
  const rng = seededRandom(seed);

  const temps = generateTemperatureProfile(station, rng, model, forecastHour);
  const winds = generateWindProfile(station, rng, model);

  const levels: SoundingLevel[] = PRESSURE_LEVELS.map((p, i) => ({
    pressure: p,
    height: Math.round(44330 * (1 - Math.pow(p / 1013.25, 0.19029))),
    temperature: temps[i].temperature,
    dewpoint: temps[i].dewpoint,
    windSpeed: winds[i].windSpeed,
    windDir: winds[i].windDir,
  }));

  // Compute run time (latest available cycle)
  const now = new Date();
  const cycleHour = Math.floor(now.getUTCHours() / 6) * 6;
  const runTime = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), cycleHour
  ));

  return {
    station,
    levels,
    model,
    runTime: runTime.toISOString(),
    forecastHour,
  };
}

/** Available forecast hours by model */
export function getAvailableForecastHours(model: ModelType): number[] {
  switch (model) {
    case 'HRRR':
      return Array.from({ length: 19 }, (_, i) => i); // 0-18
    case 'GFS':
      return [
        ...Array.from({ length: 41 }, (_, i) => i * 3), // 0-120 by 3
        ...Array.from({ length: 16 }, (_, i) => 132 + i * 12), // 132-384 by 12
      ];
    case 'RAP':
      return Array.from({ length: 22 }, (_, i) => i); // 0-21
    case 'NAM':
      return Array.from({ length: 29 }, (_, i) => i * 3); // 0-84 by 3
    default:
      return [0];
  }
}
