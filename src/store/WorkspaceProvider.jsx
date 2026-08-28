import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { PERMISSION_MODULES, ROLES, activityLog, teamUsers } from '../data/adminData';
import { starterTemplates } from '../data/starterHtml';
import { systemEmailTemplates } from '../data/systemEmails';
import { subscribers as seedSubscribers } from '../data/mockData';
import { newId } from '../utils/ids';

const KEYS = {
  version: 'mailwave.schemaVersion',
  templates: 'mailwave.templates',
  images: 'mailwave.images',
  roles: 'mailwave.roles',
  users: 'mailwave.users',
  activity: 'mailwave.activity',
  viewAs: 'mailwave.viewAs',
  systemEmails: 'mailwave.systemEmails',
  subscribers: 'mailwave.subscribers',
};

/**
 * Bump this whenever the SHAPE of anything saved below changes — a new field
 * on a role, a renamed key, a different permission model. Browsers that still
 * hold the old shape drop it and start again from the seed data, instead of
 * crashing on a field that no longer exists.
 */
const SCHEMA_VERSION = 2;

function resetIfStale() {
  try {
    const stored = window.localStorage.getItem(KEYS.version);
    if (stored === String(SCHEMA_VERSION)) return;

    Object.values(KEYS).forEach((key) => {
      if (key !== KEYS.version) window.localStorage.removeItem(key);
    });
    window.localStorage.setItem(KEYS.version, String(SCHEMA_VERSION));
  } catch (error) {
    // Storage blocked — every load() below just falls back to the seed data.
  }
}

resetIfStale();

const WorkspaceContext = createContext(null);

function load(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch (error) {
    return fallback;
  }
}

/** A saved list that came back empty or malformed is not usable — seed instead. */
function loadList(key, fallback) {
  const value = load(key, fallback);
  return Array.isArray(value) && value.length > 0 ? value : fallback;
}

function save(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    // Storage full (large images) or blocked. The app keeps working in memory.
    return false;
  }
}

