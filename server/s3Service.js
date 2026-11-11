import http from 'http';
import https from 'https';
import crypto from 'crypto';
import { 
  S3Client, 
  ListBucketsCommand, 
  CreateBucketCommand, 
  DeleteBucketCommand, 
  ListObjectsV2Command, 
  PutObjectCommand, 
  DeleteObjectCommand,
  GetObjectCommand
} from '@aws-sdk/client-s3';
import { 
  IAMClient, 
  CreateUserCommand, 
  CreateAccessKeyCommand 
} from '@aws-sdk/client-iam';

// --- Helper for Ceph Admin Ops API SigV4 Signing ---
function hmac(key, string) {
  return crypto.createHmac('sha256', key).update(string, 'utf8').digest();
}

function hash(string) {
  return crypto.createHash('sha256').update(string, 'utf8').digest('hex');
}

function getSignatureKey(key, dateStamp, regionName, serviceName) {
  const kDate = hmac('AWS4' + key, dateStamp);
  const kRegion = hmac(kDate, regionName);
  const kService = hmac(kRegion, serviceName);
  return hmac(kService, 'aws4_request');
}

function callSignedApi({ endpointUrl, accessKey, secretKey, region = 'us-east-1', method, path, queryParams = {}, body = '' }) {
  return new Promise((resolve, reject) => {
    try {
      const url = new URL(endpointUrl);
      const isHttps = url.protocol === 'https:';
      const clientModule = isHttps ? https : http;
      const hostHeader = url.port ? `${url.hostname}:${url.port}` : url.hostname;

      const sortedKeys = Object.keys(queryParams).sort();
      const queryString = sortedKeys.map(k => `${encodeURIComponent(k)}=${encodeURIComponent(queryParams[k])}`).join('&');

      const now = new Date();
      const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
      const dateStamp = amzDate.slice(0, 8);
      const payloadHash = hash(body);

      const reqHeaders = {
        'host': hostHeader,
        'x-amz-date': amzDate,
        'x-amz-content-sha256': payloadHash,
      };

      if (body) {
        reqHeaders['content-length'] = Buffer.byteLength(body);
      }

      const sortedHeaderKeys = Object.keys(reqHeaders).sort();
      const canonicalHeaders = sortedHeaderKeys.map(k => `${k.toLowerCase()}:${reqHeaders[k]}\n`).join('');
      const signedHeaders = sortedHeaderKeys.map(k => k.toLowerCase()).join(';');

      const canonicalRequest = [
        method,
        path,
        queryString,
        canonicalHeaders,
        signedHeaders,
        payloadHash
      ].join('\n');

      const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
      const stringToSign = [
        'AWS4-HMAC-SHA256',
        amzDate,
        credentialScope,
        hash(canonicalRequest)
      ].join('\n');

      const signingKey = getSignatureKey(secretKey, dateStamp, region, 's3');
      const signature = crypto.createHmac('sha256', signingKey).update(stringToSign, 'utf8').digest('hex');

      reqHeaders['Authorization'] = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

      const fullPath = queryString ? `${path}?${queryString}` : path;
      const req = clientModule.request({
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: fullPath,
        method: method,
        headers: reqHeaders,
        timeout: 10000,
      }, (res) => {
        let resBody = '';
        res.on('data', chunk => { resBody += chunk; });
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: resBody
          });
        });
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timed out connecting to S3 endpoint'));
      });

      req.on('error', reject);
      if (body) req.write(body);
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

// --- S3 Client Factory ---
export function getS3Client(endpoint, credentials) {
  const accessKeyId = credentials?.accessKey || endpoint?.accessKey;
  const secretAccessKey = credentials?.secretKey || endpoint?.secretKey;

  return new S3Client({
    endpoint: endpoint.endpointUrl,
    region: endpoint.region || 'us-east-1',
    credentials: {
      accessKeyId,
      secretAccessKey
    },
    forcePathStyle: endpoint.pathStyle !== false,
  });
}

