import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send, Database, Loader2, Square, Upload, Link2,
  CheckCircle, XCircle, LogOut, BarChart3, LineChart,
  PieChart, Activity, Table2, Sparkles, Mic, MicOff, FileDown,
  LayoutDashboard, ChevronUp, History, Info, Terminal, Cpu,
  Command, Box, Layers
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// Components
import ChartRenderer from './components/ChartRenderer.jsx';
import MermaidRenderer from './components/MermaidRenderer.jsx';
import TableRenderer from './components/TableRenderer.jsx';
import Auth from './components/Auth.jsx';
import Sidebar from './components/Sidebar.jsx';
import SourceHub from './components/SourceHub.jsx';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const generateId = (prefix = 'id') => `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// ─── Shared Part Renderer ──────────────────────────────────────────────────
function MessagePart({ part, token }) {
  if (part.type === 'chart') return <div className="export-target"><ChartRenderer config={part.content} /></div>;
  if (part.type === 'mermaid') return <div className="export-target"><MermaidRenderer chart={part.content} /></div>;
  if (part.type === 'table') return <div className="export-target"><TableRenderer data={part.content} title="Intelligence Feed" /></div>;
  
  return (
    <div className="markdown-body export-target">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{part.content}</ReactMarkdown>
    </div>
  );
}

// ─── Analyzing indicator ───────────────────────────────────────────────────
function StatusIndicator({ status }) {
  if (!status) return null;
  return (
    <div className="analyzer-pill">
      <div style={{ display: 'flex', gap: '4px', alignItems: 'center', margin: '4px 0' }}>
        <div className="wave-dot" />
        <div className="wave-dot" />
        <div className="wave-dot" />
        <span className="status-text">{status.toUpperCase()}</span>
      </div>
    </div>
  );
}

// ─── Schema Panel ──────────────────────────────────────────────────────────
function SchemaPanel({ schema }) {
  const [open, setOpen] = useState(false);
  if (!schema || !schema.tables) return null;

  return (
    <div className="schema-panel-wrap">
      <button className="quick-tool-btn" onClick={() => setOpen(!open)}>
        <Layers size={10} style={{ marginRight: '6px' }} /> {open ? 'CLOSE SCHEMA' : 'VIEW SCHEMA'}
      </button>
      
      {open && (
        <div className="schema-v2-grid animate-slide-up" style={{ 
          position: 'fixed', bottom: '120px', left: '50%', transform: 'translateX(-50%)', 
          width: 'calc(100% - 40px)', maxWidth: '800px', zIndex: 5000,
          background: 'var(--bg-subway)', border: '1px solid var(--accent-primary)', padding: '20px'
        }}>
           <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '0.8rem', fontWeight: 800 }}>DATABASE ARCHITECTURE</h3>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><XCircle size={14} /></button>
           </div>
           <div style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', display: 'grid', gap: '12px' }}>
              {Object.entries(schema.tables).map(([tbl, info]) => (
                <div key={tbl} className="schema-v2-card">
                   <h4 style={{ color: 'var(--accent-primary)', marginBottom: '8px' }}>{tbl.toUpperCase()}</h4>
                   <div className="schema-v2-cols">
                      {info.columns.map((c, i) => <span key={i}>{c.name}</span>)}
                   </div>
                </div>
              ))}
           </div>
        </div>
      )}
    </div>
  );
}

// ─── User Profile & Settings ───────────────────────────────────────────────
function UserSettings({ user, onClose }) {
  return (
    <div className="schema-v2-grid animate-slide-up" style={{ 
      position: 'fixed', bottom: '80px', left: '260px', width: '300px', zIndex: 5000,
      background: 'var(--bg-subway)', border: '1px solid var(--border-surgical)', padding: '24px'
    }}>
       <h3 style={{ fontSize: '0.8rem', fontWeight: 800, marginBottom: '20px' }}>USER SETTINGS</h3>
       <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '0.6rem', color: 'var(--text-dim)' }}>DISPLAY NAME</label>
            <div style={{ color: 'white', fontWeight: 600 }}>{user.name}</div>
          </div>
          <div>
            <label style={{ fontSize: '0.6rem', color: 'var(--text-dim)' }}>INTELLIGENCE TIER</label>
            <div style={{ color: 'var(--accent-primary)', fontWeight: 800 }}>PRO ACCESS</div>
          </div>
          <button className="quick-tool-btn" onClick={onClose} style={{ width: '100%', justifyContent: 'center', marginTop: '10px' }}>CLOSE</button>
       </div>
    </div>
  );
}

// ─── Tool Center ───────────────────────────────────────────────────────────
function ToolCenter({ onAction, disabled }) {
  const [activeTab, setActiveTab] = React.useState(null);
  const [queryVal, setQueryVal] = React.useState('');

  const handleQuerySubmit = () => {
    if (!queryVal.trim()) return;
    onAction(queryVal);
    setQueryVal('');
    setActiveTab(null);
  };

  const tools = [
    { id: 'schema', label: 'SCHEMA', icon: Database, cmd: 'Analyze database schema' },
    { id: 'query', label: 'QUERY', icon: Terminal, special: true },
    { id: 'insights', label: 'INSIGHTS', icon: Sparkles, cmd: 'Generate deep data insights' },
  ];

  const viz = {
    charts: [
      { label: 'BAR CHART', icon: BarChart3, cmd: 'Generate a Bar Chart' },
      { label: 'LINE CHART', icon: LineChart, cmd: 'Generate a Line Chart' },
      { label: 'PIE CHART', icon: PieChart, cmd: 'Generate a Pie Chart' },
    ],
    diagrams: [
      { label: 'ER DIAGRAM', icon: Box, cmd: 'Generate a detailed Mermaid ER diagram' },
      { label: 'PROCESS FLOW', icon: Layers, cmd: 'Generate a standard Mermaid flowchart' },
    ]
  };

  return (
    <div className="tool-center-v2">
       {/* ─── Query Input Shelf ─── */}
       {activeTab === 'query' && !disabled && (
          <div className="tool-sub-shelf animate-slide-up" style={{ minWidth: '400px' }}>
             <div className="sub-shelf-section" style={{ width: '100%' }}>
                <span className="section-label">NATURAL LANGUAGE QUERY</span>
                <div className="input-group-v2" style={{ marginBottom: 0, marginTop: '8px' }}>
                   <Terminal size={14} />
                   <input 
                     autoFocus
                     placeholder="Describe the data you want to see..." 
                     value={queryVal}
                     onChange={e => setQueryVal(e.target.value)}
                     onKeyDown={e => e.key === 'Enter' && handleQuerySubmit()}
                     style={{ fontSize: '0.8rem', flex: 1 }}
                   />
                   <button onClick={handleQuerySubmit} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer' }}>
                      <Send size={14} />
                   </button>
                </div>
             </div>
          </div>
       )}

       {/* ─── Visualization Shelf ─── */}
       {activeTab === 'viz' && !disabled && (
          <div className="tool-sub-shelf animate-slide-up">
             <div className="sub-shelf-section">
                <span className="section-label">DATA CHARTS</span>
                <div className="sub-shelf-grid">
                   {viz.charts.map(c => <button key={c.label} className="sub-tool-btn" onClick={() => { onAction(c.cmd); setActiveTab(null); }}><c.icon size={12} /> {c.label}</button>)}
                </div>
             </div>
             <div className="sub-shelf-section">
                <span className="section-label">DIAGRAMS</span>
                <div className="sub-shelf-grid">
                   {viz.diagrams.map(d => <button key={d.label} className="sub-tool-btn" onClick={() => { onAction(d.cmd); setActiveTab(null); }}><d.icon size={12} /> {d.label}</button>)}
                </div>
             </div>
          </div>
       )}

       <div className="tool-main-row">
          {tools.map(t => (
            <button 
              key={t.id} 
              className={`quick-tool-btn ${activeTab === t.id ? 'active' : ''}`} 
              disabled={disabled} 
              onClick={() => {
                if (t.special) {
                  setActiveTab(activeTab === t.id ? null : t.id);
                } else {
                  onAction(t.cmd);
                  setActiveTab(null);
                }
              }}
            >
              <t.icon size={10} /> {t.label}
            </button>
          ))}
          <button className={`quick-tool-btn ${activeTab === 'viz' ? 'active' : ''}`} onClick={() => setActiveTab(activeTab === 'viz' ? null : 'viz')}>
             <LayoutDashboard size={10} /> VISUAL CENTER
          </button>
       </div>
    </div>
  );
}

// ─── Chat View ─────────────────────────────────────────────────────────────
function ChatScreen({ user, conn, onDisconnect, activeChatId, messages: initialMessages, token }) {
  const [messages, setMessages] = useState(initialMessages || []);
  const [status, setStatus] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [inputVal, setInputVal] = useState('');
  const [isSending, setIsSending] = useState(false);
  
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => { setMessages(initialMessages || []); }, [initialMessages]);

  useEffect(() => {
    const sr = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (sr) {
      const recog = new sr();
      recog.continuous = true;
      recog.interimResults = true;
      recog.lang = 'en-US';
      recog.onresult = (e) => {
        const results = e.results;
        const last = results[results.length - 1];
        if (last.isFinal) {
          setInputVal(prev => (prev.trim() + ' ' + last[0].transcript).trim());
        }
      };
      recog.onstart = () => setIsListening(true);
      recog.onend = () => setIsListening(false);
      recog.onerror = (e) => {
        console.error("Mic Error:", e.error);
        setIsListening(false);
      };
      recognitionRef.current = recog;
    }
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, status]);

  const sendMessage = async (val) => {
    if (!val || isSending) return;
    setIsSending(true);
    const userMsgId = generateId('msg');
    const aiMsgId = generateId('msg');
    
    // 1. Add User Message
    const userMsg = { id: userMsgId, role: 'human', parts: [{ type: 'text', content: val }] };
    setMessages(prev => [...prev, userMsg]);
    setStatus('analyzing...');
    setInputVal('');
    
    // 2. Add placeholder AI message
    let parts = [];
    const aiPlaceholder = { id: aiMsgId, role: 'ai', parts: [], streaming: true };
    setMessages(prev => [...prev, aiPlaceholder]);

    try {
      const res = await fetch(`${API}/api/chat/stream`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message: val, chat_id: activeChatId })
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value);
        let lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const evt = JSON.parse(line.slice(6));
              if (evt.type === 'status') {
                setStatus(evt.content);
              } else if (evt.type === 'token') {
                setStatus('');
                
                // CRITICAL FIX: Immutable state update to prevent doubling/stuttering
                if (parts.length > 0 && parts[parts.length - 1].type === 'text') {
                  const last = parts[parts.length - 1];
                  parts = [
                    ...parts.slice(0, -1),
                    { ...last, content: last.content + evt.content }
                  ];
                } else {
                  parts = [...parts, { type: 'text', content: evt.content }];
                }
                
                setMessages(prev => prev.map(msg => 
                  msg.id === aiMsgId ? { ...msg, parts: [...parts] } : msg
                ));
              } else if (evt.type === 'chart' || evt.type === 'mermaid' || evt.type === 'table') {
                parts = [...parts, { type: evt.type, content: evt.content }];
                setMessages(prev => prev.map(msg => 
                  msg.id === aiMsgId ? { ...msg, parts: [...parts] } : msg
                ));
              } else if (evt.type === 'done') {
                setMessages(prev => prev.map(msg => 
                  msg.id === aiMsgId ? { ...msg, streaming: false } : msg
                ));
                setStatus('');
              }
            } catch (e) { }
          }
        }
      }
    } catch (e) {
      console.error("Stream Error:", e);
      setStatus('Signal Lost');
    } finally {
      setIsSending(false);
    }
  };

  const exportPDF = async () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const items = document.querySelectorAll('.export-target');
    let y = 20;
    doc.setFontSize(16); doc.text(`Intelligence Report`, 15, y); y += 15;
    for (const el of items) {
      const canvas = await html2canvas(el, { scale: 1.5, backgroundColor: '#030303' });
      const img = canvas.toDataURL('image/png');
      const w = 180; const h = (canvas.height * w) / canvas.width;
      if (y + h > 280) { doc.addPage(); y = 20; }
      doc.addImage(img, 'PNG', 15, y, w, h); y += h + 10;
    }
    doc.save(`Intelligence_Report.pdf`);
  };

  return (
    <div className="bot-shell">
      <header className="bot-top-nav">
         <div className="brand-group">
            <div className="brand-logo"><Command size={14} /></div>
             <div className="brand-info">
                <h2>DB Analyser Bot</h2>
                <div className="dot-active">{user?.name?.toUpperCase()} / {conn?.label?.toUpperCase() || "INITIALIZING..."}</div>
             </div>
         </div>
         <div className="nav-actions">
            <button className="btn-action" onClick={exportPDF} title="Download Report"><FileDown size={14} /></button>
            <button className="btn-action" onClick={onDisconnect} title="Terminate Source"><LogOut size={14} /></button>
         </div>
      </header>
      <main className="chat-viewport-v2">
         <div className="chat-container-inner">
            {messages.length === 0 ? (
              <div className="empty-state-v2">
                <div className="sparkle-v2"><Sparkles size={32} /></div>
                <h1>Analysis Active.</h1>
                <p className="empty-subtitle">Ask anything about your connected data source.</p>
              </div>
            ) : (
              messages.map((m, idx) => (
                <div key={m.id || idx} className={`chat-line ${m.role}`}>
                   <div className="chat-bubble">
                      <div className="bubble-icon">{m.role === 'ai' ? <Activity size={14} /> : <Command size={14} />}</div>
                      <div className="bubble-content">
                        {m.parts.map((p, i) => <MessagePart key={i} part={p} token={token} />)}
                        {m.streaming && <StatusIndicator status={status} />}
                      </div>
                   </div>
                </div>
              ))
            )}
            <div ref={bottomRef} />
         </div>
      </main>
      <footer className="bot-input-dock">
         <div className="input-dock-inner" style={{ position: 'relative', zIndex: 100 }}>
             <div className="input-wrap-premium" style={{ marginBottom: '12px' }}>
                <button className={`btn-voice ${isListening ? 'active' : ''}`} onClick={() => {
                  if (!recognitionRef.current) return alert("Voice intelligence not supported in this browser.");
                  isListening ? recognitionRef.current.stop() : recognitionRef.current.start();
                }}>
                   {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                </button>
                <textarea ref={inputRef} placeholder="Enter command..." value={inputVal} onChange={e => setInputVal(e.target.value)} 
                          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage(inputVal))} />
                <button className="btn-send-main" disabled={!inputVal.trim() || isSending} onClick={() => sendMessage(inputVal)}><Send size={14} /></button>
             </div>
             <div className="dock-controls-row">
                <ToolCenter onAction={sendMessage} disabled={isSending} />
                <SchemaPanel schema={conn?.schema} />
             </div>
         </div>
      </footer>
    </div>
  );
}

// ─── Main Application ──────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
  const [sessionToken, setSessionToken] = useState(localStorage.getItem('db_analyser_token'));
  const [conn, setConn] = useState(null);
  const [history, setHistory] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  useEffect(() => {
    if (!sessionToken) return;
    fetch(`${API}/api/auth/me`, { headers: { 'Authorization': `Bearer ${sessionToken}` } })
    .then(res => {
      if (res.ok) return res.json();
      throw new Error();
    })
    .then(data => setUser(data.user))
    .catch(() => {
       localStorage.removeItem('db_analyser_token');
       setSessionToken(null);
    });
  }, []);

  const startNewChat = () => {
    const newId = generateId('chat');
    setActiveChatId(newId);
    setConn(null);
    setMessages([]);
    setHistory(prev => [{ id: newId, title: 'New Analysis' }, ...prev]);
  };

  const onAuth = (authData) => {
    setUser(authData.user);
    setSessionToken(authData.token);
    localStorage.setItem('db_analyser_token', authData.token);
  };

  const handleLogout = () => {
    setUser(null);
    setSessionToken(null);
    localStorage.removeItem('db_analyser_token');
  };

  useEffect(() => {
    if (!sessionToken) return;
    fetch(`${API}/api/history`, { headers: { 'Authorization': `Bearer ${sessionToken}` } })
    .then(r => r.json()).then(data => setHistory(data)).catch(() => null);
  }, [sessionToken]);

  // Handle Chat Switching (Revival)
  useEffect(() => {
    if (!activeChatId || !sessionToken) return;
    setIsLoadingMessages(true);
    fetch(`${API}/api/chat/${activeChatId}/messages`, { headers: { 'Authorization': `Bearer ${sessionToken}` } })
    .then(r => r.json())
    .then(data => {
      setMessages(data.messages || []);
      if (data.connection) setConn(data.connection);
      else setConn(null);
    })
    .catch(() => setConn(null))
    .finally(() => setIsLoadingMessages(false));
  }, [activeChatId, sessionToken]);

  const connectSource = async (type, payload) => {
    let body;
    let headers = { 'Authorization': `Bearer ${sessionToken}` };
    if (type === 'csv') {
      const form = new FormData();
      form.append('file', payload);
      form.append('chat_id', activeChatId);
      body = form;
    } else {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify({ ...(type === 'sqlite' ? { path: payload } : payload), chat_id: activeChatId });
    }
    try {
      const res = await fetch(`${API}/api/connect/${type}`, { method: 'POST', headers, body });
      const data = await res.json();
      if (data.ok) {
        setConn({ label: data.label, schema: data.schema });
        setHistory(prev => prev.map(h => h.id === activeChatId ? { ...h, title: data.label } : h));
      } else alert(data.error);
    } catch(e) { alert(e.message); }
  };

  const updateOpenAIKey = async (key) => {
    try {
       await fetch(`${API}/api/config/openai`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionToken}` }, body: JSON.stringify({ key }) });
       alert("OpenAI Key Updated ✓");
    } catch(e) { alert(e.message); }
  };

  if (!user) return <Auth onAuthSuccess={onAuth} />;

  return (
    <div className="main-layout">
       <Sidebar user={user} history={history} activeChatId={activeChatId} onNewChat={startNewChat} onSelectChat={setActiveChatId} onLogout={handleLogout} onOpenSettings={() => setShowSettings(!showSettings)} />
       <div style={{ flex: 1, position: 'relative' }}>
          {!activeChatId ? (
            <div className="empty-state-v2"><h1>Ready for Intelligence.</h1><button className="btn-send-main" style={{ width: '200px', height: '48px' }} onClick={startNewChat}>NEW SESSION</button></div>
          ) : isLoadingMessages ? (
            <div className="empty-state-v2"><Loader2 className="spin" size={32} /><p>Retrieving Context...</p></div>
          ) : !conn ? (
            <SourceHub onConnect={connectSource} onUpdateKey={updateOpenAIKey} />
          ) : (
            <ChatScreen user={user} conn={conn} onDisconnect={() => setConn(null)} activeChatId={activeChatId} messages={messages} token={sessionToken} />
          )}
          {showSettings && <UserSettings user={user} onClose={() => setShowSettings(false)} />}
       </div>
    </div>
  );
}
