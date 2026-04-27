'use client';

import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

interface DistPoint {
  saves: number;
  count: number;
}

interface Sample {
  id: number;
  title: string;
  title_en?: string;
  domain: string;
  link: string;
}

interface LongTailData {
  distribution: DistPoint[];
  stats: {
    totalBookmarks: number;
    singleSaveCount: number;
    singleSavePercent: number;
    maxSaves: number;
  };
  samples: Record<string, Sample[]>;
}

export function LongTail() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [data, setData] = useState<LongTailData | null>(null);
  const [selectedSaves, setSelectedSaves] = useState<number | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 350 });

  useEffect(() => {
    fetch('/data/long-tail.json')
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
    const margin = { top: 20, right: 30, bottom: 50, left: 60 };
    const w = Math.max(0, width - margin.left - margin.right);
    const h = Math.max(0, height - margin.top - margin.bottom);
    if (w === 0 || h === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const dist = data.distribution.filter(d => d.saves <= 50);

    const x = d3.scaleLog()
      .domain([1, 50])
      .range([0, w]);

    const y = d3.scaleLog()
      .domain([1, d3.max(dist, d => d.count) || 1])
      .range([h, 0]);

    // Area fill
    const area = d3.area<DistPoint>()
      .x(d => x(d.saves))
      .y0(h)
      .y1(d => y(d.count))
      .curve(d3.curveMonotoneX);

    // Head region (saves >= 5)
    const headData = dist.filter(d => d.saves >= 5);
    const tailData = dist.filter(d => d.saves < 5);

    g.append('path')
      .datum(tailData)
      .attr('d', area)
      .attr('fill', '#1B2A4A')
      .attr('fill-opacity', 0.12);

    g.append('path')
      .datum(headData)
      .attr('d', area)
      .attr('fill', '#3D5A8A')
      .attr('fill-opacity', 0.08);

    // Line
    const line = d3.line<DistPoint>()
      .x(d => x(d.saves))
      .y(d => y(d.count))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(dist)
      .attr('d', line)
      .attr('fill', 'none')
      .attr('stroke', '#1B2A4A')
      .attr('stroke-width', 2);

    // Dots
    g.selectAll('circle')
      .data(dist)
      .join('circle')
      .attr('cx', d => x(d.saves))
      .attr('cy', d => y(d.count))
      .attr('r', 3)
      .attr('fill', '#1B2A4A')
      .attr('cursor', 'pointer')
      .attr('opacity', 0.6)
      .on('click', (_, d) => setSelectedSaves(d.saves))
      .on('mouseover', function() { d3.select(this).attr('r', 6).attr('opacity', 1); })
      .on('mouseout', function() { d3.select(this).attr('r', 3).attr('opacity', 0.6); });

    // Divider line at saves=5
    g.append('line')
      .attr('x1', x(5)).attr('x2', x(5))
      .attr('y1', 0).attr('y2', h)
      .attr('stroke', '#8DA4C4')
      .attr('stroke-dasharray', '4,4')
      .attr('stroke-width', 1);

    // Labels
    g.append('text')
      .attr('x', x(2)).attr('y', -5)
      .attr('text-anchor', 'middle')
      .attr('font-family', 'var(--font-mono), monospace')
      .attr('font-size', 10)
      .attr('fill', '#1B2A4A')
      .text('Long Tail');

    g.append('text')
      .attr('x', x(15)).attr('y', -5)
      .attr('text-anchor', 'middle')
      .attr('font-family', 'var(--font-mono), monospace')
      .attr('font-size', 10)
      .attr('fill', '#5C7396')
      .text('Head');

    // Axes
    g.append('g')
      .attr('transform', `translate(0,${h})`)
      .call(d3.axisBottom(x).tickValues([1, 2, 5, 10, 20, 50]).tickFormat(d3.format('d')))
      .call(g => g.select('.domain').attr('stroke', '#C8D4E4'))
      .call(g => g.selectAll('.tick line').attr('stroke', '#C8D4E4'))
      .call(g => g.selectAll('.tick text').attr('font-family', 'var(--font-mono)').attr('font-size', 10).attr('fill', '#5C7396'));

    g.append('text')
      .attr('x', w / 2).attr('y', h + 40)
      .attr('text-anchor', 'middle')
      .attr('font-family', 'var(--font-mono), monospace')
      .attr('font-size', 10)
      .attr('fill', '#5C7396')
      .text('Number of saves');

    g.append('g')
      .call(d3.axisLeft(y).ticks(5, '~s'))
      .call(g => g.select('.domain').attr('stroke', '#C8D4E4'))
      .call(g => g.selectAll('.tick line').attr('stroke', '#C8D4E4'))
      .call(g => g.selectAll('.tick text').attr('font-family', 'var(--font-mono)').attr('font-size', 10).attr('fill', '#5C7396'));

  }, [data, dimensions]);

  if (!data) {
    return <div className="h-[350px] flex items-center justify-center font-terminal text-sm text-ink-muted">Loading...</div>;
  }

  const samples = selectedSaves ? data.samples[selectedSaves] : null;

  return (
    <div>
      {/* Stats */}
      <div className="flex gap-6 mb-4 flex-wrap">
        <div>
          <span className="font-terminal text-2xl text-ink font-medium">{data.stats.singleSavePercent}%</span>
          <p className="font-terminal text-[10px] text-ink-muted">saved by only one person</p>
        </div>
        <div>
          <span className="font-terminal text-2xl text-ink font-medium">{data.stats.maxSaves}</span>
          <p className="font-terminal text-[10px] text-ink-muted">most saves on a single article</p>
        </div>
      </div>

      <svg ref={svgRef} width={dimensions.width} height={350} />

      <p className="font-terminal text-[10px] text-ink-muted text-center mt-1">
        Click a point to see articles at that save count
      </p>

      {/* Samples */}
      {samples && samples.length > 0 && (
        <div className="mt-4 border border-border/50 rounded-lg p-4 bg-cream-light/30">
          <p className="font-terminal text-xs text-ink-muted mb-3">
            Articles saved by {selectedSaves} {selectedSaves === 1 ? 'person' : 'people'}:
          </p>
          <div className="space-y-2">
            {samples.map(s => (
              <a
                key={s.id}
                href={s.link}
                target="_blank"
                rel="noopener noreferrer"
                className="block group"
              >
                <span className="font-serif text-sm text-ink group-hover:text-ink-light transition-colors">
                  {s.title_en || s.title}
                </span>
                <span className="font-terminal text-[10px] text-ink-muted ml-2">{s.domain}</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
