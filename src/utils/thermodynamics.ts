import type { SoundingLevel, DerivedParams } from '../types';

/**
 * Atmospheric thermodynamic and kinematic calculations
 * for SHARPpy-style derived parameters
 */

const Rd = 287.05;   // Gas constant for dry air (J/(kg·K))
const Cp = 1005.7;   // Specific heat of dry air (J/(kg·K))
const Lv = 2.501e6;  // Latent heat of vaporization (J/kg)
const g = 9.81;      // Gravitational acceleration (m/s²)
const eps = 0.622;   // Ratio of molecular weight of water to dry air

/** Convert Celsius to Kelvin */
export function toKelvin(c: number): number {
  return c + 273.15;
}

/** Saturation vapor pressure (hPa) via Bolton (1980) */
export function satVaporPressure(tempC: number): number {
  return 6.112 * Math.exp((17.67 * tempC) / (tempC + 243.5));
}

/** Mixing ratio from temperature and pressure (kg/kg) */
export function mixingRatio(tempC: number, pressHpa: number): number {
  const es = satVaporPressure(tempC);
  return eps * es / (pressHpa - es);
}

/** Potential temperature (K) */
export function potentialTemp(tempC: number, pressHpa: number): number {
  return toKelvin(tempC) * Math.pow(1000 / pressHpa, Rd / Cp);
}

/** Wet-bulb potential temperature approximation */
export function thetaW(tempC: number, dewpC: number, pressHpa: number): number {
  const w = mixingRatio(dewpC, pressHpa);
  const theta = potentialTemp(tempC, pressHpa);
  return theta - (Lv / Cp) * w * 0.001; // rough approximation
}

/** Virtual temperature (K) */
export function virtualTemp(tempC: number, dewpC: number, pressHpa: number): number {
  const w = mixingRatio(dewpC, pressHpa);
  return toKelvin(tempC) * (1 + 0.61 * w);
}

/** Temperature at a pressure level via dry adiabatic lapse rate */
export function dryAdiabat(tempC: number, p0: number, p1: number): number {
  return toKelvin(tempC) * Math.pow(p1 / p0, Rd / Cp) - 273.15;
}

/** Temperature at a pressure level via moist adiabatic lapse rate (iterative) */
export function moistAdiabat(tempC: number, p0: number, p1: number, steps = 50): number {
  let t = toKelvin(tempC);
  let p = p0;
  const dp = (p1 - p0) / steps;

  for (let i = 0; i < steps; i++) {
    const es = satVaporPressure(t - 273.15) * 100; // Pa
    const ws = eps * es / (p * 100 - es);
    const gamma = (Rd * t + Lv * ws) / (Cp + (Lv * Lv * ws * eps) / (Rd * t * t));
    const dT = gamma * (dp * 100) / (p * 100);
    t += dT;
    p += dp;
  }

  return t - 273.15;
}

/** Interpolate a sounding level at a given pressure */
export function interpLevel(levels: SoundingLevel[], targetP: number): SoundingLevel | null {
  for (let i = 0; i < levels.length - 1; i++) {
    const lo = levels[i];
    const hi = levels[i + 1];
    if ((lo.pressure >= targetP && hi.pressure <= targetP) ||
      (lo.pressure <= targetP && hi.pressure >= targetP)) {
      const frac = Math.log(targetP / lo.pressure) / Math.log(hi.pressure / lo.pressure);
      return {
        pressure: targetP,
        height: lo.height + frac * (hi.height - lo.height),
        temperature: lo.temperature + frac * (hi.temperature - lo.temperature),
        dewpoint: lo.dewpoint + frac * (hi.dewpoint - lo.dewpoint),
        windSpeed: lo.windSpeed + frac * (hi.windSpeed - lo.windSpeed),
        windDir: interpWindDir(lo.windDir, hi.windDir, frac),
      };
    }
  }
  return null;
}

function interpWindDir(d1: number, d2: number, frac: number): number {
  const diff = ((d2 - d1 + 540) % 360) - 180;
  return ((d1 + diff * frac) + 360) % 360;
}

