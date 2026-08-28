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

async function getAccessToken(clientEmail, privateKey) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claimSet = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/indexing',
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
  if (!res.ok) {
    throw new Error(`Token error: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

export async function pushUrl(url, accessToken, type = 'URL_UPDATED') {
  const res = await fetch('https://indexing.googleapis.com/v3/urlNotifications:publish', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({ url, type })
  });
  const data = await res.json();
  return { status: res.status, ok: res.ok, data };
}

async function fetchSitemapUrls(sitemapUrl) {
  const res = await fetch(sitemapUrl);
  if (!res.ok) throw new Error(`Failed to fetch sitemap: ${res.statusText}`);
  const xml = await res.text();
  const urls = [];
  const locRegex = /<loc>(https?:\/\/[^<]+)<\/loc>/g;
  let match;
  while ((match = locRegex.exec(xml)) !== null) {
    urls.push(match[1]);
  }
  return urls;
}

async function main() {
  const args = process.argv.slice(2);
  const keyPath = findKeyFile();
  const key = JSON.parse(fs.readFileSync(keyPath, 'utf8'));

  console.log(`🤖 Google Indexing Bot: ${key.client_email}`);
  console.log('🔑 Authenticating with Google Cloud...');
  const token = await getAccessToken(key.client_email, key.private_key);
  console.log('✅ Authenticated successfully!\n');

  if (args.includes('--sitemap') || args.length === 0) {
    const sitemapUrl = args.find(a => a.startsWith('http') && a.includes('sitemap')) || 'https://tattoozp.com/sitemap.xml';
    console.log(`🗺️ Fetching URLs from sitemap: ${sitemapUrl}...`);
    try {
      const urls = await fetchSitemapUrls(sitemapUrl);
      console.log(`Found ${urls.length} URLs in sitemap.`);
      console.log('🚀 Pushing URLs to Google Indexing API...\n');

      let success = 0;
      let failed = 0;
      for (let i = 0; i < urls.length; i++) {
        const u = urls[i];
        process.stdout.write(`[${i + 1}/${urls.length}] Pushing: ${u} ... `);
        const res = await pushUrl(u, token);
        if (res.ok) {
          process.stdout.write('✅ OK\n');
          success++;
        } else {
          process.stdout.write(`❌ Error: ${JSON.stringify(res.data)}\n`);
          failed++;
        }
        // Small rate limit delay (100ms)
        await new Promise(r => setTimeout(r, 100));
      }
      console.log(`\n🎉 Finished: ${success} URLs submitted successfully to Googlebot (${failed} failed).`);
    } catch (e) {
      console.error('Error processing sitemap:', e.message);
    }
  } else {
    // Single or multiple specific URLs passed as arguments
    for (const u of args) {
      if (!u.startsWith('http')) continue;
      console.log(`🚀 Pushing URL: ${u}...`);
      const res = await pushUrl(u, token);
      if (res.ok) {
        console.log(`✅ Success! Googlebot received signal URL_UPDATED for ${u}`);
      } else {
        console.error(`❌ Failed:`, res.data);
      }
    }
  }
}

if (process.argv[1] && process.argv[1].endsWith('google-index.mjs')) {
  main().catch(err => {
    console.error('Fatal error:', err.message);
    process.exit(1);
  });
}
