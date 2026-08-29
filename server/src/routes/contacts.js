// ---------------------------------------------------------------------------
// Contacts — wo log jinhe email bheja jayega.
//
// Do zaroori niyam yahan lagte hain:
//   1. Ek email address list me sirf ek baar aa sakta hai (database khud rokta hai).
//   2. Jo unsubscribe ya bounce ho chuka hai, wo suppression list me jata hai
//      aur usse dobara kabhi email nahi jayega.
// ---------------------------------------------------------------------------
import { Router } from 'express';
import { z } from 'zod';

import { many, one, query } from '../db/client.js';
import { asyncHandler, conflict, notFound, paginated, pagination } from '../lib/http.js';
import { logActivity } from '../lib/activity.js';
import { newId } from '../lib/ids.js';
import { validate } from '../lib/validate.js';
import { requireModule } from '../middleware/permissions.js';

const router = Router();

const contactInput = z.object({
  name: z.string().trim().max(120).optional().nullable(),
  email: z.string().trim().email('Sahi email address daalo'),
  phone: z.string().trim().max(40).optional().nullable(),
  company: z.string().trim().max(120).optional().nullable(),
  city: z.string().trim().max(80).optional().nullable(),
  groupId: z.string().trim().optional().nullable(),
  tags: z.array(z.string().trim().max(40)).max(20).default([]),
  consentSource: z.string().trim().max(80).optional().nullable(),
});

function toApi(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    company: row.company,
    city: row.city,
    tags: row.tags ?? [],
    group: row.group_name ?? null,
    groupId: row.group_id,
    status: row.status,
    consentSource: row.consent_source,
    addedOn: row.added_on,
  };
}

const SELECT = `
  SELECT c.id, c.name, c.email, c.phone, c.company, c.city, c.tags, c.group_id,
         c.status, c.consent_source, c.added_on, g.name AS group_name
    FROM contacts c
    LEFT JOIN contact_groups g ON g.id = c.group_id
`;

// --- list, search aur filter ke saath ----------------------------------------
router.get(
  '/',
  requireModule('contacts', 'view'),
  asyncHandler(async (req, res) => {
    // Search ko hamesha parameter ki tarah bhejte hain ($1), SQL me jodte nahi —
    // isi se SQL injection rukta hai.
    const search = String(req.query.search ?? '').trim();
    const status = String(req.query.status ?? '').trim();
    const groupId = String(req.query.groupId ?? '').trim();

    const where = [];
    const params = [];

    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      where.push(`(lower(c.name) LIKE $${params.length}
                OR lower(c.email) LIKE $${params.length}
                OR lower(c.company) LIKE $${params.length})`);
    }
    if (status) {
      params.push(status);
      where.push(`c.status = $${params.length}`);
    }
    if (groupId) {
      params.push(groupId);
      where.push(`c.group_id = $${params.length}`);
    }

    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    // Pehle ginti, phir sirf ek page jitni rows.
    //
    // Yeh isliye zaroori hai: 50,000 contacts ek saath bhejna server ki memory
    // bhar dega aur browser ko hang kar dega. Aur pehle jo `LIMIT 500` likha
    // tha wo usse bhi bura tha — 501 se aage ka data chup-chap gayab ho jata,
    // kisi ko pata bhi nahi chalta.
    const totalRow = await one(`SELECT count(*)::int AS n FROM contacts c ${clause}`, params);
    const { page, limit, offset } = pagination(req, { defaultLimit: 50, maxLimit: 500 });

    const rows = await many(
      `${SELECT} ${clause} ORDER BY c.added_on DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    res.json({
      ...paginated(rows.map(toApi), { page, limit }, totalRow?.n ?? 0),
      // Purane naam ke saath bhi bhej rahe hain, taki jo code pehle se
      // `contacts` padh raha hai wo tootey nahi.
      contacts: rows.map(toApi),
    });
  })
);

router.get(
  '/:id',
  requireModule('contacts', 'view'),
  asyncHandler(async (req, res) => {
    const row = await one(`${SELECT} WHERE c.id = $1`, [req.params.id]);
    if (!row) throw notFound('Yeh contact nahi mila');
    res.json({ contact: toApi(row) });
  })
);

// --- naya contact -----------------------------------------------------------
router.post(
  '/',
  requireModule('contacts', 'create'),
  validate(contactInput),
  asyncHandler(async (req, res) => {
    const body = req.body;

    const duplicate = await one('SELECT id FROM contacts WHERE lower(email) = lower($1)', [body.email]);
    if (duplicate) throw conflict('Yeh email pehle se list me hai');

    const id = newId('c');
    await query(
      `INSERT INTO contacts (id, name, email, phone, company, city, group_id, tags, consent_source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [id, body.name ?? null, body.email, body.phone ?? null, body.company ?? null,
       body.city ?? null, body.groupId || null, body.tags, body.consentSource ?? null]
    );

    await logActivity(req, {
      action: 'created',
      module: 'contacts',
      item: body.email,
      detail: 'Naya contact joda gaya',
    });

    const row = await one(`${SELECT} WHERE c.id = $1`, [id]);
    res.status(201).json({ contact: toApi(row) });
  })
);

