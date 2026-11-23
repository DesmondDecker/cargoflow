import React from 'react';

interface Props {
  title: string;
  data: { label: string; value: number }[];
  color?: string;
}

// A small bar chart drawn as SVG, so it needs no chart library. Every bar is
// labelled with its value, and the axis labels are the week-start dates.
export function BarChart({ title, data, color = '#F26B21' }: Props) {
  const width = 480;
  const height = 150;
  const pad = { top: 18, bottom: 26, left: 8, right: 8 };
  const max = Math.max(1, ...data.map((d) => d.value));
  const slot = (width - pad.left - pad.right) / Math.max(1, data.length);
  const barW = Math.max(4, slot * 0.62);
  const total = data.reduce((a, d) => a + d.value, 0);

  return (
    <div className="card">
      <div className="card-title">{title} <span style={{ color: 'var(--text-secondary)', fontWeight: 400, fontSize: 13 }}>· {total} in 12 weeks</span></div>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img" aria-label={title}>
        {data.map((d, i) => {
          const h = ((height - pad.top - pad.bottom) * d.value) / max;
          const x = pad.left + i * slot + (slot - barW) / 2;
          const y = height - pad.bottom - h;
          return (
            <g key={d.label}>
              <rect x={x} y={y} width={barW} height={Math.max(h, d.value > 0 ? 2 : 0)} rx={2} fill={color} />
              {d.value > 0 ? <text x={x + barW / 2} y={y - 4} fontSize="10" textAnchor="middle" fill="#444">{d.value}</text> : null}
              {i % 3 === 0 ? <text x={x + barW / 2} y={height - 8} fontSize="9" textAnchor="middle" fill="#777">{d.label.slice(5)}</text> : null}
            </g>
          );
        })}
        <line x1={pad.left} x2={width - pad.right} y1={height - pad.bottom} y2={height - pad.bottom} stroke="#ccc" />
      </svg>
    </div>
  );
}
