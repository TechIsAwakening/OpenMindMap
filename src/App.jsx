import { useCallback, useRef, useState } from 'react';
import { exportMindmapToPdf } from './utils/exporters.js';

const nodes = [
  { id: 1, label: 'Vision', x: 250, y: 40 },
  { id: 2, label: 'Produit', x: 80, y: 180 },
  { id: 3, label: 'Technique', x: 420, y: 180 },
  { id: 4, label: 'Communauté', x: 250, y: 300 },
];

const links = [
  { from: 1, to: 2 },
  { from: 1, to: 3 },
  { from: 1, to: 4 },
];

function MindmapNode({ label, x, y }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect
        x={-70}
        y={-30}
        width={140}
        height={60}
        rx={20}
        fill="url(#node-gradient)"
        stroke="rgba(148, 163, 184, 0.6)"
        strokeWidth={2}
      />
      <text
        fill="#f8fafc"
        fontSize="18"
        fontWeight="600"
        textAnchor="middle"
        alignmentBaseline="central"
      >
        {label}
      </text>
    </g>
  );
}

export default function App() {
  const svgRef = useRef(null);
  const [status, setStatus] = useState(null);
  const [isExporting, setIsExporting] = useState(false);

  const scheduleStatusReset = useCallback(() => {
    setTimeout(() => {
      setStatus((current) => {
        if (!current || current.type === 'loading') {
          return current;
        }

        return null;
      });
    }, 4000);
  }, []);

  const handleExport = useCallback(async () => {
    if (!svgRef.current) {
      setStatus({ type: 'error', message: "Canvas introuvable pour effectuer l'export." });
      scheduleStatusReset();
      return;
    }

    setIsExporting(true);
    setStatus({ type: 'loading', message: 'Génération du PDF en cours…' });

    try {
      await exportMindmapToPdf(svgRef.current, {
        filename: 'openmindmap-demo.pdf',
        backgroundColor: '#0f172a',
      });
      setStatus({ type: 'success', message: 'Export PDF réussi !' });
    } catch (error) {
      console.error(error);
      setStatus({
        type: 'error',
        message: error?.message || "Une erreur imprévue est survenue pendant l'export.",
      });
    } finally {
      setIsExporting(false);
      scheduleStatusReset();
    }
  }, [scheduleStatusReset]);

  return (
    <div className="app-container">
      <header className="top-bar">
        <h1>OpenMindMap</h1>
        <button
          className="export-button"
          type="button"
          onClick={handleExport}
          disabled={isExporting}
        >
          {isExporting ? 'Export en cours…' : 'Exporter en PDF'}
        </button>
      </header>
      <main className="canvas-container">
        <div className="mindmap-wrapper">
          <svg
            ref={svgRef}
            className="mindmap-canvas"
            viewBox="0 0 500 360"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="background-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#1d4ed8" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#9333ea" stopOpacity="0.35" />
              </linearGradient>
              <linearGradient id="node-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#6366f1" />
              </linearGradient>
            </defs>
            <rect
              x="0"
              y="0"
              width="500"
              height="360"
              fill="url(#background-gradient)"
              rx="24"
            />
            {links.map((link) => {
              const from = nodes.find((node) => node.id === link.from);
              const to = nodes.find((node) => node.id === link.to);

              if (!from || !to) {
                return null;
              }

              return (
                <line
                  key={`${link.from}-${link.to}`}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke="rgba(148, 163, 184, 0.65)"
                  strokeWidth={3}
                  strokeLinecap="round"
                />
              );
            })}
            {nodes.map((node) => (
              <MindmapNode key={node.id} {...node} />
            ))}
          </svg>
        </div>
      </main>
      {status && (
        <div className={`status-banner ${status.type}`}>
          {status.message}
        </div>
      )}
    </div>
  );
}
