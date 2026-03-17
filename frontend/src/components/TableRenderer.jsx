import { useRef } from 'react';
import { Download } from 'lucide-react';
import html2canvas from 'html2canvas';
import { saveAs } from 'file-saver';

export default function TableRenderer({ data, title }) {
  const tableRef = useRef(null);

  const handleExportPNG = async () => {
    if (tableRef.current) {
      const canvas = await html2canvas(tableRef.current, { 
        backgroundColor: '#030303',
        scale: 2
      });
      canvas.toBlob((blob) => {
        if (blob) saveAs(blob, `${(title || 'intel').replace(/\s+/g, '_')}.png`);
      });
    }
  };

  const formatValue = (val) => {
    if (val === null || val === undefined) return '—';
    if (typeof val === 'number') {
      if (Number.isInteger(val)) return val.toLocaleString();
      return val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 4 });
    }
    return String(val);
  };

  if (!data || !data.rows || !data.columns) {
    return <div className="chart-card" style={{ padding: '24px', color: 'var(--text-dim)' }}>INTELLIGENCE_GRID: NO_DATA_STREAMED</div>;
  }

  return (
    <div className="chart-card" style={{ padding: '0', background: 'transparent' }}>
      <div className="chart-header" style={{ padding: '16px 20px', marginBottom: '0' }}>
        <div className="chart-info">
          <h3 style={{ fontSize: '0.75rem', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
            {title?.toUpperCase() || 'INTELLIGENCE GRID'}
          </h3>
          <p style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginTop: '2px' }}>
            {data.rows.length} records processed
          </p>
        </div>
        <button onClick={handleExportPNG} className="quick-tool-btn" style={{ fontSize: '0.6rem' }}>
          <Download size={10} style={{ marginRight: '4px' }} /> EXPORT
        </button>
      </div>

      <div className="markdown-body" ref={tableRef} style={{ padding: '0px', overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              {data.columns.map(col => (
                <th key={col}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, i) => (
              <tr key={i}>
                {data.columns.map(col => (
                  <td key={col} style={{ textAlign: (row && typeof row[col] === 'number') ? 'right' : 'left' }}>
                    {row ? formatValue(row[col]) : '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
