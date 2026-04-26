'use client';

import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

interface MonthData {
  month: string;
  Technology: number;
  Culture: number;
  Science: number;
  Business: number;
  Personal: number;
  Media: number;
  total: number;
}

const TOPICS = ['Technology', 'Culture', 'Science', 'Business', 'Personal', 'Media'] as const;

const TOPIC_COLORS: Record<string, string> = {
  Technology: '#1B2A4A',
  Culture: '#8B4513',
  Science: '#2E5A3A',
  Business: '#B8860B',
  Personal: '#6B3A6B',
  Media: '#1B6B6B',
};

export function Zeitgeist() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [data, setData] = useState<MonthData[] | null>(null);
  const [mode, setMode] = useState<'absolute' | 'percent'>('percent');
  const [hoveredMonth, setHoveredMonth] = useState<MonthData | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 350 });

  useEffect(() => {
    fetch('/data/zeitgeist.json')
      .then(r => r.json())
      .then(d => setData(d));
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const container = svgRef.current?.parentElement;
      if (container) {
        setDimensions({ width: container.clientWidth, height: 350 });
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!data || !svgRef.current) return;

    const { width, height } = dimensions;
    const margin = { top: 10, right: 20, bottom: 40, left: 50 };
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // Filter to recent data (last 24 months)
    const recent = data.filter(d => d.total > 50).slice(-24);

    const x = d3.scalePoint<string>()
      .domain(recent.map(d => d.month))
      .range([0, w])
      .padding(0.5);

    const stack = d3.stack<MonthData>()
      .keys(TOPICS as unknown as string[])
      .offset(mode === 'percent' ? d3.stackOffsetExpand : d3.stackOffsetNone);

    const stacked = stack(recent);

    const yMax = mode === 'percent' ? 1 : d3.max(recent, d => d.total) || 1;
    const y = d3.scaleLinear().domain([0, yMax]).range([h, 0]);

    const area = d3.area<d3.SeriesPoint<MonthData>>()
      .x(d => x(d.data.month)!)
      .y0(d => y(d[0]))
      .y1(d => y(d[1]))
      .curve(d3.curveMonotoneX);

    // Areas
    g.selectAll('path')
      .data(stacked)
      .join('path')
      .attr('d', area)
      .attr('fill', d => TOPIC_COLORS[d.key] || '#ccc')
      .attr('fill-opacity', 0.7)
      .attr('stroke', d => TOPIC_COLORS[d.key] || '#ccc')
      .attr('stroke-width', 0.5);

    // Hover overlay
    const overlay = g.append('g');

    g.append('rect')
      .attr('width', w)
      .attr('height', h)
      .attr('fill', 'transparent')
      .on('mousemove', function(event) {
        const [mx] = d3.pointer(event);
        const domain = x.domain();
        const step = x.step();
        const idx = Math.round((mx - (x.range()[0])) / step);
        const month = domain[Math.max(0, Math.min(idx, domain.length - 1))];
        const monthData = recent.find(d => d.month === month);
        if (monthData) {
          setHoveredMonth(monthData);
          overlay.selectAll('*').remove();
          overlay.append('line')
            .attr('x1', x(month)!).attr('x2', x(month)!)
            .attr('y1', 0).attr('y2', h)
            .attr('stroke', '#1B2A4A')
            .attr('stroke-width', 1)
            .attr('stroke-dasharray', '3,3')
            .attr('opacity', 0.4);
        }
      })
      .on('mouseout', () => {
        setHoveredMonth(null);
        overlay.selectAll('*').remove();
      });

    // X axis
    const tickInterval = Math.max(1, Math.floor(recent.length / 8));
    g.append('g')
      .attr('transform', `translate(0,${h})`)
      .call(d3.axisBottom(x).tickValues(recent.filter((_, i) => i % tickInterval === 0).map(d => d.month)))
      .call(g => g.select('.domain').attr('stroke', '#C8D4E4'))
      .call(g => g.selectAll('.tick line').attr('stroke', '#C8D4E4'))
      .call(g => g.selectAll('.tick text').attr('font-family', 'var(--font-mono)').attr('font-size', 9).attr('fill', '#5C7396'));

    // Y axis
    const yAxis = mode === 'percent'
      ? d3.axisLeft(y).ticks(5).tickFormat(d => `${Math.round((d as number) * 100)}%`)
      : d3.axisLeft(y).ticks(5, '~s');

    g.append('g')
      .call(yAxis)
      .call(g => g.select('.domain').attr('stroke', '#C8D4E4'))
      .call(g => g.selectAll('.tick line').attr('stroke', '#C8D4E4'))
      .call(g => g.selectAll('.tick text').attr('font-family', 'var(--font-mono)').attr('font-size', 9).attr('fill', '#5C7396'));

  }, [data, dimensions, mode]);

  if (!data) {
    return <div className="h-[350px] flex items-center justify-center font-terminal text-sm text-ink-muted">Loading...</div>;
  }

  return (
    <div>
      {/* Controls */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-2">
          <button
            onClick={() => setMode('percent')}
            className={`font-terminal text-xs px-2.5 py-1 rounded-md transition-colors ${mode === 'percent' ? 'bg-ink text-cream' : 'text-ink-muted hover:text-ink hover:bg-cream-dark'}`}
          >
            Proportional
          </button>
          <button
            onClick={() => setMode('absolute')}
            className={`font-terminal text-xs px-2.5 py-1 rounded-md transition-colors ${mode === 'absolute' ? 'bg-ink text-cream' : 'text-ink-muted hover:text-ink hover:bg-cream-dark'}`}
          >
            Absolute
          </button>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3">
          {Object.entries(TOPIC_COLORS).map(([topic, color]) => (
            <div key={topic} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
              <span className="font-terminal text-[10px] text-ink-muted">{topic}</span>
            </div>
          ))}
        </div>
      </div>

      <svg ref={svgRef} width={dimensions.width} height={350} />

      {/* Hover tooltip */}
      {hoveredMonth && (
        <div className="mt-2 flex flex-wrap gap-3 justify-center">
          <span className="font-terminal text-xs text-ink font-medium">{hoveredMonth.month}</span>
          {TOPICS.map(t => (
            <span key={t} className="font-terminal text-[10px]" style={{ color: TOPIC_COLORS[t] }}>
              {t}: {mode === 'percent' ? `${Math.round(hoveredMonth[t] / hoveredMonth.total * 100)}%` : hoveredMonth[t].toLocaleString()}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
