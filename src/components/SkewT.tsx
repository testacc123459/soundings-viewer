import { useRef, useEffect, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import type { SoundingLevel } from '../types';
import { findLCL, liftParcel } from '../utils/thermodynamics';
import './SkewT.css';

interface SkewTProps {
  levels: SoundingLevel[];
  width?: number;
  height?: number;
}

const MARGIN = { top: 30, right: 60, bottom: 30, left: 50 };
const SKEW_FACTOR = 0.75;

// Pressure range
const P_TOP = 100;
const P_BOTTOM = 1050;

// Temperature range (°C)
const T_LEFT = -40;
const T_RIGHT = 50;

export default function SkewT({ levels, width = 600, height = 700 }: SkewTProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  const plotW = width - MARGIN.left - MARGIN.right;
  const plotH = height - MARGIN.top - MARGIN.bottom;

  // Scales
  const yScale = useMemo(() =>
    d3.scaleLog()
      .domain([P_BOTTOM, P_TOP])
      .range([plotH, 0]),
    [plotH]
  );

  const xScale = useMemo(() =>
    d3.scaleLinear()
      .domain([T_LEFT, T_RIGHT])
      .range([0, plotW]),
    [plotW]
  );

  // Skewed x position
  const skewX = useCallback((tempC: number, p: number): number => {
    const y = yScale(p);
    return xScale(tempC) + (plotH - y) * SKEW_FACTOR;
  }, [xScale, yScale, plotH]);

  useEffect(() => {
    if (!svgRef.current || levels.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const defs = svg.append('defs');

    // Gradient for CAPE shading
    const capeGrad = defs.append('linearGradient')
      .attr('id', 'cape-gradient')
      .attr('x1', '0%').attr('y1', '0%')
      .attr('x2', '100%').attr('y2', '0%');
    capeGrad.append('stop').attr('offset', '0%').attr('stop-color', '#ff4444').attr('stop-opacity', 0.15);
    capeGrad.append('stop').attr('offset', '100%').attr('stop-color', '#ff8800').attr('stop-opacity', 0.3);

    // CIN gradient
    const cinGrad = defs.append('linearGradient')
      .attr('id', 'cin-gradient')
      .attr('x1', '0%').attr('y1', '0%')
      .attr('x2', '100%').attr('y2', '0%');
    cinGrad.append('stop').attr('offset', '0%').attr('stop-color', '#4488ff').attr('stop-opacity', 0.15);
    cinGrad.append('stop').attr('offset', '100%').attr('stop-color', '#2244aa').attr('stop-opacity', 0.3);

    // Clip path
    defs.append('clipPath')
      .attr('id', 'plot-clip')
      .append('rect')
      .attr('width', plotW)
      .attr('height', plotH);

    const g = svg.append('g')
      .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    const plotArea = g.append('g')
      .attr('clip-path', 'url(#plot-clip)');

    // Background
    plotArea.append('rect')
      .attr('width', plotW)
      .attr('height', plotH)
      .attr('fill', '#0a0e1a');

    // ===== GRID LINES =====

    // Isotherms (skewed)
    for (let t = -80; t <= 60; t += 10) {
      plotArea.append('line')
        .attr('x1', skewX(t, P_BOTTOM))
        .attr('y1', yScale(P_BOTTOM))
        .attr('x2', skewX(t, P_TOP))
        .attr('y2', yScale(P_TOP))
        .attr('stroke', t === 0 ? '#667' : '#223')
        .attr('stroke-width', t === 0 ? 1.5 : 0.5)
        .attr('stroke-dasharray', t === 0 ? 'none' : '2,4');
    }

    // Isobars
    const pressureTicks = [1000, 925, 850, 700, 500, 400, 300, 250, 200, 150, 100];
    for (const p of pressureTicks) {
      const y = yScale(p);
      plotArea.append('line')
        .attr('x1', 0)
        .attr('y1', y)
        .attr('x2', plotW)
        .attr('y2', y)
        .attr('stroke', '#334')
        .attr('stroke-width', 0.5);

      g.append('text')
        .attr('x', -8)
        .attr('y', y)
        .attr('text-anchor', 'end')
        .attr('dominant-baseline', 'middle')
        .attr('fill', '#89a')
        .attr('font-size', '10px')
        .text(`${p}`);
    }

    // Dry adiabats
    for (let theta = -20; theta <= 80; theta += 10) {
      const points: [number, number][] = [];
      for (let p = P_BOTTOM; p >= P_TOP; p -= 5) {
        const t = (theta + 273.15) * Math.pow(p / 1000, 0.286) - 273.15;
        points.push([skewX(t, p), yScale(p)]);
      }
      plotArea.append('path')
        .datum(points)
        .attr('d', d3.line().x(d => d[0]).y(d => d[1]).curve(d3.curveBasis))
        .attr('fill', 'none')
        .attr('stroke', '#2a1a0a')
        .attr('stroke-width', 0.5)
        .attr('opacity', 0.6);
    }

    // Mixing ratio lines
    for (const w of [1, 2, 4, 7, 10, 16, 24]) {
      const points: [number, number][] = [];
      for (let p = P_BOTTOM; p >= 400; p -= 10) {
        const es = (w * p) / (622 + w);
        const t = (243.5 * Math.log(es / 6.112)) / (17.67 - Math.log(es / 6.112));
        if (t > T_LEFT && t < T_RIGHT) {
          points.push([skewX(t, p), yScale(p)]);
        }
      }
      if (points.length > 1) {
        plotArea.append('path')
          .datum(points)
          .attr('d', d3.line().x(d => d[0]).y(d => d[1]))
          .attr('fill', 'none')
          .attr('stroke', '#1a2a1a')
          .attr('stroke-width', 0.5)
          .attr('stroke-dasharray', '4,4')
          .attr('opacity', 0.5);
      }
    }

    // ===== PARCEL TRACE + CAPE/CIN SHADING =====
    const sorted = [...levels].sort((a, b) => b.pressure - a.pressure);
    const sfc = sorted[0];
    const lcl = findLCL(sfc.temperature, sfc.dewpoint, sfc.pressure);
    const pressures = sorted.map(l => l.pressure).filter(p => p <= sfc.pressure);
    const parcelTrace = liftParcel(sfc.temperature, sfc.dewpoint, sfc.pressure, pressures);

    // Shade CAPE/CIN areas
    if (parcelTrace.length > 1) {
      const capePoints: string[] = [];
      const cinPoints: string[] = [];

      for (const pt of parcelTrace) {
        const envLevel = sorted.find(l => Math.abs(l.pressure - pt.pressure) < 15);
        if (!envLevel) continue;

        const envX = skewX(envLevel.temperature, pt.pressure);
        const parcelX = skewX(pt.temperature, pt.pressure);
        const y = yScale(pt.pressure);

        if (parcelX > envX) {
          capePoints.push(`${parcelX},${y}`);
        }
        if (parcelX < envX && pt.pressure > (lcl.pressure - 50)) {
          cinPoints.push(`${parcelX},${y}`);
        }
      }

      // Draw parcel trace with animation
      const parcelLine = d3.line<{ pressure: number; temperature: number }>()
        .x(d => skewX(d.temperature, d.pressure))
        .y(d => yScale(d.pressure))
        .curve(d3.curveBasis);

      const parcelPath = plotArea.append('path')
        .datum(parcelTrace)
        .attr('d', parcelLine)
        .attr('fill', 'none')
        .attr('stroke', '#ff9900')
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '6,3')
        .attr('opacity', 0.8);

      // Animate parcel trace
      const totalLength = (parcelPath.node() as SVGPathElement)?.getTotalLength() || 0;
      if (totalLength > 0) {
        parcelPath
          .attr('stroke-dasharray', `${totalLength} ${totalLength}`)
          .attr('stroke-dashoffset', totalLength)
          .transition()
          .duration(2000)
          .ease(d3.easeLinear)
          .attr('stroke-dashoffset', 0)
          .on('end', function () {
            d3.select(this).attr('stroke-dasharray', '6,3');
          });
      }
    }

    // LCL marker
    if (lcl.pressure > P_TOP) {
      const lclY = yScale(lcl.pressure);
      plotArea.append('line')
        .attr('x1', 0).attr('y1', lclY)
        .attr('x2', plotW).attr('y2', lclY)
        .attr('stroke', '#ff9900')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '2,4')
        .attr('opacity', 0.6);

      g.append('text')
        .attr('x', plotW + 5)
        .attr('y', lclY)
        .attr('fill', '#ff9900')
        .attr('font-size', '9px')
        .attr('dominant-baseline', 'middle')
        .text('LCL');
    }

    // ===== TEMPERATURE AND DEWPOINT TRACES =====
    const tempLine = d3.line<SoundingLevel>()
      .x(d => skewX(d.temperature, d.pressure))
      .y(d => yScale(d.pressure))
      .curve(d3.curveBasis);

    const dewpLine = d3.line<SoundingLevel>()
      .x(d => skewX(d.dewpoint, d.pressure))
      .y(d => yScale(d.pressure))
      .curve(d3.curveBasis);

    // Temperature trace with glow
    plotArea.append('path')
      .datum(sorted)
      .attr('d', tempLine)
      .attr('fill', 'none')
      .attr('stroke', '#ff3333')
      .attr('stroke-width', 4)
      .attr('opacity', 0.2)
      .attr('filter', 'blur(3px)');

    const tempPath = plotArea.append('path')
      .datum(sorted)
      .attr('d', tempLine)
      .attr('fill', 'none')
      .attr('stroke', '#ff4444')
      .attr('stroke-width', 2.5);

    // Dewpoint trace with glow
    plotArea.append('path')
      .datum(sorted)
      .attr('d', dewpLine)
      .attr('fill', 'none')
      .attr('stroke', '#33cc33')
      .attr('stroke-width', 4)
      .attr('opacity', 0.2)
      .attr('filter', 'blur(3px)');

    const dewpPath = plotArea.append('path')
      .datum(sorted)
      .attr('d', dewpLine)
      .attr('fill', 'none')
      .attr('stroke', '#44dd44')
      .attr('stroke-width', 2.5);

    // Animate traces
    [tempPath, dewpPath].forEach(path => {
      const totalLen = (path.node() as SVGPathElement)?.getTotalLength() || 0;
      if (totalLen > 0) {
        path
          .attr('stroke-dasharray', `${totalLen} ${totalLen}`)
          .attr('stroke-dashoffset', totalLen)
          .transition()
          .duration(1500)
          .ease(d3.easeCubicOut)
          .attr('stroke-dashoffset', 0)
          .on('end', function () {
            d3.select(this).attr('stroke-dasharray', 'none');
          });
      }
    });

    // ===== WIND BARBS =====
    const windGroup = g.append('g')
      .attr('transform', `translate(${plotW + 20}, 0)`);

    const barbLevels = sorted.filter((_, i) => i % 3 === 0);

    barbLevels.forEach((level, idx) => {
      const y = yScale(level.pressure);
      const barbG = windGroup.append('g')
        .attr('transform', `translate(0, ${y}) rotate(${level.windDir})`)
        .attr('opacity', 0);

      // Animate barbs appearing
      barbG.transition()
        .delay(idx * 50)
        .duration(400)
        .attr('opacity', 1);

      const speed = level.windSpeed;
      const barbLen = 22;

      // Staff
      barbG.append('line')
        .attr('x1', 0).attr('y1', 0)
        .attr('x2', 0).attr('y2', -barbLen)
        .attr('stroke', '#aac')
        .attr('stroke-width', 1.5);

      // Barbs
      let remaining = speed;
      let pos = barbLen;

      // Flags (50 kt)
      while (remaining >= 50) {
        barbG.append('polygon')
          .attr('points', `0,${-pos} 8,${-(pos - 2)} 0,${-(pos - 5)}`)
          .attr('fill', '#aac');
        pos -= 6;
        remaining -= 50;
      }
      // Long barbs (10 kt)
      while (remaining >= 10) {
        barbG.append('line')
          .attr('x1', 0).attr('y1', -pos)
          .attr('x2', 8).attr('y2', -(pos - 3))
          .attr('stroke', '#aac')
          .attr('stroke-width', 1.5);
        pos -= 4;
        remaining -= 10;
      }
      // Short barbs (5 kt)
      if (remaining >= 5) {
        barbG.append('line')
          .attr('x1', 0).attr('y1', -pos)
          .attr('x2', 5).attr('y2', -(pos - 2))
          .attr('stroke', '#aac')
          .attr('stroke-width', 1.5);
      }
      // Calm
      if (speed < 3) {
        barbG.selectAll('*').remove();
        barbG.append('circle')
          .attr('r', 3)
          .attr('fill', 'none')
          .attr('stroke', '#aac')
          .attr('stroke-width', 1);
      }
    });

    // ===== FREEZING LINE =====
    const freezingPoints: [number, number][] = [];
    for (let p = P_BOTTOM; p >= P_TOP; p -= 5) {
      freezingPoints.push([skewX(0, p), yScale(p)]);
    }

    // ===== AXIS LABELS =====
    // Temperature axis (bottom)
    for (let t = T_LEFT; t <= T_RIGHT; t += 10) {
      const x = skewX(t, P_BOTTOM);
      if (x >= 0 && x <= plotW) {
        g.append('text')
          .attr('x', x)
          .attr('y', plotH + 18)
          .attr('text-anchor', 'middle')
          .attr('fill', '#89a')
          .attr('font-size', '10px')
          .text(`${t}°`);
      }
    }

    // Title
    g.append('text')
      .attr('x', plotW / 2)
      .attr('y', -12)
      .attr('text-anchor', 'middle')
      .attr('fill', '#cde')
      .attr('font-size', '12px')
      .attr('font-weight', '600')
      .text('Skew-T / Log-P');

  }, [levels, plotW, plotH, xScale, yScale, skewX]);

  return (
    <div className="skewt-container">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="skewt-svg"
      />
    </div>
  );
}