// --- contact badlo ----------------------------------------------------------
router.put(
  '/:id',
  requireModule('contacts', 'edit'),
  validate(contactInput),
  asyncHandler(async (req, res) => {
    const existing = await one('SELECT id, email FROM contacts WHERE id = $1', [req.params.id]);
    if (!existing) throw notFound('Yeh contact nahi mila');

    const body = req.body;

    // Email badla ja raha hai to dekh lo kisi aur ke paas to nahi hai.
    if (body.email.toLowerCase() !== existing.email.toLowerCase()) {
      const clash = await one(
        'SELECT id FROM contacts WHERE lower(email) = lower($1) AND id <> $2',
        [body.email, req.params.id]
      );
      if (clash) throw conflict('Yeh email kisi aur contact ke paas hai');
    }

    await query(
      `UPDATE contacts
          SET name = $1, email = $2, phone = $3, company = $4, city = $5,
              group_id = $6, tags = $7, consent_source = $8, updated_at = now()
        WHERE id = $9`,
      [body.name ?? null, body.email, body.phone ?? null, body.company ?? null, body.city ?? null,
       body.groupId || null, body.tags, body.consentSource ?? null, req.params.id]
    );

    await logActivity(req, {
      action: 'updated',
      module: 'contacts',
      item: body.email,
      detail: 'Contact ki details badli',
    });

    const row = await one(`${SELECT} WHERE c.id = $1`, [req.params.id]);
    res.json({ contact: toApi(row) });
  })
);

// --- contact hatao ----------------------------------------------------------
router.delete(
  '/:id',
  requireModule('contacts', 'delete'),
  asyncHandler(async (req, res) => {
    const existing = await one('SELECT id, email FROM contacts WHERE id = $1', [req.params.id]);
    if (!existing) throw notFound('Yeh contact nahi mila');

    await query('DELETE FROM contacts WHERE id = $1', [req.params.id]);

    await logActivity(req, {
      action: 'deleted',
      module: 'contacts',
      item: existing.email,
      detail: 'Contact hata diya gaya',
    });

    res.json({ ok: true });
  })
);

// --- ek se zyada ek saath hatao (table ke tick-box wale bulk action) ---------
router.post(
  '/bulk-delete',
  requireModule('contacts', 'delete'),
  validate(z.object({ ids: z.array(z.string()).min(1, 'Kam se kam ek contact chuno') })),
  asyncHandler(async (req, res) => {
    const result = await query('DELETE FROM contacts WHERE id = ANY($1)', [req.body.ids]);

    await logActivity(req, {
      action: 'deleted',
      module: 'contacts',
      item: `${req.body.ids.length} contacts`,
      detail: 'Ek saath kai contact hataye gaye',
    });

    res.json({ ok: true, deleted: result.affectedRows ?? req.body.ids.length });
  })
);

// --- contact groups ---------------------------------------------------------
router.get(
  '/groups/all',
  requireModule('contacts', 'view'),
  asyncHandler(async (req, res) => {
    const rows = await many(`
      SELECT g.id, g.name, g.tone, count(c.id)::int AS count
        FROM contact_groups g
        LEFT JOIN contacts c ON c.group_id = g.id
       GROUP BY g.id, g.name, g.tone
       ORDER BY g.name
    `);
    res.json({ groups: rows });
  })
);

router.post(
  '/groups',
  requireModule('contacts', 'create'),
  validate(z.object({
    name: z.string().trim().min(1, 'Group ko naam do').max(80),
    tone: z.string().trim().max(20).default('primary'),
  })),
  asyncHandler(async (req, res) => {
    const id = newId('g');
    await query('INSERT INTO contact_groups (id, name, tone) VALUES ($1,$2,$3)', [
      id,
      req.body.name,
      req.body.tone,
    ]);

    await logActivity(req, {
      action: 'created',
      module: 'contacts',
      item: req.body.name,
      detail: 'Naya contact group bana',
    });

    res.status(201).json({ group: { id, name: req.body.name, tone: req.body.tone, count: 0 } });
  })
);

// --- suppression list -------------------------------------------------------
// Jinhe kabhi email nahi jayega. Yeh sirf padhne ke liye hai; entries
// unsubscribe/bounce hone par apne aap banti hain.
router.get(
  '/suppression/all',
  requireModule('contacts', 'view'),
  asyncHandler(async (req, res) => {
    const rows = await many('SELECT email, reason, detail, created_at FROM suppression ORDER BY created_at DESC');
    res.json({ suppression: rows });
  })
);

