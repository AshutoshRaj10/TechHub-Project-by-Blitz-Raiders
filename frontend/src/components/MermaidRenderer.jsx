import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { Download } from 'lucide-react';
import html2canvas from 'html2canvas';
import { saveAs } from 'file-saver';

mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  securityLevel: 'loose',
  fontFamily: 'Inter, sans-serif',
  suppressErrorDeclaration: true,
});

export default function MermaidRenderer({ chart }) {
  const containerRef = useRef(null);
  const wrapperRef = useRef(null);
  const [svgContent, setSvgContent] = useState('');
  const [error, setError] = useState(null);

  const handleExportPNG = async () => {
    if (wrapperRef.current) {
      const canvas = await html2canvas(wrapperRef.current, { backgroundColor: '#0f172a' });
      canvas.toBlob((blob) => {
        if (blob) saveAs(blob, `flowchart.png`);
      });
    }
  };

  useEffect(() => {
    const renderChart = async () => {
      if (!chart) return;
      try {
        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
        // Validate and render quietly
        const { svg } = await mermaid.render(id, chart);
        setSvgContent(svg);
        setError(null);
      } catch (err) {
        console.warn('Mermaid rendering failed - suppressing bomb graphic', err);
        setError('Structure too complex for the current model. Please try a simpler flow.');
      }
    };

    renderChart();
  }, [chart]);

  return (
    <div className="chart-card">
      <div className="chart-header">
        <div className="chart-info">
          <div className="chart-icon-box">
            <Download size={18} color="#818cf8" />
          </div>
          <div>
            <h3>Data Visualization / Flow</h3>
          </div>
        </div>
        <div className="chart-actions">
          <button onClick={handleExportPNG} className="chart-btn" title="Export as PNG">
            <Download size={14} /> <span>PNG</span>
          </button>
        </div>
      </div>

      <div className="diagram-container">
        {error ? (
          <div className="error-msg" style={{ padding: '40px 20px', textAlign: 'center' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>
              {error}
            </div>
          </div>
        ) : (
          <div 
            className="mermaid"
            ref={wrapperRef}
          >
            <div 
              ref={containerRef} 
              dangerouslySetInnerHTML={{ __html: svgContent }} 
            />
          </div>
        )}
      </div>
    </div>
  );
}
