// ---------------------------------------------------------------------------
// Header ka global search — campaigns, contacts, templates, users, segments,
// subscribers — sab me ek saath dhoondta hai. Har category ka apna permission
// check hai (jaise har list page ka hota hai) — jis module ko dekhne ki
// ijazat nahi, uske results kabhi wapas nahi aate, chahe naam match hi kyun
// na kare. (Guide chapters is route me shaamil nahi — wo purely client-side
// i18n content hai, Topbar.jsx khud hi search karta hai, backend round-trip
// ki zarurat nahi.)
// ---------------------------------------------------------------------------
import { Router } from 'express';

import { many } from '../db/client.js';
import { asyncHandler } from '../lib/http.js';
import { roleCan } from '../middleware/permissions.js';

const router = Router();

const PER_CATEGORY_LIMIT = 5;
const MIN_QUERY_LENGTH = 2;

const EMPTY_RESULT = { campaigns: [], contacts: [], templates: [], users: [], segments: [], subscribers: [] };

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = String(req.query.q ?? '').trim();
    if (q.length < MIN_QUERY_LENGTH) {
      res.json(EMPTY_RESULT);
      return;
    }
    const like = `%${q.toLowerCase()}%`;
    const roleKey = req.user.role_key;

    const [campaigns, contacts, templates, users, segments, subscribers] = await Promise.all([
      (async () => {
        if (!(await roleCan(roleKey, 'campaigns', 'view'))) return [];
        const rows = await many(
          `SELECT id, name, status, subject FROM campaigns
            WHERE lower(name) LIKE $1 OR lower(subject) LIKE $1
            ORDER BY created_at DESC LIMIT $2`,
          [like, PER_CATEGORY_LIMIT]
        );
        return rows.map((row) => ({
          id: row.id,
          title: row.name,
          subtitle: row.status,
          link: `/campaigns/${row.id}`,
        }));
      })(),
      (async () => {
        if (!(await roleCan(roleKey, 'contacts', 'view'))) return [];
        const rows = await many(
          `SELECT id, name, email, company FROM contacts
            WHERE lower(coalesce(name, '')) LIKE $1 OR lower(email) LIKE $1 OR lower(coalesce(company, '')) LIKE $1
            ORDER BY added_on DESC LIMIT $2`,
          [like, PER_CATEGORY_LIMIT]
        );
        return rows.map((row) => ({
          id: row.id,
          title: row.name || row.email,
          subtitle: row.name ? row.email : row.company || '',
          // Contacts ka apna koi single-record page nahi hai — list page hi
          // isi search se pre-filtered khulta hai (dekho ContactsPage.jsx).
          link: `/contacts?search=${encodeURIComponent(row.name || row.email)}`,
        }));
      })(),
      (async () => {
        if (!(await roleCan(roleKey, 'templates', 'view'))) return [];
        const rows = await many(
          `SELECT id, name, category FROM templates
            WHERE lower(name) LIKE $1
            ORDER BY updated_at DESC LIMIT $2`,
          [like, PER_CATEGORY_LIMIT]
        );
        return rows.map((row) => ({
          id: row.id,
          title: row.name,
          subtitle: row.category,
          link: `/templates/${row.id}/edit`,
        }));
      })(),
      (async () => {
        if (!(await roleCan(roleKey, 'users', 'view'))) return [];
        const rows = await many(
          `SELECT id, name, email FROM users
            WHERE lower(name) LIKE $1 OR lower(email) LIKE $1
            ORDER BY created_at DESC LIMIT $2`,
          [like, PER_CATEGORY_LIMIT]
        );
        return rows.map((row) => ({
          id: row.id,
          title: row.name,
          subtitle: row.email,
          // Users page bhi list-only hai (edit ek sheet me khulta hai) — same
          // ?search= prefill pattern.
          link: `/users?search=${encodeURIComponent(row.name || row.email)}`,
        }));
      })(),
      (async () => {
        if (!(await roleCan(roleKey, 'segments', 'view'))) return [];
        const rows = await many(
          `SELECT id, name FROM segments WHERE lower(name) LIKE $1 ORDER BY created_at DESC LIMIT $2`,
          [like, PER_CATEGORY_LIMIT]
        );
        // Segments page ka koi search/filter box nahi hai — seedha list par
        // le jaate hain, segment khud wahin dikh jayega.
        return rows.map((row) => ({ id: row.id, title: row.name, subtitle: null, link: '/segments' }));
      })(),
      (async () => {
        // subscribers.js ke saare routes 'contacts' module permission hi
        // check karte hain (koi alag 'subscribers' module nahi hai) — usi se match.
        if (!(await roleCan(roleKey, 'contacts', 'view'))) return [];
        const rows = await many(
          `SELECT id, name, email FROM subscribers
            WHERE lower(coalesce(name, '')) LIKE $1 OR lower(email) LIKE $1
            ORDER BY subscribed_at DESC LIMIT $2`,
          [like, PER_CATEGORY_LIMIT]
        );
        return rows.map((row) => ({
          id: row.id,
          title: row.name || row.email,
          subtitle: row.name ? row.email : '',
          link: `/subscribers?search=${encodeURIComponent(row.name || row.email)}`,
        }));
      })(),
    ]);

    res.json({ campaigns, contacts, templates, users, segments, subscribers });
  })
);

export default router;
