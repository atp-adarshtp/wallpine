import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Server, 
  Plus, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  AlertCircle, 
  Activity, 
  RefreshCw, 
  Layers, 
  HardDrive, 
  Check, 
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  Users,
  UserCheck,
  UserX,
  Mail,
  User,
  Crown,
  Globe,
  ChevronDown
} from 'lucide-react';
import { useToast } from './ToastContext';
import { useAuth } from './AuthContext';
import CountrySelect from './CountrySelect';
import CountryFlag from './CountryFlag';

export default function AdminPortal({ endpoints, onEndpointsChange, onSelectEndpoint, activeEndpointId }) {
  const { addToast } = useToast();
  const { authFetch, currentUser } = useAuth();

  // Active Admin Sub-Tab: 'boxes' | 'users'
  const [activeAdminSubTab, setActiveAdminSubTab] = useState('boxes');

  // Country filter for Admin view (only countries with existing storage clusters)
  const [selectedAdminCountry, setSelectedAdminCountry] = useState('ALL');
  const [isAdminCountryDropdownOpen, setIsAdminCountryDropdownOpen] = useState(false);
  const adminCountryDropdownRef = useRef(null);

  // Close Admin country dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (adminCountryDropdownRef.current && !adminCountryDropdownRef.current.contains(event.target)) {
        setIsAdminCountryDropdownOpen(false);
      }
    };
    if (isAdminCountryDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isAdminCountryDropdownOpen]);

  // Countries that already have existing storage clusters created under them
  const existingCountries = useMemo(() => {
    const map = new Map();
    endpoints.forEach(ep => {
      const c = ep.country?.trim() || 'Global';
      if (!map.has(c)) {
        map.set(c, {
          name: c,
          flag: ep.countryFlag || '🌐',
          code: ep.countryCode || '',
          count: 0
        });
      }
      map.get(c).count += 1;
    });
    return Array.from(map.values());
  }, [endpoints]);

  // Storage clusters and nodes filtered by selected country
  const filteredEndpoints = useMemo(() => {
    if (selectedAdminCountry === 'ALL') return endpoints;
    return endpoints.filter(ep => (ep.country?.trim() || 'Global') === selectedAdminCountry);
  }, [endpoints, selectedAdminCountry]);

  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingBox, setEditingBox] = useState(null);

  // Connectivity Test State
  const [testResults, setTestResults] = useState({});
  const [testingId, setTestingId] = useState(null);
  const [isFormTesting, setIsFormTesting] = useState(false);
  const [formTestResult, setFormTestResult] = useState(null);

  // Registered Users Management State
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Form State
  const initialFormState = {
    name: '',
    adminName: '',
    clientName: '',
    country: 'United States',
    countryCode: 'US',
    countryFlag: '🇺🇸',
    endpointUrl: '',
    region: 'us-east-1',
    accessKey: '',
    secretKey: '',
    type: 'ceph',
    pathStyle: true,
    placementId: '',
    description: '',
  };

  const [formData, setFormData] = useState(initialFormState);

  // Presets
  const applyPreset = (presetType) => {
    if (presetType === 'ceph-node155') {
      setFormData({
        name: 'Storage Cluster (Node 155)',
        adminName: 'Storage Cluster (Node 155)',
        clientName: 'US East Production Storage',
        country: 'United States',
        countryCode: 'US',
        countryFlag: '🇺🇸',
        endpointUrl: 'http://10.40.11.155:8000',
        region: 'us-east-1',
        accessKey: 'QN2BSI9IFCTFYE61DGNV',
        secretKey: 'KC427Xv1RvCXnBOoAMaAQJe7fqQrG29pAwDatbB9',
        type: 'ceph',
        pathStyle: true,
        placementId: 'wallpineresellerrealmplace',
        description: 'S3 Gateway with Admin Ops enabled (10.40.11.155:8000)',
      });
    } else if (presetType === 'minio-local') {
      setFormData({
        name: 'MinIO Local Storage',
        adminName: 'MinIO Local Development',
        clientName: 'Local Development Box',
        country: 'United States',
        countryCode: 'US',
        countryFlag: '🇺🇸',
        endpointUrl: 'http://localhost:9000',
        region: 'us-east-1',
        accessKey: 'minioadmin',
        secretKey: 'minioadmin',
        type: 'minio',
        pathStyle: true,
        placementId: '',
        description: 'Local development MinIO S3 cluster',
      });
    } else if (presetType === 'aws-s3') {
      setFormData({
        name: 'AWS S3 Standard',
        adminName: 'AWS S3 Global Production',
        clientName: 'AWS High-Availability Storage',
        country: 'United States',
        countryCode: 'US',
        countryFlag: '🇺🇸',
        endpointUrl: 'https://s3.amazonaws.com',
        region: 'us-east-1',
        accessKey: '',
        secretKey: '',
        type: 'aws',
        pathStyle: false,
        placementId: '',
        description: 'Amazon Web Services S3 Global Endpoint',
      });
    }
    setFormTestResult(null);
  };

  const openAddModal = () => {
    setEditingBox(null);
    setFormData(initialFormState);
    setFormTestResult(null);
    setIsAddModalOpen(true);
  };

  const openEditModal = (box) => {
    setEditingBox(box);
    setFormData({
      name: box.name || box.adminName || '',
      adminName: box.adminName || box.name || '',
      clientName: box.clientName || box.name || '',
      country: box.country || 'United States',
      countryCode: box.countryCode || 'US',
      countryFlag: box.countryFlag || '🇺🇸',
      endpointUrl: box.endpointUrl || '',
      region: box.region || 'us-east-1',
      accessKey: box.accessKey || '',
      secretKey: box.secretKey || '',
      type: box.type || 'ceph',
      pathStyle: box.pathStyle !== false,
      placementId: box.placementId || '',
      description: box.description || '',
    });
    setFormTestResult(null);
    setIsAddModalOpen(true);
  };

  // Ping All Configured Endpoints on Mount
  useEffect(() => {
    if (endpoints && endpoints.length > 0) {
      endpoints.forEach(box => {
        handleTestConnection(box.id, true);
      });
    }
  }, [endpoints.length]);

  // Load Registered Users on Mount
  useEffect(() => {
    loadAdminUsers();
  }, []);

  const handleTestConnection = async (id, isSilent = false) => {
    setTestingId(id);
    try {
      const res = await authFetch(`/api/endpoints/${id}/test`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setTestResults(prev => ({ ...prev, [id]: data.result }));
        if (!isSilent) {
          if (data.result.reachable) {
            addToast(`Online! Latency: ${data.result.latencyMs}ms`, 'success');
          } else {
            addToast(`Offline: ${data.result.error || 'Connection failed'}`, 'error');
          }
        }
      }
    } catch (err) {
      setTestResults(prev => ({ ...prev, [id]: { reachable: false, error: err.message } }));
      if (!isSilent) addToast(`Test failed: ${err.message}`, 'error');
    } finally {
      setTestingId(null);
    }
  };

  const handleTestFormData = async () => {
    if (!formData.endpointUrl) {
      addToast('Please enter an endpoint URL first', 'error');
      return;
    }
    setIsFormTesting(true);
    setFormTestResult(null);

    const testAdminName = (formData.adminName || formData.name || `temp-test-${Date.now()}`).trim();
    const testClientName = (formData.clientName || formData.name || testAdminName).trim();

    try {
      const tempRes = await authFetch('/api/endpoints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ...formData, 
          name: testAdminName,
          adminName: testAdminName,
          clientName: testClientName
        })
      });
      const tempData = await tempRes.json();
      if (tempData.success && tempData.endpoint) {
        const testRes = await authFetch(`/api/endpoints/${tempData.endpoint.id}/test`, { method: 'POST' });
        const testData = await testRes.json();
        setFormTestResult(testData.result);
        await authFetch(`/api/endpoints/${tempData.endpoint.id}`, { method: 'DELETE' });
      }
    } catch (err) {
      setFormTestResult({ reachable: false, error: err.message });
    } finally {
      setIsFormTesting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const adminName = (formData.adminName || formData.name || '').trim();
    const clientName = (formData.clientName || formData.name || adminName).trim();

    if (!adminName || !formData.endpointUrl) {
      addToast('Admin side name and Endpoint URL are required', 'error');
      return;
    }

    const payload = {
      ...formData,
      name: adminName,
      adminName,
      clientName,
      country: formData.country || '',
      countryCode: formData.countryCode || '',
      countryFlag: formData.countryFlag || '',
    };

    try {
      const url = editingBox ? `/api/endpoints/${editingBox.id}` : '/api/endpoints';
      const method = editingBox ? 'PUT' : 'POST';

      const res = await authFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        addToast(editingBox ? 'Box endpoint updated successfully' : 'New Box added successfully!', 'success');
        setIsAddModalOpen(false);
        onEndpointsChange(data.endpoints);
        if (!editingBox && data.endpoint) {
          handleTestConnection(data.endpoint.id);
        }
      } else {
        addToast(data.error || 'Failed to save endpoint', 'error');
      }
    } catch (err) {
      addToast(`Error: ${err.message}`, 'error');
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to remove storage box "${name}"?`)) return;

    try {
      const res = await authFetch(`/api/endpoints/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        addToast('Box removed successfully', 'info');
        onEndpointsChange(data.endpoints);
      }
    } catch (err) {
      addToast(`Error removing box: ${err.message}`, 'error');
    }
  };

  // ==========================================
  // USER PRIVILEGE MANAGEMENT
  // ==========================================
  const loadAdminUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await authFetch('/api/admin/users');
      const data = await res.json();
      if (data.success) {
        setUsers(data.users || []);
      }
    } catch (err) {
      console.error('Failed to load registered users:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleToggleAdminRole = async (targetUser) => {
    const isCurrentlyAdmin = targetUser.role === 'admin';
    const newRole = isCurrentlyAdmin ? 'user' : 'admin';

    try {
      const res = await authFetch(`/api/admin/users/${targetUser.id}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole })
      });
      const data = await res.json();
      if (data.success) {
        addToast(data.message, 'success');
        loadAdminUsers();
      } else {
        addToast(data.error || 'Failed to update user role', 'error');
      }
    } catch (err) {
      addToast(`Error: ${err.message}`, 'error');
    }
  };

  const handleDeleteUserAccount = async (targetUser) => {
    if (!window.confirm(`Are you sure you want to permanently delete user account "${targetUser.email}"?`)) {
      return;
    }

    try {
      const res = await authFetch(`/api/admin/users/${targetUser.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        addToast(`User ${targetUser.email} has been deleted.`, 'info');
        loadAdminUsers();
      } else {
        addToast(data.error || 'Failed to delete user', 'error');
      }
    } catch (err) {
      addToast(`Error: ${err.message}`, 'error');
    }
  };

  return (
    <div>
      {/* Top Header & Add Box CTA */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            Admin Console
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Configure S3 storage boxes, verify cluster reachability, and manage client user privileges
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            id="btn-add-box"
            onClick={openAddModal}
            className="btn btn-primary"
          >
            <Plus size={16} />
            <span>Add Storage Box</span>
          </button>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="sub-tabs">
        <button
          id="btn-subtab-boxes"
          onClick={() => setActiveAdminSubTab('boxes')}
          className={`sub-tab-btn ${activeAdminSubTab === 'boxes' ? 'active' : ''}`}
        >
          <Server size={15} />
          <span>Storage Endpoints ({endpoints.length})</span>
        </button>

        <button
          id="btn-subtab-users"
          onClick={() => {
            setActiveAdminSubTab('users');
            loadAdminUsers();
          }}
          className={`sub-tab-btn ${activeAdminSubTab === 'users' ? 'active' : ''}`}
        >
          <Users size={15} />
          <span>User Accounts & Roles ({users.length})</span>
        </button>
      </div>

      {/* Quick Metrics Bar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '1rem',
        marginBottom: '1.75rem'
      }}>
        <div 
          className="glass-card" 
          onClick={() => setActiveAdminSubTab('boxes')}
          style={{ padding: '1.25rem', cursor: 'pointer', borderColor: activeAdminSubTab === 'boxes' ? 'var(--brand-primary)' : undefined }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Configured Boxes
            </span>
            <Server size={18} color="var(--brand-primary)" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.4rem', color: 'var(--text-primary)' }}>
            {endpoints.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
            Active S3 Endpoints
          </div>
        </div>

        <div 
          className="glass-card" 
          onClick={() => { setActiveAdminSubTab('users'); loadAdminUsers(); }}
          style={{ padding: '1.25rem', cursor: 'pointer', borderColor: activeAdminSubTab === 'users' ? 'var(--brand-primary)' : undefined }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Registered Users
            </span>
            <Users size={18} color="var(--brand-primary)" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.4rem', color: 'var(--text-primary)' }}>
            {users.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
            {users.filter(u => u.role === 'admin').length} Admins • {users.filter(u => u.role === 'user').length} Standard
          </div>
        </div>

        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Active Client Target
            </span>
            <Activity size={18} color="var(--brand-primary)" />
          </div>
          <div style={{ fontSize: '1.05rem', fontWeight: 700, marginTop: '0.5rem', color: 'var(--brand-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            {(() => {
              const b = endpoints.find(e => e.id === activeEndpointId);
              if (!b) return 'None Selected';
              return (
                <>
                  <CountryFlag code={b.countryCode} country={b.country} flag={b.countryFlag} size="xs" />
                  <span>{b.adminName || b.name}</span>
                </>
              );
            })()}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
            Bound Target for User Portal
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* VIEW A: STORAGE BOXES GRID */}
      {/* ========================================================= */}
      {activeAdminSubTab === 'boxes' && (
        <>
          {/* Country Filter Dropdown (Only displays countries that already have storage clusters) */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
            marginBottom: '1.25rem',
            padding: '0.65rem 1rem',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            position: 'relative',
            zIndex: 100
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Globe size={18} color="var(--brand-primary)" />
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Filter Clusters by Country
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Showing storage clusters associated with selected location
                </div>
              </div>
            </div>

            {/* Custom Interactive Country Dropdown */}
            <div ref={adminCountryDropdownRef} style={{ position: 'relative' }}>
              <div
                onClick={() => setIsAdminCountryDropdownOpen(!isAdminCountryDropdownOpen)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  padding: '0.45rem 0.85rem',
                  background: 'var(--bg-input)',
                  border: isAdminCountryDropdownOpen ? '1px solid var(--brand-primary)' : '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  userSelect: 'none',
                  transition: 'all 0.15s ease',
                  minWidth: '220px',
                  justifyContent: 'space-between'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {selectedAdminCountry === 'ALL' ? (
                    <>
                      <span style={{ fontSize: '1rem' }}>🌐</span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        All Countries
                      </span>
                      <span className="badge" style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem' }}>
                        {endpoints.length}
                      </span>
                    </>
                  ) : (() => {
                    const countryObj = existingCountries.find(c => c.name === selectedAdminCountry);
                    return (
                      <>
                        <CountryFlag code={countryObj?.code} country={selectedAdminCountry} flag={countryObj?.flag} size="sm" />
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {selectedAdminCountry}
                        </span>
                        <span className="badge" style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem' }}>
                          {countryObj?.count || 1}
                        </span>
                      </>
                    );
                  })()}
                </div>
                <ChevronDown 
                  size={15} 
                  color="var(--text-muted)" 
                  style={{ 
                    transform: isAdminCountryDropdownOpen ? 'rotate(180deg)' : 'none', 
                    transition: 'transform 0.2s',
                    flexShrink: 0
                  }} 
                />
              </div>

              {/* Dropdown Menu Popup */}
              {isAdminCountryDropdownOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    right: 0,
                    minWidth: '240px',
                    zIndex: 1200,
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-card)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: '0 12px 32px rgba(0, 0, 0, 0.45)',
                    overflow: 'hidden',
                    padding: '0.4rem 0'
                  }}
                >
                  <div style={{ padding: '0.35rem 0.75rem', fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                    Select Country Filter
                  </div>

                  {/* Option: All Countries */}
                  <div
                    onClick={() => {
                      setSelectedAdminCountry('ALL');
                      setIsAdminCountryDropdownOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.55rem 0.85rem',
                      cursor: 'pointer',
                      background: selectedAdminCountry === 'ALL' ? 'var(--brand-primary-subtle)' : 'transparent',
                      color: selectedAdminCountry === 'ALL' ? 'var(--brand-primary)' : 'var(--text-primary)',
                      fontSize: '0.85rem',
                      fontWeight: selectedAdminCountry === 'ALL' ? 700 : 500,
                      transition: 'background 0.12s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (selectedAdminCountry !== 'ALL') e.currentTarget.style.background = 'var(--bg-input-focus)';
                    }}
                    onMouseLeave={(e) => {
                      if (selectedAdminCountry !== 'ALL') e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                      <span style={{ fontSize: '1rem' }}>🌐</span>
                      <span>All Countries</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span className="badge" style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem' }}>
                        {endpoints.length}
                      </span>
                      {selectedAdminCountry === 'ALL' && <Check size={14} color="var(--brand-primary)" />}
                    </div>
                  </div>

                  <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '0.25rem 0' }} />

                  {/* Individual Countries with Clusters */}
                  {existingCountries.map((c) => {
                    const isSelected = selectedAdminCountry === c.name;
                    return (
                      <div
                        key={c.name}
                        onClick={() => {
                          setSelectedAdminCountry(c.name);
                          setIsAdminCountryDropdownOpen(false);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.55rem 0.85rem',
                          cursor: 'pointer',
                          background: isSelected ? 'var(--brand-primary-subtle)' : 'transparent',
                          color: isSelected ? 'var(--brand-primary)' : 'var(--text-primary)',
                          fontSize: '0.85rem',
                          fontWeight: isSelected ? 700 : 500,
                          transition: 'background 0.12s ease'
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) e.currentTarget.style.background = 'var(--bg-input-focus)';
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                          <CountryFlag code={c.code} country={c.name} flag={c.flag} size="sm" />
                          <span>{c.name}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span className="badge" style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem' }}>
                            {c.count}
                          </span>
                          {isSelected && <Check size={14} color="var(--brand-primary)" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
            gap: '1.5rem',
          }}>
            {filteredEndpoints.map((box) => {
            const test = testResults[box.id];
            const isTesting = testingId === box.id;
            const isSelected = box.id === activeEndpointId;

            return (
              <div 
                key={box.id} 
                className="glass-card"
                style={{
                  borderColor: isSelected ? 'var(--brand-primary)' : undefined,
                  boxShadow: isSelected ? 'var(--shadow-brand)' : undefined,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{
                        width: 42,
                        height: 42,
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--brand-primary-subtle)',
                        color: 'var(--brand-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <Server size={20} />
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {box.adminName || box.name}
                          </h3>
                          <CountryFlag code={box.countryCode} country={box.country} flag={box.countryFlag} size="sm" />
                        </div>
                        <div style={{ display: 'flex', gap: '0.45rem', marginTop: '0.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
                          <span className="badge badge-s3">
                            {box.type === 'ceph' ? 'S3 Gateway' : box.type.toUpperCase()}
                          </span>
                          {box.country && (
                            <span className="badge" style={{ background: 'var(--bg-surface)', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                              <CountryFlag code={box.countryCode} country={box.country} flag={box.countryFlag} size="xs" />
                              <span>{box.country} {box.countryCode ? `(${box.countryCode})` : ''}</span>
                            </span>
                          )}
                          {box.pathStyle && (
                            <span className="badge" style={{ background: 'var(--bg-surface)', color: 'var(--text-secondary)' }}>
                              Path-Style
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div>
                      {isTesting ? (
                        <span className="badge" style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)' }}>
                          <RefreshCw size={12} className="spin" /> Checking...
                        </span>
                      ) : test?.reachable ? (
                        <span className="badge badge-online">
                          <span className="pulse-dot" style={{ width: 6, height: 6 }}></span>
                          {test.latencyMs}ms Online
                        </span>
                      ) : (
                        <span className="badge badge-offline">
                          Offline
                        </span>
                      )}
                    </div>
                  </div>

                  {box.description && (
                    <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.4 }}>
                      {box.description}
                    </p>
                  )}

                  <div style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.85rem',
                    fontSize: '0.8rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.45rem',
                    marginBottom: '1.25rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Admin Side Name:</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{box.adminName || box.name}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-muted)' }}>User Side Name:</span>
                      <span style={{ color: 'var(--brand-primary)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                        <CountryFlag code={box.countryCode} country={box.country} flag={box.countryFlag} size="xs" />
                        <span>{box.clientName || box.name}</span>
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Location / Country:</span>
                      <span style={{ color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                        <CountryFlag code={box.countryCode} country={box.country} flag={box.countryFlag} size="xs" />
                        <span>{box.country || 'Global'}</span>
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Endpoint URL:</span>
                      <span className="font-mono" style={{ color: 'var(--brand-primary)' }}>{box.endpointUrl}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Region:</span>
                      <span style={{ color: 'var(--text-primary)' }}>{box.region || 'us-east-1'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Admin Key:</span>
                      <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>
                        {box.accessKey ? `${box.accessKey.substring(0, 8)}••••••••` : 'Not Set'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Placement ID:</span>
                      <span className="font-mono" style={{ color: box.placementId ? 'var(--brand-primary)' : 'var(--text-muted)', fontWeight: 600 }}>
                        {box.placementId || 'default (cluster-wide)'}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: '0.85rem',
                  borderTop: '1px solid var(--border-subtle)',
                  gap: '0.5rem'
                }}>
                  <button
                    onClick={() => handleTestConnection(box.id)}
                    disabled={isTesting}
                    className="btn btn-secondary btn-sm"
                    title="Test Reachability"
                  >
                    <Activity size={14} />
                    <span>Ping</span>
                  </button>

                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button
                      onClick={() => onSelectEndpoint(box.id)}
                      className={`btn btn-sm ${isSelected ? 'btn-success' : 'btn-secondary'}`}
                    >
                      {isSelected ? (
                        <>
                          <Check size={14} />
                          <span>Active</span>
                        </>
                      ) : (
                        <span>Set Active</span>
                      )}
                    </button>

                    <button
                      onClick={() => openEditModal(box)}
                      className="btn btn-secondary btn-icon btn-sm"
                      title="Edit Configuration"
                    >
                      <Edit3 size={14} />
                    </button>

                    <button
                      onClick={() => handleDelete(box.id, box.name)}
                      className="btn btn-danger btn-icon btn-sm"
                      title="Delete Box"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          </div>

          {filteredEndpoints.length === 0 && (
            <div className="glass-card" style={{ padding: '2.5rem', textAlign: 'center', marginTop: '1rem' }}>
              <Globe size={32} color="var(--text-muted)" style={{ marginBottom: '0.5rem' }} />
              <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.25rem' }}>No Storage Clusters Found</h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                There are no storage clusters or nodes configured under {selectedAdminCountry}.
              </p>
            </div>
          )}
        </>
      )}

      {/* ========================================================= */}
      {/* VIEW B: USER ACCOUNTS & PRIVILEGES */}
      {/* ========================================================= */}
      {activeAdminSubTab === 'users' && (
        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Registered User Accounts ({users.length})
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Promote clients to Administrators or manage access privileges
              </p>
            </div>
            <button
              onClick={loadAdminUsers}
              disabled={loadingUsers}
              className="btn btn-secondary btn-sm"
            >
              <RefreshCw size={14} className={loadingUsers ? 'spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>

          {loadingUsers ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              <RefreshCw size={24} className="spin" style={{ marginBottom: '0.75rem', color: 'var(--brand-primary)' }} />
              <div>Loading user accounts...</div>
            </div>
          ) : users.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              No registered user accounts found.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {users.map((u) => {
                const isAdmin = u.role === 'admin';
                const isSelf = currentUser && currentUser.email === u.email;

                return (
                  <div
                    key={u.id || u._id}
                    style={{
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      padding: '1rem 1.25rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '1rem',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {/* User Identity info */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                      <div style={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        background: isAdmin 
                          ? 'linear-gradient(135deg, var(--brand-primary) 0%, #3b82f6 100%)' 
                          : 'linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-primary-hover) 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                      }}>
                        {isAdmin ? <ShieldCheck size={18} /> : <User size={18} />}
                      </div>

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                            {u.name || u.email}
                          </span>
                          {isSelf && (
                            <span className="badge" style={{ background: 'var(--brand-primary-subtle)', color: 'var(--brand-primary)', fontSize: '0.7rem' }}>
                              You
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.2rem' }}>
                          <span className="font-mono" style={{ fontSize: '0.8rem', color: 'var(--brand-primary)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                            <Mail size={12} />
                            {u.email}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>•</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Joined: {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Role Badge and Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span className={`badge ${isAdmin ? 'badge-s3' : 'badge-online'}`} style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}>
                        {isAdmin ? <ShieldCheck size={13} /> : <UserCheck size={13} />}
                        <span>{isAdmin ? 'ADMINISTRATOR' : 'CLIENT USER'}</span>
                      </span>

                      {isAdmin ? (
                        <button
                          id={`btn-revoke-admin-${u.email}`}
                          onClick={() => handleToggleAdminRole(u)}
                          disabled={isSelf}
                          className="btn btn-secondary btn-sm"
                          style={{
                            borderColor: 'rgba(244, 63, 94, 0.3)',
                            color: isSelf ? 'var(--text-muted)' : '#f43f5e',
                            cursor: isSelf ? 'not-allowed' : 'pointer'
                          }}
                          title={isSelf ? 'You cannot revoke your own administrator privileges' : 'Revoke Admin Privileges'}
                        >
                          <ShieldAlert size={14} />
                          <span>Revoke Admin</span>
                        </button>
                      ) : (
                        <button
                          id={`btn-grant-admin-${u.email}`}
                          onClick={() => handleToggleAdminRole(u)}
                          className="btn btn-secondary btn-sm"
                          style={{
                            borderColor: 'rgba(16, 185, 129, 0.3)',
                            color: 'var(--brand-primary)'
                          }}
                          title="Grant Full Administrator Privileges"
                        >
                          <ShieldCheck size={14} />
                          <span>Make Admin</span>
                        </button>
                      )}

                      {!isSelf && (
                        <button
                          id={`btn-delete-user-${u.email}`}
                          onClick={() => handleDeleteUserAccount(u)}
                          className="btn btn-danger btn-icon btn-sm"
                          title="Delete User Account"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* ADD / EDIT STORAGE BOX MODAL */}
      {/* ========================================================= */}
      {isAddModalOpen && (
        <div className="modal-overlay" onClick={() => setIsAddModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                <Server size={20} color="var(--brand-primary)" />
                <span>{editingBox ? 'Edit Storage Box' : 'Configure New Storage Box'}</span>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                style={{ background: 'transparent', color: 'var(--text-muted)', fontSize: '1.25rem' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {/* Presets Bar */}
                {!editingBox && (
                  <div style={{ marginBottom: '1.25rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                      Quick-Fill Verified Presets:
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => applyPreset('ceph-node155')}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.75rem', color: 'var(--brand-primary)' }}
                      >
                        ⚡ Storage Cluster (10.40.11.155)
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPreset('minio-local')}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.75rem' }}
                      >
                        MinIO Local (9000)
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPreset('aws-s3')}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.75rem' }}
                      >
                        AWS S3 Standard
                      </button>
                    </div>
                  </div>
                )}

                {/* Dual Endpoint Names: Admin Console Side & Client User Side */}
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">
                      Admin Side Name <span className="form-label-required">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Storage Cluster (Node 155)"
                      value={formData.adminName || formData.name}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData(prev => ({
                          ...prev,
                          adminName: val,
                          name: val,
                          clientName: prev.clientName || val
                        }));
                      }}
                      className="form-input"
                    />
                    <div className="form-hint">
                      Internal cluster name visible in Admin Console
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      User Side Name <span className="form-label-required">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. US Fast Cloud Storage"
                      value={formData.clientName}
                      onChange={(e) => setFormData(prev => ({ ...prev, clientName: e.target.value }))}
                      className="form-input"
                    />
                    <div className="form-hint">
                      Client-facing display name shown to regular users
                    </div>
                  </div>
                </div>

                {/* Country / Location Selector */}
                <CountrySelect
                  value={formData.country}
                  flag={formData.countryFlag}
                  code={formData.countryCode}
                  onChange={({ country, countryCode, countryFlag }) => {
                    setFormData(prev => ({
                      ...prev,
                      country,
                      countryCode,
                      countryFlag
                    }));
                  }}
                />

                <div className="form-group">
                  <label className="form-label">
                    Endpoint URL <span className="form-label-required">*</span>
                  </label>
                  <input
                    type="url"
                    required
                    placeholder="http://10.40.11.155:8000 or https://s3.amazonaws.com"
                    value={formData.endpointUrl}
                    onChange={(e) => setFormData({ ...formData, endpointUrl: e.target.value })}
                    className="form-input font-mono"
                  />
                  <div className="form-hint">
                    Include the port number (e.g. 8000 for S3 Gateway, 9000 for MinIO).
                  </div>
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Storage Gateway Type</label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      className="form-select"
                    >
                      <option value="ceph">S3 Gateway (Admin Ops)</option>
                      <option value="aws">AWS S3 / IAM</option>
                      <option value="minio">MinIO Object Store</option>
                      <option value="generic">Generic S3 Compatible</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Region</label>
                    <input
                      type="text"
                      placeholder="us-east-1"
                      value={formData.region}
                      onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                      className="form-input"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Default Placement ID (Ceph Storage Pool Target)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. wallpineresellerrealmplace"
                    value={formData.placementId || ''}
                    onChange={(e) => setFormData({ ...formData, placementId: e.target.value })}
                    className="form-input font-mono"
                  />
                  <div className="form-hint">
                    Specifies the Ceph placement target (e.g. erasure-coded or custom pool rule) for users and buckets on this box.
                  </div>
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Admin Access Key</label>
                    <input
                      type="text"
                      placeholder="Admin API Access Key"
                      value={formData.accessKey}
                      onChange={(e) => setFormData({ ...formData, accessKey: e.target.value })}
                      className="form-input font-mono"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Admin Secret Key</label>
                    <input
                      type="password"
                      placeholder="Admin API Secret Key"
                      value={formData.secretKey}
                      onChange={(e) => setFormData({ ...formData, secretKey: e.target.value })}
                      className="form-input font-mono"
                    />
                  </div>
                </div>

                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <input
                    type="checkbox"
                    id="pathStyle"
                    checked={formData.pathStyle}
                    onChange={(e) => setFormData({ ...formData, pathStyle: e.target.checked })}
                    style={{ width: 16, height: 16, accentColor: 'var(--brand-primary)' }}
                  />
                  <label htmlFor="pathStyle" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    Enable Path-Style Addressing (Required for IP endpoints & MinIO)
                  </label>
                </div>

                <div className="form-group">
                  <label className="form-label">Description / Notes</label>
                  <input
                    type="text"
                    placeholder="Optional details about cluster nodes, network zone, etc."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="form-input"
                  />
                </div>

                {/* Form Test Result Card */}
                {formTestResult && (
                  <div style={{
                    padding: '0.75rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    background: formTestResult.reachable ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)',
                    border: `1px solid ${formTestResult.reachable ? 'rgba(16, 185, 129, 0.25)' : 'rgba(244, 63, 94, 0.25)'}`,
                    color: formTestResult.reachable ? 'var(--brand-primary)' : '#f43f5e',
                    fontSize: '0.825rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    marginTop: '0.75rem'
                  }}>
                    {formTestResult.reachable ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                    <span>
                      {formTestResult.reachable 
                        ? `Endpoint is reachable! Latency: ${formTestResult.latencyMs}ms` 
                        : `Connection failed: ${formTestResult.error || 'Timed out'}`}
                    </span>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={handleTestFormData}
                  disabled={isFormTesting || !formData.endpointUrl}
                  className="btn btn-secondary"
                >
                  <Activity size={14} className={isFormTesting ? 'spin' : ''} />
                  <span>{isFormTesting ? 'Testing Ping...' : 'Test Connection'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>

                <button
                  id="btn-save-box"
                  type="submit"
                  className="btn btn-primary"
                >
                  {editingBox ? 'Save Changes' : 'Save Box'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
