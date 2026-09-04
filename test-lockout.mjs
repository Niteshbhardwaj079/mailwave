// Password guess karne wale ko rokna — bina asli logon ko roke.
//
// Yeh office ke liye khaas zaroori hai: aap sab log ek hi internet par hain.
// Agar rok "poore internet" par lage, to ek aadmi ke galat password daalne se
// SABKA darwaza band ho jayega. Isliye rok ek-ek ACCOUNT par honi chahiye.
const API = 'http://localhost:4000';
const BASE = 'http://localhost:5174';
const results = [];

function check(name, ok, extra = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -- ' + extra : ''}`);
}

async function tryLogin(email, password) {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: BASE },
    body: JSON.stringify({ email, password }),
  });
  return res.status;
}

// Ek nakli email par baar-baar galat password — jaise koi guess kar raha ho.
const attacker = `guess.${Date.now()}@example.com`;
let blockedAt = 0;

for (let i = 1; i <= 14; i += 1) {
  const status = await tryLogin(attacker, `galat-${i}`);
  if (status === 429 && !blockedAt) blockedAt = i;
}

check('baar-baar galat password par rok lagi', blockedAt > 0, `${blockedAt}vi koshish par ruka`);
check('rok bahut jaldi nahi lagi (asli user ko dikkat na ho)', blockedAt === 0 || blockedAt >= 8,
  `${blockedAt}vi par`);

// --- sabse zaroori: baaki logon par asar nahi padna chahiye ---------------
const realUser = await tryLogin('rohit@gowebkart.com', 'mailwave');
check('doosra aadmi ab bhi login kar sakta hai', realUser === 200,
  realUser === 429 ? 'SABKA darwaza band ho gaya' : `status ${realUser}`);

// Aur usi account par sahi password bhi ab ruka hona chahiye — yahi rok ka
// matlab hai.
const stillBlocked = await tryLogin(attacker, 'jo-bhi-ho');
check('jis account par koshish hui thi wo abhi bhi ruka hai', stillBlocked === 429,
  `status ${stillBlocked}`);

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} pass`);
if (failed.length) console.log('Fail:', failed.map((f) => f.name).join(', '));
process.exit(failed.length ? 1 : 0);
