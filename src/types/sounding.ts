export interface SoundingLevel {
  pressure: number;    // hPa
  height: number;      // meters AGL
  temperature: number; // °C
  dewpoint: number;    // °C
  windSpeed: number;   // knots
  windDir: number;     // degrees
}

export interface SoundingData {
  station: StationInfo;
  levels: SoundingLevel[];
  model: ModelType;
  runTime: string;
  forecastHour: number;
}

export interface StationInfo {
  id: string;
  name: string;
  lat: number;
  lon: number;
  elevation: number;
}

export type ModelType = 'HRRR' | 'GFS' | 'RAP' | 'NAM';

export interface DerivedParams {
  sbCAPE: number;
  sbCIN: number;
  mlCAPE: number;
  mlCIN: number;
  muCAPE: number;
  muCIN: number;
  lcl: number;       // meters AGL
  lfc: number;       // meters AGL
  el: number;        // meters AGL
  li: number;        // Lifted Index
  bulk0_1km: number; // m/s
  bulk0_3km: number;
  bulk0_6km: number;
  srh0_1km: number;
  srh0_3km: number;
  stp: number;       // Significant Tornado Parameter
  scp: number;       // Supercell Composite Parameter
  ship: number;      // Significant Hail Parameter
  pwat: number;      // Precipitable water (mm)
  meanWind: { speed: number; dir: number };
  stormMotion: { speed: number; dir: number };
  freezingLevel: number; // meters AGL
  wetBulbZero: number;
  maxTemp: number;
}

export interface MapViewState {
  lng: number;
  lat: number;
  zoom: number;
}