const SEED_TEMPLATES = [
  {
    id: 't1',
    name: 'Welcome Warm',
    category: 'Welcome',
    subject: 'Welcome to {{company}}, {{name}}',
    html: starterTemplates[1].html,
    updated: '2026-08-18',
    createdBy: 'Neha Kulkarni',
  },
  {
    id: 't2',
    name: 'Festival Offer',
    category: 'Festival',
    subject: 'Hello {{name}}, 30% off this week',
    html: starterTemplates[0].html,
    updated: '2026-08-14',
    createdBy: 'Arjun Bhosale',
  },
  {
    id: 't3',
    name: 'Announcement Clean',
    category: 'Announcement',
    subject: 'An important update for you',
    html: starterTemplates[2].html,
    updated: '2026-08-08',
    createdBy: 'Rohit Sharma',
  },
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function nowStamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(
    now.getMinutes()
  )}`;
}

export function WorkspaceProvider({ children }) {
  const [templates, setTemplates] = useState(() => load(KEYS.templates, SEED_TEMPLATES));
  const [images, setImages] = useState(() => load(KEYS.images, []));
  // Roles and users can never be empty — an empty roles list would leave the
  // app with nobody to check permissions against.
  const [roles, setRoles] = useState(() => loadList(KEYS.roles, ROLES));
  const [users, setUsers] = useState(() => loadList(KEYS.users, teamUsers));
  const [activity, setActivity] = useState(() => load(KEYS.activity, activityLog));
  const [viewAs, setViewAs] = useState(() => load(KEYS.viewAs, 'super_admin'));
  const [systemEmails, setSystemEmails] = useState(() => {
    const stored = load(KEYS.systemEmails, null);
    if (!stored) return systemEmailTemplates.map((item) => ({ ...item, enabled: true }));
    // Keep new templates that were added to the code after this browser saved.
    return systemEmailTemplates.map((item) => {
      const saved = stored.find((entry) => entry.key === item.key);
      return saved ? { ...item, ...saved } : { ...item, enabled: true };
    });
  });
  const [subscribers, setSubscribers] = useState(() => load(KEYS.subscribers, seedSubscribers));
  const [storageWarning, setStorageWarning] = useState(false);

  useEffect(() => {
    save(KEYS.templates, templates);
  }, [templates]);

  useEffect(() => {
    const ok = save(KEYS.images, images);
    if (!ok) setStorageWarning(true);
  }, [images]);

  useEffect(() => {
    save(KEYS.roles, roles);
  }, [roles]);

  useEffect(() => {
    save(KEYS.users, users);
  }, [users]);

  useEffect(() => {
    save(KEYS.activity, activity);
  }, [activity]);

  useEffect(() => {
    save(KEYS.viewAs, viewAs);
  }, [viewAs]);

  useEffect(() => {
    save(KEYS.systemEmails, systemEmails);
  }, [systemEmails]);

  useEffect(() => {
    save(KEYS.subscribers, subscribers);
  }, [subscribers]);

  // --- activity ------------------------------------------------------------
  // Never call this from inside a setState updater: React runs updaters twice
  // in development to check they are pure, which would log the same action
  // twice. Read the state you need first, then update and log side by side.
  const logActivity = useCallback((entry) => {
    setActivity((current) => [
      {
        id: newId('a'),
        userId: 'u1',
        userName: 'Rohit Sharma',
        initials: 'RS',
        ip: '103.21.58.9',
        device: 'This browser',
        before: '—',
        after: '—',
        at: nowStamp(),
        ...entry,
      },
      ...current,
    ]);
  }, []);

  // --- templates -----------------------------------------------------------
  const saveTemplate = useCallback(
    (template) => {
      const isNew = !template.id;
      const id = template.id || newId('t');
      const record = { ...template, id, updated: todayIso() };

      setTemplates((current) => {
        const exists = current.some((item) => item.id === id);
        return exists ? current.map((item) => (item.id === id ? record : item)) : [record, ...current];
      });

      logActivity({
        action: isNew ? 'created' : 'updated',
        module: 'templates',
        item: record.name,
        detail: isNew ? 'New HTML template saved' : 'Template HTML edited',
      });

      return record;
    },
    [logActivity]
  );

  const deleteTemplate = useCallback(
    (id) => {
      const found = templates.find((item) => item.id === id);
      if (!found) return;

      setTemplates((current) => current.filter((item) => item.id !== id));
      logActivity({ action: 'deleted', module: 'templates', item: found.name, detail: 'Template removed' });
    },
    [templates, logActivity]
  );

  const duplicateTemplate = useCallback(
    (id) => {
      const found = templates.find((item) => item.id === id);
      if (!found) return null;

      const copy = { ...found, id: newId('t'), name: `${found.name} (copy)`, updated: todayIso() };
      setTemplates((current) => [copy, ...current]);
      logActivity({
        action: 'created',
        module: 'templates',
        item: copy.name,
        detail: 'Copied from an existing template',
      });
      return copy;
    },
    [templates, logActivity]
  );

  const getTemplate = useCallback((id) => templates.find((item) => item.id === id) || null, [templates]);

  // --- images --------------------------------------------------------------
  const addImage = useCallback(
    (image) => {
      const record = { id: newId('img'), addedAt: nowStamp(), ...image };
      setImages((current) => [record, ...current]);
      logActivity({ action: 'created', module: 'templates', item: record.name, detail: 'Image added to the library' });
      return record;
    },
    [logActivity]
  );

  const removeImage = useCallback((id) => {
    setImages((current) => current.filter((item) => item.id !== id));
  }, []);

  // --- roles (created by the Super Admin) ----------------------------------
  const emptyPermissions = useCallback(
    () =>
      PERMISSION_MODULES.reduce((acc, module) => {
        acc[module.key] = [];
        return acc;
      }, {}),
    []
  );

  const createRole = useCallback(
    ({ name, description, tone, icon, copyFrom }) => {
      const key = newId('role');
      const source = copyFrom ? roles.find((item) => item.key === copyFrom) : null;

      const record = {
        key,
        label: name,
        desc: description,
        tone: tone || 'primary',
        icon: icon || 'bi-person',
        locked: false,
        custom: true,
        permissions: source
          ? JSON.parse(JSON.stringify(source.permissions))
          : emptyPermissions(),
      };

      setRoles((current) => [...current, record]);
      logActivity({
        action: 'created',
        module: 'users',
        item: name,
        detail: source ? `New role copied from ${source.label || source.key}` : 'New role created',
        after: `Role: ${name}`,
      });

      return record;
    },
    [roles, emptyPermissions, logActivity]
  );

  const updateRole = useCallback(
    (key, { name, description, tone, icon }) => {
      setRoles((current) =>
        current.map((role) => {
          if (role.key !== key) return role;
          return {
            ...role,
            label: name ?? role.label,
            desc: description ?? role.desc,
            tone: tone ?? role.tone,
            icon: icon ?? role.icon,
          };
        })
      );
      logActivity({ action: 'updated', module: 'users', item: name || key, detail: 'Role details changed' });
    },
    [logActivity]
  );

  /**
   * A role in use is never silently removed — the caller is told how many
   * people still have it so it can show a clear message.
   */
  const deleteRole = useCallback(
    (key) => {
      const role = roles.find((item) => item.key === key);
      if (!role) return { ok: false, reason: 'missing' };
      if (role.locked) return { ok: false, reason: 'locked' };

      const inUse = users.filter((user) => user.role === key).length;
      if (inUse > 0) return { ok: false, reason: 'inUse', count: inUse };

      setRoles((current) => current.filter((item) => item.key !== key));
      logActivity({
        action: 'deleted',
        module: 'users',
        item: role.label || role.key,
        detail: 'Role removed',
        before: `Role: ${role.label || role.key}`,
      });
      return { ok: true };
    },
    [roles, users, logActivity]
  );

  const duplicateRole = useCallback(
    (key) => {
      const role = roles.find((item) => item.key === key);
      if (!role) return null;
      return createRole({
        name: `${role.label || role.key} (copy)`,
        description: role.desc || '',
        tone: role.tone,
        icon: role.icon,
        copyFrom: key,
      });
    },
    [roles, createRole]
  );

  // --- permissions ---------------------------------------------------------
  const togglePermission = useCallback(
    (roleKey, moduleKey, actionKey) => {
      setRoles((current) =>
        current.map((role) => {
          if (role.key !== roleKey || role.locked) return role;
          const list = role.permissions[moduleKey] || [];
          const next = list.includes(actionKey)
            ? list.filter((item) => item !== actionKey)
            : [...list, actionKey];
          return { ...role, permissions: { ...role.permissions, [moduleKey]: next } };
        })
      );
      logActivity({
        action: 'permissionChanged',
        module: 'users',
        item: roleKey,
        detail: `Toggled “${actionKey}” on ${moduleKey}`,
      });
    },
    [logActivity]
  );

  const setModulePermissions = useCallback(
    (roleKey, moduleKey, actions) => {
      setRoles((current) =>
        current.map((role) =>
          role.key === roleKey && !role.locked
            ? { ...role, permissions: { ...role.permissions, [moduleKey]: actions } }
            : role
        )
      );
      logActivity({
        action: 'permissionChanged',
        module: 'users',
        item: roleKey,
        detail: `Set all permissions on ${moduleKey}`,
      });
    },
    [logActivity]
  );

  // --- users ---------------------------------------------------------------
  const saveUser = useCallback(
    (user) => {
      const isNew = !user.id;
      const id = user.id || newId('u');
      const record = { lastActive: '—', status: 'Invited', initials: 'NU', ...user, id };

      setUsers((current) => {
        const exists = current.some((item) => item.id === id);
        return exists ? current.map((item) => (item.id === id ? record : item)) : [...current, record];
      });

      logActivity({
        action: isNew ? 'created' : 'updated',
        module: 'users',
        item: `${record.name} (${record.role})`,
        detail: isNew ? 'Invite email sent' : 'User details changed',
      });
    },
    [logActivity]
  );

  const toggleUserStatus = useCallback(
    (id) => {
      const user = users.find((item) => item.id === id);
      if (!user) return;

      const next = user.status === 'Disabled' ? 'Active' : 'Disabled';
      setUsers((current) => current.map((item) => (item.id === id ? { ...item, status: next } : item)));
      logActivity({
        action: 'updated',
        module: 'users',
        item: user.name,
        detail: `Account ${next === 'Active' ? 'enabled' : 'disabled'}`,
        before: `Status: ${user.status}`,
        after: `Status: ${next}`,
      });
    },
    [users, logActivity]
  );

  // --- system emails -------------------------------------------------------
  const updateSystemEmail = useCallback(
    (key, patch) => {
      setSystemEmails((current) =>
        current.map((item) => (item.key === key ? { ...item, ...patch } : item))
      );
      logActivity({
        action: 'updated',
        module: 'settings',
        item: key,
        detail: 'System email template edited',
      });
    },
    [logActivity]
  );

  const resetSystemEmail = useCallback(
    (key) => {
      const original = systemEmailTemplates.find((item) => item.key === key);
      if (!original) return;
      setSystemEmails((current) =>
        current.map((item) => (item.key === key ? { ...original, enabled: item.enabled } : item))
      );
      logActivity({ action: 'updated', module: 'settings', item: key, detail: 'System email reset to default' });
    },
    [logActivity]
  );

  const toggleSystemEmail = useCallback((key) => {
    setSystemEmails((current) =>
      current.map((item) => (item.key === key ? { ...item, enabled: !item.enabled } : item))
    );
  }, []);

  // --- passwords -----------------------------------------------------------
  /**
   * A Super Admin never sees an existing password — there is nothing to see,
   * because only a hash is stored. They can only set a NEW one.
   */
  const setUserPassword = useCallback(
    (userId, { notify }) => {
      const user = users.find((item) => item.id === userId);
      if (!user) return;
      logActivity({
        action: 'updated',
        module: 'users',
        item: user.name,
        detail: notify
          ? 'New password set by Super Admin — “Password set by Super Admin” email sent'
          : 'New password set by Super Admin (no email sent)',
        before: 'Password: unchanged',
        after: 'Password: replaced',
      });
    },
    [users, logActivity]
  );

  const sendPasswordResetLink = useCallback(
    (userId) => {
      const user = users.find((item) => item.id === userId);
      if (!user) return;
      logActivity({
        action: 'sent',
        module: 'users',
        item: user.name,
        detail: '“Forgot password” link emailed by Super Admin',
      });
    },
    [users, logActivity]
  );

  // --- subscribers ---------------------------------------------------------
  const removeSubscribers = useCallback(
    (ids) => {
      setSubscribers((current) => current.filter((item) => !ids.includes(item.id)));
      logActivity({
        action: 'deleted',
        module: 'contacts',
        item: `${ids.length} subscriber(s)`,
        detail: 'Removed from the subscriber list',
      });
    },
    [logActivity]
  );

  // --- bulk actions on campaign recipients ---------------------------------
  /** Used by the failed / bounced clean-up on a campaign report. */
  const bulkRecipientAction = useCallback(
    (kind, ids, campaignName) => {
      const map = {
        resend: { action: 'sent', detail: 'Queued a resend for the selected recipients' },
        remove: { action: 'deleted', detail: 'Removed the selected recipients from this campaign' },
        suppress: { action: 'updated', detail: 'Added the selected addresses to the suppression list' },
        export: { action: 'exported', detail: 'Downloaded the selected recipients' },
      };
      const entry = map[kind] || map.export;
      logActivity({
        action: entry.action,
        module: 'campaigns',
        item: campaignName,
        detail: `${entry.detail} (${ids.length})`,
      });
    },
    [logActivity]
  );

  // --- permission check ----------------------------------------------------
  // roles is guaranteed non-empty by loadList(), but a role saved by an older
  // build may not carry every field, so nothing here assumes a shape.
  const currentRole = useMemo(
    () => roles.find((role) => role.key === viewAs) || roles[0] || ROLES[0],
    [roles, viewAs]
  );

  const can = useCallback(
    (moduleKey, actionKey = 'view') => {
      if (!currentRole) return false;
      if (currentRole.key === 'super_admin') return true;
      const list = currentRole.permissions?.[moduleKey] || [];
      return list.includes(actionKey);
    },
    [currentRole]
  );

  const value = useMemo(
    () => ({
      templates,
      saveTemplate,
      deleteTemplate,
      duplicateTemplate,
      getTemplate,
      images,
      addImage,
      removeImage,
      storageWarning,
      roles,
      createRole,
      updateRole,
      deleteRole,
      duplicateRole,
      togglePermission,
      setModulePermissions,
      users,
      saveUser,
      toggleUserStatus,
      setUserPassword,
      sendPasswordResetLink,
      systemEmails,
      updateSystemEmail,
      resetSystemEmail,
      toggleSystemEmail,
      subscribers,
      removeSubscribers,
      bulkRecipientAction,
      activity,
      logActivity,
      viewAs,
      setViewAs,
      currentRole,
      can,
    }),
    [
      templates,
      saveTemplate,
      deleteTemplate,
      duplicateTemplate,
      getTemplate,
      images,
      addImage,
      removeImage,
      storageWarning,
      roles,
      createRole,
      updateRole,
      deleteRole,
      duplicateRole,
      togglePermission,
      setModulePermissions,
      users,
      saveUser,
      toggleUserStatus,
      setUserPassword,
      sendPasswordResetLink,
      systemEmails,
      updateSystemEmail,
      resetSystemEmail,
      toggleSystemEmail,
      subscribers,
      removeSubscribers,
      bulkRecipientAction,
      activity,
      logActivity,
      viewAs,
      currentRole,
      can,
    ]
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('useWorkspace must be used inside <WorkspaceProvider>');
  return context;
}
