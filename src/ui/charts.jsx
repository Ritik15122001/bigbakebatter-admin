import { useId, useMemo, useRef, useState } from 'react';

const TONE_COLOR = { brand: '#5b5bd6', green: '#079455', amber: '#dc6803', red: '#d92d20', blue: '#1570ef', violet: '#7a5af8', gray: '#98a2b3' };

/** Tiny trend line for stat cards. */
export function Sparkline({ values, tone = 'brand' }) {
  const id = useId();
  const color = TONE_COLOR[tone] || TONE_COLOR.brand;
  const max = Math.max(1, ...values);
  const min = Math.min(0, ...values);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * 96, 32 - ((v - min) / (max - min || 1)) * 28]);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  return (
    <svg className="u-spark" viewBox="0 0 96 36" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L96 36 L0 36 Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/**
 * Smooth area chart with hover tooltip.
 * data: [{ label, value, sub? }]; format(value) renders numbers.
 */
export function AreaChart({ data, height = 240, format = (v) => v, tone = 'brand' }) {
  const id = useId();
  const wrap = useRef(null);
  const [hover, setHover] = useState(null);
  const color = TONE_COLOR[tone] || TONE_COLOR.brand;
  const W = 800;
  const H = height;
  const padB = 26;
  const padT = 12;
  const max = Math.max(1, ...data.map((d) => d.value));
  const niceMax = useMemo(() => {
    const p = 10 ** Math.floor(Math.log10(max));
    return Math.ceil(max / p) * p;
  }, [max]);
  const x = (i) => (data.length <= 1 ? W / 2 : (i / (data.length - 1)) * W);
  const y = (v) => padT + (1 - v / niceMax) * (H - padT - padB);
  const pts = data.map((d, i) => [x(i), y(d.value)]);
  // Catmull-Rom → bezier for a soft curve.
  const path = pts.reduce((acc, p, i, a) => {
    if (i === 0) return `M${p[0]} ${p[1]}`;
    const p0 = a[i - 2] || a[i - 1];
    const p1 = a[i - 1];
    const p2 = p;
    const p3 = a[i + 1] || p;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    return `${acc} C${c1[0]} ${Math.min(c1[1], H - padB)} ${c2[0]} ${Math.min(c2[1], H - padB)} ${p2[0]} ${p2[1]}`;
  }, '');
  const ticks = [0, 0.5, 1].map((f) => niceMax * f);
  const every = Math.ceil(data.length / 7);

  const onMove = (e) => {
    const r = wrap.current.getBoundingClientRect();
    const i = Math.round(((e.clientX - r.left) / r.width) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  };

  return (
    <div className="u-chart" ref={wrap} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ height }} role="img" aria-label="Chart">
        <defs>
          <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <line key={t} x1="0" x2={W} y1={y(t)} y2={y(t)} stroke="#eef0f3" strokeDasharray={t ? '4 4' : '0'} vectorEffect="non-scaling-stroke" />
        ))}
        {data.length > 0 && <path d={`${path} L${W} ${H - padB} L0 ${H - padB} Z`} fill={`url(#${id})`} />}
        <path d={path} fill="none" stroke={color} strokeWidth="2.25" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        {hover !== null && (
          <>
            <line x1={pts[hover][0]} x2={pts[hover][0]} y1={padT} y2={H - padB} stroke="#d0d5dd" vectorEffect="non-scaling-stroke" />
            <circle cx={pts[hover][0]} cy={pts[hover][1]} r="5" fill="#fff" stroke={color} strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
          </>
        )}
      </svg>
      <div style={{ position: 'relative', height: 0 }}>
        {data.map((d, i) =>
          i % every === 0 || i === data.length - 1 ? (
            <span key={i} className="u-chart-axis" style={{ position: 'absolute', top: -22, left: `${(x(i) / W) * 100}%`, transform: i === 0 ? 'none' : i === data.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)', fontSize: 11.5, color: '#98a2b3' }}>
              {d.label}
            </span>
          ) : null
        )}
      </div>
      {hover !== null && data[hover] && (
        <div className="u-chart-tip" style={{ left: `${(pts[hover][0] / W) * 100}%`, top: (pts[hover][1] / H) * height }}>
          <b>{format(data[hover].value)}</b>
          {data[hover].label}{data[hover].sub ? ` · ${data[hover].sub}` : ''}
        </div>
      )}
    </div>
  );
}

/** Horizontal labelled bars: [{ label, value, display? }] */
export function BarList({ items, tone = 'brand' }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="u-barlist">
      {items.map((it) => (
        <div className="u-barlist-row" key={it.label}>
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.label}</span>
          <b>{it.display ?? it.value}</b>
          <div className="u-barlist-track"><i style={{ width: `${(it.value / max) * 100}%`, background: TONE_COLOR[it.tone || tone] }} /></div>
        </div>
      ))}
    </div>
  );
}

/** Stacked proportion bar + legend: [{ label, value, tone }] */
export function SegmentBar({ items }) {
  const total = items.reduce((s, i) => s + i.value, 0) || 1;
  return (
    <div className="u-stack tight">
      <div className="u-segbar">
        {items.filter((i) => i.value > 0).map((i) => (
          <i key={i.label} style={{ width: `${(i.value / total) * 100}%`, background: TONE_COLOR[i.tone] || TONE_COLOR.gray }} title={`${i.label}: ${i.value}`} />
        ))}
      </div>
      <div className="u-legend">
        {items.map((i) => (
          <span key={i.label}><i style={{ background: TONE_COLOR[i.tone] || TONE_COLOR.gray }} />{i.label} <b>{i.value}</b></span>
        ))}
      </div>
    </div>
  );
}
