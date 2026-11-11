import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB, S3UserRecord } from './db.js';
import { 
  getEndpoints, 
  getEndpointById,
  saveEndpoint, 
  deleteEndpoint, 
  getSavedUsers, 
  saveUser, 
  deleteSavedUser,
  getAuthUsers,
  findAuthUserByEmail,
  verifyUserPassword,
  findAuthUserById,
  saveAuthUser,
  getUserCount,
  getAllAuthUsers,
  updateUserRole,
  deleteAuthUserById,
  getBucketsByOwner,
  saveBucketRecord,
  deleteBucketRecord,
  checkBucketOwnership
} from './storage.js';
import { 
  testEndpoint, 
  createS3User, 
  listBuckets, 
  createBucket, 
  deleteBucket, 
  listObjects, 
  putObject, 
  deleteObject,
  getObject
} from './s3Service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Serve static assets from client dist if built
const clientDistPath = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDistPath));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB max

// Email validation helper
function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// Token Helpers
function generateToken(user) {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
    ts: Date.now()
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

function verifyToken(tokenString) {
  try {
    const raw = Buffer.from(tokenString, 'base64').toString('utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// Authentication Middleware: Users MUST be logged in
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      success: false, 
      error: 'Authentication required. Please log in to access this resource.' 
    });
  }

  const token = authHeader.replace('Bearer ', '').trim();
  const decoded = verifyToken(token);

  if (!decoded || !decoded.email) {
    return res.status(401).json({ 
      success: false, 
      error: 'Invalid or expired session. Please log in again.' 
    });
  }

  // Cross-check with MongoDB
  const user = await findAuthUserByEmail(decoded.email);
  if (!user) {
    return res.status(401).json({ 
      success: false, 
      error: 'User account not found. Please log in.' 
    });
  }

  req.user = user;
  next();
}

// Admin Authorization Middleware: User must be an Administrator
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      error: 'Access denied: Administrator privileges required.' 
    });
  }
  next();
}

// Public Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', database: 'mongodb', timestamp: new Date().toISOString() });
});

// ==========================================
// 0. AUTHENTICATION & LOGIN (PUBLIC)
// ==========================================

// Login Route
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!isValidEmail(cleanEmail)) {
      return res.status(400).json({ success: false, error: 'Please enter a valid email address.' });
    }

    const user = await findAuthUserByEmail(cleanEmail);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });
    }

    const isMatch = await verifyUserPassword(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });
    }

    const token = generateToken(user);
    const safeUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    };

    res.json({
      success: true,
      message: `Welcome back, ${user.name || user.email}!`,
      user: safeUser,
      token
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Register Route
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!isValidEmail(cleanEmail)) {
      return res.status(400).json({ success: false, error: 'Please enter a valid email address (e.g. user@domain.com).' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters long.' });
    }

    const existing = await findAuthUserByEmail(cleanEmail);
    if (existing) {
      return res.status(400).json({ success: false, error: 'An account with this email address already exists.' });
    }

    // REQUIREMENT: The first registered user automatically becomes the Admin!
    // All subsequent registered users receive the default 'user' role.
    const userCount = await getUserCount();
    const isFirstUser = userCount === 0;
    const assignedRole = isFirstUser ? 'admin' : 'user';

    const newUser = await saveAuthUser({
      email: cleanEmail,
      password,
      name: name?.trim() || cleanEmail.split('@')[0],
      role: assignedRole
    });

    const token = generateToken(newUser);
    const safeUser = {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      role: newUser.role
    };

    res.json({
      success: true,
      message: isFirstUser
        ? 'Account created! As the first registered user, you have been designated as System Administrator.'
        : 'Account created successfully!',
      user: safeUser,
      token,
      isFirstUser
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Session Validation
app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user.id,
      email: req.user.email,
      name: req.user.name,
      role: req.user.role
    }
  });
});

// ==========================================
// 0.1 ADMIN USER MANAGEMENT (ADMIN ONLY)
// ==========================================

