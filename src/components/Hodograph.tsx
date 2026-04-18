import { useRef, useEffect, useMemo } from 'react';
import * as d3 from 'd3';
import type { SoundingLevel } from '../types';
import { windComponents, bunkersStormMotion } from '../utils/thermodynamics';
import './Hodograph.css';

interface HodographProps {
  levels: SoundingLevel[];
  size?: number;
}

const RINGS = [10, 20, 30, 40, 50, 60, 80, 100]; // knots

const HEIGHT_COLORS: { maxH: number; color: string; label: string }[] = [
  { maxH: 1000, color: '#ff4444', label: '0-1 km' },
  { maxH: 3000, color: '#ffaa00', label: '1-3 km' },
  { maxH: 6000, color: '#44dd44', label: '3-6 km' },
  { maxH: 9000, color: '#4488ff', label: '6-9 km' },
  { maxH: 12000, color: '#aa44ff', label: '9-12 km' },
  { maxH: 99999, color: '#888', label: '>12 km' },
];

export default function Hodograph({ levels, size = 300 }: HodographProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const margin = 30;
  const radius = (size - margin * 2) / 2;
  const cx = size / 2;
  const cy = size / 2;

  const maxRing = useMemo(() => {
    const maxSpeed = Math.max(...levels.map(l => l.windSpeed), 30);
    return RINGS.find(r => r >= maxSpeed) || RINGS[RINGS.length - 1];
  }, [levels]);

  const rScale = useMemo(() =>
    d3.scaleLinear().domain([0, maxRing]).range([0, radius]),
    [maxRing, radius]
  );

  useEffect(() => {
    if (!svgRef.current || levels.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const g = svg.append('g');

    // Background
    g.append('circle')
      .attr('cx', cx).attr('cy', cy)
      .attr('r', radius + 5)
      .attr('fill', '#0a0e1a');

    // Range rings
    for (const ring of RINGS) {
      if (ring > maxRing) break;
      const r = rScale(ring);
      g.append('circle')
        .attr('cx', cx).attr('cy', cy)
        .attr('r', r)
        .attr('fill', 'none')
        .attr('stroke', '#223')
        .attr('stroke-width', 0.5);

      g.append('text')
        .attr('x', cx + r + 2)
        .attr('y', cy - 3)
        .attr('fill', '#556')
        .attr('font-size', '8px')
        .text(`${ring}`);
    }

    // Cross hairs
    g.append('line')
      .attr('x1', cx - radius).attr('y1', cy)
      .attr('x2', cx + radius).attr('y2', cy)
      .attr('stroke', '#334').attr('stroke-width', 0.5);
    g.append('line')
      .attr('x1', cx).attr('y1', cy - radius)
      .attr('x2', cx).attr('y2', cy + radius)
      .attr('stroke', '#334').attr('stroke-width', 0.5);

    // Cardinal labels
    g.append('text').attr('x', cx).attr('y', cy - radius - 5)
      .attr('text-anchor', 'middle').attr('fill', '#89a').attr('font-size', '10px').text('N');
    g.append('text').attr('x', cx + radius + 8).attr('y', cy + 4)
      .attr('text-anchor', 'start').attr('fill', '#89a').attr('font-size', '10px').text('E');
    g.append('text').attr('x', cx).attr('y', cy + radius + 15)
      .attr('text-anchor', 'middle').attr('fill', '#89a').attr('font-size', '10px').text('S');
    g.append('text').attr('x', cx - radius - 8).attr('y', cy + 4)
      .attr('text-anchor', 'end').attr('fill', '#89a').attr('font-size', '10px').text('W');

    // Plot hodograph trace by height segments
    const sorted = [...levels].sort((a, b) => a.height - b.height);

    for (const segment of HEIGHT_COLORS) {
      const segLevels = sorted.filter(l =>
        l.height <= segment.maxH &&
        (segment.maxH === 1000 || l.height > (HEIGHT_COLORS[HEIGHT_COLORS.indexOf(segment) - 1]?.maxH || 0))
      );

      if (segLevels.length < 2) continue;

      const points: [number, number][] = segLevels.map(l => {
        const { u, v } = windComponents(l.windSpeed, l.windDir);
        return [cx + rScale(-u), cy + rScale(v)];
      });

      // Glow
      g.append('path')
        .datum(points)
        .attr('d', d3.line().x(d => d[0]).y(d => d[1]).curve(d3.curveBasis))
        .attr('fill', 'none')
        .attr('stroke', segment.color)
        .attr('stroke-width', 6)
        .attr('opacity', 0.15)
        .attr('filter', 'blur(3px)');

      // Main line
      const path = g.append('path')
        .datum(points)
        .attr('d', d3.line().x(d => d[0]).y(d => d[1]).curve(d3.curveBasis))
        .attr('fill', 'none')
        .attr('stroke', segment.color)
        .attr('stroke-width', 2.5)
        .attr('stroke-linecap', 'round');

      // Animate
      const totalLen = (path.node() as SVGPathElement)?.getTotalLength() || 0;
      if (totalLen > 0) {
        path
          .attr('stroke-dasharray', `${totalLen} ${totalLen}`)
          .attr('stroke-dashoffset', totalLen)
          .transition()
          .duration(1200)
          .delay(HEIGHT_COLORS.indexOf(segment) * 200)
          .ease(d3.easeCubicOut)
          .attr('stroke-dashoffset', 0)
          .on('end', function () {
            d3.select(this).attr('stroke-dasharray', 'none');
          });
      }
    }

    // Height markers
    const markers = [1, 3, 6, 9];
    for (const km of markers) {
      const nearestLevel = sorted.reduce((prev, curr) =>
        Math.abs(curr.height - km * 1000) < Math.abs(prev.height - km * 1000) ? curr : prev
      );
      const { u, v } = windComponents(nearestLevel.windSpeed, nearestLevel.windDir);
      const mx = cx + rScale(-u);
      const my = cy + rScale(v);

      g.append('circle')
        .attr('cx', mx).attr('cy', my)
        .attr('r', 4)
        .attr('fill', '#0a0e1a')
        .attr('stroke', '#aac')
        .attr('stroke-width', 1.5)
        .attr('opacity', 0)
        .transition()
        .delay(1500)
        .duration(300)
        .attr('opacity', 1);

      g.append('text')
        .attr('x', mx + 6).attr('y', my - 6)
        .attr('fill', '#aac')
        .attr('font-size', '9px')
        .attr('font-weight', '600')
        .attr('opacity', 0)
        .text(`${km}`)
        .transition()
        .delay(1500)
        .duration(300)
        .attr('opacity', 1);
    }

    // Storm motion marker (Bunkers)
    const storm = bunkersStormMotion(sorted);
    const stormX = cx + rScale(-storm.u / 0.5144);
    const stormY = cy + rScale(storm.v / 0.5144);

    g.append('text')
      .attr('x', stormX).attr('y', stormY)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('fill', '#ff9900')
      .attr('font-size', '14px')
      .attr('font-weight', 'bold')
      .attr('opacity', 0)
      .text('⊕')
      .transition()
      .delay(2000)
      .duration(400)
      .attr('opacity', 1);

    // Title
    g.append('text')
      .attr('x', cx).attr('y', 14)
      .attr('text-anchor', 'middle')
      .attr('fill', '#cde')
      .attr('font-size', '12px')
      .attr('font-weight', '600')
      .text('Hodograph');

    // Legend
    const legendG = g.append('g')
      .attr('transform', `translate(${size - 70}, ${size - HEIGHT_COLORS.length * 14 - 10})`);

    HEIGHT_COLORS.forEach((seg, i) => {
      if (seg.maxH > 12000) return;
      legendG.append('line')
        .attr('x1', 0).attr('y1', i * 14)
        .attr('x2', 16).attr('y2', i * 14)
        .attr('stroke', seg.color)
        .attr('stroke-width', 2);
      legendG.append('text')
        .attr('x', 20).attr('y', i * 14 + 3)
        .attr('fill', '#89a')
        .attr('font-size', '8px')
        .text(seg.label);
    });

  }, [levels, cx, cy, radius, maxRing, rScale, size]);

  return (
    <div className="hodograph-container">
      <svg ref={svgRef} width={size} height={size} className="hodograph-svg" />
    </div>
  );
}
