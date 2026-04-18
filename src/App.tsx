import { useState, useCallback, useMemo, useEffect } from 'react';
import type { StationInfo, ModelType, SoundingData } from './types';
import { fetchSoundingData, getAvailableForecastHours } from './services/soundingService';
import { computeDerivedParams } from './utils/thermodynamics';
import MapView from './components/MapView';
import SkewT from './components/SkewT';
import Hodograph from './components/Hodograph';
import ParamsPanel from './components/ParamsPanel';
import DataTable from './components/DataTable';
import Toolbar from './components/Toolbar';
import './App.css';

type TabKey = 'skewt' | 'hodograph' | 'data';

export default function App() {
  const [selectedStation, setSelectedStation] = useState<StationInfo | null>(null);
  const [model, setModel] = useState<ModelType>('HRRR');
  const [forecastHour, setForecastHour] = useState(0);
  const [sounding, setSounding] = useState<SoundingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('skewt');
  const [showPanel, setShowPanel] = useState(false);

  const availableHours = useMemo(() => getAvailableForecastHours(model), [model]);

  const derivedParams = useMemo(() => {
    if (!sounding) return null;
    return computeDerivedParams(sounding.levels);
  }, [sounding]);

  const loadSounding = useCallback(async (station: StationInfo, mdl: ModelType, fh: number) => {
    setLoading(true);
    try {
      const data = await fetchSoundingData(station, mdl, fh);
      setSounding(data);
      setShowPanel(true);
    } catch (err) {
      console.error('Failed to load sounding:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleStationSelect = useCallback((station: StationInfo) => {
    setSelectedStation(station);
    loadSounding(station, model, forecastHour);
  }, [model, forecastHour, loadSounding]);

  const handleModelChange = useCallback((m: ModelType) => {
    setModel(m);
    const hours = getAvailableForecastHours(m);
    const newFh = hours.includes(forecastHour) ? forecastHour : hours[0];
    setForecastHour(newFh);
    if (selectedStation) {
      loadSounding(selectedStation, m, newFh);
    }
  }, [forecastHour, selectedStation, loadSounding]);

  const handleForecastHourChange = useCallback((fh: number) => {
    setForecastHour(fh);
    if (selectedStation) {
      loadSounding(selectedStation, model, fh);
    }
  }, [model, selectedStation, loadSounding]);

  // Keyboard shortcut to close panel
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowPanel(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="app">
      <Toolbar
        model={model}
        onModelChange={handleModelChange}
        forecastHour={forecastHour}
        onForecastHourChange={handleForecastHourChange}
        availableHours={availableHours}
        stationName={selectedStation?.name || null}
        loading={loading}
        runTime={sounding?.runTime || null}
      />

      <div className="app-content">
        <div className={`map-pane ${showPanel ? 'with-panel' : ''}`}>
          <MapView
            onStationSelect={handleStationSelect}
            selectedStation={selectedStation}
          />
        </div>

        {showPanel && sounding && (
          <div className="sounding-panel">
            <div className="panel-header">
              <div className="panel-tabs">
                <button
                  className={`panel-tab ${activeTab === 'skewt' ? 'active' : ''}`}
                  onClick={() => setActiveTab('skewt')}
                >
                  Skew-T
                </button>
                <button
                  className={`panel-tab ${activeTab === 'hodograph' ? 'active' : ''}`}
                  onClick={() => setActiveTab('hodograph')}
                >
                  Hodograph
                </button>
                <button
                  className={`panel-tab ${activeTab === 'data' ? 'active' : ''}`}
                  onClick={() => setActiveTab('data')}
                >
                  Data
                </button>
              </div>
              <button
                className="panel-close"
                onClick={() => setShowPanel(false)}
                title="Close (Esc)"
              >
                ✕
              </button>
            </div>

            <div className="panel-body">
              <div className="panel-main">
                {activeTab === 'skewt' && (
                  <SkewT levels={sounding.levels} width={560} height={660} />
                )}
                {activeTab === 'hodograph' && (
                  <div className="hodograph-view">
                    <Hodograph levels={sounding.levels} size={400} />
                  </div>
                )}
                {activeTab === 'data' && (
                  <DataTable levels={sounding.levels} />
                )}
              </div>

              {derivedParams && (
                <div className="panel-sidebar">
                  <ParamsPanel params={derivedParams} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
