// ---------------------------------------------------------------------------
// Roles aur unki permissions.
//
// Permission ka model bilkul wahi hai jo screen par dikhta hai: 10 module x 6
// action. Database me sirf "haan" wali rows rakhi jati hain — row nahi hai to
// matlab ijaazat nahi hai.
//
// Ek baat yaad rakhna: super_admin ki permissions database me nahi dekhi
// jatin. permissions.js me sabse pehli line hi use sab kuch de deti hai, taki
// koi apne aap ko galti se bhi bahar na kar le.
// ---------------------------------------------------------------------------
import { Router } from 'express';
import { z } from 'zod';

import { many, one, query } from '../db/client.js';
import { asyncHandler, badRequest, notFound } from '../lib/http.js';
import { logActivity } from '../lib/activity.js';
import { validate } from '../lib/validate.js';
import { requireModule } from '../middleware/permissions.js';

const router = Router();

// Jo modules aur actions app me hain — inke alawa kuch bhi save nahi hota.
const MODULE_ACTIONS = {
  dashboard: ['view', 'export'],
  campaigns: ['view', 'create', 'edit', 'delete', 'send', 'export'],
  contacts: ['view', 'create', 'edit', 'delete', 'export'],
  templates: ['view', 'create', 'edit', 'delete'],
  segments: ['view', 'create', 'edit', 'delete'],
  reports: ['view', 'export'],
  accounts: ['view', 'create', 'edit', 'delete'],
  settings: ['view', 'edit'],
  users: ['view', 'create', 'edit', 'delete'],
  activity: ['view', 'export'],
};

const roleInput = z.object({
  key: z
    .string()
    .trim()
    .min(2, 'Role ki key kam se kam 2 akshar ki ho')
    .max(40)
    .regex(/^[a-z][a-z0-9_]*$/, 'Key me sirf chhote akshar, number aur _ chalega'),
  // Naam khali bhi ho sakta hai. Starter roles (Admin, Member waghairah) ka
  // naam translation file se aata hai, database me nahi rakha jata — unhe
  // update karte waqt screen null bhejti hai, aur wo galti nahi hai.
  label: z.string().trim().max(80).nullish(),
  desc: z.string().trim().max(300).nullish(),
  tone: z.enum(['danger', 'primary', 'info', 'success', 'warning', 'muted']).default('primary'),
  icon: z.string().trim().max(60).default('bi-person'),
  permissions: z.record(z.string(), z.array(z.string())).default({}),
});

/** Naya role banate waqt naam zaroori hai — bina naam ka role kis kaam ka. */
const newRoleInput = roleInput.extend({
  label: z.string().trim().min(1, 'Role ko ek naam do').max(80),
});

/**
 * Bheji hui permissions ko saaf karta hai.
 *
 * Sirf wahi module aur action rakhta hai jo asli me app me hain. Isse koi
 * request me apna banaya hua module ya action ghusa kar database gandaa nahi
 * kar sakta.
 */
function cleanPermissions(input) {
  const out = {};

  for (const [module, actions] of Object.entries(input || {})) {
    const allowed = MODULE_ACTIONS[module];
    if (!allowed) continue;

    const kept = [...new Set(actions)].filter((action) => allowed.includes(action));
    if (kept.length) out[module] = kept;
  }

  return out;
}

function roleToApi(row, permissions) {
  return {
    key: row.key,
    // Starter roles ka naam translation file se aata hai (labelKey), aur jo
    // role Super Admin khud banata hai uska naam seedha typed hota hai (label).
    label: row.label,
    labelKey: row.label_key,
    desc: row.descr,
    descKey: row.descr_key,
    tone: row.tone,
    icon: row.icon,
    locked: row.locked,
    custom: row.custom,
    permissions,
  };
}

/** Ek hi baar me saare roles ki permissions le aata hai. */
async function permissionMap() {
  const rows = await many('SELECT role_key, module, action FROM role_permissions');

  return rows.reduce((acc, row) => {
    acc[row.role_key] = acc[row.role_key] || {};
    acc[row.role_key][row.module] = acc[row.role_key][row.module] || [];
    acc[row.role_key][row.module].push(row.action);
    return acc;
  }, {});
}

// --- 1. saare roles ---------------------------------------------------------
router.get(
  '/',
  requireModule('users', 'view'),
  asyncHandler(async (req, res) => {
    const rows = await many('SELECT * FROM roles ORDER BY sort_order, key');
    const permissions = await permissionMap();

    res.json({
      roles: rows.map((row) => roleToApi(row, permissions[row.key] ?? {})),
      // Screen ko yeh dono chahiye taki wo checkbox ka grid bana sake. Ek hi
      // jagah se aane se frontend aur backend kabhi alag nahi hote.
      modules: MODULE_ACTIONS,
    });
  })
);

// --- 2. naya role -----------------------------------------------------------
router.post(
  '/',
  requireModule('users', 'create'),
  validate(newRoleInput),
  asyncHandler(async (req, res) => {
    const { key, label, desc, tone, icon, permissions } = req.body;

    const clash = await one('SELECT key FROM roles WHERE key = $1', [key]);
    if (clash) throw badRequest('Is key se ek role pehle se hai');

    const orderRow = await one('SELECT coalesce(max(sort_order), 0) + 1 AS n FROM roles');

    await query(
      `INSERT INTO roles (key, label, descr, tone, icon, locked, custom, sort_order)
       VALUES ($1,$2,$3,$4,$5,false,true,$6)`,
      [key, label, desc ?? '', tone, icon, orderRow?.n ?? 99]
    );

    await savePermissions(key, cleanPermissions(permissions));

    await logActivity(req, {
      action: 'created',
      module: 'users',
      item: label,
      detail: `Naya role bana: ${key}`,
    });

    const row = await one('SELECT * FROM roles WHERE key = $1', [key]);
    const map = await permissionMap();
    res.status(201).json({ role: roleToApi(row, map[key] ?? {}) });
  })
);

