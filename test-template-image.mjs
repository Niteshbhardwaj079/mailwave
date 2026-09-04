// "Apna HTML code daalo, image upload karo, uska URL template me lagao —
//  aur wo email me sach me dikhe."
//
// Yahi poora raasta jaancha jata hai, shuru se aakhir tak:
//   1. image upload karo
//   2. uska URL BINA LOGIN khulta hai (Gmail ka server aise hi kholta hai)
//   3. apna HTML template me save karo — waisa ka waisa bacha rahe
//   4. us template se campaign bhejo
//   5. JO EMAIL GAYA usme wahi image link ho, aur wo khulta ho
//
// Point 5 sabse zaroori hai. App ke andar preview theek dikhna kaafi nahi —
// asli sawaal yeh hai ki recipient ko image dikhi ya nahi.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const API = 'http://localhost:4000';
const BASE = 'http://localhost:5174';
const results = [];

function check(name, ok, extra = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -- ' + extra : ''}`);
}

let token = null;

async function apiCall(method, p, body) {
  const res = await fetch(API + p, {
    method,
    headers: {
      Origin: BASE,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* no body */
  }
  return { status: res.status, data };
}

const login = await apiCall('POST', '/api/auth/login', {
  email: 'rohit@gowebkart.com',
  password: 'mailwave',
});
token = login.data?.accessToken;
check('login', login.status === 200);

// --- 1. image upload -------------------------------------------------------
// Ek asli 1x1 PNG.
const png =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const uploaded = await apiCall('POST', '/api/images', {
  name: 'logo-test.png',
  url: png,
  source: 'upload',
});
const imageUrl = uploaded.data?.image?.url;
const imageId = uploaded.data?.image?.id;

check('image upload ho gayi', uploaded.status === 201, imageUrl);
check('URL asli http link hai (data: nahi)', /^https?:\/\//.test(imageUrl ?? ''),
  (imageUrl ?? '').slice(0, 45));

// --- 2. bina login khulti hai? --------------------------------------------
// Gmail/Outlook ka server login nahi kar sakta. Agar yahan login maanga gaya
// to har recipient ko tooti hui image dikhegi.
const open = await fetch(imageUrl);
const bytes = await open.arrayBuffer();

check('image BINA LOGIN khul gayi', open.status === 200, `status ${open.status}`);
check('asli PNG aayi', open.headers.get('content-type') === 'image/png' && bytes.byteLength > 0,
  `${open.headers.get('content-type')}, ${bytes.byteLength} bytes`);

// --- 3. apna HTML template me save ----------------------------------------
// Jaan-boojh kar aisi cheezein daali hain jo aksar bigad jati hain: comment,
// style, table, merge variable, aur upload ki hui image.
const myHtml = `<!-- mera apna code -->
<table width="100%" style="background:#f5f5f5">
  <tr><td align="center" style="padding:24px">
    <img src="${imageUrl}" width="120" alt="Logo" />
    <h1 style="font-family:Arial;color:#111">Namaste {{name}}</h1>
    <p style="font-family:Arial">Yeh {{company}} ki taraf se hai.</p>
    <a href="https://gowebkart.in" style="color:#4f46e5">Website dekho</a>
  </td></tr>
</table>`;

const saved = await apiCall('POST', '/api/templates', {
  name: `Mera Template ${Date.now()}`,
  category: 'Custom',
  subject: 'Hello {{name}}',
  html: myHtml,
});
const templateId = saved.data?.template?.id;

check('apna template save ho gaya', saved.status === 201, saved.data?.error?.message);
check('HTML bilkul waisa ka waisa bacha', saved.data?.template?.html === myHtml,
  saved.data?.template?.html === myHtml ? 'ek akshar nahi badla' : 'BADAL GAYA');

// Dobara padhne par bhi wahi mile — beech me kuch saaf to nahi ho gaya.
const reread = await apiCall('GET', `/api/templates/${templateId}`);
check('dobara kholne par bhi wahi HTML', reread.data?.template?.html === myHtml);
check('comment aur style bache hain',
  (reread.data?.template?.html ?? '').includes('<!-- mera apna code -->') &&
    (reread.data?.template?.html ?? '').includes('background:#f5f5f5'));

// --- 4. is template se campaign bhejo -------------------------------------
const account = (await apiCall('GET', '/api/accounts')).data?.accounts?.[0];

const campaign = await apiCall('POST', '/api/campaigns', {
  name: `Image Test ${Date.now()}`,
  accountId: account.id,
  subject: 'Hello {{name}}',
  templateId,
  html: myHtml,
  batchSize: 100,
  batchDelay: 0,
  clickTracking: true, // link tracking chalu — dekhte hain image bigadti to nahi
});
const campaignId = campaign.data?.campaign?.id;

await apiCall('POST', `/api/campaigns/${campaignId}/recipients`, { source: 'all' });

const logBefore = (await fs.readFile(path.join(os.tmpdir(), 'mw-server.log'), 'utf8')).length;
await apiCall('POST', `/api/campaigns/${campaignId}/send`);

// Bhejne ka intezaar
let done = null;
for (let i = 0; i < 30; i += 1) {
  await new Promise((r) => setTimeout(r, 2000));
  done = (await apiCall('GET', `/api/campaigns/${campaignId}`)).data?.campaign;
  if (done && done.sent + done.failed >= done.recipients) break;
}

check('campaign chali gayi', (done?.sent ?? 0) > 0, `${done?.sent} bheje, ${done?.failed} fail`);

// --- 5. JO EMAIL GAYA usme kya hai? ---------------------------------------
const log = (await fs.readFile(path.join(os.tmpdir(), 'mw-server.log'), 'utf8')).slice(logBefore);
const previewUrl = [...log.matchAll(/https:\/\/ethereal\.email\/message\/[A-Za-z0-9_.-]+/g)].at(-1)?.[0];

check('bheja hua email padhne ko mila', Boolean(previewUrl), previewUrl ? 'mila' : 'nahi mila');

if (previewUrl) {
  const raw = await (await fetch(`${previewUrl}/message.eml`)).text();
  const clean = raw
    .replace(/<\/?span[^>]*>/g, '')
    .replace(/=\r?\n/g, '')
    .replace(/=([0-9A-Fa-f]{2})/g, (m, hex) => String.fromCharCode(parseInt(hex, 16)));

  check('email me wahi image link gaya', clean.includes(imageUrl), imageUrl);
  check('email me "data:" wali image NAHI gayi', !clean.includes('data:image/'),
    'warna Gmail use block kar deta');

  // Merge variable bhare ya nahi
  check('{{name}} asli naam se badla', !clean.includes('{{name}}'));
  check('{{company}} bhi bhara gaya', !clean.includes('{{company}}'));

  // Mera style aur table bacha?
  check('mera apna style email me pahuncha', clean.includes('background:#f5f5f5'));

  // Click tracking se image ka link bigda to nahi
  const imgTag = clean.match(/<img[^>]*src="([^"]+)"[^>]*width="120"/);
  check('click tracking ne image ka link nahi bigada', imgTag?.[1] === imageUrl,
    imgTag?.[1]?.slice(0, 50) ?? 'img tag nahi mila');
}

// --- safai ------------------------------------------------------------------
await apiCall('POST', `/api/campaigns/${campaignId}/pause`);
await apiCall('DELETE', `/api/campaigns/${campaignId}`);
await apiCall('DELETE', `/api/templates/${templateId}`);
await apiCall('DELETE', `/api/images/${imageId}`);

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} pass`);
if (failed.length) console.log('Fail:', failed.map((f) => f.name).join(', '));
process.exit(failed.length ? 1 : 0);
