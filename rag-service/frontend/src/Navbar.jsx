import React, { useState } from 'react';

export default function Navbar({ theme, toggleTheme }) {
  return (
    <nav className="gemini-header" style={{
      background: theme === 'dark' ? 'rgba(30, 41, 59, 0.9)' : 'rgba(255, 255, 255, 0.9)',
      backdropFilter: 'blur(16px)',
      borderBottom: '1px solid var(--card-border)',
      padding: '12px 24px',
      borderRadius: '16px',
      marginBottom: '24px'
    }}>
      {/* CloudVault Brand / Logo */}
      <div className="brand-badge" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '36px',
          height: '36px',
          background: 'linear-gradient(135deg, #4285f4, #9b51e0)',
          borderRadius: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontWeight: '700',
          fontSize: '1.2rem',
          boxShadow: '0 4px 12px rgba(155, 81, 224, 0.3)'
        }}>
          ☁️
        </div>
        <div>
          <span className="brand-text" style={{ fontSize: '1.15rem', display: 'block', fontWeight: '700' }}>CloudVault AI</span>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Multi-Modal Hybrid RAG</span>
        </div>
      </div>

      {/* Right Actions: Theme Toggle & Auth Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Light / Dark Mode Toggle Button */}
        <button 
          onClick={toggleTheme}
          style={{
            background: 'transparent',
            border: '1px solid var(--card-border)',
            borderRadius: '50%',
            width: '38px',
            height: '38px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: '1rem',
            transition: 'transform 0.2s'
          }}
          title="Toggle Theme"
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>

        <button className="gemini-logout-btn" style={{ padding: '8px 16px', borderRadius: '999px' }}>
          Login
        </button>
        
        <button className="purple-accent" style={{
          backgroundColor: '#9b51e0',
          color: '#fff',
          border: 'none',
          padding: '8px 18px',
          borderRadius: '999px',
          fontWeight: '600',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(155, 81, 224, 0.25)'
        }}>
          Sign Up
        </button>
      </div>
    </nav>
  );
}