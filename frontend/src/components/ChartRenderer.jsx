import { useRef, useMemo } from 'react';
import { Download, BarChart3, LineChart as LineIcon, PieChart as PieIcon, Activity } from 'lucide-react';
import html2canvas from 'html2canvas';
import { saveAs } from 'file-saver';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts';

/* Enterprise Studio Palette — Monochromatic with selective accents */
const COLORS = ['#ededed', '#737373', '#404040', '#ffffff', '#a1a1a1', '#525252'];

const formatValue = (val) => {
  if (typeof val === 'number') {
    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `${(val / 1000).toFixed(1)}K`;
    return val.toLocaleString();
  }
  return val;
};

export default function ChartRenderer({ config }) {
  if (!config) return null;
  const { chart_type, title, data: rawData, x_key, y_keys } = config;
  if (!rawData || !Array.isArray(rawData) || rawData.length === 0) {
    return <div className="chart-card" style={{ padding: '24px', color: 'var(--text-dim)' }}>No analytical data available.</div>;
  }
  if (!x_key || !y_keys || y_keys.length === 0) {
    return <div className="chart-card" style={{ padding: '24px', color: 'var(--text-dim)' }}>Configuration schema error.</div>;
  }

  const chartRef = useRef(null);

  const data = useMemo(() => {
    try {
      if (!rawData || !Array.isArray(rawData)) return [];
      return rawData.slice(0, 40).map(item => {
        if (!item || typeof item !== 'object') return {};
        const newItem = { ...item };
        y_keys.forEach(key => {
          if (newItem[key] === undefined || newItem[key] === null) {
            newItem[key] = 0;
          } else if (typeof newItem[key] === 'string') {
            const cleaned = newItem[key].replace(/[$,\s]/g, '');
            const parsed = parseFloat(cleaned);
            newItem[key] = isNaN(parsed) ? 0 : parsed;
          }
        });
        return newItem;
      });
    } catch (e) {
      console.error("Chart Data Processing Error:", e);
      return [];
    }
  }, [rawData, y_keys]);

  const pieData = useMemo(() => {
    if (chart_type !== 'pie') return data;
    if (data.length <= 8) return data;
    const valueKey = y_keys[0];
    const sorted   = [...data].sort((a, b) => (b[valueKey] ?? 0) - (a[valueKey] ?? 0));
    const top       = sorted.slice(0, 7);
    const rest      = sorted.slice(7);
    const otherVal  = rest.reduce((sum, r) => sum + (Number(r[valueKey]) || 0), 0);
    return [...top, { [x_key]: 'Other', [valueKey]: otherVal }];
  }, [data, chart_type, y_keys, x_key]);

  const handleExportPNG = async () => {
    if (chartRef.current) {
      const canvas = await html2canvas(chartRef.current, { backgroundColor: '#030303', scale: 2 });
      canvas.toBlob(blob => { if (blob) saveAs(blob, `${(title || 'analytics').replace(/\s+/g, '_')}.png`); });
    }
  };

  const Icon = { bar: BarChart3, line: LineIcon, pie: PieIcon, scatter: Activity }[chart_type] || BarChart3;
  
  const commonTooltip = (
    <Tooltip
      contentStyle={{
        backgroundColor: '#0a0a0a',
        border: '0.5px solid var(--border-surgical)',
        borderRadius: '6px',
        boxShadow: 'var(--shadow-elite)',
        padding: '10px',
        fontSize: '0.75rem'
      }}
      itemStyle={{ color: 'var(--text-pure)', fontWeight: '600' }}
      cursor={{ fill: 'rgba(255,255,255,0.02)' }}
      formatter={(value) => formatValue(value)}
    />
  );

  const renderChart = () => {
    const gridProps = { strokeDasharray: "2 2", stroke: "rgba(255,255,255,0.03)", vertical: false };
    const axisProps = { stroke: "var(--text-dim)", fontSize: 9, tickLine: false, axisLine: false, fontWeight: 500 };

    switch (chart_type) {
      case 'bar':
        return (
          <BarChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 40 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey={x_key} {...axisProps} tickMargin={8}
              angle={data.length > 10 ? -30 : 0} textAnchor={data.length > 10 ? 'end' : 'middle'} />
            <YAxis {...axisProps} tickFormatter={formatValue} />
            {commonTooltip}
            <Legend iconSize={8} wrapperStyle={{ paddingTop: '24px', fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }} />
            {y_keys.map((key, idx) => (
              <Bar key={key} dataKey={key} fill={COLORS[idx % COLORS.length]}
                radius={[1, 1, 0, 0]} barSize={Math.max(6, Math.min(24, 260 / data.length))}
                animationDuration={500} />
            ))}
          </BarChart>
        );
      case 'line':
        return (
          <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 40 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey={x_key} {...axisProps} tickMargin={8}
              angle={data.length > 10 ? -30 : 0} textAnchor={data.length > 10 ? 'end' : 'middle'} />
            <YAxis {...axisProps} tickFormatter={formatValue} />
            {commonTooltip}
            <Legend iconSize={8} wrapperStyle={{ paddingTop: '24px', fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }} />
            {y_keys.map((key, idx) => (
              <Line key={key} type="monotone" dataKey={key} stroke={COLORS[idx % COLORS.length]}
                strokeWidth={1.5} dot={{ r: 2, fill: '#0a0a0a', strokeWidth: 1 }}
                activeDot={{ r: 4 }} animationDuration={500} />
            ))}
          </LineChart>
        );
      case 'pie': {
        const valueKey = y_keys[0];
        return (
          <PieChart>
            {commonTooltip}
            <Pie
              data={pieData}
              dataKey={valueKey}
              nameKey={x_key}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={2}
              animationDuration={500}
            >
              {pieData.map((_, idx) => (
                <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} stroke="rgba(0,0,0,0.2)" />
              ))}
            </Pie>
            <Legend layout="vertical" align="right" verticalAlign="middle" iconSize={6}
              formatter={(value) => <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>{value.toUpperCase()}</span>} />
          </PieChart>
        );
      }
      case 'scatter':
        return (
          <ScatterChart margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey={x_key} {...axisProps} type="category" name={x_key} />
            <YAxis dataKey={y_keys[0]} {...axisProps} name={y_keys[0]} tickFormatter={formatValue} />
            {commonTooltip}
             <Legend iconSize={8} wrapperStyle={{ paddingTop: '24px', fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }} />
            <Scatter name={title} data={data} fill={COLORS[0]} animationDuration={500} />
          </ScatterChart>
        );
      default:
        return <div style={{ color: 'var(--danger)', fontSize: '0.7rem' }}>INVALID_VISUAL_TYPE: {chart_type}</div>;
    }
  };

  return (
    <div className="chart-card" ref={chartRef} style={{ background: 'transparent', padding: '0' }}>
      <div className="chart-header" style={{ padding: '16px 20px', marginBottom: '0' }}>
        <div className="chart-info">
          <h3 style={{ fontSize: '0.75rem', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
            {title?.toUpperCase() || 'ANALYTICAL FEED'}
          </h3>
          {rawData.length > 40 && <p style={{ fontSize: '0.6rem', color: 'var(--text-dim)', marginTop: '2px' }}>Sampling 40 points</p>}
        </div>
        <button onClick={handleExportPNG} className="quick-tool-btn" style={{ fontSize: '0.6rem' }}>
          <Download size={10} style={{ marginRight: '4px' }} /> EXPORT
        </button>
      </div>
      <div className="chart-viewport" style={{ height: '320px', padding: '0 20px 20px' }}>
        <ResponsiveContainer width="100%" height="100%">
          {renderChart()}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
