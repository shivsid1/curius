'use client';

import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

interface Node {
  id: string;
  bookmarks: number;
  topic: string;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

interface Edge {
  source: string | Node;
  target: string | Node;
  weight: number;
}

interface TasteMapData {
  nodes: Node[];
  edges: Edge[];
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
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  useEffect(() => {
    fetch('/data/taste-map.json')
      .then(r => r.json())
      .then(d => setData(d));
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const container = svgRef.current?.parentElement;
      if (container) {
        setDimensions({
          width: container.clientWidth,
          height: Math.max(500, Math.min(700, window.innerHeight * 0.6)),
        });
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!data || !svgRef.current) return;

    const { width, height } = dimensions;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const g = svg.append('g');

    // Zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 4])
      .on('zoom', (event) => g.attr('transform', event.transform));
    svg.call(zoom);

    const nodes: Node[] = data.nodes.map(d => ({ ...d }));
    const edges: Edge[] = data.edges.map(d => ({ ...d }));

    const maxWeight = d3.max(edges, d => d.weight) || 1;
    const maxBookmarks = d3.max(nodes, d => d.bookmarks) || 1;

    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink<Node, Edge>(edges)
        .id(d => d.id)
        .distance(d => 120 - (d.weight / maxWeight) * 60)
        .strength(d => 0.1 + (d.weight / maxWeight) * 0.4))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide<Node>().radius(d => Math.sqrt(d.bookmarks / maxBookmarks) * 30 + 8));

    // Edges
    const link = g.append('g')
      .selectAll('line')
      .data(edges)
      .join('line')
      .attr('stroke', '#C8D4E4')
      .attr('stroke-opacity', d => 0.15 + (d.weight / maxWeight) * 0.4)
      .attr('stroke-width', d => 0.5 + (d.weight / maxWeight) * 2);

    // Nodes
    const node = g.append('g')
      .selectAll('circle')
      .data(nodes)
      .join('circle')
      .attr('r', d => Math.sqrt(d.bookmarks / maxBookmarks) * 25 + 4)
      .attr('fill', d => TOPIC_COLORS[d.topic] || TOPIC_COLORS.Technology)
      .attr('fill-opacity', 0.75)
      .attr('stroke', d => TOPIC_COLORS[d.topic] || TOPIC_COLORS.Technology)
      .attr('stroke-width', 1.5)
      .attr('cursor', 'pointer')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .call(d3.drag<any, Node>()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        }));

    // Labels
    const label = g.append('g')
      .selectAll('text')
      .data(nodes)
      .join('text')
      .text(d => d.id)
      .attr('font-family', 'var(--font-mono), monospace')
      .attr('font-size', d => Math.max(8, Math.min(12, Math.sqrt(d.bookmarks / maxBookmarks) * 12)))
      .attr('fill', '#1B2A4A')
      .attr('text-anchor', 'middle')
      .attr('dy', d => Math.sqrt(d.bookmarks / maxBookmarks) * 25 + 16)
      .attr('opacity', 0.7)
      .attr('pointer-events', 'none');

    // Hover effects
    node.on('mouseover', function(event, d) {
      setHoveredNode(d.id);
      const connected = new Set<string>();
      edges.forEach(e => {
        const s = typeof e.source === 'object' ? e.source.id : e.source;
        const t = typeof e.target === 'object' ? e.target.id : e.target;
        if (s === d.id) connected.add(t);
        if (t === d.id) connected.add(s);
      });

      node.attr('fill-opacity', n => n.id === d.id || connected.has(n.id) ? 0.9 : 0.15);
      link.attr('stroke-opacity', e => {
        const s = typeof e.source === 'object' ? e.source.id : e.source;
        const t = typeof e.target === 'object' ? e.target.id : e.target;
        return s === d.id || t === d.id ? 0.6 : 0.03;
      });
      label.attr('opacity', n => n.id === d.id || connected.has(n.id) ? 1 : 0.1);
    });

    node.on('mouseout', function() {
      setHoveredNode(null);
      node.attr('fill-opacity', 0.75);
      link.attr('stroke-opacity', d => 0.15 + ((d as Edge).weight / maxWeight) * 0.4);
      label.attr('opacity', 0.7);
    });

    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as Node).x!)
        .attr('y1', d => (d.source as Node).y!)
        .attr('x2', d => (d.target as Node).x!)
        .attr('y2', d => (d.target as Node).y!);

      node.attr('cx', d => d.x!).attr('cy', d => d.y!);
      label.attr('x', d => d.x!).attr('y', d => d.y!);
    });

    return () => { simulation.stop(); };
  }, [data, dimensions]);

  if (!data) {
    return <div className="h-[500px] flex items-center justify-center font-terminal text-sm text-ink-muted">Loading taste map...</div>;
  }

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="bg-cream-light/50 rounded-lg border border-border/30"
      />
      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-3 justify-center">
        {Object.entries(TOPIC_COLORS).map(([topic, color]) => (
          <div key={topic} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
            <span className="font-terminal text-[10px] text-ink-muted">{topic}</span>
          </div>
        ))}
      </div>
      {hoveredNode && (
        <div className="absolute top-3 left-3 bg-cream/90 backdrop-blur-sm border border-border rounded-lg px-3 py-2 shadow-paper">
          <span className="font-serif text-sm text-ink font-medium">{hoveredNode}</span>
          <span className="font-terminal text-[10px] text-ink-muted ml-2">
            {data.nodes.find(n => n.id === hoveredNode)?.bookmarks} bookmarks
          </span>
        </div>
      )}
    </div>
  );
}