/** Find LCL pressure (hPa) and temperature (°C) */
export function findLCL(
  tempC: number,
  dewpC: number,
  pressHpa: number
): { pressure: number; temperature: number; height: number } {
  let p = pressHpa;
  let t = tempC;
  let td = dewpC;

  while (p > 100 && t - td > 0.1) {
    p -= 1;
    t = dryAdiabat(tempC, pressHpa, p);
    const w = mixingRatio(dewpC, pressHpa);
    const es_target = (w * p) / (eps + w);
    td = (243.5 * Math.log(es_target / 6.112)) / (17.67 - Math.log(es_target / 6.112));
  }

  const h = heightAtPressure(pressHpa, p);
  return { pressure: p, temperature: t, height: h };
}

function heightAtPressure(p0: number, p1: number): number {
  return (Rd * 288.15 / g) * Math.log(p0 / p1);
}

/** Lift a parcel from startP to endP, return temperatures at each level */
export function liftParcel(
  startTempC: number,
  startDewpC: number,
  startP: number,
  pressureLevels: number[]
): { pressure: number; temperature: number }[] {
  const lcl = findLCL(startTempC, startDewpC, startP);
  const result: { pressure: number; temperature: number }[] = [];

  for (const p of pressureLevels) {
    if (p > startP) continue;
    if (p >= lcl.pressure) {
      result.push({ pressure: p, temperature: dryAdiabat(startTempC, startP, p) });
    } else {
      result.push({ pressure: p, temperature: moistAdiabat(lcl.temperature, lcl.pressure, p) });
    }
  }

  return result;
}

/** Compute CAPE and CIN for a given parcel */
export function computeCAPE(
  levels: SoundingLevel[],
  parcelTempC: number,
  parcelDewpC: number,
  parcelP: number
): { cape: number; cin: number; lfc: number; el: number } {
  const lcl = findLCL(parcelTempC, parcelDewpC, parcelP);
  let cape = 0;
  let cin = 0;
  let lfc = -1;
  let el = -1;
  let wasPositive = false;

  const sortedLevels = [...levels].sort((a, b) => b.pressure - a.pressure);

  for (let i = 0; i < sortedLevels.length - 1; i++) {
    const lo = sortedLevels[i];
    const hi = sortedLevels[i + 1];
    if (lo.pressure > parcelP || hi.pressure < 100) continue;

    const midP = (lo.pressure + hi.pressure) / 2;
    const dz = (Rd * 288.15 / g) * Math.log(lo.pressure / hi.pressure);

    let parcelT: number;
    if (midP >= lcl.pressure) {
      parcelT = dryAdiabat(parcelTempC, parcelP, midP);
    } else {
      parcelT = moistAdiabat(lcl.temperature, lcl.pressure, midP);
    }

    const envT = (lo.temperature + hi.temperature) / 2;
    const buoyancy = g * (toKelvin(parcelT) - toKelvin(envT)) / toKelvin(envT);
    const contribution = buoyancy * dz;

    if (contribution > 0) {
      cape += contribution;
      if (!wasPositive && lfc < 0) {
        lfc = lo.height;
      }
      wasPositive = true;
    } else {
      if (wasPositive && el < 0) {
        el = lo.height;
      }
      if (!wasPositive) {
        cin += contribution;
      }
    }
  }

  return { cape: Math.max(0, cape), cin: Math.min(0, cin), lfc, el };
}

/** Wind components (u, v) from speed and direction */
export function windComponents(speed: number, dir: number): { u: number; v: number } {
  const rad = (dir * Math.PI) / 180;
  return {
    u: -speed * Math.sin(rad),
    v: -speed * Math.cos(rad),
  };
}

/** Bulk wind difference between two heights (m/s) */
export function bulkShear(levels: SoundingLevel[], hLo: number, hHi: number): number {
  const lo = findNearestHeight(levels, hLo);
  const hi = findNearestHeight(levels, hHi);
  if (!lo || !hi) return 0;

  const uLo = windComponents(lo.windSpeed * 0.5144, lo.windDir);
  const uHi = windComponents(hi.windSpeed * 0.5144, hi.windDir);
  return Math.sqrt((uHi.u - uLo.u) ** 2 + (uHi.v - uLo.v) ** 2);
}

function findNearestHeight(levels: SoundingLevel[], height: number): SoundingLevel | null {
  let best: SoundingLevel | null = null;
  let bestDiff = Infinity;
  for (const lev of levels) {
    const diff = Math.abs(lev.height - height);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = lev;
    }
  }
  return best;
}