// --- import (Excel/CSV se aaye hue log) -------------------------------------
//
// Duplicate email ka poora hisaab yahan hota hai. Teen jagah duplicate ho
// sakta hai, aur teenon pakde jate hain:
//
//   1. Jo email pehle se database me hai
//   2. Jo email isi file me do baar aa gaya
//   3. Jo suppression list me hai (unsubscribe/bounce ho chuka)
//
// Kuch bhi chup-chap nahi hota — har row ka natija wapas bheja jata hai, taki
// screen par saaf dikhe ki kya hua aur kyun.

/** Bahut aam galtiyan pakadta hai: spaces, "name <email>" wala format. */
function cleanEmail(raw) {
  const text = String(raw ?? '').trim();
  const angle = text.match(/<([^>]+)>/);
  return (angle ? angle[1] : text).trim().toLowerCase();
}

function looksLikeEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

router.post(
  '/import',
  requireModule('contacts', 'create'),
  validate(z.object({
    rows: z.array(z.record(z.any())).min(1, 'Import karne ke liye kuch to do').max(50_000),
    groupId: z.string().trim().optional().nullable(),
    // false rakho to sirf report milegi, kuch save nahi hoga (preview ke liye).
    commit: z.boolean().default(true),
  })),
  asyncHandler(async (req, res) => {
    const { rows, groupId, commit } = req.body;

    // Ek hi baar database se sab uthate hain — har row par query karna 5000
    // contacts par bahut slow ho jata.
    const existing = await many('SELECT lower(email) AS email FROM contacts');
    const suppressed = await many('SELECT lower(email) AS email FROM suppression');

    const inDatabase = new Set(existing.map((r) => r.email));
    const inSuppression = new Set(suppressed.map((r) => r.email));
    const seenInFile = new Set();

    const report = {
      total: rows.length,
      valid: 0,
      invalid: 0,
      duplicateInDatabase: 0,
      duplicateInFile: 0,
      suppressed: 0,
      imported: 0,
      // Screen par dikhane ke liye — pehli 200 problem wali rows.
      problems: [],
    };

    const toInsert = [];

    rows.forEach((row, index) => {
      const rowNumber = index + 2; // header ko row 1 maan kar
      const email = cleanEmail(row.email ?? row.Email ?? row['Email Address']);
      const name = row.name ?? row.Name ?? row['Full Name'] ?? null;

      function problem(reason, detail) {
        if (report.problems.length < 200) {
          report.problems.push({ row: rowNumber, email: email || null, name, reason, detail });
        }
      }

      if (!email) {
        report.invalid += 1;
        problem('missing', 'Email khali hai');
        return;
      }
      if (!looksLikeEmail(email)) {
        report.invalid += 1;
        problem('invalid', 'Email theek nahi lag raha');
        return;
      }
      if (seenInFile.has(email)) {
        report.duplicateInFile += 1;
        problem('duplicateInFile', 'Yeh email isi file me pehle bhi aaya hai');
        return;
      }
      if (inDatabase.has(email)) {
        report.duplicateInDatabase += 1;
        problem('duplicateInDatabase', 'Yeh email pehle se aapki list me hai');
        seenInFile.add(email);
        return;
      }
      if (inSuppression.has(email)) {
        report.suppressed += 1;
        problem('suppressed', 'Isne unsubscribe kiya tha ya bounce hua tha — isliye chhod diya');
        seenInFile.add(email);
        return;
      }

      seenInFile.add(email);
      report.valid += 1;
      toInsert.push({
        email,
        name,
        phone: row.phone ?? row.Phone ?? row.Mobile ?? null,
        company: row.company ?? row.Company ?? row['Company Name'] ?? null,
        city: row.city ?? row.City ?? null,
      });
    });

    // commit=false matlab sirf dikhao, save mat karo.
    if (commit) {
      for (const person of toInsert) {
        // ON CONFLICT: agar do request ek saath aa jayein to bhi duplicate
        // nahi banega — database khud rok deta hai.
        const result = await query(
          `INSERT INTO contacts (id, name, email, phone, company, city, group_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT (lower(email)) DO NOTHING`,
          [newId('c'), person.name, person.email, person.phone, person.company, person.city, groupId || null]
        );
        if (result.affectedRows ?? result.rowCount) report.imported += 1;
      }

      await logActivity(req, {
        action: 'created',
        module: 'contacts',
        item: `${report.imported} contacts`,
        detail:
          `Import: ${report.imported} jude, ${report.duplicateInDatabase} pehle se the, ` +
          `${report.duplicateInFile} file me dobara the, ${report.invalid} galat the`,
      });
    }

    res.json({ ok: true, committed: commit, report });
  })
);

export default router;
