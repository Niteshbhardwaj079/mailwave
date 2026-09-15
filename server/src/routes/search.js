// ---------------------------------------------------------------------------
// Header ka global search — campaigns, contacts, templates me ek saath
// dhoondta hai. Har category ka apna permission check hai (jaise har list
// page ka hota hai) — jis module ko dekhne ki ijazat nahi, uske results
// kabhi wapas nahi aate, chahe naam match hi kyun na kare.
// ---------------------------------------------------------------------------
import { Router } from 'express';

import { many } from '../db/client.js';
import { asyncHandler } from '../lib/http.js';
import { roleCan } from '../middleware/permissions.js';

const router = Router();

const PER_CATEGORY_LIMIT = 5;
const MIN_QUERY_LENGTH = 2;

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = String(req.query.q ?? '').trim();
    if (q.length < MIN_QUERY_LENGTH) {
      res.json({ campaigns: [], contacts: [], templates: [] });
      return;
    }
    const like = `%${q.toLowerCase()}%`;
    const roleKey = req.user.role_key;

    const [campaigns, contacts, templates] = await Promise.all([
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
    ]);

    res.json({ campaigns, contacts, templates });
  })
);

export default router;
