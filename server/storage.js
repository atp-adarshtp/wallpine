import bcrypt from 'bcryptjs';
import { User, Endpoint, S3UserRecord, BucketRecord } from './db.js';

// ==========================================
// 1. ENDPOINTS (STORAGE BOXES) VIA MONGODB
// ==========================================

export async function getEndpoints() {
  try {
    const endpoints = await Endpoint.find().lean();
    return endpoints.map(e => ({
      ...e,
      id: e.id || e._id.toString()
    }));
  } catch (err) {
    console.error('Error fetching endpoints from MongoDB:', err);
    return [];
  }
}

export async function getEndpointById(id) {
  try {
    const ep = await Endpoint.findOne({ id }).lean();
    return ep;
  } catch (err) {
    console.error(`Error fetching endpoint ${id}:`, err);
    return null;
  }
}

export async function saveEndpoint(endpointData) {
  try {
    const id = endpointData.id || `box-${Date.now()}`;
    const updated = await Endpoint.findOneAndUpdate(
      { id },
      { ...endpointData, id },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    ).lean();
    return await getEndpoints();
  } catch (err) {
    console.error('Error saving endpoint to MongoDB:', err);
    throw err;
  }
}

export async function deleteEndpoint(id) {
  try {
    await Endpoint.deleteOne({ id });
    return await getEndpoints();
  } catch (err) {
    console.error(`Error deleting endpoint ${id} from MongoDB:`, err);
    throw err;
  }
}

// ==========================================
// 2. PROVISIONED S3 USERS VIA MONGODB
// ==========================================

export async function getSavedUsers(endpointId = null, ownerEmail = null) {
  try {
    const filter = {};
    if (endpointId) filter.endpointId = endpointId;
    if (ownerEmail) filter.ownerEmail = ownerEmail.toLowerCase().trim();
    const users = await S3UserRecord.find(filter).sort({ createdAt: -1 }).lean();
    return users.map(u => ({ ...u, id: u.id || u._id.toString() }));
  } catch (err) {
    console.error('Error fetching S3 users from MongoDB:', err);
    return [];
  }
}