// --- IAM Client Factory ---
export function getIAMClient(endpoint, credentials) {
  const accessKeyId = credentials?.accessKey || endpoint?.accessKey;
  const secretAccessKey = credentials?.secretKey || endpoint?.secretKey;

  return new IAMClient({
    endpoint: endpoint.endpointUrl,
    region: endpoint.region || 'us-east-1',
    credentials: {
      accessKeyId,
      secretAccessKey
    }
  });
}

// --- User Creation Service ---
export async function createS3User({ endpoint, uid, displayName, email, maxBuckets = 1000, placementId }) {
  const targetPlacement = placementId?.trim() || endpoint.placementId?.trim() || '';

  // First attempt: Ceph Admin Ops API (Standard for Ceph RadosGW)
  try {
    const queryParams = {
      uid: uid,
      'display-name': displayName || uid,
      'max-buckets': String(maxBuckets),
      format: 'json'
    };
    if (email && email.trim()) {
      queryParams.email = email.trim();
    }
    if (targetPlacement) {
      queryParams['default-placement'] = targetPlacement;
    }

    const cephRes = await callSignedApi({
      endpointUrl: endpoint.endpointUrl,
      accessKey: endpoint.accessKey,
      secretKey: endpoint.secretKey,
      region: endpoint.region || 'us-east-1',
      method: 'PUT',
      path: '/admin/user',
      queryParams
    });

    if (cephRes.statusCode === 200) {
      const data = JSON.parse(cephRes.body);
      const primaryKey = data.keys && data.keys.length > 0 ? data.keys[0] : null;
      return {
        uid: data.user_id || uid,
        displayName: data.display_name || displayName || uid,
        email: data.email || email,
        maxBuckets: data.max_buckets ?? maxBuckets,
        placementId: data.default_placement || targetPlacement,
        accessKey: primaryKey ? primaryKey.access_key : '',
        secretKey: primaryKey ? primaryKey.secret_key : '',
        source: 'ceph_admin_ops',
        raw: data
      };
    }

    if (cephRes.statusCode === 409) {
      // Check if Ceph returned EmailExists or UserAlreadyExists
      let errCode = '';
      try {
        const errJson = JSON.parse(cephRes.body);
        errCode = errJson.Code || '';
      } catch {}

      if (errCode === 'EmailExists') {
        throw new Error(`Ceph rejected user creation: An S3 account with email "${email}" already exists. Please use a unique email or leave the email field empty.`);
      }

      // User or email already exists in Ceph - update placement if requested
      if (targetPlacement) {
        try {
          await callSignedApi({
            endpointUrl: endpoint.endpointUrl,
            accessKey: endpoint.accessKey,
            secretKey: endpoint.secretKey,
            region: endpoint.region || 'us-east-1',
            method: 'POST',
            path: '/admin/user',
            queryParams: { uid, 'default-placement': targetPlacement, format: 'json' }
          });
        } catch (updateErr) {
          console.warn('Could not update default-placement on existing Ceph user:', updateErr.message);
        }
      }

      // Fetch existing Ceph user record and real keys
      const getRes = await callSignedApi({
        endpointUrl: endpoint.endpointUrl,
        accessKey: endpoint.accessKey,
        secretKey: endpoint.secretKey,
        region: endpoint.region || 'us-east-1',
        method: 'GET',
        path: '/admin/user',
        queryParams: { uid, format: 'json' }
      });
      if (getRes.statusCode === 200) {
        const data = JSON.parse(getRes.body);
        const primaryKey = data.keys && data.keys.length > 0 ? data.keys[0] : null;
        if (primaryKey) {
          return {
            uid: data.user_id || uid,
            displayName: data.display_name || displayName || uid,
            email: data.email || email,
            maxBuckets: data.max_buckets ?? maxBuckets,
            placementId: data.default_placement || targetPlacement,
            accessKey: primaryKey.access_key,
            secretKey: primaryKey.secret_key,
            source: 'ceph_admin_ops_existing',
            raw: data
          };
        }
      }
    }

    if (cephRes.statusCode === 400) {
      let errDetail = cephRes.body;
      try {
        const errJson = JSON.parse(cephRes.body);
        if (errJson.Code === 'InvalidArgument') {
          errDetail = `Placement ID "${targetPlacement}" is not recognized by the Ceph zonegroup placement targets, or an invalid parameter was provided.`;
        }
      } catch {}
      throw new Error(`Ceph Error (400 Bad Request): ${errDetail}`);
    }

    if (cephRes.statusCode === 403) {
      throw new Error(`Ceph Admin Ops AccessDenied (403): The cluster admin credentials do not have 'users=read,write' permissions.`);
    }

    console.warn(`Ceph Admin Ops returned status ${cephRes.statusCode}: ${cephRes.body}`);
  } catch (err) {
    if (endpoint.type === 'ceph' && (err.message.includes('Ceph') || err.message.includes('400') || err.message.includes('409') || err.message.includes('403'))) {
      throw err;
    }
    console.warn('Ceph Admin Ops API call failed or not supported:', err.message);
  }

  // Second attempt: AWS IAM API (for MinIO / AWS IAM supported endpoints)
  try {
    const iamClient = getIAMClient(endpoint);
    await iamClient.send(new CreateUserCommand({ UserName: uid }));
    const keyRes = await iamClient.send(new CreateAccessKeyCommand({ UserName: uid }));

    return {
      uid: uid,
      displayName: displayName || uid,
      email: email || '',
      maxBuckets: maxBuckets,
      placementId: targetPlacement,
      accessKey: keyRes.AccessKey.AccessKeyId,
      secretKey: keyRes.AccessKey.SecretAccessKey,
      source: 'aws_iam',
      raw: keyRes
    };
  } catch (err) {
    console.warn('AWS IAM Client failed:', err.message);
  }

  // Fallback: If Ceph Admin Ops / IAM is not supported or access is denied,
  // bind to the storage box's root S3 credentials if available
  if (endpoint.accessKey && endpoint.secretKey) {
    return {
      uid: uid || 'cluster-default',
      displayName: displayName || uid || endpoint.name,
      email: email || '',
      maxBuckets: maxBuckets,
      placementId: targetPlacement,
      accessKey: endpoint.accessKey,
      secretKey: endpoint.secretKey,
      source: 'endpoint_credentials',
      notes: 'Storage box default credentials'
    };
  }

  throw new Error('Unable to provision S3 user: Ceph Admin Ops rejected request (403 AccessDenied) and no storage box S3 credentials are configured.');
}