// List all registered users
app.get('/api/admin/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const users = await getAllAuthUsers();
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Grant or Revoke Admin Privileges
app.patch('/api/admin/users/:id/role', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    const targetUserId = req.params.id;

    if (!role || !['admin', 'user'].includes(role)) {
      return res.status(400).json({ success: false, error: 'Valid role ("admin" or "user") is required.' });
    }

    // Prevent admin from revoking their own admin rights
    if (req.user.id === targetUserId && role !== 'admin') {
      return res.status(400).json({ success: false, error: 'You cannot revoke your own administrator privileges.' });
    }

    const updatedUser = await updateUserRole(targetUserId, role);
    if (!updatedUser) {
      return res.status(404).json({ success: false, error: 'Target user not found.' });
    }

    res.json({
      success: true,
      message: `User privileges updated to ${role.toUpperCase()} successfully.`,
      user: updatedUser
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete user account
app.delete('/api/admin/users/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const targetUserId = req.params.id;
    if (req.user.id === targetUserId) {
      return res.status(400).json({ success: false, error: 'You cannot delete your own account while logged in.' });
    }

    await deleteAuthUserById(targetUserId);
    res.json({ success: true, message: 'User account removed successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 1. ADMIN PORTAL: BOX (ENDPOINT) MANAGEMENT (PROTECTED)
// ==========================================

// List configured endpoints (Authenticated users can read endpoints)
app.get('/api/endpoints', requireAuth, async (req, res) => {
  try {
    const endpoints = await getEndpoints();
    const isAdmin = req.user.role === 'admin';
    const formatted = endpoints.map(ep => {
      const adminName = ep.adminName || ep.name;
      const clientName = ep.clientName || ep.name;
      return {
        ...ep,
        adminName,
        clientName,
        name: isAdmin ? adminName : clientName
      };
    });
    res.json({ success: true, endpoints: formatted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Add Box / Create Endpoint (Requires Admin)
app.post('/api/endpoints', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { 
      name, 
      adminName, 
      clientName, 
      country, 
      countryCode, 
      countryFlag, 
      endpointUrl, 
      region, 
      accessKey, 
      secretKey, 
      type, 
      pathStyle, 
      description 
    } = req.body;

    const resolvedAdminName = (adminName || name || '').trim();
    const resolvedClientName = (clientName || name || adminName || '').trim();

    if (!resolvedAdminName || !endpointUrl) {
      return res.status(400).json({ success: false, error: 'Admin side name and Endpoint URL are required.' });
    }

    const newEndpoint = {
      id: `box-${Date.now()}`,
      name: resolvedAdminName,
      adminName: resolvedAdminName,
      clientName: resolvedClientName,
      country: country?.trim() || '',
      countryCode: countryCode?.trim() || '',
      countryFlag: countryFlag?.trim() || '',
      endpointUrl: endpointUrl.trim().replace(/\/+$/, ''),
      region: region?.trim() || 'us-east-1',
      accessKey: accessKey?.trim() || '',
      secretKey: secretKey?.trim() || '',
      type: type || 'ceph',
      pathStyle: pathStyle !== false,
      placementId: placementId?.trim() || '',
      description: description?.trim() || '',
      createdAt: new Date().toISOString()
    };

    const endpoints = await saveEndpoint(newEndpoint);
    res.json({ success: true, endpoint: newEndpoint, endpoints });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update Box (Requires Admin)
app.put('/api/endpoints/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const existing = await getEndpointById(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Box endpoint not found.' });
    }

    const resolvedAdminName = (req.body.adminName || req.body.name || existing.adminName || existing.name || '').trim();
    const resolvedClientName = (req.body.clientName || req.body.name || existing.clientName || existing.name || '').trim();

    const updated = {
      ...existing,
      ...req.body,
      id,
      name: resolvedAdminName,
      adminName: resolvedAdminName,
      clientName: resolvedClientName,
      country: req.body.country !== undefined ? req.body.country : (existing.country || ''),
      countryCode: req.body.countryCode !== undefined ? req.body.countryCode : (existing.countryCode || ''),
      countryFlag: req.body.countryFlag !== undefined ? req.body.countryFlag : (existing.countryFlag || ''),
      endpointUrl: req.body.endpointUrl ? req.body.endpointUrl.trim().replace(/\/+$/, '') : existing.endpointUrl,
      placementId: req.body.placementId !== undefined ? req.body.placementId.trim() : (existing.placementId || '')
    };

    const all = await saveEndpoint(updated);
    res.json({ success: true, endpoint: updated, endpoints: all });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete Box (Requires Admin)
app.delete('/api/endpoints/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const endpoints = await deleteEndpoint(req.params.id);
    res.json({ success: true, endpoints });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Test Box Connectivity (Authenticated)
app.post('/api/endpoints/:id/test', requireAuth, async (req, res) => {
  try {
    const endpoint = await getEndpointById(req.params.id);
    if (!endpoint) {
      return res.status(404).json({ success: false, error: 'Endpoint not found.' });
    }

    const result = await testEndpoint(endpoint);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 2. USER PORTAL: IAM & USER MANAGEMENT (PROTECTED)
// ==========================================

// Create S3 / IAM User
app.post('/api/users', requireAuth, async (req, res) => {
  try {
    const { endpointId, uid, displayName, email, maxBuckets, placementId } = req.body;
    if (!endpointId || !uid) {
      return res.status(400).json({ success: false, error: 'Endpoint ID and Username (UID) are required.' });
    }

    const endpoint = await getEndpointById(endpointId);
    if (!endpoint) {
      return res.status(404).json({ success: false, error: 'Selected storage box was not found.' });
    }

    const cleanUid = uid.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '-');
    const cleanDisplayName = displayName?.trim() || cleanUid;
    const resolvedPlacement = (placementId !== undefined ? placementId : (endpoint.placementId || '')).trim();

    const userResult = await createS3User({
      endpoint,
      uid: cleanUid,
      displayName: cleanDisplayName,
      email: email?.trim(),
      maxBuckets: maxBuckets ? parseInt(maxBuckets, 10) : 1000,
      placementId: resolvedPlacement
    });

    const savedRecord = {
      ...userResult,
      placementId: userResult.placementId || resolvedPlacement,
      endpointId: endpoint.id,
      endpointName: endpoint.name,
      endpointUrl: endpoint.endpointUrl,
      ownerEmail: req.user.email,
      ownerUserId: req.user.id,
      createdAt: new Date().toISOString()
    };

    await saveUser(savedRecord);

    res.json({
      success: true,
      message: 'S3 User successfully created with active credentials and saved in MongoDB!',
      user: savedRecord
    });
  } catch (err) {
    console.error('Error creating user:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get created users list (Only returns users created by the logged-in user)
app.get('/api/users', requireAuth, async (req, res) => {
  try {
    const { endpointId } = req.query;
    // Multi-tenant isolation: Only list provisioned users created by the requesting user
    let users = await getSavedUsers(endpointId, req.user.email);

    // ONLY FOR ADMINISTRATORS: if an Admin has no identities on this endpoint, seed default cluster admin credentials for them
    if (users.length === 0 && endpointId && req.user.role === 'admin') {
      const ep = await getEndpointById(endpointId);
      if (ep && ep.accessKey && ep.secretKey) {
        const defaultUid = (ep.name || 'default').toLowerCase().replace(/[^a-z0-9_-]/g, '-');
        const defaultUser = {
          id: `user-${Date.now()}`,
          uid: defaultUid,
          displayName: `${ep.name} Default`,
          email: req.user.email,
          maxBuckets: 1000,
          accessKey: ep.accessKey,
          secretKey: ep.secretKey,
          endpointId: ep.id,
          endpointName: ep.name,
          endpointUrl: ep.endpointUrl,
          source: 'endpoint_credentials',
          ownerEmail: req.user.email,
          ownerUserId: req.user.id,
          createdAt: new Date().toISOString()
        };
        await saveUser(defaultUser);
        users = [defaultUser];
      }
    }

    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete user record
app.delete('/api/users/:id', requireAuth, async (req, res) => {
  try {
    const users = await deleteSavedUser(req.params.id, req.user.role === 'admin' ? null : req.user.email);
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 3. USER PORTAL: BUCKET & OBJECT MANAGEMENT (PROTECTED)
// ==========================================

async function resolveEndpointAndCreds(body, requestingUser = null) {
  const { endpointId, credentials, accessKey, secretKey, userId, uid } = body;
  const endpoint = await getEndpointById(endpointId);
  if (!endpoint) {
    throw new Error('Target storage box not found.');
  }

  let finalAccessKey = credentials?.accessKey || accessKey || '';
  let finalSecretKey = credentials?.secretKey || secretKey || '';

  // If keys not directly provided or userId/uid was provided, look up from DB for THIS endpoint
  if (userId || uid) {
    const userTargetId = userId || uid;
    const userQuery = {
      $or: [{ id: userTargetId }, { uid: userTargetId }],
      endpointId: endpoint.id
    };
    // Non-admin users are strictly scoped to their own IAM user records
    if (requestingUser && requestingUser.role !== 'admin') {
      userQuery.ownerEmail = requestingUser.email.toLowerCase().trim();
    }
    const userRec = await S3UserRecord.findOne(userQuery);
    if (userRec) {
      finalAccessKey = userRec.accessKey;
      finalSecretKey = userRec.secretKey;
    }
  }

  // Fallback to storage box root S3 credentials ONLY if the user is an Administrator
  if (!finalAccessKey || !finalSecretKey) {
    if (requestingUser && requestingUser.role === 'admin' && endpoint.accessKey && endpoint.secretKey) {
      finalAccessKey = endpoint.accessKey;
      finalSecretKey = endpoint.secretKey;
    }
  }

  const creds = {
    accessKey: typeof finalAccessKey === 'string' ? finalAccessKey.trim() : '',
    secretKey: typeof finalSecretKey === 'string' ? finalSecretKey.trim() : '',
  };

  if (!creds.accessKey || !creds.secretKey) {
    throw new Error('Provisioned S3 identity credentials are required. Please initialize or select your storage identity.');
  }

  return { endpoint, creds };
}

// List Buckets (Strict Multi-Tenant Scoping)
app.post('/api/buckets/list', requireAuth, async (req, res) => {
  try {
    const { endpoint, creds } = await resolveEndpointAndCreds(req.body, req.user);
    const data = await listBuckets({ endpoint, credentials: creds });

    // Multi-tenant isolation: Regular users ONLY see buckets they personally created
    if (req.user.role !== 'admin') {
      const ownedBuckets = await getBucketsByOwner(endpoint.id, req.user.email);
      const ownedNames = new Set(ownedBuckets.map(b => b.bucketName.toLowerCase()));
      data.buckets = (data.buckets || []).filter(b => ownedNames.has(b.name.toLowerCase()));
    }

    res.json({ success: true, ...data });
  } catch (err) {
    console.error('Error listing buckets:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create Bucket (With Ownership Tracking)
app.post('/api/buckets/create', requireAuth, async (req, res) => {
  try {
    const { bucketName, endpointId } = req.body;
    if (!bucketName) {
      return res.status(400).json({ success: false, error: 'Bucket name is required.' });
    }

    const cleanBucketName = bucketName.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(cleanBucketName)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid bucket name. Must be 3-63 lowercase alphanumeric characters, dots, or hyphens.' 
      });
    }

    const { endpoint, creds } = await resolveEndpointAndCreds(req.body, req.user);
    const result = await createBucket({ endpoint, credentials: creds, bucketName: cleanBucketName });

    // Track bucket ownership in MongoDB
    await saveBucketRecord({
      bucketName: cleanBucketName,
      endpointId: endpoint.id,
      ownerEmail: req.user.email,
      ownerUserId: req.user.id,
      creatorUid: req.body.userId || creds.accessKey || ''
    });

    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Error creating bucket:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete Bucket
app.post('/api/buckets/delete', requireAuth, async (req, res) => {
  try {
    const { bucketName, endpointId } = req.body;
    if (!bucketName) {
      return res.status(400).json({ success: false, error: 'Bucket name is required.' });
    }

    // Verify ownership before deleting
    const hasAccess = await checkBucketOwnership(bucketName, endpointId, req.user);
    if (!hasAccess) {
      return res.status(403).json({ success: false, error: 'Access denied. You do not own this bucket.' });
    }

    const { endpoint, creds } = await resolveEndpointAndCreds(req.body, req.user);
    await deleteBucket({ endpoint, credentials: creds, bucketName });

    // Remove ownership record from MongoDB
    await deleteBucketRecord(bucketName, endpoint.id, req.user.role === 'admin' ? null : req.user.email);

    res.json({ success: true, bucketName });
  } catch (err) {
    console.error('Error deleting bucket:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// List Objects inside Bucket
app.post('/api/objects/list', requireAuth, async (req, res) => {
  try {
    const { bucketName, prefix, endpointId } = req.body;
    if (!bucketName) {
      return res.status(400).json({ success: false, error: 'Bucket name is required.' });
    }

    // Verify ownership before listing objects
    const hasAccess = await checkBucketOwnership(bucketName, endpointId, req.user);
    if (!hasAccess) {
      return res.status(403).json({ success: false, error: 'Access denied. You do not own this bucket.' });
    }

    const { endpoint, creds } = await resolveEndpointAndCreds(req.body, req.user);
    const data = await listObjects({ endpoint, credentials: creds, bucketName, prefix });
    res.json({ success: true, ...data });
  } catch (err) {
    console.error('Error listing objects:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Upload Object to Bucket
app.post('/api/objects/upload', requireAuth, upload.single('file'), async (req, res) => {
  try {
    const { endpointId, bucketName, keyName } = req.body;
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file provided for upload.' });
    }
    if (!bucketName) {
      return res.status(400).json({ success: false, error: 'Bucket name is required.' });
    }

    // Verify ownership before upload
    const hasAccess = await checkBucketOwnership(bucketName, endpointId, req.user);
    if (!hasAccess) {
      return res.status(403).json({ success: false, error: 'Access denied. You do not own this bucket.' });
    }

    const { endpoint, creds } = await resolveEndpointAndCreds(req.body, req.user);
    const objectKey = keyName?.trim() || req.file.originalname;

    const result = await putObject({
      endpoint,
      credentials: creds,
      bucketName,
      key: objectKey,
      body: req.file.buffer,
      contentType: req.file.mimetype
    });

    res.json({ success: true, ...result, size: req.file.size });
  } catch (err) {
    console.error('Error uploading object:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete Object from Bucket
app.post('/api/objects/delete', requireAuth, async (req, res) => {
  try {
    const { bucketName, key, endpointId } = req.body;
    if (!bucketName || !key) {
      return res.status(400).json({ success: false, error: 'Bucket name and object key are required.' });
    }

    // Verify ownership before deleting
    const hasAccess = await checkBucketOwnership(bucketName, endpointId, req.user);
    if (!hasAccess) {
      return res.status(403).json({ success: false, error: 'Access denied. You do not own this bucket.' });
    }

    const { endpoint, creds } = await resolveEndpointAndCreds(req.body, req.user);
    await deleteObject({ endpoint, credentials: creds, bucketName, key });
    res.json({ success: true, key });
  } catch (err) {
    console.error('Error deleting object:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Download Object from Bucket
app.post('/api/objects/download', requireAuth, async (req, res) => {
  try {
    const { bucketName, key, endpointId } = req.body;
    if (!bucketName || !key) {
      return res.status(400).json({ success: false, error: 'Bucket name and object key are required.' });
    }

    const hasAccess = await checkBucketOwnership(bucketName, endpointId, req.user);
    if (!hasAccess) {
      return res.status(403).json({ success: false, error: 'Access denied. You do not own this bucket.' });
    }

    const { endpoint, creds } = await resolveEndpointAndCreds(req.body, req.user);
    const s3Object = await getObject({ endpoint, credentials: creds, bucketName, key });

    const filename = path.basename(key);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    if (s3Object.ContentType) {
      res.setHeader('Content-Type', s3Object.ContentType);
    }
    if (s3Object.ContentLength) {
      res.setHeader('Content-Length', s3Object.ContentLength);
    }

    s3Object.Body.pipe(res);
  } catch (err) {
    console.error('Error downloading object:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Fallback to index.html for SPA client routing
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

// Start Express Server after connecting to MongoDB
async function startServer() {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`>>> S3 Management Backend running on port ${PORT} connected to MongoDB`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
