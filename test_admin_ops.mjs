import http from 'http';
import crypto from 'crypto';

const ACCESS_KEY = 'QN2BSI9IFCTFYE61DGNV';
const SECRET_KEY = 'KC427Xv1RvCXnBOoAMaAQJe7fqQrG29pAwDatbB9';
const HOST = '10.40.11.155';
const PORT = 8000;
const REGION = 'us-east-1';

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

export function sendAdminSigned(method, path, queryParams = {}) {
    return new Promise((resolve, reject) => {
        const sortedKeys = Object.keys(queryParams).sort();
        const queryString = sortedKeys.map(k => `${encodeURIComponent(k)}=${encodeURIComponent(queryParams[k])}`).join('&');

        const now = new Date();
        const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
        const dateStamp = amzDate.slice(0, 8);
        const payloadHash = hash('');

        const reqHeaders = {
            'host': `${HOST}:${PORT}`,
            'x-amz-date': amzDate,
            'x-amz-content-sha256': payloadHash,
        };

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

        const credentialScope = `${dateStamp}/${REGION}/s3/aws4_request`;
        const stringToSign = [
            'AWS4-HMAC-SHA256',
            amzDate,
            credentialScope,
            hash(canonicalRequest)
        ].join('\n');

        const signingKey = getSignatureKey(SECRET_KEY, dateStamp, REGION, 's3');
        const signature = crypto.createHmac('sha256', signingKey).update(stringToSign, 'utf8').digest('hex');

        reqHeaders['Authorization'] = `AWS4-HMAC-SHA256 Credential=${ACCESS_KEY}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

        const fullPath = queryString ? `${path}?${queryString}` : path;
        const req = http.request({
            hostname: HOST,
            port: PORT,
            path: fullPath,
            method: method,
            headers: reqHeaders,
        }, (res) => {
            let body = '';
            res.on('data', chunk => { body += chunk; });
            res.on('end', () => {
                resolve({ statusCode: res.statusCode, body });
            });
        });

        req.on('error', reject);
        req.end();
    });
}

async function test() {
    console.log('Testing GET /admin/user for reseller-wallpine:');
    let res = await sendAdminSigned('GET', '/admin/user', { uid: 'reseller-wallpine', format: 'json' });
    console.log('GET status:', res.statusCode);
    console.log('GET body:', res.body);

    const testUser = `test-user-${Date.now()}`;
    console.log(`\nTesting PUT /admin/user to create user ${testUser}:`);
    res = await sendAdminSigned('PUT', '/admin/user', {
        uid: testUser,
        'display-name': `Test User ${testUser}`,
        format: 'json'
    });
    console.log('PUT status:', res.statusCode);
    console.log('PUT body:', res.body);

    if (res.statusCode === 200) {
        console.log(`\nTesting DELETE /admin/user for ${testUser}:`);
        res = await sendAdminSigned('DELETE', '/admin/user', { uid: testUser, 'purge-data': 'true', format: 'json' });
        console.log('DELETE status:', res.statusCode);
    }
}

test().catch(console.error);
