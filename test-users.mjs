// Users aur roles ki API ka test.
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
  try { data = await res.json(); } catch { /* no body */ }
  return { status: res.status, data };
}

// login
const login = await call('POST', '/api/auth/login', { email: 'rohit@gowebkart.com', password: 'mailwave' });
token = login.data?.accessToken;
check('login', login.status === 200);
const me = login.data.user;

// --- roles ---
const roles = await call('GET', '/api/roles');
check('roles list', roles.status === 200 && Array.isArray(roles.data.roles), `${roles.data?.roles?.length} roles`);
check('modules bhi aaye', Boolean(roles.data?.modules?.campaigns));
const superAdmin = roles.data.roles.find((r) => r.key === 'super_admin');
check('super_admin locked hai', superAdmin?.locked === true);

// locked role badalne ki koshish
const lockedEdit = await call('PUT', '/api/roles/super_admin', { label: 'Hack', permissions: {} });
check('locked role badla nahi ja sakta', lockedEdit.status === 400, lockedEdit.data?.error?.message);

// naya role
await call('DELETE', '/api/roles/test_role'); // purana pada ho to hata do
const made = await call('POST', '/api/roles', {
  key: 'test_role',
  label: 'Test Role',
  desc: 'sirf test ke liye',
  tone: 'info',
  icon: 'bi-person',
  permissions: { contacts: ['view', 'export'], campaigns: ['view'], nakli_module: ['view'], contacts_extra: ['x'] },
});
check('naya role bana', made.status === 201, made.data?.error?.message);
check('nakli module save nahi hua', !made.data?.role?.permissions?.nakli_module);
check('sahi permissions save hui', made.data?.role?.permissions?.contacts?.length === 2);

// galat action bhi ruke
const badAction = await call('PUT', '/api/roles/test_role', {
  label: 'Test Role', desc: '', tone: 'info', icon: 'bi-person',
  permissions: { settings: ['view', 'delete'] }, // settings me delete hota hi nahi
});
check('galat action save nahi hua', !badAction.data?.role?.permissions?.settings?.includes('delete'),
  JSON.stringify(badAction.data?.role?.permissions?.settings));

// --- users ---
const users = await call('GET', '/api/users');
check('users list', users.status === 200 && Array.isArray(users.data.users), `${users.data?.users?.length} users`);
check('password kabhi bahar nahi jata', !JSON.stringify(users.data).includes('password_hash') && !JSON.stringify(users.data).match(/"password"/));

// naya user
const email = `test.user.${Date.now()}@example.com`;
const created = await call('POST', '/api/users', {
  name: 'Test Banda', email, role: 'test_role', department: 'QA', status: 'Invited',
});
check('naya user bana', created.status === 201, created.data?.error?.message);
check('naye user ka password nahi hai', created.data?.user?.hasPassword === false);
check('initials khud bane', created.data?.user?.initials === 'TB', created.data?.user?.initials);
const newUserId = created.data?.user?.id;

// wahi email dobara
const dup = await call('POST', '/api/users', { name: 'Koi Aur', email, role: 'test_role' });
check('duplicate email ruka', dup.status === 400, dup.data?.error?.message);

// apne aap ko band karne ki koshish
const selfOff = await call('PUT', `/api/users/${me.id}`, {
  name: me.name, email: me.email, role: 'super_admin', department: '', status: 'Disabled',
});
check('apne aap ko band nahi kar sakte', selfOff.status === 400, selfOff.data?.error?.message);

// apna role ghatane ki koshish
const selfRole = await call('PUT', `/api/users/${me.id}`, {
  name: me.name, email: me.email, role: 'test_role', department: '', status: 'Active',
});
check('apna role khud nahi badal sakte', selfRole.status === 400, selfRole.data?.error?.message);

// apne aap ko delete
const selfDel = await call('DELETE', `/api/users/${me.id}`);
check('apne aap ko delete nahi kar sakte', selfDel.status === 400, selfDel.data?.error?.message);

// role par user hai to role delete na ho
const roleBusy = await call('DELETE', '/api/roles/test_role');
check('jis role par user hai wo delete nahi hota', roleBusy.status === 400, roleBusy.data?.error?.message);

// admin password set kare
const setPw = await call('POST', `/api/users/${newUserId}/password`, { password: 'chotasa' });
check('chhota password ruka', setPw.status === 400, setPw.data?.error?.message);

const setPw2 = await call('POST', `/api/users/${newUserId}/password`, { password: 'TestPass123' });
check('admin ne password set kiya', setPw2.status === 200);

const newLogin = await call('POST', '/api/auth/login', { email, password: 'TestPass123' });
check('naya user login kar paya', newLogin.status === 200);

// naye user (test_role) ke paas users ki permission nahi hai
const otherToken = token;
token = newLogin.data.accessToken;
const forbidden = await call('GET', '/api/users');
check('bina permission users list nahi dikhti', forbidden.status === 403, `${forbidden.status}`);
token = otherToken;
await call('PUT', '/api/roles/test_role', {
  label: 'Test Role', desc: '', tone: 'info', icon: 'bi-person',
  permissions: { contacts: ['view'] },
});
token = newLogin.data.accessToken;
const allowed = await call('GET', '/api/contacts');
check('jis cheez ki permission hai wo dikhti hai', allowed.status === 200, `${allowed.status}`);
token = otherToken;

// safai
await call('DELETE', `/api/users/${newUserId}`);
const cleanup = await call('DELETE', '/api/roles/test_role');
check('user hatne ke baad role hat gaya', cleanup.status === 200, cleanup.data?.error?.message);

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} pass`);
process.exit(failed.length ? 1 : 0);
