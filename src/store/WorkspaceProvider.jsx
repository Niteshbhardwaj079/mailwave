import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { PERMISSION_MODULES, ROLES, activityLog, teamUsers } from '../data/adminData';
import { starterTemplates } from '../data/starterHtml';
import { systemEmailTemplates } from '../data/systemEmails';
import { subscribers as seedSubscribers } from '../data/mockData';
import { newId } from '../utils/ids';
import { useToast } from '../components/ui/ToastProvider';
import { useT } from '../i18n/I18nProvider';

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
  // Har kaam ke baad screen ke kone me ek message — warna pata hi nahi chalta
  // ki save hua ya nahi.
  const toast = useToast();
  const t = useT();

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

  /**
   * Browser me save karna — ek hi jagah se, aur FAIL HONE PAR CHUP NAHI.
   *
   * Do dikkatein theek karta hai:
   *
   * 1. Browser ki storage bhar sakti hai (lagbhag 5 MB). 50,000 log daalo to
   *    save fail ho jata hai. Pehle yeh CHUP-CHAP fail hota tha — user ko
   *    lagta data save ho gaya, hota nahi. Ab saaf message aata hai.
   *
   * 2. Har akshar par JSON.stringify chalana bade data par screen ko rok deta
   *    hai. Isliye 400ms ruk kar likhte hain — beech me aur badlaav aaye to
   *    sirf aakhri wala likha jata hai.
   */
  const saveTimers = useRef(new Map());
  const warnedRef = useRef(false);

  const persist = useCallback(
    (key, value) => {
      const timers = saveTimers.current;
      clearTimeout(timers.get(key));

      timers.set(
        key,
        setTimeout(() => {
          const ok = save(key, value);
          timers.delete(key);

          if (!ok) {
            setStorageWarning(true);
            // Ek hi baar bolte hain — har keystroke par toast bhar dena aur
            // bura hota.
            if (!warnedRef.current) {
              warnedRef.current = true;
              toast.error(t('toast.storageFull'));
            }
          }
        }, 400)
      );
    },
    [toast, t]
  );

  // Component hatne par bache hue timers saaf — warna React warning deta hai.
  useEffect(() => {
    const timers = saveTimers.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  useEffect(() => persist(KEYS.templates, templates), [templates, persist]);
  useEffect(() => persist(KEYS.images, images), [images, persist]);
  useEffect(() => persist(KEYS.roles, roles), [roles, persist]);
  useEffect(() => persist(KEYS.users, users), [users, persist]);
  useEffect(() => persist(KEYS.activity, activity), [activity, persist]);
  useEffect(() => persist(KEYS.viewAs, viewAs), [viewAs, persist]);
  useEffect(() => persist(KEYS.systemEmails, systemEmails), [systemEmails, persist]);
  useEffect(() => persist(KEYS.subscribers, subscribers), [subscribers, persist]);

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

      toast.success(t('toast.templateSaved'), record.name);
      return record;
    },
    [logActivity, toast, t]
  );

  const deleteTemplate = useCallback(
    (id) => {
      const found = templates.find((item) => item.id === id);
      if (!found) return;

      setTemplates((current) => current.filter((item) => item.id !== id));
      logActivity({ action: 'deleted', module: 'templates', item: found.name, detail: 'Template removed' });

      // Delete par sirf "hat gaya" bolna kaafi nahi — wapas laane ka mauka bhi
      // dena chahiye. Galti se delete ho jaye to yahi bachata hai.
      toast.undo(t('toast.templateDeleted'), () => setTemplates((current) => [found, ...current]), found.name);
    },
    [templates, logActivity, toast, t]
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

      toast.success(t('toast.templateCopied'), copy.name);
      return copy;
    },
    [templates, logActivity, toast, t]
  );

  const getTemplate = useCallback((id) => templates.find((item) => item.id === id) || null, [templates]);

  // --- images --------------------------------------------------------------
  const addImage = useCallback(
    (image) => {
      const record = { id: newId('img'), addedAt: nowStamp(), ...image };
      setImages((current) => [record, ...current]);
      logActivity({ action: 'created', module: 'templates', item: record.name, detail: 'Image added to the library' });

      toast.success(t('toast.imageAdded'), record.name);
      return record;
    },
    [logActivity, toast, t]
  );

  const removeImage = useCallback(
    (id) => {
      // Pehle padho, phir badlo. setState ke updater ke andar kuch aur karna
      // mana hai — React use do baar chalata hai, aur toast do baar aa jata.
      const removed = images.find((item) => item.id === id) ?? null;

      setImages((current) => current.filter((item) => item.id !== id));
      toast.success(t('toast.imageRemoved'), removed?.name);
    },
    [images, toast, t]
  );

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

      toast.success(t('toast.roleCreated'), name);
      return record;
    },
    [roles, emptyPermissions, logActivity, toast, t]
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
      toast.success(t('toast.roleUpdated'), name);
    },
    [logActivity, toast, t]
  );

  /**
   * A role in use is never silently removed — the caller is told how many
   * people still have it so it can show a clear message.
   */
  const deleteRole = useCallback(
    (key) => {
      const role = roles.find((item) => item.key === key);
      if (!role) return { ok: false, reason: 'missing' };

      if (role.locked) {
        toast.warning(t('toast.roleLocked'));
        return { ok: false, reason: 'locked' };
      }

      const inUse = users.filter((user) => user.role === key).length;
      if (inUse > 0) {
        // Chup-chap mana nahi karte — batate hain ki kitne logon ke paas hai
        // aur pehle kya karna hai.
        toast.warning(t('toast.roleInUse', { count: inUse }));
        return { ok: false, reason: 'inUse', count: inUse };
      }

      setRoles((current) => current.filter((item) => item.key !== key));
      logActivity({
        action: 'deleted',
        module: 'users',
        item: role.label || role.key,
        detail: 'Role removed',
        before: `Role: ${role.label || role.key}`,
      });

      toast.success(t('toast.roleDeleted'), role.label || role.key);
      return { ok: true };
    },
    [roles, users, logActivity, toast, t]
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

      // Ek-ek checkbox par toast nahi dete (checkbox khud dikh jata hai), par
      // "sab chuno" ek bada badlaav hai — uska batana chahiye.
      toast.success(t('toast.permissionsChanged'));
    },
    [logActivity, toast, t]
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

      // Naya user bana = invite gaya. Purana user = sirf details badli.
      toast.success(isNew ? t('toast.userInvited') : t('toast.userSaved'), record.name);
    },
    [logActivity, toast, t]
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

      toast.success(next === 'Active' ? t('toast.userEnabled') : t('toast.userDisabled'), user.name);
    },
    [users, logActivity, toast, t]
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
      // Wapas laane ke liye pehle copy rakh lete hain.
      const removed = subscribers.filter((item) => ids.includes(item.id));

      setSubscribers((current) => current.filter((item) => !ids.includes(item.id)));
      logActivity({
        action: 'deleted',
        module: 'contacts',
        item: `${ids.length} subscriber(s)`,
        detail: 'Removed from the subscriber list',
      });

      toast.undo(t('toast.subscribersRemoved', { count: ids.length }), () =>
        setSubscribers((current) => [...removed, ...current])
      );
    },
    [subscribers, logActivity, toast, t]
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
