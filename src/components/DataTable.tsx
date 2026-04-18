import type { SoundingLevel } from '../types';
import './DataTable.css';

interface DataTableProps {
  levels: SoundingLevel[];
}

export default function DataTable({ levels }: DataTableProps) {
  const sorted = [...levels].sort((a, b) => b.pressure - a.pressure);

  return (
    <div className="data-table-wrapper">
      <div className="data-table-header">
        <span className="table-icon">📋</span>
        <span>Sounding Data</span>
      </div>
      <div className="data-table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>P (hPa)</th>
              <th>H (m)</th>
              <th>T (°C)</th>
              <th>Td (°C)</th>
              <th>Dir (°)</th>
              <th>Spd (kt)</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((level, i) => (
              <tr key={i} className={level.pressure % 100 < 25 ? 'highlight-row' : ''}>
                <td className="mono">{level.pressure}</td>
                <td className="mono">{level.height}</td>
                <td className="mono temp">{level.temperature.toFixed(1)}</td>
                <td className="mono dewp">{level.dewpoint.toFixed(1)}</td>
                <td className="mono">{level.windDir}</td>
                <td className="mono">{level.windSpeed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
