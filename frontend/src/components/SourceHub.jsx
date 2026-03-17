import React, { useState } from 'react';
import { Database, FileText, Globe, Cpu, ChevronRight, Upload, Server, Key, Terminal } from 'lucide-react';

const sources = [
  { 
    id: 'csv', 
    name: 'Local Dataset', 
    desc: 'Analyze CSV files immediately', 
    icon: FileText, 
    color: '#34d399',
    details: 'Supports large CSV uploads with auto-schema detection.'
  },
  { 
    id: 'sqlite', 
    name: 'SQLite Database', 
    desc: 'Connect to local .db files', 
    icon: Database, 
    color: '#3b82f6',
    details: 'Read-only access to any local SQLite instance via absolute path.'
  },
  { 
    id: 'mysql', 
    name: 'MySQL Server', 
    desc: 'Enterprise database connection', 
    icon: Server, 
    color: '#f59e0b',
    details: 'Connect to remote production databases securely.'
  },
  { 
    id: 'openai', 
    name: 'Intelligence Engine', 
    desc: 'Configure OpenAI API Key', 
    icon: Key, 
    color: '#10a37f',
    details: 'Leverage GPT-4o intelligence for your data exploration.'
  }
];

export default function SourceHub({ onConnect, onUpdateKey }) {
  const [selected, setSelected] = useState(null);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAction = () => {
    if (selected === 'openai') onUpdateKey(inputValue);
    else onConnect(selected, inputValue);
  };

  return (
    <div className="source-hub animate-fade-in">
      <div className="hub-content">
        <div className="hub-header">
           <Cpu size={40} className="sparkle-v2" />
           <h2>Initialize Intelligence</h2>
           <p>Choose an analytical source to begin your exploration</p>
        </div>

        {!selected ? (
          <div className="source-grid">
            {sources.map(s => (
              <button key={s.id} className="source-card" onClick={() => setSelected(s.id)}>
                <div className="source-icon" style={{ backgroundColor: `${s.color}20`, color: s.color }}>
                   <s.icon size={24} />
                </div>
                <div className="source-info">
                   <h3>{s.name}</h3>
                   <p>{s.desc}</p>
                </div>
                <ChevronRight size={18} className="chevron" />
              </button>
            ))}
          </div>
        ) : (
          <div className="connection-wizard animate-slide-up">
             <button className="back-link" onClick={() => setSelected(null)}>← Change analytical source</button>
             
             <div className="active-source-pill">
                {React.createElement(sources.find(s => s.id === selected).icon, { size: 16 })}
                <span>{sources.find(s => s.id === selected).name.toUpperCase()}</span>
             </div>

             <div className="wizard-input-box">
                {selected === 'csv' ? (
                   <div className="upload-zone" onClick={() => document.getElementById('hub-upload').click()}>
                      <Upload size={32} />
                      <p>Drop your CSV here or <span>Browse Files</span></p>
                      <input type="file" id="hub-upload" hidden onChange={(e) => onConnect('csv', e.target.files[0])} accept=".csv" />
                   </div>
                ) : (
                   <div className="text-input-zone">
                      <label>{selected === 'openai' ? 'API KEY' : 'ACCESS PATH / CREDENTIALS'}</label>
                      <div className="input-group-v2">
                         {selected === 'openai' ? <Key size={18} /> : <Terminal size={18} />}
                         <input 
                           type={selected === 'openai' ? 'password' : 'text'}
                           placeholder={selected === 'sqlite' ? '/path/to/database.db' : 'Enter credentials...'}
                           value={inputValue}
                           onChange={(e) => setInputValue(e.target.value)}
                           autoFocus
                         />
                      </div>
                      <button className="btn-initialize" onClick={handleAction}>
                         ESTABLISH CONNECTION
                      </button>
                   </div>
                )}
             </div>
             <p className="source-disclaimer">{sources.find(s => s.id === selected).details}</p>
          </div>
        )}
      </div>
    </div>
  );
}
