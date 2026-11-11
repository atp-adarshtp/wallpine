import http from 'http';
import crypto from 'crypto';

const ACCESS_KEY = 'QN2BSI9IFCTFYE61DGNV';
const SECRET_KEY = 'KC427Xv1RvCXnBOoAMaAQJe7fqQrG29pAwDatbB9';
const HOST = '10.40.11.155';
const PORT = 8000;
const REGION = 'us-east-1'; // standard default for ceph unless configured otherwise
const SERVICE = 's3';

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
    const kSigning = hmac(kService, 'aws4_request');
    return kSigning;
}

function signRequest({ method, path, headers = {}, body = '' }) {
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);

    const payloadHash = hash(body);

    const reqHeaders = {
        ...headers,
        'host': `${HOST}:${PORT}`,
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
        '', // query string
        canonicalHeaders,
        signedHeaders,
        payloadHash
    ].join('\n');

    const credentialScope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;
    const stringToSign = [
        'AWS4-HMAC-SHA256',
        amzDate,
        credentialScope,
        hash(canonicalRequest)
    ].join('\n');

    const signingKey = getSignatureKey(SECRET_KEY, dateStamp, REGION, SERVICE);
    const signature = crypto.createHmac('sha256', signingKey).update(stringToSign, 'utf8').digest('hex');

    reqHeaders['Authorization'] = `AWS4-HMAC-SHA256 Credential=${ACCESS_KEY}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    return { reqHeaders, body };
}

function sendRequest(method, path, body = '', headers = {}) {
    return new Promise((resolve, reject) => {
        const { reqHeaders } = signRequest({ method, path, headers, body });

        const options = {
            hostname: HOST,
            port: PORT,
            path: path,
            method: method,
            headers: reqHeaders,
        };

        const req = http.request(options, (res) => {
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

        req.on('error', (e) => reject(e));
        if (body) {
            req.write(body);
        }
        req.end();
    });
}

async function runTests() {
    console.log('--- 1. Testing ListBuckets with AWS SigV4 ---');
    let res = await sendRequest('GET', '/');
    console.log('Status:', res.statusCode);
    console.log('Body:', res.body);

    const testBucket = `test-verify-${Date.now()}`;
    console.log(`\n--- 2. Testing CreateBucket (/${testBucket}) ---`);
    res = await sendRequest('PUT', `/${testBucket}`);
    console.log('Status:', res.statusCode);
    console.log('Body:', res.body);

    if (res.statusCode >= 200 && res.statusCode < 300) {
        console.log(`\n--- 3. Testing PutObject (/${testBucket}/hello.txt) ---`);
        res = await sendRequest('PUT', `/${testBucket}/hello.txt`, 'Hello from Ceph S3 verification test!', { 'content-type': 'text/plain' });
        console.log('Status:', res.statusCode);
        console.log('Body:', res.body);

        console.log(`\n--- 4. Testing GetObject (/${testBucket}/hello.txt) ---`);
        res = await sendRequest('GET', `/${testBucket}/hello.txt`);
        console.log('Status:', res.statusCode);
        console.log('Body:', res.body);

        console.log(`\n--- 5. Testing DeleteObject (/${testBucket}/hello.txt) ---`);
        res = await sendRequest('DELETE', `/${testBucket}/hello.txt`);
        console.log('Status:', res.statusCode);

        console.log(`\n--- 6. Testing DeleteBucket (/${testBucket}) ---`);
        res = await sendRequest('DELETE', `/${testBucket}`);
        console.log('Status:', res.statusCode);
    }
}

runTests().catch(err => console.error('Error:', err));