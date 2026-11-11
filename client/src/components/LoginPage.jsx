import React, { useState } from 'react';
import { 
  Cloud, 
  Lock, 
  Mail, 
  ArrowRight, 
  Eye, 
  EyeOff, 
  ShieldCheck,
  AlertCircle,
  Sun,
  Moon
} from 'lucide-react';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

export default function LoginPage({ theme, toggleTheme }) {
  const { login, register } = useAuth();
  const { addToast } = useToast();

  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const isValidEmail = (val) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Please enter both email address and password.');
      return;
    }

    if (!isValidEmail(email)) {
      setErrorMsg('Please enter a valid email address (e.g. name@company.com).');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    try {
      if (isRegisterMode) {
        const result = await register({ email, password, name });
        if (result.success) {
          addToast(result.message || 'Account created successfully!', 'success');
        } else {
          setErrorMsg(result.error);
          addToast(result.error, 'error');
        }
      } else {
        const result = await login(email, password);
        if (result.success) {
          addToast(result.message || 'Logged in successfully!', 'success');
        } else {
          setErrorMsg(result.error);
          addToast(result.error, 'error');
        }
      }
    } catch (err) {
      setErrorMsg(err.message);
      addToast(err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '85vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem',
    }}>
      <div style={{
        maxWidth: '460px',
        width: '100%',
        background: 'var(--bg-card-solid)',
        backdropFilter: 'blur(20px)',
        border: '1px solid var(--border-card)',
        borderRadius: 'var(--radius-xl)',
        padding: '2.5rem',
        boxShadow: 'var(--shadow-lg), var(--shadow-brand)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Glow Accent Top Bar */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '3px',
          background: 'var(--text-primary)'
        }}></div>

        {/* Theme Toggle Button in Corner */}
        {toggleTheme && (
          <div style={{ position: 'absolute', top: '1.25rem', right: '1.25rem' }}>
            <button
              onClick={toggleTheme}
              className="theme-toggle-btn"
              title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
              aria-label="Toggle Theme"
            >
              {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            </button>
          </div>
        )}

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <img 
            src="/wallpine-logo.png" 
            alt="Wallpine Logo" 
            style={{ 
              height: 72, 
              width: 'auto',
              objectFit: 'contain', 
              marginBottom: '0.75rem',
              filter: 'drop-shadow(0 2px 8px rgba(0, 0, 0, 0.2))'
            }} 
          />

          <h2 style={{ fontSize: '1.85rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
            Wallpine
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            {isRegisterMode 
              ? 'Create a new client account. First user receives Administrator privileges.' 
              : 'Sign in to access your S3 storage buckets, files, and API credentials'}
          </p>
        </div>

        {/* First User Notice in Register Mode */}
        {isRegisterMode && (
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '0.75rem 1rem',
            marginBottom: '1.25rem',
            color: 'var(--text-primary)',
            fontSize: '0.8rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem'
          }}>
            <ShieldCheck size={18} style={{ flexShrink: 0 }} />
            <span>
              <strong>First-User Rule:</strong> The first user to register automatically receives <strong>System Administrator</strong> privileges.
            </span>
          </div>
        )}

        {/* Error Alert */}
        {errorMsg && (
          <div style={{
            background: 'rgba(244, 63, 94, 0.12)',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            borderRadius: 'var(--radius-md)',
            padding: '0.75rem 1rem',
            marginBottom: '1.25rem',
            color: '#f43f5e',
            fontSize: '0.825rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {isRegisterMode && (
            <div className="form-group">
              <label className="form-label">Full Name / Display Name</label>
              <input
                id="input-register-name"
                type="text"
                placeholder="e.g. Adarsh Sharma"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="form-input"
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }} />
              <input
                id="input-login-email"
                type="email"
                required
                placeholder={isRegisterMode ? "name@company.com" : "Enter your email"}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input"
                style={{ paddingLeft: '2.4rem' }}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }} />
              <input
                id="input-login-password"
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input"
                style={{ paddingLeft: '2.4rem', paddingRight: '2.5rem' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: 12,
                  top: 10,
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  cursor: 'pointer'
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            id="btn-login-submit"
            type="submit"
            disabled={isLoading}
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '0.75rem', padding: '0.75rem', fontSize: '0.925rem' }}
          >
            {isLoading ? (
              <span>Authenticating...</span>
            ) : (
              <>
                <span>{isRegisterMode ? 'Create Account' : 'Sign In to Portal'}</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {/* Toggle Mode */}
        <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          {isRegisterMode ? (
            <span>
              Already have an account?{' '}
              <button
                id="btn-toggle-signin"
                type="button"
                onClick={() => { setIsRegisterMode(false); setErrorMsg(''); }}
                style={{ background: 'transparent', color: 'var(--brand-primary)', fontWeight: 600, cursor: 'pointer' }}
              >
                Sign In
              </button>
            </span>
          ) : (
            <span>
              Don't have an account?{' '}
              <button
                id="btn-toggle-register"
                type="button"
                onClick={() => { setIsRegisterMode(true); setErrorMsg(''); }}
                style={{ background: 'transparent', color: 'var(--brand-primary)', fontWeight: 600, cursor: 'pointer' }}
              >
                Register Here
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
