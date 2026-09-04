// Naye routes ka test: activity, subscribers, system emails, segments, images.
const BASE = 'http://localhost:4000';
let token = null;
const results = [];

function check(name, ok, extra = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -- ' + extra : ''}`);
}

async function call(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      Origin: 'http://localhost:5174',
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

const login = await call('POST', '/api/auth/login', {
  email: 'rohit@gowebkart.com',
  password: 'mailwave',
});
token = login.data?.accessToken;
check('login', login.status === 200);

// --- activity ---------------------------------------------------------------
const activity = await call('GET', '/api/activity?limit=5');
check('activity list', activity.status === 200 && Array.isArray(activity.data.activity),
  `${activity.data?.total} entries`);
check('activity pagination chali', (activity.data?.activity?.length ?? 99) <= 5);

const filtered = await call('GET', '/api/activity?module=users&limit=5');
check('activity module filter', filtered.status === 200 &&
  filtered.data.activity.every((a) => a.module === 'users'));

const searched = await call('GET', "/api/activity?search=' OR 1=1--");
check('SQL injection se kuch nahi toota', searched.status === 200,
  `${searched.data?.total} results`);

// --- subscribers ------------------------------------------------------------
const subs = await call('GET', '/api/subscribers');
check('subscribers list', subs.status === 200 && Array.isArray(subs.data.subscribers),
  `${subs.data?.total} subscribers`);

const email = `sub.${Date.now()}@example.com`;
const madeSub = await call('POST', '/api/subscribers', { name: 'Test Sub', email, company: 'ACME' });
check('naya subscriber bana', madeSub.status === 201 && madeSub.data.duplicate === false);

const dupSub = await call('POST', '/api/subscribers', { name: 'Test Sub 2', email, company: 'ACME2' });
check('wahi email dobara = duplicate, nayi row nahi', dupSub.data?.duplicate === true);
check('duplicate par wahi id rahi', dupSub.data?.subscriber?.id === madeSub.data?.subscriber?.id);

const delSub = await call('POST', '/api/subscribers/delete', { ids: [madeSub.data.subscriber.id] });
check('subscriber hata', delSub.status === 200 && delSub.data.removed === 1);

const delNone = await call('POST', '/api/subscribers/delete', { ids: [] });
check('khali list ruki', delNone.status === 400);

// --- system emails ----------------------------------------------------------
const sysList = await call('GET', '/api/system-emails');
check('system emails list', sysList.status === 200 && sysList.data.systemEmails.length > 0,
  `${sysList.data?.systemEmails?.length} templates`);

const resetTpl = sysList.data.systemEmails.find((s) => s.key === 'password.reset');
const original = resetTpl.subject;

const edited = await call('PUT', '/api/system-emails/password.reset', {
  subject: 'Badla hua subject',
  html: resetTpl.html,
});
check('system email edit hui', edited.data?.systemEmail?.subject === 'Badla hua subject');

const restored = await call('POST', '/api/system-emails/password.reset/reset');
check('wapas asli haalat me aayi', restored.data?.systemEmail?.subject === original,
  restored.data?.systemEmail?.subject);

const offCritical = await call('POST', '/api/system-emails/password.reset/toggle', { enabled: false });
check('zaroori email band nahi ho sakti', offCritical.status === 400,
  offCritical.data?.error?.message);

const offNormal = await call('POST', '/api/system-emails/report.ready/toggle', { enabled: false });
check('normal email band ho gayi', offNormal.data?.systemEmail?.enabled === false);
await call('POST', '/api/system-emails/report.ready/toggle', { enabled: true });

const testMail = await call('POST', '/api/system-emails/password.reset/test');
check('test email gaya', testMail.status === 200, testMail.data?.error?.message ?? testMail.data?.to);

// --- segments ---------------------------------------------------------------
const segs = await call('GET', '/api/segments');
check('segments list', segs.status === 200 && Array.isArray(segs.data.segments),
  `${segs.data?.segments?.length} segments`);
check('segment ki ginti taaza hai', typeof segs.data.segments[0]?.count === 'number',
  `pehle segment me ${segs.data.segments[0]?.count}`);

const preview = await call('POST', '/api/segments/preview', {
  rule: { description: '', join: 'and', conditions: [{ kind: 'status', value: 'Subscribed' }] },
});
check('preview count aaya', preview.status === 200 && typeof preview.data.count === 'number',
  `${preview.data?.count} contacts`);

const madeSeg = await call('POST', '/api/segments', {
  name: 'Test Segment',
  tone: 'info',
  rule: {
    description: 'Sirf test ke liye',
    join: 'and',
    conditions: [{ kind: 'status', value: 'Subscribed' }],
  },
});
check('naya segment bana', madeSeg.status === 201, madeSeg.data?.error?.message);
check('segment ki ginti preview se match hui', madeSeg.data?.segment?.count === preview.data?.count,
  `${madeSeg.data?.segment?.count} vs ${preview.data?.count}`);

const badSeg = await call('POST', '/api/segments', {
  name: 'Bura Segment', tone: 'info',
  rule: { description: '', join: 'and', conditions: [{ kind: 'nakli_cheez', value: 'x' }] },
});
check('nakli field ruka', badSeg.status === 400, `${badSeg.status}`);

await call('DELETE', `/api/segments/${madeSeg.data.segment.id}`);

// --- images -----------------------------------------------------------------
const imgs = await call('GET', '/api/images');
check('images list', imgs.status === 200 && Array.isArray(imgs.data.images));

const tiny = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const madeImg = await call('POST', '/api/images', { name: 'test.png', url: tiny, source: 'upload' });
check('image save hui', madeImg.status === 201, madeImg.data?.error?.message);
check('size khud gina gaya', madeImg.data?.image?.size > 0, `${madeImg.data?.image?.size} bytes`);

const badImg = await call('POST', '/api/images', {
  name: 'bura.png', url: 'javascript:alert(1)', source: 'url',
});
check('javascript: link ruka', badImg.status === 400, badImg.data?.error?.message);

const httpImg = await call('POST', '/api/images', {
  name: 'http.png', url: 'http://example.com/a.png', source: 'url',
});
check('bina https wala link ruka', httpImg.status === 400);

const delImg = await call('DELETE', `/api/images/${madeImg.data.image.id}`);
check('image hati', delImg.status === 200);

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} pass`);
process.exit(failed.length ? 1 : 0);