/** Storm-relative helicity (m²/s²) */
export function stormRelativeHelicity(
  levels: SoundingLevel[],
  hLo: number,
  hHi: number,
  stormU: number,
  stormV: number
): number {
  let srh = 0;
  const filteredLevels = levels
    .filter(l => l.height >= hLo && l.height <= hHi)
    .sort((a, b) => a.height - b.height);

  for (let i = 0; i < filteredLevels.length - 1; i++) {
    const cur = filteredLevels[i];
    const next = filteredLevels[i + 1];
    const u1 = windComponents(cur.windSpeed * 0.5144, cur.windDir);
    const u2 = windComponents(next.windSpeed * 0.5144, next.windDir);
    srh += (u2.u - stormU) * (u1.v - stormV) - (u1.u - stormU) * (u2.v - stormV);
  }

  return srh;
}

/** Precipitable water (mm) */
export function precipitableWater(levels: SoundingLevel[]): number {
  let pw = 0;
  const sorted = [...levels].sort((a, b) => b.pressure - a.pressure);
  for (let i = 0; i < sorted.length - 1; i++) {
    const lo = sorted[i];
    const hi = sorted[i + 1];
    const w = (mixingRatio(lo.dewpoint, lo.pressure) + mixingRatio(hi.dewpoint, hi.pressure)) / 2;
    const dp = (lo.pressure - hi.pressure) * 100; // Pa
    pw += w * dp / g;
  }
  return pw * 1000; // mm
}

/** Estimate Bunkers storm motion */
export function bunkersStormMotion(levels: SoundingLevel[]): { u: number; v: number } {
  // Mean wind 0-6km
  const l6km = levels.filter(l => l.height <= 6000);
  if (l6km.length < 2) return { u: 0, v: 0 };

  let uMean = 0, vMean = 0;
  for (const l of l6km) {
    const comp = windComponents(l.windSpeed * 0.5144, l.windDir);
    uMean += comp.u;
    vMean += comp.v;
  }
  uMean /= l6km.length;
  vMean /= l6km.length;

  const shear = bulkShear(levels, 0, 6000);
  const lo = findNearestHeight(levels, 0);
  const hi = findNearestHeight(levels, 6000);
  if (!lo || !hi) return { u: uMean, v: vMean };

  const uLo = windComponents(lo.windSpeed * 0.5144, lo.windDir);
  const uHi = windComponents(hi.windSpeed * 0.5144, hi.windDir);
  const shearU = uHi.u - uLo.u;
  const shearV = uHi.v - uLo.v;

  const D = 7.5; // deviation magnitude (m/s)
  const mag = Math.max(shear, 0.1);

  return {
    u: uMean + D * shearV / mag,
    v: vMean - D * shearU / mag,
  };
}