// --- 3. role badlo ----------------------------------------------------------
router.put(
  '/:key',
  requireModule('users', 'edit'),
  validate(roleInput.partial({ key: true })),
  asyncHandler(async (req, res) => {
    const existing = await one('SELECT * FROM roles WHERE key = $1', [req.params.key]);
    if (!existing) throw notFound('Yeh role nahi mila');

    // super_admin par taala isliye hai ki uski permissions ghata di jayen to
    // app ko phir se theek karne wala koi bachta hi nahi.
    if (existing.locked) throw badRequest('Yeh role locked hai, ise badla nahi ja sakta');

    const { label, desc, tone, icon, permissions } = req.body;

    // Starter roles ka naam translation file se aata hai — database me unka
    // `label` khali (null) hota hai aur `label_key` bhara hota hai. Isliye naam
    // tabhi likhte hain jab koi asli naam bheja gaya ho. Aur naam likhte hi
    // label_key hata dete hain, warna screen purana translated naam hi dikhati
    // rahegi aur user ko lagega ki uska badla hua naam save hi nahi hua.
    if (label) {
      await query('UPDATE roles SET label = $1, label_key = NULL WHERE key = $2', [
        label,
        req.params.key,
      ]);
    }

    if (desc) {
      await query('UPDATE roles SET descr = $1, descr_key = NULL WHERE key = $2', [
        desc,
        req.params.key,
      ]);
    }

    await query('UPDATE roles SET tone = $1, icon = $2 WHERE key = $3', [
      tone ?? existing.tone,
      icon ?? existing.icon,
      req.params.key,
    ]);

    if (permissions) {
      await query('DELETE FROM role_permissions WHERE role_key = $1', [req.params.key]);
      await savePermissions(req.params.key, cleanPermissions(permissions));
    }

    await logActivity(req, {
      action: 'updated',
      module: 'users',
      item: label ?? existing.label ?? existing.key,
      detail: 'Role ki permissions ya detail badli',
    });

    const row = await one('SELECT * FROM roles WHERE key = $1', [req.params.key]);
    const map = await permissionMap();
    res.json({ role: roleToApi(row, map[req.params.key] ?? {}) });
  })
);

// --- 4. role ki copy --------------------------------------------------------
router.post(
  '/:key/duplicate',
  requireModule('users', 'create'),
  asyncHandler(async (req, res) => {
    const source = await one('SELECT * FROM roles WHERE key = $1', [req.params.key]);
    if (!source) throw notFound('Yeh role nahi mila');

    // Nayi key khud bana lete hain: admin, admin_2, admin_3...
    let key = `${source.key}_copy`;
    let n = 2;
    while (await one('SELECT key FROM roles WHERE key = $1', [key])) {
      key = `${source.key}_copy_${n}`;
      n += 1;
    }

    const orderRow = await one('SELECT coalesce(max(sort_order), 0) + 1 AS n FROM roles');
    const label = `${source.label ?? source.key} (copy)`;

    await query(
      `INSERT INTO roles (key, label, descr, tone, icon, locked, custom, sort_order)
       VALUES ($1,$2,$3,$4,$5,false,true,$6)`,
      [key, label, source.descr, source.tone, source.icon, orderRow?.n ?? 99]
    );

    await query(
      `INSERT INTO role_permissions (role_key, module, action)
       SELECT $1, module, action FROM role_permissions WHERE role_key = $2`,
      [key, req.params.key]
    );

    await logActivity(req, {
      action: 'created',
      module: 'users',
      item: label,
      detail: `${source.key} se copy bana`,
    });

    const row = await one('SELECT * FROM roles WHERE key = $1', [key]);
    const map = await permissionMap();
    res.status(201).json({ role: roleToApi(row, map[key] ?? {}) });
  })
);

// --- 5. role hatao ----------------------------------------------------------
router.delete(
  '/:key',
  requireModule('users', 'delete'),
  asyncHandler(async (req, res) => {
    const existing = await one('SELECT * FROM roles WHERE key = $1', [req.params.key]);
    if (!existing) throw notFound('Yeh role nahi mila');
    if (existing.locked) throw badRequest('Yeh role locked hai, ise hataya nahi ja sakta');

    // Role ke saath uske users ko chhodna nahi hai — wo bina role ke reh
    // jayenge aur unse app khulega hi nahi.
    const used = await one('SELECT count(*)::int AS n FROM users WHERE role_key = $1', [
      req.params.key,
    ]);
    if ((used?.n ?? 0) > 0) {
      throw badRequest(
        `Is role par ${used.n} user hain. Pehle unhe koi doosra role do, phir yeh role hatao.`
      );
    }

    await query('DELETE FROM roles WHERE key = $1', [req.params.key]);

    await logActivity(req, {
      action: 'deleted',
      module: 'users',
      item: existing.label ?? existing.key,
      detail: 'Role hata diya gaya',
    });

    res.json({ ok: true });
  })
);

/** Permissions ki rows daalta hai. Ek action = ek row. */
async function savePermissions(roleKey, permissions) {
  for (const [module, actions] of Object.entries(permissions)) {
    for (const action of actions) {
      await query(
        `INSERT INTO role_permissions (role_key, module, action) VALUES ($1,$2,$3)
         ON CONFLICT DO NOTHING`,
        [roleKey, module, action]
      );
    }
  }
}

export default router;
