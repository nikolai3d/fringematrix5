import { useState, useCallback } from 'react';
import FringeGlyphLoadingSpinner from './components/FringeGlyphLoadingSpinner';

interface ControlPanelProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
}

function ControlSlider({ label, value, min, max, step = 1, unit = '', onChange }: ControlPanelProps) {
  return (
    <div style={sliderContainerStyle}>
      <label style={labelStyle}>
        {label}: <span style={valueStyle}>{value}{unit}</span>
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={rangeStyle}
      />
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={numberInputStyle}
      />
    </div>
  );
}

const sliderContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  marginBottom: '16px',
};

const labelStyle: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
  fontSize: '13px',
  color: '#b8c7d9',
  letterSpacing: '0.02em',
};

const valueStyle: React.CSSProperties = {
  color: '#64d9ff',
  fontWeight: 600,
};

const rangeStyle: React.CSSProperties = {
  width: '100%',
  height: '6px',
  borderRadius: '3px',
  background: '#1a2a3a',
  cursor: 'pointer',
  accentColor: '#64d9ff',
};

const numberInputStyle: React.CSSProperties = {
  width: '80px',
  padding: '6px 10px',
  background: '#0d1520',
  border: '1px solid #2a3a4a',
  borderRadius: '4px',
  color: '#64d9ff',
  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
  fontSize: '12px',
};

export default function GlyphSpinnerDebug() {
  const [x, setX] = useState(100);
  const [y, setY] = useState(100);
  const [size, setSize] = useState(200);
  const [opacity, setOpacity] = useState(1);
  const [borderRadius, setBorderRadius] = useState(8);
  const [fadeInDuration, setFadeInDuration] = useState(500);
  const [displayDuration, setDisplayDuration] = useState(1500);
  const [crossDissolveDuration, setCrossDissolveDuration] = useState(500);
  const [componentKey, setComponentKey] = useState(0);

  const handleReload = useCallback(() => {
    setComponentKey((prev) => prev + 1);
  }, []);

  return (
    <div style={pageStyle}>
      {/* Control Panel */}
      <div style={panelStyle}>
        <h2 style={titleStyle}>Glyph Spinner Debug</h2>
        
        <div style={sectionStyle}>
          <h3 style={sectionTitleStyle}>Position</h3>
          <ControlSlider label="X" value={x} min={0} max={800} onChange={setX} unit="px" />
          <ControlSlider label="Y" value={y} min={0} max={600} onChange={setY} unit="px" />
        </div>

        <div style={sectionStyle}>
          <h3 style={sectionTitleStyle}>Appearance</h3>
          <ControlSlider label="Size" value={size} min={50} max={400} onChange={setSize} unit="px" />
          <ControlSlider label="Opacity" value={opacity} min={0} max={1} step={0.05} onChange={setOpacity} />
          <ControlSlider label="Border Radius" value={borderRadius} min={0} max={100} onChange={setBorderRadius} unit="px" />
        </div>

        <div style={sectionStyle}>
          <h3 style={sectionTitleStyle}>Timing</h3>
          <ControlSlider label="Fade In" value={fadeInDuration} min={0} max={3000} step={100} onChange={setFadeInDuration} unit="ms" />
          <ControlSlider label="Display Time" value={displayDuration} min={200} max={5000} step={100} onChange={setDisplayDuration} unit="ms" />
          <ControlSlider label="Cross-Dissolve" value={crossDissolveDuration} min={0} max={2000} step={50} onChange={setCrossDissolveDuration} unit="ms" />
        </div>

        <button onClick={handleReload} style={buttonStyle}>
          Reload Component (Re-shuffle)
        </button>

        <div style={infoStyle}>
          <p>Click "Reload" to re-shuffle the glyph order.</p>
          <p>Adjust sliders to see changes in real-time.</p>
        </div>
      </div>

      {/* Spinner Display Area */}
      <div style={displayAreaStyle}>
        <FringeGlyphLoadingSpinner
          key={componentKey}
          x={x}
          y={y}
          size={size}
          opacity={opacity}
          borderRadius={borderRadius}
          fadeInDuration={fadeInDuration}
          displayDuration={displayDuration}
          crossDissolveDuration={crossDissolveDuration}
        />
        
        {/* Position indicator */}
        <div style={{
          ...positionIndicatorStyle,
          left: x,
          top: y,
          width: size,
          height: size,
          borderRadius,
        }} />
      </div>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  display: 'flex',
  minHeight: '100vh',
  background: 'linear-gradient(135deg, #06090f 0%, #0b111a 50%, #101820 100%)',
  fontFamily: "'Inter', system-ui, sans-serif",
};

const panelStyle: React.CSSProperties = {
  width: '320px',
  minWidth: '320px',
  padding: '24px',
  background: 'linear-gradient(180deg, rgba(11,17,26,0.98), rgba(6,9,15,0.95))',
  borderRight: '1px solid rgba(100, 217, 255, 0.15)',
  overflowY: 'auto',
  boxShadow: '4px 0 20px rgba(0,0,0,0.3)',
};

const titleStyle: React.CSSProperties = {
  fontFamily: "'Orbitron', 'Inter', sans-serif",
  fontSize: '18px',
  fontWeight: 700,
  color: '#e6f0ff',
  marginBottom: '24px',
  letterSpacing: '0.05em',
  textShadow: '0 0 10px rgba(100, 217, 255, 0.3)',
};

const sectionStyle: React.CSSProperties = {
  marginBottom: '24px',
  paddingBottom: '20px',
  borderBottom: '1px solid rgba(100, 217, 255, 0.1)',
};

const sectionTitleStyle: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '11px',
  fontWeight: 600,
  color: '#64d9ff',
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  marginBottom: '14px',
};

const buttonStyle: React.CSSProperties = {
  width: '100%',
  padding: '14px 20px',
  background: 'linear-gradient(135deg, rgba(100, 217, 255, 0.15), rgba(124, 77, 255, 0.15))',
  border: '1px solid rgba(100, 217, 255, 0.4)',
  borderRadius: '8px',
  color: '#e6f0ff',
  fontFamily: "'Orbitron', 'Inter', sans-serif",
  fontSize: '13px',
  fontWeight: 600,
  letterSpacing: '0.04em',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  marginBottom: '20px',
};

const infoStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#89a0b3',
  lineHeight: 1.6,
};

const displayAreaStyle: React.CSSProperties = {
  flex: 1,
  position: 'relative',
  overflow: 'hidden',
};

const positionIndicatorStyle: React.CSSProperties = {
  position: 'absolute',
  border: '1px dashed rgba(100, 217, 255, 0.25)',
  pointerEvents: 'none',
};
