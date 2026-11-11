import React, { useState, useEffect, useRef } from 'react';
import { 
  Folder,
  FolderPlus, 
  Key, 
  Users, 
  ShieldCheck, 
  LogOut, 
  User as UserIcon, 
  Sun, 
  Moon, 
  Server,
  Globe,
  ChevronDown,
  Check,
  Plus,
  Cloud
} from 'lucide-react';
import { ToastProvider, useToast } from './components/ToastContext';
import { AuthProvider, useAuth } from './components/AuthContext';
import LoginPage from './components/LoginPage';
import AdminPortal from './components/AdminPortal';
import UserPortal from './components/UserPortal';
import CountryFlag from './components/CountryFlag';

function MainApp({ theme, toggleTheme }) {
  const { currentUser, logout, loading: authLoading, authFetch } = useAuth();
  const { addToast } = useToast();

  // Navigation tab: 'files' | 'keys' | 'users' | 'admin'
  const [activeTab, setActiveTab] = useState('files');
  const [endpoints, setEndpoints] = useState([]);
  const [activeEndpointId, setActiveEndpointId] = useState('');
  const [loading, setLoading] = useState(true);
  const [openCreateBucketTrigger, setOpenCreateBucketTrigger] = useState(false);

  // Location dropdown open state
  const [isLocationDropdownOpen, setIsLocationDropdownOpen] = useState(false);
  const locationDropdownRef = useRef(null);

  // Close location dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (locationDropdownRef.current && !locationDropdownRef.current.contains(e.target)) {
        setIsLocationDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch Endpoints on load only if authenticated
  useEffect(() => {
    if (currentUser) {
      fetchEndpoints();
    }
  }, [currentUser?.id]);

  const fetchEndpoints = async () => {
    try {
      const res = await authFetch('/api/endpoints');
      const data = await res.json();
      if (data.success && data.endpoints) {
        setEndpoints(data.endpoints);
        if (data.endpoints.length > 0 && !activeEndpointId) {
          setActiveEndpointId(data.endpoints[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load endpoints:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectEndpoint = (id) => {
    setActiveEndpointId(id);
    setIsLocationDropdownOpen(false);
  };

  const handleLogout = () => {
    logout();
    addToast('You have been logged out.', 'info');
  };

  // If restoring auth state
  if (authLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-muted)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <img 
            src="/wallpine-logo.png" 
            alt="Wallpine" 
            style={{ height: 60, width: 'auto', objectFit: 'contain', marginBottom: '1rem', filter: 'drop-shadow(0 0 16px rgba(16, 185, 129, 0.4))' }} 
          />
          <div>Loading Wallpine Storage...</div>
        </div>
      </div>
    );
  }

  // If not authenticated, render LoginPage
  if (!currentUser) {
    return <LoginPage theme={theme} toggleTheme={toggleTheme} />;
  }

  const activeBox = endpoints.find(e => e.id === activeEndpointId) || endpoints[0];
  const isAdmin = currentUser.role === 'admin';

  return (
    <div className="cloud-drive-layout">
      {/* ========================================================= */}
      {/* 1. LEFT SIDEBAR NAVIGATION (Modern Cloud Drive) */}
      {/* ========================================================= */}
      <aside className="cloud-sidebar">
        <div>
          {/* Brand Logo & Title */}
          <div className="cloud-sidebar-brand">
            <img 
              src="/wallpine-logo.png" 
              alt="Wallpine Logo" 
            />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontSize: '1.15rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
                  Wallpine
                </span>
                <span className="brand-badge" style={{ fontSize: '0.625rem', padding: '0.1rem 0.4rem' }}>
                  Drive
                </span>
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                Object Storage
              </div>
            </div>
          </div>

          {/* Quick Action: "+ New" Button */}
          <div className="cloud-new-btn-wrapper">
            <button
              onClick={() => {
                setActiveTab('files');
                setOpenCreateBucketTrigger(true);
              }}
              className="cloud-new-btn"
            >
              <Plus size={18} />
              <span>New Bucket</span>
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="cloud-nav-group">
            <div className="cloud-nav-label">Storage</div>

            <div
              onClick={() => setActiveTab('files')}
              className={`cloud-nav-item ${activeTab === 'files' ? 'active' : ''}`}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <Folder size={17} />
                <span>My Files & Buckets</span>
              </div>
            </div>

            <div
              onClick={() => setActiveTab('keys')}
              className={`cloud-nav-item ${activeTab === 'keys' ? 'active' : ''}`}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <Key size={17} />
                <span>API Keys & SDK</span>
              </div>
            </div>

            <div
              onClick={() => setActiveTab('users')}
              className={`cloud-nav-item ${activeTab === 'users' ? 'active' : ''}`}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <Users size={17} />
                <span>Storage Identities</span>
              </div>
            </div>

            {isAdmin && (
              <>
                <div className="cloud-nav-label" style={{ marginTop: '0.75rem' }}>Management</div>
                <div
                  id="tab-admin-portal"
                  onClick={() => setActiveTab('admin')}
                  className={`cloud-nav-item ${activeTab === 'admin' ? 'active' : ''}`}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <ShieldCheck size={17} />
                    <span>Admin Console</span>
                  </div>
                </div>
              </>
            )}
          </nav>
        </div>

        {/* Sidebar Footer: Location Switcher & User Profile */}
        <div className="cloud-sidebar-footer">
          {/* Storage Cluster Switcher (Single clean unified location picker) */}
          <div ref={locationDropdownRef} style={{ position: 'relative' }}>
            <div 
              className="cloud-location-picker"
              onClick={() => setIsLocationDropdownOpen(!isLocationDropdownOpen)}
              title="Click to switch storage cluster location"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', overflow: 'hidden' }}>
                <CountryFlag code={activeBox?.countryCode} country={activeBox?.country} flag={activeBox?.countryFlag} size="xs" />
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                    Location
                  </div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {activeBox?.clientName || activeBox?.name || 'Select Location'}
                  </div>
                </div>
              </div>
              <ChevronDown size={14} color="var(--text-muted)" style={{ transform: isLocationDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </div>

            {/* Location Switcher Popup */}
            {isLocationDropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 'calc(100% + 8px)',
                  left: 0,
                  right: 0,
                  background: 'var(--bg-card-solid)',
                  border: '1px solid var(--border-card)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: 'var(--shadow-lg)',
                  padding: '0.4rem 0',
                  zIndex: 200,
                  maxHeight: '260px',
                  overflowY: 'auto'
                }}
              >
                <div style={{ padding: '0.35rem 0.75rem', fontSize: '0.675rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                  Available Locations ({endpoints.length})
                </div>
                {endpoints.map((ep) => {
                  const isSelected = ep.id === activeBox?.id;
                  return (
                    <div
                      key={ep.id}
                      onClick={() => handleSelectEndpoint(ep.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.55rem 0.75rem',
                        cursor: 'pointer',
                        background: isSelected ? 'var(--brand-primary-subtle)' : 'transparent',
                        color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                        fontSize: '0.825rem',
                        fontWeight: isSelected ? 700 : 500
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <CountryFlag code={ep.countryCode} country={ep.country} flag={ep.countryFlag} size="xs" />
                        <span>{ep.clientName || ep.name}</span>
                      </div>
                      {isSelected && <Check size={14} color="var(--brand-primary)" />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* User Profile Pill */}
          <div className="cloud-user-pill">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', overflow: 'hidden' }}>
              <div style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--bg-primary)',
                flexShrink: 0
              }}>
                {isAdmin ? <ShieldCheck size={14} /> : <UserIcon size={14} />}
              </div>
              <div style={{ overflow: 'hidden', lineHeight: 1.2 }}>
                <div style={{ fontSize: '0.775rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {currentUser.name || currentUser.email}
                </div>
                <div style={{ fontSize: '0.65rem', color: isAdmin ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: 600 }}>
                  {isAdmin ? 'ADMIN' : 'CLIENT'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <button
                onClick={toggleTheme}
                className="theme-toggle-btn"
                style={{ width: 28, height: 28 }}
                title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
              >
                {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
              </button>

              <button
                onClick={handleLogout}
                className="btn btn-secondary btn-icon btn-sm"
                style={{ width: 28, height: 28, color: 'var(--status-rose)', padding: 0 }}
                title="Sign Out"
              >
                <LogOut size={13} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* ========================================================= */}
      {/* 2. MAIN CONTENT AREA */}
      {/* ========================================================= */}
      <main className="cloud-main">
        {/* Topbar */}
        <header className="cloud-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {activeTab === 'admin' ? 'Admin Console' : activeTab === 'keys' ? 'API Keys & Developer Access' : activeTab === 'users' ? 'Storage Identities' : 'My Storage'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            {/* Cluster Status Badge */}
            <div className="header-status-pill" style={{ padding: '0.35rem 0.75rem' }}>
              <span className="pulse-dot"></span>
              <CountryFlag code={activeBox?.countryCode} country={activeBox?.country} flag={activeBox?.countryFlag} size="xs" />
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {activeBox?.clientName || activeBox?.name}
              </span>
            </div>
          </div>
        </header>

        {/* Dynamic View Content */}
        <div className="cloud-content">
          {activeTab === 'admin' && isAdmin ? (
            <AdminPortal
              endpoints={endpoints}
              onEndpointsChange={setEndpoints}
              onSelectEndpoint={handleSelectEndpoint}
              activeEndpointId={activeEndpointId}
            />
          ) : (
            <UserPortal
              endpoints={endpoints}
              activeEndpointId={activeEndpointId}
              onSelectEndpoint={setActiveEndpointId}
              activeSubTab={activeTab}
              onSubTabChange={setActiveTab}
              openCreateBucketTrigger={openCreateBucketTrigger}
              onResetCreateBucketTrigger={() => setOpenCreateBucketTrigger(false)}
            />
          )}
        </div>
      </main>
    </div>
  );
}

export default function App() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('wallpine_theme') || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('wallpine_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  return (
    <ToastProvider>
      <AuthProvider>
        <MainApp theme={theme} toggleTheme={toggleTheme} />
      </AuthProvider>
    </ToastProvider>
  );
}
