import React, { useState } from 'react';
import { Mail, Lock, User, AtSign, ArrowRight, Github, Chrome, Cpu, Sparkles } from 'lucide-react';

export default function Auth({ onAuthSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const res = await fetch(`${API}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name })
      });
      
      const data = await res.json();
      if (res.ok) {
        onAuthSuccess(data);
      } else {
        setError(data.detail || 'Authentication failed');
      }
    } catch (err) {
      setError('Connection refused by Intelligence Server');
    } finally {
      setLoading(false);
    }
  };

  const handleGuest = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/auth/guest`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) onAuthSuccess(data);
      else setError('Guest access unavailable');
    } catch (err) {
      setError('Connection refused');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper animate-fade-in">
      <div className="auth-glass-card">
        <div className="auth-header">
           <div className="auth-logo-p">
              <Cpu size={32} className="pulse-slow" />
           </div>
           <h1>{isLogin ? 'Welcome Back' : 'Create Account'}</h1>
           <p className="auth-subtitle">Enterprise Data Intelligence Platform</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {!isLogin && (
            <div className="auth-input-group">
              <User size={18} />
              <input 
                type="text" 
                placeholder="Full Name" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                required 
              />
            </div>
          )}
          <div className="auth-input-group">
            <AtSign size={18} />
            <input 
              type="email" 
              placeholder="Email Address" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
            />
          </div>
          <div className="auth-input-group">
            <Lock size={18} />
            <input 
              type="password" 
              placeholder="Password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
            />
          </div>

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" className="auth-submit-btn" disabled={loading}>
            {loading ? 'Processing...' : (isLogin ? 'Initialize Session' : 'Create Intelligence Profile')}
            <ArrowRight size={18} />
          </button>
        </form>

        <div className="auth-divider">
          <span>OR CONTINUE WITH</span>
        </div>

        <div className="auth-social-grid">
          <button className="social-btn" onClick={handleGuest} title="Continue as Guest">
            <User size={20} />
            <span>Guest</span>
          </button>
        </div>

        <div className="auth-footer">
          <button onClick={() => setIsLogin(!isLogin)}>
            {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Login"}
          </button>
        </div>
      </div>

      <div className="auth-bg-ornaments">
        <div className="orb-1"></div>
        <div className="orb-2"></div>
      </div>
    </div>
  );
}
