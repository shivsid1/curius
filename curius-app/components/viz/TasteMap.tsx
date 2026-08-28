'use client';

import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { cn } from '@/lib/utils';
import { Loader } from '@/components/shared/Loader';

interface PackNode {
  id: string;
  bookmarks: number;
  topic: string;
}

interface TasteMapData {
  nodes: PackNode[];
  edges: unknown[];
}

const TOPIC_COLORS: Record<string, string> = {
  Technology: '#1B2A4A',
  Culture: '#8B4513',
  Science: '#2E5A3A',
  Business: '#B8860B',
  Personal: '#6B3A6B',
  Media: '#1B6B6B',
};

export function TasteMap() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [data, setData] = useState<TasteMapData | null>(null);
  const [hovered, setHovered] = useState<PackNode | null>(null);
  const [activeTopic, setActiveTopic] = useState<string | null>(null);
  // Start at 0 width and measure the container once the svg exists -- a
  // fixed default overflows narrow viewports.
  const [dimensions, setDimensions] = useState({ width: 0, height: 500 });

  useEffect(() => {
    fetch('/data/taste-map.json')
      .then(r => r.json())
      .then(d => setData(d));
  }, []);

  // Re-runs when data arrives: before that the component renders its loading
  // state, the svg ref is null, and a mount-only measure would silently no-op.
  useEffect(() => {
    const handleResize = () => {
      const container = svgRef.current?.parentElement;
      if (container) {
        setDimensions({
          width: container.clientWidth,
          height: Math.max(400, Math.min(560, window.innerHeight * 0.55)),
        });
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [data]);

  useEffect(() => {
    if (!data || !svgRef.current) return;

    const { width, height } = dimensions;
    // Skip the pre-measure pass -- pack layout at 0 width produces NaN circles.
    if (width <= 0) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const nodes = activeTopic
      ? data.nodes.filter(n => n.topic === activeTopic)
      : data.nodes;

    const root = d3
      .hierarchy<{ children: PackNode[] }>({ children: nodes })
      .sum(d => (d as unknown as PackNode).bookmarks || 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    d3.pack<{ children: PackNode[] }>()
      .size([width, height])
      .padding(3)(root);

    const leaves = root.leaves() as unknown as (d3.HierarchyCircularNode<PackNode> & { data: PackNode })[];

    const g = svg.append('g');

    const nodeG = g
      .selectAll<SVGGElement, (typeof leaves)[number]>('g')
      .data(leaves)
      .join('g')
      .attr('transform', d => `translate(${d.x},${d.y})`)
      .attr('cursor', 'pointer');

    nodeG
      .append('circle')
      .attr('r', d => d.r)
      .attr('fill', d => TOPIC_COLORS[d.data.topic] || TOPIC_COLORS.Technology)
      .attr('fill-opacity', 0.72)
      .attr('stroke', d => TOPIC_COLORS[d.data.topic] || TOPIC_COLORS.Technology)
      .attr('stroke-width', 1);

    // Label only when bubble is large enough to hold it
    nodeG
      .filter(d => d.r > 20)
      .append('text')
      .text(d => d.data.id)
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('font-family', 'var(--font-mono), monospace')
      .attr('font-size', d => Math.max(7, Math.min(11, d.r / 3.8)))
      .attr('fill', 'white')
      .attr('fill-opacity', 0.88)
      .attr('pointer-events', 'none');

    nodeG.on('mouseover', (event, d) => {
      setHovered(d.data);
      d3.select<SVGGElement, typeof d>(event.currentTarget)
        .select('circle')
        .attr('fill-opacity', 1)
        .attr('stroke-width', 2);
    });

    nodeG.on('mouseout', (event) => {
      setHovered(null);
      d3.select(event.currentTarget as SVGGElement)
        .select('circle')
        .attr('fill-opacity', 0.72)
        .attr('stroke-width', 1);
    });
  }, [data, dimensions, activeTopic]);

  if (!data) {
    return (
      <div className="h-[400px] flex items-center justify-center">
        <Loader label="Loading taste map..." />
      </div>
    );
  }

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="bg-cream-light/50 rounded-lg border border-border/30"
      />

      {/* Topic filter legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3 justify-center">
        <button
          onClick={() => setActiveTopic(null)}
          className={cn(
            'font-terminal text-[10px] transition-opacity',
            activeTopic ? 'text-ink-muted opacity-40' : 'text-ink opacity-100'
          )}
        >
          All
        </button>
        {Object.entries(TOPIC_COLORS).map(([topic, color]) => (
          <button
            key={topic}
            onClick={() => setActiveTopic(activeTopic === topic ? null : topic)}
            className={cn(
              'flex items-center gap-1.5 transition-opacity',
              activeTopic && activeTopic !== topic ? 'opacity-30' : 'opacity-100'
            )}
          >
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
            <span className="font-terminal text-[10px] text-ink-muted">{topic}</span>
          </button>
        ))}
      </div>

      {/* Hover tooltip */}
      {hovered && (
        <div className="absolute top-3 left-3 bg-cream/90 backdrop-blur-sm border border-border rounded-lg px-3 py-2 shadow-paper pointer-events-none">
          <span className="font-serif text-sm text-ink font-medium">{hovered.id}</span>
          <span className="font-terminal text-[10px] text-ink-muted ml-2">
            {hovered.bookmarks.toLocaleString()} bookmarks
          </span>
          <span className="font-terminal text-[10px] text-ink-muted ml-2">{hovered.topic}</span>
        </div>
      )}
    </div>
  );
}
