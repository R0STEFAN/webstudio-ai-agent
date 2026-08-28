import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

function findKeyFile() {
  const files = fs.readdirSync(process.cwd());
  const keyFile = files.find(f => f.startsWith('indexing-bot-') && f.endsWith('.json'));
  if (!keyFile) {
    throw new Error('Service account key file (indexing-bot-*.json) not found in project root.');
  }
  return path.resolve(process.cwd(), keyFile);
}

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

async function getGscToken(clientEmail, privateKey) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claimSet = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/webmasters.readonly https://www.googleapis.com/auth/webmasters',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedClaim = base64url(JSON.stringify(claimSet));
  const signatureInput = `${encodedHeader}.${encodedClaim}`;

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signatureInput);
  const signature = signer.sign(privateKey, 'base64url');
  const jwt = `${signatureInput}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`Token error: ${JSON.stringify(data)}`);
  return data.access_token;
}

export async function querySearchAnalytics({ siteUrl, startDate, endDate, dimensions = ['query'], rowLimit = 25, dimensionFilterGroups }) {
  const keyPath = findKeyFile();
  const key = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
  const token = await getGscToken(key.client_email, key.private_key);

  const payload = {
    startDate,
    endDate,
    dimensions,
    rowLimit
  };
  if (dimensionFilterGroups) payload.dimensionFilterGroups = dimensionFilterGroups;

  const res = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`GSC API Error: ${JSON.stringify(data)}`);
  return data;
}

async function main() {
  const args = process.argv.slice(2);
  const keyPath = findKeyFile();
  const key = JSON.parse(fs.readFileSync(keyPath, 'utf8'));

  console.log(`🔍 Connecting to Google Search Console via ${key.client_email}...`);
  const token = await getGscToken(key.client_email, key.private_key);

  const siteUrl = args.find(a => a.startsWith('sc-domain:') || a.startsWith('http')) || 'sc-domain:tattoozp.com';

  const today = new Date();
  const endDate = new Date(today.getTime() - 3 * 86400000).toISOString().split('T')[0];
  const startDate = new Date(today.getTime() - 31 * 86400000).toISOString().split('T')[0];

  console.log(`📊 Property: ${siteUrl}`);
  console.log(`📅 Period: ${startDate} to ${endDate} (Last 28 days)\n`);

  if (args.includes('pages')) {
    const data = await querySearchAnalytics({ siteUrl, startDate, endDate, dimensions: ['page'], rowLimit: 20 });
    console.log('🏆 TOP LANDING PAGES IN GOOGLE SEARCH:');
    console.log('-----------------------------------------------------------------------------------');
    for (const r of data.rows || []) {
      console.log(`Clicks: ${String(r.clicks).padStart(3)} | Impr: ${String(r.impressions).padStart(4)} | Pos: ${r.position.toFixed(1).padStart(4)} | URL: ${r.keys[0]}`);
    }
  } else {
    const data = await querySearchAnalytics({ siteUrl, startDate, endDate, dimensions: ['query'], rowLimit: 25 });
    console.log('🏆 TOP SEARCH QUERIES IN GOOGLE:');
    console.log('-----------------------------------------------------------------------------------');
    for (const r of data.rows || []) {
      console.log(`Clicks: ${String(r.clicks).padStart(2)} | Impr: ${String(r.impressions).padStart(4)} | CTR: ${(r.ctr * 100).toFixed(1).padStart(4)}% | Pos: ${r.position.toFixed(1).padStart(4)} | Query: "${r.keys[0]}"`);
    }
  }
}

if (process.argv[1] && process.argv[1].endsWith('gsc-analytics.mjs')) {
  main().catch(e => {
    console.error('Error:', e.message);
    process.exit(1);
  });
}
