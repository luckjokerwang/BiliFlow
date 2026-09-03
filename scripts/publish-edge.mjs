import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Read version from package.json
const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8'));
const version = pkg.version;

// Read API credentials from environment variables
const productId = process.env.EDGE_PRODUCT_ID;
const clientId = process.env.EDGE_CLIENT_ID;
const apiKey = process.env.EDGE_API_KEY;

if (!productId || !clientId || !apiKey) {
  console.error('❌ [Edge Publish] Missing required environment variables:');
  if (!productId) console.error('  - EDGE_PRODUCT_ID is missing');
  if (!clientId) console.error('  - EDGE_CLIENT_ID is missing');
  if (!apiKey) console.error('  - EDGE_API_KEY is missing');
  process.exit(1);
}

// Locate zip artifact in .output
const zipName = `biliflow-${version}-chrome.zip`;
let zipPath = path.join(rootDir, '.output', zipName);

if (!fs.existsSync(zipPath)) {
  // Fallback: search any *-chrome.zip in .output
  const outputDir = path.join(rootDir, '.output');
  if (fs.existsSync(outputDir)) {
    const candidate = fs.readdirSync(outputDir).find((f) => f.endsWith('-chrome.zip'));
    if (candidate) {
      zipPath = path.join(outputDir, candidate);
    }
  }
}

if (!fs.existsSync(zipPath)) {
  console.error(`❌ [Edge Publish] Package zip file not found at: ${zipPath}`);
  console.error('Please make sure "npm run zip" ran successfully beforehand.');
  process.exit(1);
}

const BASE_URL = 'https://api.addons.microsoftedge.microsoft.com/v1';
const headers = {
  Authorization: `ApiKey ${apiKey}`,
  'X-ClientID': clientId,
};

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function publishToEdge() {
  console.log(`🚀 [Edge Publish] Starting automated release for BiliFlow v${version}...`);
  console.log(`📦 Package: ${zipPath} (${(fs.statSync(zipPath).size / 1024).toFixed(1)} KB)`);
  console.log(`🎯 Product ID: ${productId}`);

  // Step 1: Upload package to draft
  console.log('\n⏳ Step 1: Uploading package to Microsoft Edge Add-ons draft...');
  const uploadUrl = `${BASE_URL}/products/${productId}/submissions/draft/package`;
  const fileBuffer = fs.readFileSync(zipPath);

  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/zip',
    },
    body: fileBuffer,
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`Upload package failed (HTTP ${uploadRes.status}): ${errText}`);
  }

  const operationLocation = uploadRes.headers.get('Location');
  const operationId = uploadRes.headers.get('Operation-ID');
  console.log('✅ Upload initiated successfully!');
  console.log(`   Operation tracking URL: ${operationLocation || operationId}`);

  const opId = (operationLocation && !operationLocation.startsWith('http')) ? operationLocation : (operationId || operationLocation);
  const checkStatusUrl = (operationLocation && operationLocation.startsWith('http'))
    ? operationLocation
    : `${uploadUrl}/operations/${opId}`;
  console.log(`   Status polling endpoint: ${checkStatusUrl}`);
  const maxAttempts = 30; // 30 * 6s = 3 minutes max
  let isVerified = false;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await sleep(6000);
    const statusRes = await fetch(checkStatusUrl, { headers });
    if (!statusRes.ok) {
      console.warn(`   [Attempt ${attempt}/${maxAttempts}] Checking status returned HTTP ${statusRes.status}, retrying...`);
      continue;
    }

    const statusData = await statusRes.json();
    console.log(`   [Attempt ${attempt}/${maxAttempts}] Current Status: ${statusData.status}`);

    if (statusData.status === 'Succeeded') {
      isVerified = true;
      console.log('✅ Package verification completed successfully!');
      break;
    } else if (statusData.status === 'Failed') {
      throw new Error(`Package verification failed: ${JSON.stringify(statusData.errors || statusData.message)}`);
    }
  }

  if (!isVerified) {
    throw new Error('Package verification timed out after 3 minutes. Please check Microsoft Partner Center manually.');
  }

  // Step 3: Publish the submission
  console.log('\n⏳ Step 3: Submitting new version for certification review...');
  const publishUrl = `${BASE_URL}/products/${productId}/submissions`;
  const publishRes = await fetch(publishUrl, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      notes: `Automated release v${version} triggered by GitHub Actions. All tests passed.`,
    }),
  });

  if (!publishRes.ok) {
    const errText = await publishRes.text();
    throw new Error(`Submission publish failed (HTTP ${publishRes.status}): ${errText}`);
  }

  console.log('\n🎉 [Edge Publish] SUCCESS! BiliFlow v' + version + ' has been successfully submitted to Microsoft Edge Add-ons for certification review!');
  console.log('🌐 Track status at: https://partner.microsoft.com/dashboard/microsoftedge/' + productId + '/packages/dashboard');
}

publishToEdge().catch((err) => {
  console.error('\n❌ [Edge Publish] Release failed:', err.message);
  process.exit(1);
});