export async function saveUser(userData) {
  try {
    const id = userData.id || `user-${Date.now()}`;
    const cleanOwnerEmail = (userData.ownerEmail || '').toLowerCase().trim();
    await S3UserRecord.findOneAndUpdate(
      { uid: userData.uid, endpointId: userData.endpointId, ownerEmail: cleanOwnerEmail },
      { ...userData, id, ownerEmail: cleanOwnerEmail },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return await getSavedUsers(userData.endpointId, cleanOwnerEmail);
  } catch (err) {
    console.error('Error saving S3 user record to MongoDB:', err);
    throw err;
  }
}

export async function deleteSavedUser(id, ownerEmail = null) {
  try {
    const filter = { $or: [{ id }, { uid: id }] };
    if (ownerEmail) filter.ownerEmail = ownerEmail.toLowerCase().trim();
    await S3UserRecord.deleteOne(filter);
    return await getSavedUsers(null, ownerEmail);
  } catch (err) {
    console.error(`Error deleting S3 user ${id} from MongoDB:`, err);
    throw err;
  }
}

// ==========================================
// 3. AUTH USERS VIA MONGODB
// ==========================================

export async function getAuthUsers() {
  try {
    const users = await User.find().lean();
    return users.map(u => ({ ...u, id: u._id.toString() }));
  } catch (err) {
    console.error('Error fetching auth users from MongoDB:', err);
    return [];
  }
}

export async function findAuthUserByEmail(email) {
  try {
    if (!email) return null;
    const user = await User.findOne({ email: email.toLowerCase().trim() }).lean();
    if (!user) return null;
    return { ...user, id: user._id.toString() };
  } catch (err) {
    console.error(`Error finding user by email ${email} in MongoDB:`, err);
    return null;
  }
}

export async function verifyUserPassword(plainPassword, hashedPassword) {
  try {
    if (!plainPassword || !hashedPassword) return false;
    return await bcrypt.compare(plainPassword, hashedPassword);
  } catch (err) {
    console.error('Error verifying password:', err);
    return false;
  }
}

export async function findAuthUserById(id) {
  try {
    if (!id) return null;
    const user = await User.findById(id).lean();
    if (!user) return null;
    return { ...user, id: user._id.toString() };
  } catch (err) {
    console.error(`Error finding user by ID ${id} in MongoDB:`, err);
    return null;
  }
}

export async function getUserCount() {
  try {
    return await User.countDocuments();
  } catch (err) {
    console.error('Error counting users in MongoDB:', err);
    return 0;
  }
}

export async function getAllAuthUsers() {
  try {
    const users = await User.find({}, { password: 0 }).sort({ createdAt: -1 }).lean();
    return users.map(u => ({ ...u, id: u._id.toString() }));
  } catch (err) {
    console.error('Error fetching all auth users:', err);
    return [];
  }
}

export async function updateUserRole(userId, newRole) {
  try {
    const user = await User.findByIdAndUpdate(
      userId,
      { role: newRole },
      { new: true, select: '-password' }
    ).lean();
    if (!user) return null;
    return { ...user, id: user._id.toString() };
  } catch (err) {
    console.error(`Error updating role for user ${userId}:`, err);
    throw err;
  }
}

export async function deleteAuthUserById(userId) {
  try {
    const result = await User.findByIdAndDelete(userId);
    return !!result;
  } catch (err) {
    console.error(`Error deleting user ${userId}:`, err);
    throw err;
  }
}

export async function saveAuthUser({ email, password, name, role = 'user' }) {
  try {
    const cleanEmail = email.toLowerCase().trim();
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.findOneAndUpdate(
      { email: cleanEmail },
      {
        email: cleanEmail,
        password: hashedPassword,
        name: name || cleanEmail.split('@')[0],
        role: role === 'admin' ? 'admin' : 'user'
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    return { ...user, id: user._id.toString() };
  } catch (err) {
    console.error('Error saving auth user in MongoDB:', err);
    throw err;
  }
}

// ==========================================
// 4. BUCKET OWNERSHIP VIA MONGODB
// ==========================================

export async function getBucketsByOwner(endpointId, ownerEmail = null) {
  try {
    const filter = { endpointId };
    if (ownerEmail) {
      filter.ownerEmail = ownerEmail.toLowerCase().trim();
    }
    return await BucketRecord.find(filter).lean();
  } catch (err) {
    console.error('Error fetching buckets by owner:', err);
    return [];
  }
}

export async function saveBucketRecord({ bucketName, endpointId, ownerEmail, ownerUserId, creatorUid }) {
  try {
    const cleanEmail = (ownerEmail || '').toLowerCase().trim();
    const cleanBucket = (bucketName || '').toLowerCase().trim();
    return await BucketRecord.findOneAndUpdate(
      { bucketName: cleanBucket, endpointId },
      {
        bucketName: cleanBucket,
        endpointId,
        ownerEmail: cleanEmail,
        ownerUserId,
        creatorUid: creatorUid || '',
        createdAt: new Date()
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    ).lean();
  } catch (err) {
    console.error('Error saving bucket record:', err);
    throw err;
  }
}

export async function deleteBucketRecord(bucketName, endpointId, ownerEmail = null) {
  try {
    const filter = { bucketName: bucketName.toLowerCase().trim(), endpointId };
    if (ownerEmail) {
      filter.ownerEmail = ownerEmail.toLowerCase().trim();
    }
    await BucketRecord.deleteOne(filter);
    return true;
  } catch (err) {
    console.error('Error deleting bucket record:', err);
    throw err;
  }
}

export async function checkBucketOwnership(bucketName, endpointId, user) {
  try {
    // Admins have universal management access
    if (user.role === 'admin') return true;
    const cleanBucket = (bucketName || '').toLowerCase().trim();
    const cleanEmail = (user.email || '').toLowerCase().trim();
    const record = await BucketRecord.findOne({
      bucketName: cleanBucket,
      endpointId,
      ownerEmail: cleanEmail
    }).lean();
    return !!record;
  } catch (err) {
    console.error('Error checking bucket ownership:', err);
    return false;
  }
}

