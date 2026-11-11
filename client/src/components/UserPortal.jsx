import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Folder,
  FolderPlus, 
  File, 
  FileText, 
  Image as ImageIcon, 
  Film, 
  Archive, 
  Code, 
  Database, 
  Trash2, 
  Download, 
  Upload, 
  RefreshCw, 
  Copy, 
  Check, 
  Eye, 
  EyeOff, 
  Key, 
  Search, 
  ArrowLeft, 
  ChevronRight, 
  ChevronDown, 
  Globe, 
  Server, 
  Shield, 
  Users, 
  ExternalLink, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle,
  Plus
} from 'lucide-react';
import { useToast } from './ToastContext';
import { useAuth } from './AuthContext';
import CountryFlag from './CountryFlag';

// Helper to format file sizes nicely (e.g. 1.2 MB)
function formatBytes(bytes, decimals = 1) {
  if (!+bytes) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

// Helper to pick appropriate icon and theme based on file extension
function getFileMeta(filename) {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif'].includes(ext)) {
    return { icon: ImageIcon, color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.12)', type: 'Image' };
  }
  if (['mp4', 'mov', 'avi', 'mkv', 'webm', 'mp3', 'wav', 'ogg'].includes(ext)) {
    return { icon: Film, color: '#a855f7', bg: 'rgba(168, 85, 247, 0.12)', type: 'Media' };
  }
  if (['zip', 'tar', 'gz', 'rar', '7z', 'bz2'].includes(ext)) {
    return { icon: Archive, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)', type: 'Archive' };
  }
  if (['js', 'jsx', 'ts', 'tsx', 'py', 'json', 'html', 'css', 'sql', 'sh', 'yml', 'yaml', 'xml'].includes(ext)) {
    return { icon: Code, color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', type: 'Code' };
  }
  if (['pdf', 'doc', 'docx', 'txt', 'md', 'csv', 'xlsx', 'xls', 'rtf'].includes(ext)) {
    return { icon: FileText, color: '#ec4899', bg: 'rgba(236, 72, 153, 0.12)', type: 'Document' };
  }
  return { icon: File, color: 'var(--text-secondary)', bg: 'var(--bg-surface)', type: 'File' };
}

export default function UserPortal({ 
  endpoints, 
  activeEndpointId, 
  onSelectEndpoint,
  activeSubTab = 'files',
  onSubTabChange,
  openCreateBucketTrigger = false,
  onResetCreateBucketTrigger
}) {
  const { addToast } = useToast();
  const { authFetch, currentUser } = useAuth();

  // Selected Storage Cluster/Box
  const selectedBox = endpoints.find(e => e.id === activeEndpointId) || endpoints[0];

  // Internal view management ('files' | 'keys' | 'users')
  const [currentView, setCurrentView] = useState(activeSubTab);
  useEffect(() => {
    if (activeSubTab && activeSubTab !== currentView) {
      setCurrentView(activeSubTab);
    }
  }, [activeSubTab]);

  const switchView = (view) => {
    setCurrentView(view);
    if (onSubTabChange) onSubTabChange(view);
  };

  // State for IAM Users & Credentials
  const [savedUsers, setSavedUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [activeProvisionedUser, setActiveProvisionedUser] = useState(null);
  const [activeCreds, setActiveCreds] = useState({ sourceName: '', accessKey: '', secretKey: '' });
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [copiedField, setCopiedField] = useState(null);
  const [activeSnippetTab, setActiveSnippetTab] = useState('env');

  // New IAM User Modal
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [userFormData, setUserFormData] = useState({ 
    uid: '', 
    displayName: '', 
    email: '', 
    maxBuckets: 1000, 
    placementId: '' 
  });

  // Buckets state
  const [buckets, setBuckets] = useState([]);
  const [loadingBuckets, setLoadingBuckets] = useState(false);
  const [bucketSearchTerm, setBucketSearchTerm] = useState('');
  const [isCreateBucketModalOpen, setIsCreateBucketModalOpen] = useState(false);
  const [newBucketName, setNewBucketName] = useState('');
  const [isCreatingBucket, setIsCreatingBucket] = useState(false);

  // Active Opened Bucket (Folder View)
  const [openedBucket, setOpenedBucket] = useState(null);
  const [bucketObjects, setBucketObjects] = useState([]);
  const [loadingObjects, setLoadingObjects] = useState(false);
  const [fileSearchTerm, setFileSearchTerm] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef(null);

  // Listen for external trigger to open Create Bucket modal (e.g. from top "+ New" button)
  useEffect(() => {
    if (openCreateBucketTrigger) {
      setIsCreateBucketModalOpen(true);
      if (onResetCreateBucketTrigger) onResetCreateBucketTrigger();
    }
  }, [openCreateBucketTrigger]);

  // Load saved users when selectedBox changes
  const loadUsers = async (endpointId, preferredUserId = null) => {
    setLoadingUsers(true);
    try {
      const res = await authFetch(`/api/users?endpointId=${endpointId}`);
      const data = await res.json();
      if (data.success) {
        const userList = data.users || [];
        setSavedUsers(userList);

        let targetUser = null;
        if (preferredUserId) {
          targetUser = userList.find(u => u.id === preferredUserId || u.uid === preferredUserId);
        }
        if (!targetUser && activeProvisionedUser) {
          targetUser = userList.find(u => u.id === activeProvisionedUser.id || u.uid === activeProvisionedUser.uid);
        }
        if (!targetUser && userList.length > 0) {
          targetUser = userList[0];
        }

        if (targetUser) {
          setActiveProvisionedUser(targetUser);
          setActiveCreds({
            sourceName: targetUser.displayName || targetUser.uid,
            accessKey: targetUser.accessKey,
            secretKey: targetUser.secretKey,
          });
        } else {
          setActiveProvisionedUser(null);
          setActiveCreds({ sourceName: '', accessKey: '', secretKey: '' });
          setBuckets([]);
        }
      }
    } catch (err) {
      console.error('Error loading users:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (selectedBox) {
      setOpenedBucket(null);
      setBucketObjects([]);
      loadUsers(selectedBox.id);
    }
  }, [selectedBox?.id]);

  // Load Buckets when credentials are ready
  useEffect(() => {
    if (
      selectedBox && 
      activeProvisionedUser && 
      activeProvisionedUser.endpointId === selectedBox.id && 
      activeCreds.accessKey && 
      activeCreds.secretKey
    ) {
      loadBuckets();
    } else {
      setBuckets([]);
    }
  }, [selectedBox?.id, activeProvisionedUser?.id, activeCreds.accessKey, activeCreds.secretKey]);

  const loadBuckets = async () => {
    const accessKey = activeCreds.accessKey || activeProvisionedUser?.accessKey;
    const secretKey = activeCreds.secretKey || activeProvisionedUser?.secretKey;

    if (!selectedBox || !activeProvisionedUser || !accessKey || !secretKey) return;

    setLoadingBuckets(true);
    try {
      const res = await authFetch('/api/buckets/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpointId: selectedBox.id,
          accessKey,
          secretKey,
          credentials: { accessKey, secretKey },
          userId: activeProvisionedUser.id || activeProvisionedUser.uid,
          customEndpoint: selectedBox.endpointUrl,
          pathStyle: selectedBox.pathStyle,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setBuckets(data.buckets || []);
      } else {
        addToast(data.error || 'Failed to list buckets', 'error');
      }
    } catch (err) {
      addToast(`Error loading buckets: ${err.message}`, 'error');
    } finally {
      setLoadingBuckets(false);
    }
  };

  // Quick 1-Click Onboarding
  const handleQuickProvision = async () => {
    if (!selectedBox) {
      addToast('Please select a storage location first', 'error');
      return;
    }

    setIsCreatingUser(true);
    try {
      const userPrefix = (currentUser?.email?.split('@')[0] || 'client').replace(/[^a-zA-Z0-9_-]/g, '');
      const autoUid = `${userPrefix}-${Math.floor(1000 + Math.random() * 9000)}`;

      const res = await authFetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpointId: selectedBox.id,
          uid: autoUid,
          displayName: currentUser?.name || `${userPrefix} Storage`,
          email: currentUser?.email || '',
          maxBuckets: 1000,
          placementId: selectedBox?.placementId || '',
        }),
      });

      const data = await res.json();
      if (data.success && data.user) {
        addToast(`Storage Space Initialized! S3 Account ready.`, 'success');
        await loadUsers(selectedBox.id, data.user.id || data.user.uid);
      } else {
        addToast(data.error || 'Failed to initialize storage space', 'error');
      }
    } catch (err) {
      addToast(`Error: ${err.message}`, 'error');
    } finally {
      setIsCreatingUser(false);
    }
  };

  // Custom User Creation
  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!selectedBox || !userFormData.uid) return;

    setIsCreatingUser(true);
    try {
      const res = await authFetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpointId: selectedBox.id,
          ...userFormData,
          placementId: userFormData.placementId?.trim() || selectedBox?.placementId || '',
        }),
      });

      const data = await res.json();
      if (data.success && data.user) {
        addToast(`User "${data.user.uid}" created!`, 'success');
        await loadUsers(selectedBox.id, data.user.id || data.user.uid);
        setUserFormData({ uid: '', displayName: '', email: '', maxBuckets: 1000, placementId: '' });
        setIsAddUserModalOpen(false);
      } else {
        addToast(data.error || 'Failed to create user', 'error');
      }
    } catch (err) {
      addToast(`Error: ${err.message}`, 'error');
    } finally {
      setIsCreatingUser(false);
    }
  };

  // Switch Active User Identity
  const useCredentialsForBuckets = (userRecord) => {
    setActiveProvisionedUser(userRecord);
    setActiveCreds({
      sourceName: userRecord.displayName || userRecord.uid,
      accessKey: userRecord.accessKey,
      secretKey: userRecord.secretKey,
    });
    setOpenedBucket(null);
    addToast(`Switched active identity to: ${userRecord.displayName || userRecord.uid}`, 'success');
  };

  // Copy Helper
  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    addToast(`${label} copied to clipboard!`, 'info');
    setTimeout(() => setCopiedField(null), 2500);
  };

  // Download .env file
  const downloadEnvFile = (user) => {
    const envContent = `AWS_ACCESS_KEY_ID=${user.accessKey}
AWS_SECRET_ACCESS_KEY=${user.secretKey}
AWS_ENDPOINT_URL_S3=${selectedBox?.endpointUrl || ''}
AWS_DEFAULT_REGION=${selectedBox?.region || 'us-east-1'}
S3_FORCE_PATH_STYLE=${selectedBox?.pathStyle !== false ? 'true' : 'false'}
`;
    const blob = new Blob([envContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${user.uid}-s3.env`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    addToast(`.env file downloaded for ${user.uid}`, 'success');
  };

  // Create Bucket
  const handleCreateBucketSubmit = async (e) => {
    e.preventDefault();
    if (!selectedBox || !activeProvisionedUser || !newBucketName.trim()) return;

    const accessKey = activeCreds.accessKey || activeProvisionedUser?.accessKey;
    const secretKey = activeCreds.secretKey || activeProvisionedUser?.secretKey;
    const cleanName = newBucketName.trim().toLowerCase();

    setIsCreatingBucket(true);
    try {
      const res = await authFetch('/api/buckets/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpointId: selectedBox.id,
          bucketName: cleanName,
          accessKey,
          secretKey,
          credentials: { accessKey, secretKey },
          userId: activeProvisionedUser.id || activeProvisionedUser.uid,
          region: selectedBox.region || 'us-east-1',
          customEndpoint: selectedBox.endpointUrl,
          pathStyle: selectedBox.pathStyle,
        }),
      });

      const data = await res.json();
      if (data.success) {
        addToast(`Bucket "${cleanName}" created!`, 'success');
        setIsCreateBucketModalOpen(false);
        setNewBucketName('');
        await loadBuckets();
      } else {
        addToast(data.error || 'Failed to create bucket', 'error');
      }
    } catch (err) {
      addToast(`Error creating bucket: ${err.message}`, 'error');
    } finally {
      setIsCreatingBucket(false);
    }
  };

  // Delete Bucket
  const handleDeleteBucket = async (bucketName, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm(`Delete bucket "${bucketName}"? Please ensure it contains no files first.`)) return;

    const accessKey = activeCreds.accessKey || activeProvisionedUser?.accessKey;
    const secretKey = activeCreds.secretKey || activeProvisionedUser?.secretKey;

    try {
      const res = await authFetch('/api/buckets/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpointId: selectedBox.id,
          bucketName,
          accessKey,
          secretKey,
          credentials: { accessKey, secretKey },
          userId: activeProvisionedUser?.id || activeProvisionedUser?.uid,
          customEndpoint: selectedBox.endpointUrl,
          pathStyle: selectedBox.pathStyle,
        }),
      });

      const data = await res.json();
      if (data.success) {
        addToast(`Bucket "${bucketName}" deleted.`, 'info');
        if (openedBucket === bucketName) setOpenedBucket(null);
        loadBuckets();
      } else {
        addToast(data.error || 'Failed to delete bucket', 'error');
      }
    } catch (err) {
      addToast(`Error: ${err.message}`, 'error');
    }
  };

  // Open Bucket (Drive Folder View)
  const handleOpenBucket = (bucketName) => {
    setOpenedBucket(bucketName);
    loadBucketObjects(bucketName);
  };

  // Load Objects in Bucket
  const loadBucketObjects = async (bucketName) => {
    setLoadingObjects(true);
    const accessKey = activeCreds.accessKey || activeProvisionedUser?.accessKey;
    const secretKey = activeCreds.secretKey || activeProvisionedUser?.secretKey;

    try {
      const res = await authFetch('/api/objects/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpointId: selectedBox.id,
          bucketName,
          accessKey,
          secretKey,
          credentials: { accessKey, secretKey },
          userId: activeProvisionedUser?.id || activeProvisionedUser?.uid,
          customEndpoint: selectedBox.endpointUrl,
          pathStyle: selectedBox.pathStyle,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setBucketObjects(data.objects || []);
      } else {
        addToast(data.error || 'Failed to load files', 'error');
      }
    } catch (err) {
      addToast(`Error loading files: ${err.message}`, 'error');
    } finally {
      setLoadingObjects(false);
    }
  };

  // Upload Single File
  const uploadSingleFile = async (file) => {
    if (!file || !openedBucket) return;
    const accessKey = activeCreds.accessKey || activeProvisionedUser?.accessKey;
    const secretKey = activeCreds.secretKey || activeProvisionedUser?.secretKey;

    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('endpointId', selectedBox.id);
      formData.append('bucketName', openedBucket);
      formData.append('accessKey', accessKey);
      formData.append('secretKey', secretKey);
      formData.append('customEndpoint', selectedBox.endpointUrl);
      formData.append('pathStyle', selectedBox.pathStyle ? 'true' : 'false');

      const res = await authFetch('/api/objects/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        addToast(`"${file.name}" uploaded successfully!`, 'success');
        loadBucketObjects(openedBucket);
      } else {
        addToast(data.error || `Failed to upload "${file.name}"`, 'error');
      }
    } catch (err) {
      addToast(`Error uploading: ${err.message}`, 'error');
    } finally {
      setUploadingFile(false);
    }
  };

  // Drag and drop handler
  const handleDropFiles = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      await uploadSingleFile(files[i]);
    }
  };

  // Native input file change
  const handleFileInputChange = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    for (let i = 0; i < files.length; i++) {
      await uploadSingleFile(files[i]);
    }
    e.target.value = '';
  };

  // Download Object Directly from S3
  const handleDownloadObject = async (objectKey) => {
    const accessKey = activeCreds.accessKey || activeProvisionedUser?.accessKey;
    const secretKey = activeCreds.secretKey || activeProvisionedUser?.secretKey;

    try {
      const res = await authFetch('/api/objects/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpointId: selectedBox.id,
          bucketName: openedBucket,
          key: objectKey,
          accessKey,
          secretKey,
          credentials: { accessKey, secretKey },
          userId: activeProvisionedUser?.id || activeProvisionedUser?.uid,
          customEndpoint: selectedBox.endpointUrl,
          pathStyle: selectedBox.pathStyle,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to download file');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = objectKey.split('/').pop() || objectKey;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      addToast(`Downloaded "${objectKey}"`, 'success');
    } catch (err) {
      addToast(`Download error: ${err.message}`, 'error');
    }
  };

  // Delete Object
  const handleDeleteObject = async (objectKey) => {
    if (!window.confirm(`Delete file "${objectKey}" from ${openedBucket}?`)) return;

    const accessKey = activeCreds.accessKey || activeProvisionedUser?.accessKey;
    const secretKey = activeCreds.secretKey || activeProvisionedUser?.secretKey;

    try {
      const res = await authFetch('/api/objects/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpointId: selectedBox.id,
          bucketName: openedBucket,
          key: objectKey,
          objectKey,
          accessKey,
          secretKey,
          credentials: { accessKey, secretKey },
          userId: activeProvisionedUser?.id || activeProvisionedUser?.uid,
          customEndpoint: selectedBox.endpointUrl,
          pathStyle: selectedBox.pathStyle,
        }),
      });

      const data = await res.json();
      if (data.success) {
        addToast(`File "${objectKey}" deleted.`, 'info');
        loadBucketObjects(openedBucket);
      } else {
        addToast(data.error || 'Failed to delete file', 'error');
      }
    } catch (err) {
      addToast(`Error: ${err.message}`, 'error');
    }
  };

  // Filtered lists
  const filteredBuckets = buckets.filter(b => 
    b.name.toLowerCase().includes(bucketSearchTerm.toLowerCase())
  );

  const filteredObjects = bucketObjects.filter(o => 
    o.key.toLowerCase().includes(fileSearchTerm.toLowerCase())
  );

  return (
    <div style={{ width: '100%' }}>
      {/* ========================================================= */}
      {/* 1. ONBOARDING HERO (If no identity provisioned) */}
      {/* ========================================================= */}
      {!activeProvisionedUser && (
        <div className="glass-card" style={{ textAlign: 'center', padding: '3.5rem 2rem', marginBottom: '2rem' }}>
          <div style={{
            width: 68,
            height: 68,
            borderRadius: '50%',
            background: 'var(--brand-primary-subtle)',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.25rem'
          }}>
            <Sparkles size={32} />
          </div>
          <h3 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            Welcome to Wallpine Cloud Storage
          </h3>
          <p style={{ maxWidth: '520px', margin: '0 auto 1.75rem', color: 'var(--text-secondary)', fontSize: '0.925rem' }}>
            Get started in seconds. We'll automatically set up your high-speed S3 storage workspace on{' '}
            <strong>{selectedBox?.clientName || selectedBox?.name}</strong> so you can create buckets and upload files immediately.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              onClick={handleQuickProvision}
              disabled={isCreatingUser}
              className="btn btn-primary"
              style={{ padding: '0.75rem 1.75rem', fontSize: '0.95rem', borderRadius: 'var(--radius-full)' }}
            >
              {isCreatingUser ? (
                <>
                  <RefreshCw size={16} className="spin" />
                  <span>Configuring your storage space...</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  <span>Start Using Storage (1-Click Setup)</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. STORAGE OVERVIEW SUMMARY STRIP (Top of Dashboard) */}
      {/* ========================================================= */}
      {activeProvisionedUser && currentView === 'files' && (
        <div className="cloud-overview-strip">
          <div className="cloud-stat-card">
            <div className="cloud-stat-icon-wrapper">
              <Folder size={22} />
            </div>
            <div>
              <div className="cloud-stat-value">{buckets.length}</div>
              <div className="cloud-stat-label">Storage Buckets</div>
            </div>
          </div>

          <div className="cloud-stat-card">
            <div className="cloud-stat-icon-wrapper">
              <FileText size={22} />
            </div>
            <div>
              <div className="cloud-stat-value">
                {openedBucket ? bucketObjects.length : (buckets.length > 0 ? `${buckets.length} Active` : '0')}
              </div>
              <div className="cloud-stat-label">
                {openedBucket ? `Files in ${openedBucket}` : 'Active Buckets'}
              </div>
            </div>
          </div>

          <div className="cloud-stat-card">
            <div className="cloud-stat-icon-wrapper">
              <Server size={22} />
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div className="cloud-stat-value" style={{ fontSize: '1.05rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {selectedBox?.clientName || selectedBox?.name || 'S3 Cloud'}
              </div>
              <div className="cloud-stat-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span className="pulse-dot" style={{ width: 6, height: 6 }}></span>
                <span>Cluster Online</span>
              </div>
            </div>
          </div>

          <div className="cloud-stat-card" style={{ justifyContent: 'center', cursor: 'pointer', background: 'var(--bg-surface)' }} onClick={() => setIsCreateBucketModalOpen(true)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--text-primary)', fontWeight: 700 }}>
              <FolderPlus size={18} />
              <span>+ New Bucket</span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* VIEW A: FILES & BUCKETS MANAGER (Modern Cloud Drive) */}
      {/* ========================================================= */}
      {activeProvisionedUser && currentView === 'files' && (
        <div>
          {/* Breadcrumbs Navigation Bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
            marginBottom: '1.25rem',
            paddingBottom: '0.75rem',
            borderBottom: '1px solid var(--border-subtle)'
          }}>
            <div className="cloud-breadcrumbs">
              <span 
                className="cloud-breadcrumb-link" 
                onClick={() => setOpenedBucket(null)}
              >
                <Folder size={16} />
                <span>My Storage</span>
              </span>

              {openedBucket && (
                <>
                  <ChevronRight size={14} color="var(--text-muted)" />
                  <span className="cloud-breadcrumb-current">
                    <Database size={15} color="var(--brand-primary)" />
                    <span>{openedBucket}</span>
                  </span>
                </>
              )}
            </div>

            {/* Quick Actions & Search */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              {openedBucket ? (
                <>
                  {/* File Search */}
                  <div style={{ position: 'relative', width: '200px' }}>
                    <Search size={14} style={{ position: 'absolute', left: 10, top: 9, color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      placeholder="Search files..."
                      value={fileSearchTerm}
                      onChange={(e) => setFileSearchTerm(e.target.value)}
                      className="form-input"
                      style={{ paddingLeft: '2rem', padding: '0.4rem 0.6rem 0.4rem 2rem', fontSize: '0.825rem' }}
                    />
                  </div>

                  <button
                    onClick={() => loadBucketObjects(openedBucket)}
                    className="btn btn-secondary btn-icon btn-sm"
                    title="Refresh files"
                  >
                    <RefreshCw size={14} className={loadingObjects ? 'spin' : ''} />
                  </button>

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingFile}
                    className="btn btn-primary btn-sm"
                    style={{ borderRadius: 'var(--radius-full)' }}
                  >
                    <Upload size={14} />
                    <span>{uploadingFile ? 'Uploading...' : 'Upload File'}</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleFileInputChange}
                    style={{ display: 'none' }}
                  />
                </>
              ) : (
                <>
                  {/* Bucket Search */}
                  <div style={{ position: 'relative', width: '220px' }}>
                    <Search size={14} style={{ position: 'absolute', left: 10, top: 9, color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      placeholder="Filter buckets..."
                      value={bucketSearchTerm}
                      onChange={(e) => setBucketSearchTerm(e.target.value)}
                      className="form-input"
                      style={{ paddingLeft: '2rem', padding: '0.4rem 0.6rem 0.4rem 2rem', fontSize: '0.825rem' }}
                    />
                  </div>

                  <button
                    onClick={loadBuckets}
                    className="btn btn-secondary btn-icon btn-sm"
                    title="Refresh buckets"
                  >
                    <RefreshCw size={14} className={loadingBuckets ? 'spin' : ''} />
                  </button>

                  <button
                    onClick={() => setIsCreateBucketModalOpen(true)}
                    className="btn btn-primary btn-sm"
                    style={{ borderRadius: 'var(--radius-full)' }}
                  >
                    <FolderPlus size={14} />
                    <span>New Bucket</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Sub-View 1: Inside Opened Bucket (Object Explorer) */}
          {openedBucket ? (
            <div>
              {/* Back button */}
              <button
                onClick={() => setOpenedBucket(null)}
                className="btn btn-secondary btn-sm"
                style={{ marginBottom: '1.25rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <ArrowLeft size={14} />
                <span>Back to Buckets</span>
              </button>

              {/* Drag & Drop Upload Zone */}
              <div
                className={`cloud-dropzone ${isDragging ? 'dragging' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDropFiles}
                onClick={() => fileInputRef.current?.click()}
              >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    background: 'var(--brand-primary-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-primary)'
                  }}>
                    <Upload size={22} className={uploadingFile ? 'spin' : ''} />
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                    {uploadingFile ? 'Uploading file to S3...' : 'Drag & drop files here to upload'}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    or click to browse from your device
                  </div>
                </div>
              </div>

              {/* Files Table */}
              <div className="cloud-files-table-container">
                {loadingObjects ? (
                  <div style={{ textAlign: 'center', padding: '3.5rem', color: 'var(--text-muted)' }}>
                    <RefreshCw size={24} className="spin" style={{ marginBottom: '0.75rem', color: 'var(--brand-primary)' }} />
                    <div>Loading files from S3...</div>
                  </div>
                ) : filteredObjects.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3.5rem 1.5rem', color: 'var(--text-muted)' }}>
                    <FileText size={36} style={{ marginBottom: '0.75rem', opacity: 0.5 }} />
                    <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                      {fileSearchTerm ? 'No files match your search' : 'No files in this bucket yet'}
                    </div>
                    <div style={{ fontSize: '0.825rem' }}>
                      Drag and drop files into the box above to store your first object.
                    </div>
                  </div>
                ) : (
                  <table className="cloud-table">
                    <thead>
                      <tr>
                        <th>File Name</th>
                        <th>Type</th>
                        <th>Size</th>
                        <th>Modified</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredObjects.map((file) => {
                        const meta = getFileMeta(file.key);
                        const IconComponent = meta.icon;
                        return (
                          <tr key={file.key}>
                            <td>
                              <div className="cloud-file-name-cell">
                                <div className="cloud-file-icon" style={{ background: meta.bg, color: meta.color }}>
                                  <IconComponent size={16} />
                                </div>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                                  {file.key}
                                </span>
                              </div>
                            </td>
                            <td>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                                {meta.type}
                              </span>
                            </td>
                            <td>{formatBytes(file.size)}</td>
                            <td>{file.lastModified ? new Date(file.lastModified).toLocaleDateString() : 'N/A'}</td>
                            <td>
                              <div className="cloud-actions-cell">
                                <button
                                  onClick={() => handleDownloadObject(file.key)}
                                  className="btn btn-secondary btn-icon btn-sm"
                                  title="Download File"
                                >
                                  <Download size={13} />
                                </button>
                                <button
                                  onClick={() => copyToClipboard(`s3://${openedBucket}/${file.key}`, 'S3 URI')}
                                  className="btn btn-secondary btn-icon btn-sm"
                                  title="Copy S3 URI"
                                >
                                  <Copy size={13} />
                                </button>
                                <button
                                  onClick={() => handleDeleteObject(file.key)}
                                  className="btn btn-danger btn-icon btn-sm"
                                  title="Delete File"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          ) : (
            /* Sub-View 2: Bucket Folders Grid / List */
            <div>
              {loadingBuckets ? (
                <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
                  <RefreshCw size={28} className="spin" style={{ marginBottom: '1rem', color: 'var(--brand-primary)' }} />
                  <div>Loading your storage buckets...</div>
                </div>
              ) : filteredBuckets.length === 0 ? (
                <div className="glass-card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
                  <FolderPlus size={44} style={{ color: 'var(--text-muted)', marginBottom: '0.85rem', opacity: 0.6 }} />
                  <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                    {bucketSearchTerm ? 'No buckets match your search' : 'No storage buckets yet'}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '420px', margin: '0 auto 1.5rem' }}>
                    Create your first bucket to organize files, store media assets, or integrate with your applications.
                  </div>
                  <button
                    onClick={() => setIsCreateBucketModalOpen(true)}
                    className="btn btn-primary"
                    style={{ borderRadius: 'var(--radius-full)', padding: '0.65rem 1.4rem' }}
                  >
                    <FolderPlus size={15} />
                    <span>Create My First Bucket</span>
                  </button>
                </div>
              ) : (
                <div className="cloud-folders-grid">
                  {filteredBuckets.map((bucket) => (
                    <div
                      key={bucket.name}
                      className="cloud-folder-card"
                      onClick={() => handleOpenBucket(bucket.name)}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
                        <div style={{
                          width: 44,
                          height: 44,
                          borderRadius: 'var(--radius-md)',
                          background: 'var(--brand-primary-subtle)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--text-primary)'
                        }}>
                          <Database size={20} />
                        </div>

                        <button
                          onClick={(e) => handleDeleteBucket(bucket.name, e)}
                          className="btn btn-danger btn-icon btn-sm"
                          title="Delete Bucket"
                          style={{ opacity: 0.7, padding: '0.35rem' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>

                      <div>
                        <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '0.25rem', wordBreak: 'break-all' }}>
                          {bucket.name}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Created: {bucket.creationDate ? new Date(bucket.creationDate).toLocaleDateString() : 'Active'}
                        </div>
                      </div>

                      <div style={{
                        marginTop: '1.25rem',
                        paddingTop: '0.75rem',
                        borderTop: '1px solid var(--border-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '0.8rem',
                        color: 'var(--brand-primary)',
                        fontWeight: 600
                      }}>
                        <span>Open Files</span>
                        <ChevronRight size={14} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* VIEW B: API KEYS & DEVELOPER ACCESS */}
      {/* ========================================================= */}
      {activeProvisionedUser && currentView === 'keys' && (
        <div style={{ maxWidth: '840px', margin: '0 auto' }}>
          <div className="glass-card" style={{ marginBottom: '1.5rem', padding: '1.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  S3 API Credentials
                </h3>
                <div style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Active Identity: <strong style={{ color: 'var(--text-primary)' }}>{activeProvisionedUser.displayName || activeProvisionedUser.uid}</strong>
                </div>
              </div>

              <button
                onClick={() => downloadEnvFile(activeProvisionedUser)}
                className="btn btn-secondary btn-sm"
                style={{ borderRadius: 'var(--radius-full)' }}
              >
                <Download size={14} />
                <span>Download .env File</span>
              </button>
            </div>

            {/* Keys Display */}
            <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  Access Key ID
                </div>
                <div className="key-field-box">
                  <span className="key-field-value">{activeProvisionedUser.accessKey}</span>
                  <button
                    onClick={() => copyToClipboard(activeProvisionedUser.accessKey, 'Access Key')}
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '0.25rem 0.5rem' }}
                  >
                    {copiedField === 'Access Key' ? <Check size={14} color="var(--brand-primary)" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  Secret Access Key
                </div>
                <div className="key-field-box">
                  <span className="key-field-value">
                    {showSecretKey ? activeProvisionedUser.secretKey : '••••••••••••••••••••••••••••••••••••••••'}
                  </span>
                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    <button
                      onClick={() => setShowSecretKey(!showSecretKey)}
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '0.25rem 0.5rem' }}
                    >
                      {showSecretKey ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                    <button
                      onClick={() => copyToClipboard(activeProvisionedUser.secretKey, 'Secret Key')}
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '0.25rem 0.5rem' }}
                    >
                      {copiedField === 'Secret Key' ? <Check size={14} color="var(--brand-primary)" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* S3 Endpoint URL */}
            <div style={{ marginBottom: '2rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                S3 Storage Endpoint
              </div>
              <div className="key-field-box">
                <span className="key-field-value">{selectedBox?.endpointUrl}</span>
                <button
                  onClick={() => copyToClipboard(selectedBox?.endpointUrl, 'Endpoint URL')}
                  className="btn btn-secondary btn-sm"
                >
                  {copiedField === 'Endpoint URL' ? <Check size={14} color="var(--brand-primary)" /> : <Copy size={14} />}
                </button>
              </div>
            </div>

            {/* Quick Code Integration Tabs */}
            <div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
                Quick Code Integration
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                {[
                  { id: 'env', label: '.env File' },
                  { id: 'cli', label: 'AWS CLI' },
                  { id: 'node', label: 'Node.js (AWS SDK v3)' },
                  { id: 'python', label: 'Python (boto3)' },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveSnippetTab(tab.id)}
                    className="btn btn-secondary btn-sm"
                    style={{
                      background: activeSnippetTab === tab.id ? 'var(--btn-primary-bg)' : 'transparent',
                      color: activeSnippetTab === tab.id ? 'var(--btn-primary-text)' : 'var(--text-secondary)',
                      fontSize: '0.775rem'
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div style={{ position: 'relative' }}>
                <pre style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-input)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1rem',
                  fontSize: '0.8rem',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-primary)',
                  overflowX: 'auto',
                  lineHeight: 1.5
                }}>
                  {activeSnippetTab === 'env' && `AWS_ACCESS_KEY_ID=${activeProvisionedUser.accessKey}
AWS_SECRET_ACCESS_KEY=${activeProvisionedUser.secretKey}
AWS_ENDPOINT_URL_S3=${selectedBox?.endpointUrl || ''}
AWS_DEFAULT_REGION=${selectedBox?.region || 'us-east-1'}
S3_FORCE_PATH_STYLE=true`}

                  {activeSnippetTab === 'cli' && `# Configure AWS CLI profile for Wallpine S3
aws configure set aws_access_key_id ${activeProvisionedUser.accessKey}
aws configure set aws_secret_access_key ${activeProvisionedUser.secretKey}
aws configure set default.region ${selectedBox?.region || 'us-east-1'}

# List your buckets:
aws --endpoint-url=${selectedBox?.endpointUrl} s3 ls`}

                  {activeSnippetTab === 'node' && `import { S3Client, ListBucketsCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({
  region: "${selectedBox?.region || 'us-east-1'}",
  endpoint: "${selectedBox?.endpointUrl}",
  credentials: {
    accessKeyId: "${activeProvisionedUser.accessKey}",
    secretAccessKey: "${activeProvisionedUser.secretKey}",
  },
  forcePathStyle: true,
});

const { Buckets } = await s3.send(new ListBucketsCommand({}));
console.log(Buckets);`}

                  {activeSnippetTab === 'python' && `import boto3

s3 = boto3.client(
    's3',
    endpoint_url='${selectedBox?.endpointUrl}',
    aws_access_key_id='${activeProvisionedUser.accessKey}',
    aws_secret_access_key='${activeProvisionedUser.secretKey}',
    region_name='${selectedBox?.region || 'us-east-1'}'
)

response = s3.list_buckets()
for bucket in response['Buckets']:
    print(bucket['Name'])`}
                </pre>

                <button
                  onClick={() => {
                    const text = activeSnippetTab === 'env'
                      ? `AWS_ACCESS_KEY_ID=${activeProvisionedUser.accessKey}\nAWS_SECRET_ACCESS_KEY=${activeProvisionedUser.secretKey}\nAWS_ENDPOINT_URL_S3=${selectedBox?.endpointUrl}\nAWS_DEFAULT_REGION=${selectedBox?.region || 'us-east-1'}\nS3_FORCE_PATH_STYLE=true`
                      : activeSnippetTab === 'cli'
                      ? `aws --endpoint-url=${selectedBox?.endpointUrl} s3 ls`
                      : activeSnippetTab === 'node'
                      ? `import { S3Client } from "@aws-sdk/client-s3";`
                      : `import boto3`;
                    copyToClipboard(text, 'Code Snippet');
                  }}
                  className="btn btn-secondary btn-sm"
                  style={{ position: 'absolute', top: 10, right: 10, fontSize: '0.75rem', padding: '0.25rem 0.55rem' }}
                >
                  <Copy size={13} />
                  <span>Copy</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* VIEW C: IAM USERS & IDENTITIES */}
      {/* ========================================================= */}
      {activeProvisionedUser && currentView === 'users' && (
        <div style={{ maxWidth: '840px', margin: '0 auto' }}>
          <div className="glass-card" style={{ padding: '1.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Storage Identities
                </h3>
                <div style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  S3 credentials associated with your account on {selectedBox?.clientName || selectedBox?.name}
                </div>
              </div>

              <button
                onClick={() => {
                  setUserFormData({
                    uid: '',
                    displayName: '',
                    email: '',
                    maxBuckets: 1000,
                    placementId: selectedBox?.placementId || ''
                  });
                  setIsAddUserModalOpen(true);
                }}
                className="btn btn-primary btn-sm"
                style={{ borderRadius: 'var(--radius-full)' }}
              >
                <Plus size={14} />
                <span>Create New User</span>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {savedUsers.map((u) => {
                const isActive = (activeProvisionedUser?.id || activeProvisionedUser?.uid) === (u.id || u.uid);
                return (
                  <div
                    key={u.id || u.uid}
                    style={{
                      background: isActive ? 'var(--brand-primary-subtle)' : 'var(--bg-surface)',
                      border: isActive ? '1px solid var(--text-primary)' : '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      padding: '1rem 1.25rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '0.75rem'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                      <div style={{
                        width: 38,
                        height: 38,
                        borderRadius: '50%',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-primary)'
                      }}>
                        <Key size={16} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span>{u.displayName || u.uid}</span>
                          {isActive && (
                            <span className="badge badge-online" style={{ fontSize: '0.675rem' }}>
                              Active
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.15rem' }}>
                          <span>UID: {u.uid}</span>
                          <span>•</span>
                          <span>Key: {u.accessKey?.slice(0, 8)}...</span>
                          <span>•</span>
                          <span>
                            Placement: <strong style={{ color: (u.placementId || selectedBox?.placementId) ? 'var(--brand-primary)' : 'var(--text-muted)' }}>
                              {u.placementId || selectedBox?.placementId || 'default'}
                            </strong>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <button
                        onClick={() => downloadEnvFile(u)}
                        className="btn btn-secondary btn-sm"
                        title="Download .env"
                      >
                        <Download size={13} />
                      </button>

                      {!isActive && (
                        <button
                          onClick={() => useCredentialsForBuckets(u)}
                          className="btn btn-primary btn-sm"
                        >
                          <span>Switch to this Identity</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: CREATE BUCKET */}
      {/* ========================================================= */}
      {isCreateBucketModalOpen && (
        <div className="modal-overlay" onClick={() => setIsCreateBucketModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                <FolderPlus size={18} />
                <span>Create New Storage Bucket</span>
              </div>
              <button
                onClick={() => setIsCreateBucketModalOpen(false)}
                style={{ background: 'transparent', color: 'var(--text-muted)', fontSize: '1.25rem' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateBucketSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Bucket Name *</label>
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="e.g. assets, backups, media-files"
                    value={newBucketName}
                    onChange={(e) => setNewBucketName(e.target.value)}
                    className="form-input font-mono"
                  />
                  <div className="form-hint">
                    Bucket names must be lowercase letters, numbers, and hyphens (3-63 chars).
                  </div>
                </div>

                <div style={{ marginTop: '0.75rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                    Quick suggestions:
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    {[`drive-data-${Date.now().toString().slice(-4)}`, `media-${Date.now().toString().slice(-4)}`, `backups-${Date.now().toString().slice(-4)}`].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setNewBucketName(s)}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setIsCreateBucketModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingBucket || !newBucketName.trim()}
                  className="btn btn-primary"
                >
                  {isCreatingBucket ? (
                    <>
                      <RefreshCw size={14} className="spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <FolderPlus size={14} />
                      <span>Create Bucket</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: CREATE IAM USER */}
      {/* ========================================================= */}
      {isAddUserModalOpen && (
        <div className="modal-overlay" onClick={() => setIsAddUserModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                <Key size={18} />
                <span>Create S3 IAM Identity</span>
              </div>
              <button
                onClick={() => setIsAddUserModalOpen(false)}
                style={{ background: 'transparent', color: 'var(--text-muted)', fontSize: '1.25rem' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateUser}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">User ID (UID) *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. app-uploader"
                    value={userFormData.uid}
                    onChange={(e) => setUserFormData({ ...userFormData, uid: e.target.value })}
                    className="form-input font-mono"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Display Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Production Uploader"
                    value={userFormData.displayName}
                    onChange={(e) => setUserFormData({ ...userFormData, displayName: e.target.value })}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Placement ID (Ceph Storage Pool Target)</label>
                  <input
                    type="text"
                    placeholder="e.g. wallpineresellerrealmplace"
                    value={userFormData.placementId}
                    onChange={(e) => setUserFormData({ ...userFormData, placementId: e.target.value })}
                    className="form-input font-mono"
                  />
                  <div className="form-hint">
                    Specifies the Ceph placement target (storage pool rule). Buckets created by this user will be placed into this target pool.
                  </div>

                  <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                    {selectedBox?.placementId && (
                      <button
                        type="button"
                        onClick={() => setUserFormData({ ...userFormData, placementId: selectedBox.placementId })}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.725rem', padding: '0.15rem 0.5rem' }}
                      >
                        Box Default ({selectedBox.placementId})
                      </button>
                    )}
                    {selectedBox?.placementId !== 'wallpineresellerrealmplace' && (
                      <button
                        type="button"
                        onClick={() => setUserFormData({ ...userFormData, placementId: 'wallpineresellerrealmplace' })}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.725rem', padding: '0.15rem 0.5rem' }}
                      >
                        wallpineresellerrealmplace
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setUserFormData({ ...userFormData, placementId: '' })}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.725rem', padding: '0.15rem 0.5rem' }}
                    >
                      Cluster Default
                    </button>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setIsAddUserModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingUser || !userFormData.uid}
                  className="btn btn-primary"
                >
                  {isCreatingUser ? 'Generating keys...' : 'Create Identity'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