/** Compute all derived parameters */
export function computeDerivedParams(levels: SoundingLevel[]): DerivedParams {
  if (levels.length < 3) {
    return getEmptyParams();
  }

  const sorted = [...levels].sort((a, b) => b.pressure - a.pressure);
  const sfc = sorted[0];

  // Surface-based parcel
  const sb = computeCAPE(sorted, sfc.temperature, sfc.dewpoint, sfc.pressure);

  // Mixed-layer parcel (lowest 100 hPa)
  const mlLevels = sorted.filter(l => l.pressure >= sfc.pressure - 100);
  const mlT = mlLevels.reduce((s, l) => s + l.temperature, 0) / mlLevels.length;
  const mlTd = mlLevels.reduce((s, l) => s + l.dewpoint, 0) / mlLevels.length;
  const ml = computeCAPE(sorted, mlT, mlTd, sfc.pressure);

  // Most-unstable parcel (highest theta-e in lowest 300 hPa)
  let muLevel = sfc;
  let maxThetaE = -Infinity;
  for (const l of sorted.filter(lv => lv.pressure >= sfc.pressure - 300)) {
    const te = potentialTemp(l.temperature, l.pressure) +
      (Lv / Cp) * mixingRatio(l.dewpoint, l.pressure);
    if (te > maxThetaE) {
      maxThetaE = te;
      muLevel = l;
    }
  }
  const mu = computeCAPE(sorted, muLevel.temperature, muLevel.dewpoint, muLevel.pressure);

  // LCL
  const lcl = findLCL(sfc.temperature, sfc.dewpoint, sfc.pressure);

  // Lifted Index
  const p500 = interpLevel(sorted, 500);
  const parcelAt500 = dryAdiabat(sfc.temperature, sfc.pressure, 500);
  const li = p500 ? p500.temperature - parcelAt500 : 0;

  // Bulk shear
  const bulk01 = bulkShear(sorted, 0, 1000);
  const bulk03 = bulkShear(sorted, 0, 3000);
  const bulk06 = bulkShear(sorted, 0, 6000);

  // Storm motion
  const storm = bunkersStormMotion(sorted);

  // SRH
  const srh01 = stormRelativeHelicity(sorted, 0, 1000, storm.u, storm.v);
  const srh03 = stormRelativeHelicity(sorted, 0, 3000, storm.u, storm.v);

  // PWAT
  const pwat = precipitableWater(sorted);

  // STP
  const stp = (sb.cape / 1500) * (bulk06 / 20) * (srh01 / 150) *
    ((2000 - lcl.height) / 1000) * Math.max(0, (200 + sb.cin) / 150);

  // SCP
  const scp = (mu.cape / 1000) * (bulk06 / 20) * (srh03 / 100);

  // SHIP
  const ship = (mu.cape * mixingRatio(sfc.dewpoint, sfc.pressure) * 1000 *
    (-500 + Math.abs(li > 0 ? 0 : li)) * bulk06) / 42000000;

  // Freezing level
  let freezingLevel = 0;
  for (const l of sorted) {
    if (l.temperature <= 0) { freezingLevel = l.height; break; }
  }

  // Mean wind 0-6km
  const meanWind6 = levels.filter(l => l.height <= 6000);
  let mwU = 0, mwV = 0;
  for (const l of meanWind6) {
    const c = windComponents(l.windSpeed, l.windDir);
    mwU += c.u;
    mwV += c.v;
  }
  mwU /= Math.max(meanWind6.length, 1);
  mwV /= Math.max(meanWind6.length, 1);

  const stormSpeed = Math.sqrt(storm.u ** 2 + storm.v ** 2) / 0.5144;
  const stormDir = (Math.atan2(-storm.u, -storm.v) * 180 / Math.PI + 360) % 360;

  return {
    sbCAPE: Math.round(sb.cape),
    sbCIN: Math.round(sb.cin),
    mlCAPE: Math.round(ml.cape),
    mlCIN: Math.round(ml.cin),
    muCAPE: Math.round(mu.cape),
    muCIN: Math.round(mu.cin),
    lcl: Math.round(lcl.height),
    lfc: Math.round(sb.lfc),
    el: Math.round(sb.el),
    li: Math.round(li * 10) / 10,
    bulk0_1km: Math.round(bulk01 * 10) / 10,
    bulk0_3km: Math.round(bulk03 * 10) / 10,
    bulk0_6km: Math.round(bulk06 * 10) / 10,
    srh0_1km: Math.round(srh01),
    srh0_3km: Math.round(srh03),
    stp: Math.round(stp * 100) / 100,
    scp: Math.round(scp * 100) / 100,
    ship: Math.round(Math.max(0, ship) * 100) / 100,
    pwat: Math.round(pwat * 10) / 10,
    meanWind: {
      speed: Math.round(Math.sqrt(mwU ** 2 + mwV ** 2) * 10) / 10,
      dir: Math.round((Math.atan2(-mwU, -mwV) * 180 / Math.PI + 360) % 360),
    },
    stormMotion: {
      speed: Math.round(stormSpeed * 10) / 10,
      dir: Math.round(stormDir),
    },
    freezingLevel: Math.round(freezingLevel),
    wetBulbZero: Math.round(freezingLevel * 0.85), // approximation
    maxTemp: Math.round(sfc.temperature + 3), // rough estimate
  };
}

function getEmptyParams(): DerivedParams {
  return {
    sbCAPE: 0, sbCIN: 0, mlCAPE: 0, mlCIN: 0, muCAPE: 0, muCIN: 0,
    lcl: 0, lfc: 0, el: 0, li: 0,
    bulk0_1km: 0, bulk0_3km: 0, bulk0_6km: 0,
    srh0_1km: 0, srh0_3km: 0,
    stp: 0, scp: 0, ship: 0, pwat: 0,
    meanWind: { speed: 0, dir: 0 },
    stormMotion: { speed: 0, dir: 0 },
    freezingLevel: 0, wetBulbZero: 0, maxTemp: 0,
  };
}
