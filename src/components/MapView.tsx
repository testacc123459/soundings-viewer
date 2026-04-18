import { useRef, useEffect, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { StationInfo } from '../types';
import { STATIONS } from '../data/stations';
import './MapView.css';

interface MapViewProps {
  onStationSelect: (station: StationInfo) => void;
  selectedStation: StationInfo | null;
}

export default function MapView({ onStationSelect, selectedStation }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  const createMarkerEl = useCallback((station: StationInfo, isSelected: boolean) => {
    const el = document.createElement('div');
    el.className = `station-marker ${isSelected ? 'selected' : ''}`;
    el.innerHTML = `
      <div class="marker-dot"></div>
      <div class="marker-pulse"></div>
      <div class="marker-label">${station.name.split('(')[1]?.replace(')', '') || station.id}</div>
    `;
    return el;
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        name: 'Dark',
        sources: {
          'carto-dark': {
            type: 'raster',
            tiles: [
              'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
            ],
            tileSize: 256,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
          },
        },
        layers: [
          {
            id: 'carto-dark-layer',
            type: 'raster',
            source: 'carto-dark',
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      },
      center: [-97.5, 38.5],
      zoom: 4,
      maxZoom: 12,
      minZoom: 2,
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    map.on('load', () => {
      // Add station markers
      for (const station of STATIONS) {
        const el = createMarkerEl(station, false);

        el.addEventListener('click', (e) => {
          e.stopPropagation();
          onStationSelect(station);
        });

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([station.lon, station.lat])
          .addTo(map);

        markersRef.current.push(marker);
      }
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [createMarkerEl, onStationSelect]);

  // Update marker styles when selection changes
  useEffect(() => {
    markersRef.current.forEach((marker, i) => {
      const station = STATIONS[i];
      const el = marker.getElement();
      const isSelected = selectedStation?.id === station.id;
      el.className = `station-marker ${isSelected ? 'selected' : ''}`;
    });
  }, [selectedStation]);

  return (
    <div className="map-wrapper">
      <div ref={containerRef} className="map-container" />
      <div className="map-overlay-info">
        <span className="map-instruction">
          Click a station to load sounding data
        </span>
      </div>
    </div>
  );
}
