import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/s3_cloud_commander';

// --- Schemas ---

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  name: { type: String, trim: true },
  role: { type: String, enum: ['admin', 'user'], default: 'user' },
  createdAt: { type: Date, default: Date.now }
});

const endpointSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  adminName: { type: String, default: '' },
  clientName: { type: String, default: '' },
  country: { type: String, default: '' },
  countryCode: { type: String, default: '' },
  countryFlag: { type: String, default: '' },
  endpointUrl: { type: String, required: true },
  region: { type: String, default: 'us-east-1' },
  accessKey: { type: String, default: '' },
  secretKey: { type: String, default: '' },
  type: { type: String, enum: ['ceph', 'aws', 'minio', 'generic'], default: 'ceph' },
  pathStyle: { type: Boolean, default: true },
  placementId: { type: String, default: '' },
  description: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

const s3UserRecordSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  uid: { type: String, required: true },
  displayName: { type: String },
  email: { type: String, default: '' },
  maxBuckets: { type: Number, default: 1000 },
  placementId: { type: String, default: '' },
  accessKey: { type: String, default: '' },
  secretKey: { type: String, default: '' },
  endpointId: { type: String, required: true },
  endpointName: { type: String },
  endpointUrl: { type: String },
  source: { type: String, default: 'ceph_admin_ops' },
  ownerEmail: { type: String, required: true, lowercase: true, trim: true, index: true },
  ownerUserId: { type: String, index: true },
  createdAt: { type: Date, default: Date.now }
});

const bucketRecordSchema = new mongoose.Schema({
  bucketName: { type: String, required: true },
  endpointId: { type: String, required: true },
  ownerEmail: { type: String, required: true, lowercase: true, trim: true, index: true },
  ownerUserId: { type: String, index: true },
  creatorUid: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});
bucketRecordSchema.index({ bucketName: 1, endpointId: 1 }, { unique: true });

export const User = mongoose.model('User', userSchema);
export const Endpoint = mongoose.model('Endpoint', endpointSchema);
export const S3UserRecord = mongoose.model('S3UserRecord', s3UserRecordSchema);
export const BucketRecord = mongoose.model('BucketRecord', bucketRecordSchema);

// --- Connect & Seed MongoDB ---
export async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log(`>>> Connected to MongoDB at ${MONGODB_URI}`);

    // Note: User accounts are created via real registration.
    // The very first registered user automatically becomes the Administrator.

    // Seed Default Storage Endpoint if not exist
    const endpointCount = await Endpoint.countDocuments({ id: 'box-ceph-155' });
    if (endpointCount === 0) {
      await Endpoint.create({
        id: 'box-ceph-155',
        name: 'Storage Cluster (Node 155)',
        adminName: 'Storage Cluster (Node 155)',
        clientName: 'US East Primary Storage',
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
        description: 'Production Storage Cluster with S3 Admin Ops enabled'
      });
      console.log('>>> Seeded initial MongoDB Storage Cluster Box (10.40.11.155:8000)');
    } else {
      // Ensure box-ceph-155 has default placementId if not set
      await Endpoint.updateOne(
        { id: 'box-ceph-155', $or: [{ placementId: { $exists: false } }, { placementId: '' }] },
        { $set: { placementId: 'wallpineresellerrealmplace' } }
      );
    }

    return true;
  } catch (err) {
    console.error('>>> MongoDB connection error:', err.message);
    throw err;
  }
}