function normalizeS3Error(err, endpoint) {
  const code = err.Code || err.name || '';
  const msg = err.message || '';
  if (code === 'InvalidAccessKeyId' || msg.includes('InvalidAccessKeyId')) {
    return new Error(`Invalid S3 Access Key for "${endpoint?.name || 'cluster'}". Please verify the cluster credentials.`);
  }
  if (code === 'SignatureDoesNotMatch' || msg.includes('SignatureDoesNotMatch')) {
    return new Error(`S3 Secret Key signature mismatch for "${endpoint?.name || 'cluster'}".`);
  }
  if (code === 'AccessDenied' || msg.includes('AccessDenied')) {
    return new Error(`Access Denied on "${endpoint?.name || 'cluster'}". Permission insufficient.`);
  }
  if (msg === 'UnknownError' && code) {
    return new Error(`${code} on ${endpoint?.name || 'S3 cluster'}`);
  }
  return err;
}

// --- Bucket Operations ---
export async function listBuckets({ endpoint, credentials }) {
  try {
    const client = getS3Client(endpoint, credentials);
    const command = new ListBucketsCommand({});
    const response = await client.send(command);
    return {
      owner: response.Owner ? { id: response.Owner.ID, displayName: response.Owner.DisplayName } : null,
      buckets: (response.Buckets || []).map(b => ({
        name: b.Name,
        creationDate: b.CreationDate
      }))
    };
  } catch (err) {
    throw normalizeS3Error(err, endpoint);
  }
}

