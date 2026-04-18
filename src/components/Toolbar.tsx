import type { ModelType } from '../types';
import './Toolbar.css';

interface ToolbarProps {
  model: ModelType;
  onModelChange: (model: ModelType) => void;
  forecastHour: number;
  onForecastHourChange: (hour: number) => void;
  availableHours: number[];
  stationName: string | null;
  loading: boolean;
  runTime: string | null;
}

const MODELS: ModelType[] = ['HRRR', 'GFS', 'RAP', 'NAM'];

export default function Toolbar({
  model,
  onModelChange,
  forecastHour,
  onForecastHourChange,
  availableHours,
  stationName,
  loading,
  runTime,
}: ToolbarProps) {
  const formatRunTime = (rt: string | null) => {
    if (!rt) return '';
    const d = new Date(rt);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')} ${String(d.getUTCHours()).padStart(2, '0')}Z`;
  };

  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <div className="toolbar-brand">
          <span className="brand-icon">🌡️</span>
          <span className="brand-text">Soundings Viewer</span>
        </div>

        <div className="toolbar-divider" />

        <div className="model-selector">
          {MODELS.map(m => (
            <button
              key={m}
              className={`model-btn ${m === model ? 'active' : ''}`}
              onClick={() => onModelChange(m)}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="toolbar-center">
        {stationName ? (
          <div className="station-info-bar">
            <span className="station-name-display">{stationName}</span>
            {runTime && (
              <span className="run-time-display">
                Run: {formatRunTime(runTime)}
              </span>
            )}
          </div>
        ) : (
          <span className="no-station">Select a station on the map</span>
        )}
      </div>

      <div className="toolbar-right">
        <div className="forecast-hour-control">
          <label className="fh-label">F</label>
          <select
            className="fh-select"
            value={forecastHour}
            onChange={e => onForecastHourChange(Number(e.target.value))}
          >
            {availableHours.map(h => (
              <option key={h} value={h}>+{String(h).padStart(2, '0')}h</option>
            ))}
          </select>
        </div>

        {loading && (
          <div className="loading-indicator">
            <div className="loading-spinner" />
          </div>
        )}
      </div>
    </div>
  );
}
