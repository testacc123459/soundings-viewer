import type { DerivedParams } from '../types';
import './ParamsPanel.css';

interface ParamsPanelProps {
  params: DerivedParams;
}

function capeColor(cape: number): string {
  if (cape >= 4000) return '#ff2222';
  if (cape >= 2500) return '#ff6622';
  if (cape >= 1000) return '#ffaa00';
  if (cape >= 500) return '#ffdd44';
  return '#88cc88';
}

function shearColor(shear: number): string {
  if (shear >= 30) return '#ff2222';
  if (shear >= 20) return '#ff6622';
  if (shear >= 15) return '#ffaa00';
  if (shear >= 10) return '#ffdd44';
  return '#88cc88';
}

function srhColor(srh: number): string {
  if (srh >= 300) return '#ff2222';
  if (srh >= 200) return '#ff6622';
  if (srh >= 100) return '#ffaa00';
  if (srh >= 50) return '#ffdd44';
  return '#88cc88';
}

function stpColor(stp: number): string {
  if (stp >= 4) return '#ff2222';
  if (stp >= 2) return '#ff6622';
  if (stp >= 1) return '#ffaa00';
  if (stp >= 0.5) return '#ffdd44';
  return '#88cc88';
}

function ParamRow({ label, value, unit, color }: {
  label: string;
  value: string | number;
  unit?: string;
  color?: string;
}) {
  return (
    <div className="param-row">
      <span className="param-label">{label}</span>
      <span className="param-value" style={color ? { color } : undefined}>
        {value}
        {unit && <span className="param-unit">{unit}</span>}
      </span>
    </div>
  );
}

export default function ParamsPanel({ params }: ParamsPanelProps) {
  return (
    <div className="params-panel">
      <div className="params-header">
        <span className="params-icon">📊</span>
        <span>SHARPpy Parameters</span>
      </div>

      <div className="params-sections">
        {/* Thermodynamic */}
        <div className="params-section">
          <div className="section-title">Thermodynamic</div>
          <ParamRow label="SB CAPE" value={params.sbCAPE} unit="J/kg" color={capeColor(params.sbCAPE)} />
          <ParamRow label="SB CIN" value={params.sbCIN} unit="J/kg" />
          <ParamRow label="ML CAPE" value={params.mlCAPE} unit="J/kg" color={capeColor(params.mlCAPE)} />
          <ParamRow label="ML CIN" value={params.mlCIN} unit="J/kg" />
          <ParamRow label="MU CAPE" value={params.muCAPE} unit="J/kg" color={capeColor(params.muCAPE)} />
          <ParamRow label="LI" value={params.li} unit="°C" />
          <ParamRow label="LCL" value={params.lcl} unit="m AGL" />
          <ParamRow label="LFC" value={params.lfc > 0 ? params.lfc : '—'} unit={params.lfc > 0 ? 'm AGL' : ''} />
          <ParamRow label="EL" value={params.el > 0 ? params.el : '—'} unit={params.el > 0 ? 'm AGL' : ''} />
        </div>

        {/* Kinematic */}
        <div className="params-section">
          <div className="section-title">Kinematic</div>
          <ParamRow label="0-1km Shear" value={params.bulk0_1km} unit="m/s" color={shearColor(params.bulk0_1km)} />
          <ParamRow label="0-3km Shear" value={params.bulk0_3km} unit="m/s" color={shearColor(params.bulk0_3km)} />
          <ParamRow label="0-6km Shear" value={params.bulk0_6km} unit="m/s" color={shearColor(params.bulk0_6km)} />
          <ParamRow label="0-1km SRH" value={params.srh0_1km} unit="m²/s²" color={srhColor(params.srh0_1km)} />
          <ParamRow label="0-3km SRH" value={params.srh0_3km} unit="m²/s²" color={srhColor(params.srh0_3km)} />
          <ParamRow
            label="Storm Motion"
            value={`${params.stormMotion.dir}° / ${params.stormMotion.speed} kt`}
          />
          <ParamRow
            label="Mean Wind"
            value={`${params.meanWind.dir}° / ${params.meanWind.speed} kt`}
          />
        </div>

        {/* Composite */}
        <div className="params-section">
          <div className="section-title">Composite Indices</div>
          <ParamRow label="STP" value={params.stp} color={stpColor(params.stp)} />
          <ParamRow label="SCP" value={params.scp} color={stpColor(params.scp)} />
          <ParamRow label="SHIP" value={params.ship} />
        </div>

        {/* Moisture / Other */}
        <div className="params-section">
          <div className="section-title">Moisture &amp; Levels</div>
          <ParamRow label="PWAT" value={params.pwat} unit="mm" />
          <ParamRow label="Freezing Lvl" value={params.freezingLevel} unit="m AGL" />
          <ParamRow label="WBZ" value={params.wetBulbZero} unit="m AGL" />
        </div>
      </div>
    </div>
  );
}
