import React, { useState, useEffect } from 'react';
import './LoginGate.css';

const STORAGE_KEY = 'sp_auth_token';
const TOKEN_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days

const LoginGate = ({ children }) => {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  // Check for existing session
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const { expiry } = JSON.parse(stored);
        if (expiry && Date.now() < expiry) {
          setAuthenticated(true);
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch {}
    setLoading(false);
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    const correctPassword = import.meta.env.VITE_APP_PASSWORD || 'schools2026';

    if (password === correctPassword) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ expiry: Date.now() + TOKEN_EXPIRY }));
      setAuthenticated(true);
      setError('');
    } else {
      setError('Incorrect password');
      setPassword('');
    }
  };

  if (loading) return null;
  if (authenticated) return children;

  return (
    <div className="login-overlay">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">SP</div>
          <h1 className="login-title">School Profiles</h1>
          <p className="login-subtitle">Department for Education · Schools Policy & Delivery</p>
        </div>
        <form onSubmit={handleSubmit} className="login-form">
          <input
            type="password"
            className="login-input"
            value={password}
            onChange={e => { setPassword(e.target.value); setError(''); }}
            placeholder="Enter password"
            autoFocus
          />
          <button type="submit" className="login-btn">Sign in</button>
          {error && <div className="login-error">{error}</div>}
        </form>
        <p className="login-footer">Contact the Schools Policy team for access</p>
      </div>
    </div>
  );
};

export const useLogout = () => {
  return () => {
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  };
};

export default LoginGate;