export async function createBucket({ endpoint, credentials, bucketName }) {
  try {
    const client = getS3Client(endpoint, credentials);
    const command = new CreateBucketCommand({
      Bucket: bucketName
    });
    const res = await client.send(command);
    return { success: true, bucketName, location: res.Location };
  } catch (err) {
    throw normalizeS3Error(err, endpoint);
  }
}

export async function deleteBucket({ endpoint, credentials, bucketName }) {
  try {
    const client = getS3Client(endpoint, credentials);
    const command = new DeleteBucketCommand({
      Bucket: bucketName
    });
    await client.send(command);
    return { success: true, bucketName };
  } catch (err) {
    throw normalizeS3Error(err, endpoint);
  }
}

// --- Object Operations ---
export async function listObjects({ endpoint, credentials, bucketName, prefix = '', maxKeys = 100 }) {
  try {
    const client = getS3Client(endpoint, credentials);
    const command = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: prefix,
      MaxKeys: maxKeys
    });
    const response = await client.send(command);
    return {
      bucket: bucketName,
      keyCount: response.KeyCount || 0,
      isTruncated: response.IsTruncated,
      objects: (response.Contents || []).map(o => ({
        key: o.Key,
        size: o.Size,
        lastModified: o.LastModified,
        etag: o.ETag?.replace(/"/g, ''),
        storageClass: o.StorageClass
      }))
    };
  } catch (err) {
    throw normalizeS3Error(err, endpoint);
  }
}

export async function putObject({ endpoint, credentials, bucketName, key, body, contentType = 'application/octet-stream' }) {
  try {
    const client = getS3Client(endpoint, credentials);
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: body,
      ContentType: contentType
    });
    const res = await client.send(command);
    return { success: true, key, etag: res.ETag };
  } catch (err) {
    throw normalizeS3Error(err, endpoint);
  }
}

export async function deleteObject({ endpoint, credentials, bucketName, key }) {
  try {
    const client = getS3Client(endpoint, credentials);
    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key
    });
    await client.send(command);
    return { success: true, key };
  } catch (err) {
    throw normalizeS3Error(err, endpoint);
  }
}

export async function getObject({ endpoint, credentials, bucketName, key }) {
  try {
    const client = getS3Client(endpoint, credentials);
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key
    });
    return await client.send(command);
  } catch (err) {
    throw normalizeS3Error(err, endpoint);
  }
}

// --- Endpoint Connectivity Test ---
export async function testEndpoint(endpoint) {
  const startTime = Date.now();
  try {
    const url = new URL(endpoint.endpointUrl);
    const isHttps = url.protocol === 'https:';
    const clientModule = isHttps ? https : http;

    return await new Promise((resolve) => {
      const req = clientModule.request({
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: '/',
        method: 'GET',
        timeout: 5000,
      }, (res) => {
        const latency = Date.now() - startTime;
        let serverType = res.headers['server'] || 'Unknown S3 Gateway';
        let isCeph = serverType.toLowerCase().includes('ceph');
        resolve({
          reachable: true,
          statusCode: res.statusCode,
          latencyMs: latency,
          serverHeader: serverType,
          isCeph,
          statusText: 'Online'
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          reachable: false,
          latencyMs: Date.now() - startTime,
          error: 'Connection timed out',
          statusText: 'Timeout'
        });
      });

      req.on('error', (err) => {
        resolve({
          reachable: false,
          latencyMs: Date.now() - startTime,
          error: err.message,
          statusText: 'Offline'
        });
      });

      req.end();
    });
  } catch (err) {
    return {
      reachable: false,
      latencyMs: Date.now() - startTime,
      error: err.message,
      statusText: 'Invalid URL'
    };
  }
}
