import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { ApiError, api } from '../api/client';
import { useAuth } from './AuthProvider';
import { useToast } from '../components/ui/ToastProvider';
import { useT } from '../i18n/I18nProvider';

/**
 * App ka saara saanjha data — ek hi jagah.
 *
 * Pehle yeh sab browser ke localStorage me rehta tha. Ab server par hai.
 * Farq kya pada:
 *
 *   - Data ab har computer par ek jaisa hai. Pehle aapke browser ka data sirf
 *     aapka tha; team ko kuch dikhta hi nahi tha.
 *   - Browser ka data saaf karne se ab kuch nahi jata.
 *   - localStorage ki 5 MB wali hadd khatam. Photo aur bade list ab server par.
 *
 * Screen ka code bilkul nahi badla — inhi naamon se sab kuch pehle bhi milta
 * tha. Sirf andar ka kaam badla hai.
 */
const WorkspaceContext = createContext(null);

/** "Preview as role" sirf is browser ki cheez hai, isliye yeh yahin rehta hai. */
const VIEW_AS_KEY = 'mailwave.viewAs';

function loadViewAs() {
  try {
    return window.localStorage.getItem(VIEW_AS_KEY) || 'super_admin';
  } catch (error) {
    return 'super_admin';
  }
}

export function WorkspaceProvider({ children }) {
  // Har kaam ke baad screen ke kone me ek message — warna pata hi nahi chalta
  // ki save hua ya nahi.
  const toast = useToast();
  const t = useT();
  const { isSignedIn } = useAuth();

  const [templates, setTemplates] = useState([]);
  const [images, setImages] = useState([]);
  const [roles, setRoles] = useState([]);
  const [users, setUsers] = useState([]);
  const [activity, setActivity] = useState([]);
  const [systemEmails, setSystemEmails] = useState([]);
  const [subscribers, setSubscribers] = useState([]);
  const [viewAs, setViewAsState] = useState(loadViewAs);

  /** Pehli baar data aane tak true. Screen loader dikha sakti hai. */
  const [loading, setLoading] = useState(true);

  // Image ab server par jati hai, isliye browser ki storage ab bhar hi nahi
  // sakti. Yeh sirf isliye rakha hai ki purana screen ka code na toote.
  const storageWarning = false;

  /**
   * Server ki galti ko screen par saaf-saaf dikhata hai.
   *
   * Sabse zaroori baat: yeh galti ko chupata nahi. Pehle localStorage chup-chap
   * fail ho jata tha aur user ko lagta tha ki save ho gaya. Ab agar server ne
   * mana kiya, to user ko turant pata chalta hai aur screen par purana (sahi)
   * data hi rehta hai.
   */
  const fail = useCallback(
    (error) => {
      const message =
        error instanceof ApiError ? error.message : t('toast.networkError');
      toast.error(message);
      return null;
    },
    [toast, t]
  );

  // --- sab kuch ek saath le aao --------------------------------------------
  const reloadAll = useCallback(async () => {
    if (!isSignedIn) return;

    // Sab request ek saath jati hain, ek ke baad ek nahi — warna 7 request ka
    // intezaar jod kar screen der se khulti.
    const [tpl, img, rol, usr, act, sys, sub] = await Promise.all([
      api.get('/api/templates?limit=500').catch(() => null),
      api.get('/api/images').catch(() => null),
      api.get('/api/roles').catch(() => null),
      api.get('/api/users?limit=500').catch(() => null),
      api.get('/api/activity?limit=200').catch(() => null),
      api.get('/api/system-emails').catch(() => null),
      api.get('/api/subscribers?limit=500').catch(() => null),
    ]);

    // Jis cheez ki permission nahi hai uski request 403 se wapas aati hai. Wo
    // galti nahi hai — us user ko wo hissa dikhna hi nahi chahiye. Isliye
    // khali list rakh dete hain aur baaki app chalta rehta hai.
    if (tpl) setTemplates(tpl.templates ?? []);
    if (img) setImages(img.images ?? []);
    if (rol) setRoles(rol.roles ?? []);
    if (usr) setUsers(usr.users ?? []);
    if (act) setActivity(act.activity ?? []);
    if (sys) setSystemEmails(sys.systemEmails ?? []);
    if (sub) setSubscribers(sub.subscribers ?? []);

    setLoading(false);
  }, [isSignedIn]);

  useEffect(() => {
    if (!isSignedIn) {
      // Sign out par sab kuch khali. Agli baar koi aur sign in kare to use
      // pichhle bande ka data ek pal ke liye bhi nahi dikhna chahiye.
      setTemplates([]);
      setImages([]);
      setRoles([]);
      setUsers([]);
      setActivity([]);
      setSystemEmails([]);
      setSubscribers([]);
      setLoading(true);
      return;
    }

    reloadAll();
  }, [isSignedIn, reloadAll]);

  /** Server har kaam ko khud log karta hai, isliye baad me list taazi kar lete hain. */
  const refreshActivity = useCallback(async () => {
    try {
      const data = await api.get('/api/activity?limit=200');
      setActivity(data.activity ?? []);
    } catch (error) {
      // Log dobara na aaye to bhi asli kaam ho chuka hai. Chupchap chhod dete
      // hain — iske liye user ko pareshan karna galat hai.
    }
  }, []);

  // --- templates -----------------------------------------------------------
  const saveTemplate = useCallback(
    async (template) => {
      const isNew = !template.id;
      const body = {
        name: template.name,
        category: template.category ?? 'Custom',
        subject: template.subject ?? '',
        html: template.html ?? '',
      };

      try {
        const data = isNew
          ? await api.post('/api/templates', body)
          : await api.put(`/api/templates/${template.id}`, body);

        const record = data.template;
        setTemplates((current) =>
          isNew
            ? [record, ...current]
            : current.map((item) => (item.id === record.id ? record : item))
        );

        toast.success(t('toast.templateSaved'), record.name);
        refreshActivity();
        return record;
      } catch (error) {
        return fail(error);
      }
    },
    [toast, t, fail, refreshActivity]
  );

  const deleteTemplate = useCallback(
    async (id) => {
      const found = templates.find((item) => item.id === id);
      if (!found) return;

      try {
        await api.delete(`/api/templates/${id}`);
        setTemplates((current) => current.filter((item) => item.id !== id));

        // Delete par sirf "hat gaya" bolna kaafi nahi — wapas laane ka mauka
        // bhi dena chahiye. Galti se delete ho jaye to yahi bachata hai.
        toast.undo(
          t('toast.templateDeleted'),
          async () => {
            const data = await api.post('/api/templates', {
              name: found.name,
              category: found.category,
              subject: found.subject,
              html: found.html,
            });
            setTemplates((current) => [data.template, ...current]);
            refreshActivity();
          },
          found.name
        );
        refreshActivity();
      } catch (error) {
        fail(error);
      }
    },
    [templates, toast, t, fail, refreshActivity]
  );

  const duplicateTemplate = useCallback(
    async (id) => {
      try {
        const data = await api.post(`/api/templates/${id}/duplicate`);
        setTemplates((current) => [data.template, ...current]);
        toast.success(t('toast.templateCopied'), data.template.name);
        refreshActivity();
        return data.template;
      } catch (error) {
        return fail(error);
      }
    },
    [toast, t, fail, refreshActivity]
  );

  const getTemplate = useCallback(
    (id) => templates.find((item) => item.id === id) || null,
    [templates]
  );

  // --- images --------------------------------------------------------------
  const addImage = useCallback(
    async (image) => {
      try {
        const data = await api.post('/api/images', {
          name: image.name,
          url: image.url,
          size: image.size ?? 0,
          source: image.source ?? 'upload',
        });

        setImages((current) => [data.image, ...current]);
        toast.success(t('toast.imageAdded'), data.image.name);
        refreshActivity();
        return data.image;
      } catch (error) {
        return fail(error);
      }
    },
    [toast, t, fail, refreshActivity]
  );

  const removeImage = useCallback(
    async (id) => {
      const removed = images.find((item) => item.id === id) ?? null;

      try {
        await api.delete(`/api/images/${id}`);
        setImages((current) => current.filter((item) => item.id !== id));
        toast.success(t('toast.imageRemoved'), removed?.name);
        refreshActivity();
      } catch (error) {
        fail(error);
      }
    },
    [images, toast, t, fail, refreshActivity]
  );

  // --- roles ---------------------------------------------------------------
  const createRole = useCallback(
    async ({ name, description, tone, icon, copyFrom }) => {
      try {
        // "Copy from" wala raasta server ke duplicate se jata hai, taki poori
        // permissions bilkul waisi hi utrein.
        if (copyFrom) {
          const data = await api.post(`/api/roles/${copyFrom}/duplicate`);
          const made = data.role;

          // Naam aur baaki detail user ne jo di, wo upar chadha dete hain.
          const updated = await api.put(`/api/roles/${made.key}`, {
            label: name,
            desc: description ?? '',
            tone: tone || 'primary',
            icon: icon || 'bi-person',
            permissions: made.permissions,
          });

          setRoles((current) => [...current, updated.role]);
          toast.success(t('toast.roleCreated'), name);
          refreshActivity();
          return updated.role;
        }

        const data = await api.post('/api/roles', {
          key: roleKeyFrom(name),
          label: name,
          desc: description ?? '',
          tone: tone || 'primary',
          icon: icon || 'bi-person',
          permissions: {},
        });

        setRoles((current) => [...current, data.role]);
        toast.success(t('toast.roleCreated'), name);
        refreshActivity();
        return data.role;
      } catch (error) {
        return fail(error);
      }
    },
    [toast, t, fail, refreshActivity]
  );

  const updateRole = useCallback(
    async (key, { name, description, tone, icon }) => {
      const role = roles.find((item) => item.key === key);
      if (!role) return;

      try {
        const data = await api.put(`/api/roles/${key}`, {
          label: name ?? role.label,
          desc: description ?? role.desc ?? '',
          tone: tone ?? role.tone,
          icon: icon ?? role.icon,
          permissions: role.permissions,
        });

        setRoles((current) => current.map((item) => (item.key === key ? data.role : item)));
        toast.success(t('toast.roleUpdated'), name);
        refreshActivity();
      } catch (error) {
        fail(error);
      }
    },
    [roles, toast, t, fail, refreshActivity]
  );

  /**
   * Jis role par log hain wo chup-chap nahi hatta — batate hain kitne logon ke
   * paas hai. Yeh check server par bhi hai; yahan sirf isliye ki turant pata
   * chal jaye aur bekaar ki request na jaye.
   */
  const deleteRole = useCallback(
    async (key) => {
      const role = roles.find((item) => item.key === key);
      if (!role) return { ok: false, reason: 'missing' };

      if (role.locked) {
        toast.warning(t('toast.roleLocked'));
        return { ok: false, reason: 'locked' };
      }

      const inUse = users.filter((user) => user.role === key).length;
      if (inUse > 0) {
        toast.warning(t('toast.roleInUse', { count: inUse }));
        return { ok: false, reason: 'inUse', count: inUse };
      }

      try {
        await api.delete(`/api/roles/${key}`);
        setRoles((current) => current.filter((item) => item.key !== key));
        toast.success(t('toast.roleDeleted'), role.label || role.key);
        refreshActivity();
        return { ok: true };
      } catch (error) {
        fail(error);
        return { ok: false, reason: 'server' };
      }
    },
    [roles, users, toast, t, fail, refreshActivity]
  );

  const duplicateRole = useCallback(
    async (key) => {
      try {
        const data = await api.post(`/api/roles/${key}/duplicate`);
        setRoles((current) => [...current, data.role]);
        toast.success(t('toast.roleCreated'), data.role.label);
        refreshActivity();
        return data.role;
      } catch (error) {
        return fail(error);
      }
    },
    [toast, t, fail, refreshActivity]
  );

  // --- permissions ---------------------------------------------------------
  /**
   * Ek checkbox dabane par poori permissions server ko bhejte hain.
   *
   * Yahan ek chhota trick hai: screen turant badal jati hai (taki checkbox
   * atke nahi), aur server ke jawab ka baad me intezaar hota hai. Server ne
   * mana kar diya to purani haalat wapas aa jati hai — screen kabhi jhooth
   * nahi bolti.
   */
  const savePermissions = useCallback(
    async (roleKey, nextPermissions) => {
      const role = roles.find((item) => item.key === roleKey);
      if (!role || role.locked) return;

      const before = role.permissions;

      setRoles((current) =>
        current.map((item) =>
          item.key === roleKey ? { ...item, permissions: nextPermissions } : item
        )
      );

      try {
        const data = await api.put(`/api/roles/${roleKey}`, {
          label: role.label,
          desc: role.desc ?? '',
          tone: role.tone,
          icon: role.icon,
          permissions: nextPermissions,
        });
        setRoles((current) => current.map((item) => (item.key === roleKey ? data.role : item)));
        refreshActivity();
      } catch (error) {
        setRoles((current) =>
          current.map((item) => (item.key === roleKey ? { ...item, permissions: before } : item))
        );
        fail(error);
      }
    },
    [roles, fail, refreshActivity]
  );

  const togglePermission = useCallback(
    (roleKey, moduleKey, actionKey) => {
      const role = roles.find((item) => item.key === roleKey);
      if (!role || role.locked) return;

      const list = role.permissions?.[moduleKey] || [];
      const next = list.includes(actionKey)
        ? list.filter((item) => item !== actionKey)
        : [...list, actionKey];

      savePermissions(roleKey, { ...role.permissions, [moduleKey]: next });
    },
    [roles, savePermissions]
  );

  const setModulePermissions = useCallback(
    (roleKey, moduleKey, actions) => {
      const role = roles.find((item) => item.key === roleKey);
      if (!role || role.locked) return;

      savePermissions(roleKey, { ...role.permissions, [moduleKey]: actions });

      // Ek-ek checkbox par toast nahi dete (checkbox khud dikh jata hai), par
      // "sab chuno" ek bada badlaav hai — uska batana chahiye.
      toast.success(t('toast.permissionsChanged'));
    },
    [roles, savePermissions, toast, t]
  );

  // --- users ---------------------------------------------------------------
  const saveUser = useCallback(
    async (user) => {
      const isNew = !user.id;
      const body = {
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department ?? '',
        status: user.status ?? (isNew ? 'Invited' : 'Active'),
      };

      try {
        const data = isNew
          ? await api.post('/api/users', body)
          : await api.put(`/api/users/${user.id}`, body);

        const record = data.user;
        setUsers((current) =>
          isNew
            ? [...current, record]
            : current.map((item) => (item.id === record.id ? record : item))
        );

        // Naya user bana = invite email gaya. Purana = sirf details badli.
        toast.success(isNew ? t('toast.userInvited') : t('toast.userSaved'), record.name);
        refreshActivity();
        return record;
      } catch (error) {
        return fail(error);
      }
    },
    [toast, t, fail, refreshActivity]
  );

  const toggleUserStatus = useCallback(
    async (id) => {
      const user = users.find((item) => item.id === id);
      if (!user) return;

      const next = user.status === 'Disabled' ? 'Active' : 'Disabled';

      try {
        const data = await api.put(`/api/users/${id}`, {
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department ?? '',
          status: next,
        });

        setUsers((current) => current.map((item) => (item.id === id ? data.user : item)));
        toast.success(next === 'Active' ? t('toast.userEnabled') : t('toast.userDisabled'), user.name);
        refreshActivity();
      } catch (error) {
        fail(error);
      }
    },
    [users, toast, t, fail, refreshActivity]
  );

  /**
   * Super Admin kisi ka purana password kabhi nahi dekh sakta — dekhne ko kuch
   * hai hi nahi, server par sirf uska scrambled roop rakha hota hai. Wo sirf
   * naya password set kar sakta hai.
   */
  const setUserPassword = useCallback(
    async (userId, { password, notify } = {}) => {
      if (!password) return fail(new ApiError(400, 'bad_request', t('toast.passwordNeeded')));

      try {
        await api.post(`/api/users/${userId}/password`, { password, notify: notify !== false });
        toast.success(t('toast.passwordSet'));
        refreshActivity();
        return true;
      } catch (error) {
        return fail(error);
      }
    },
    [toast, t, fail, refreshActivity]
  );

  const sendPasswordResetLink = useCallback(
    async (userId) => {
      try {
        await api.post(`/api/users/${userId}/reset-link`);
        toast.success(t('toast.resetLinkSent'));
        refreshActivity();
        return true;
      } catch (error) {
        return fail(error);
      }
    },
    [toast, t, fail, refreshActivity]
  );

  // --- system emails -------------------------------------------------------
  const updateSystemEmail = useCallback(
    async (key, patch) => {
      const existing = systemEmails.find((item) => item.key === key);
      if (!existing) return;

      try {
        const data = await api.put(`/api/system-emails/${key}`, {
          subject: patch.subject ?? existing.subject,
          html: patch.html ?? existing.html,
        });

        setSystemEmails((current) =>
          current.map((item) => (item.key === key ? { ...item, ...data.systemEmail } : item))
        );
        toast.success(t('toast.systemEmailSaved'));
        refreshActivity();
      } catch (error) {
        fail(error);
      }
    },
    [systemEmails, toast, t, fail, refreshActivity]
  );

  const resetSystemEmail = useCallback(
    async (key) => {
      try {
        const data = await api.post(`/api/system-emails/${key}/reset`);
        setSystemEmails((current) =>
          current.map((item) => (item.key === key ? { ...item, ...data.systemEmail } : item))
        );
        toast.success(t('toast.systemEmailReset'));
        refreshActivity();
      } catch (error) {
        fail(error);
      }
    },
    [toast, t, fail, refreshActivity]
  );

  const toggleSystemEmail = useCallback(
    async (key) => {
      const existing = systemEmails.find((item) => item.key === key);
      if (!existing) return;

      try {
        const data = await api.post(`/api/system-emails/${key}/toggle`, {
          enabled: !existing.enabled,
        });
        setSystemEmails((current) =>
          current.map((item) => (item.key === key ? { ...item, ...data.systemEmail } : item))
        );
        refreshActivity();
      } catch (error) {
        // Zaroori email band karne ki koshish yahin ruk jati hai, saaf wajah
        // ke saath.
        fail(error);
      }
    },
    [systemEmails, fail, refreshActivity]
  );

  // --- subscribers ---------------------------------------------------------
  const removeSubscribers = useCallback(
    async (ids) => {
      const removed = subscribers.filter((item) => ids.includes(item.id));

      try {
        await api.post('/api/subscribers/delete', { ids });
        setSubscribers((current) => current.filter((item) => !ids.includes(item.id)));

        toast.undo(t('toast.subscribersRemoved', { count: ids.length }), async () => {
          // Wapas laate hain — server par nayi entry ban jati hai, isliye baad
          // me poori list dobara le aate hain taki id sahi rahe.
          for (const person of removed) {
            await api.post('/api/subscribers', {
              name: person.name,
              email: person.email,
              company: person.company,
              city: person.city,
            });
          }
          const data = await api.get('/api/subscribers?limit=500');
          setSubscribers(data.subscribers ?? []);
        });

        refreshActivity();
      } catch (error) {
        fail(error);
      }
    },
    [subscribers, toast, t, fail, refreshActivity]
  );

  // --- campaign recipients par bulk kaam -----------------------------------
  /** Campaign report par "failed / bounced" saaf karne ke liye. */
  const bulkRecipientAction = useCallback(
    async (kind, ids, campaignName) => {
      try {
        await api.post('/api/campaigns/recipients/bulk', { kind, ids, campaignName });
        refreshActivity();
        return true;
      } catch (error) {
        return fail(error);
      }
    },
    [fail, refreshActivity]
  );

  // --- permission check ----------------------------------------------------
  const setViewAs = useCallback((next) => {
    setViewAsState(next);
    try {
      window.localStorage.setItem(VIEW_AS_KEY, next);
    } catch (error) {
      // Storage band hai — sirf is session ke liye chalega, koi nuksaan nahi.
    }
  }, []);

  const currentRole = useMemo(
    () => roles.find((role) => role.key === viewAs) || roles[0] || null,
    [roles, viewAs]
  );

  const can = useCallback(
    (moduleKey, actionKey = 'view') => {
      // Roles abhi aaye hi nahi (pehla load chal raha hai) — tab tak "haan"
      // bolte hain. Asli rok server par hai; wahan bina permission kuch hota
      // hi nahi. Agar yahan "na" bolte to screen ek pal ke liye khali dikhti.
      if (!currentRole) return loading;
      if (currentRole.key === 'super_admin') return true;

      const list = currentRole.permissions?.[moduleKey] || [];
      return list.includes(actionKey);
    },
    [currentRole, loading]
  );

  const value = useMemo(
    () => ({
      loading,
      reloadAll,
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
      viewAs,
      setViewAs,
      currentRole,
      can,
    }),
    [
      loading,
      reloadAll,
      templates,
      saveTemplate,
      deleteTemplate,
      duplicateTemplate,
      getTemplate,
      images,
      addImage,
      removeImage,
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
      viewAs,
      setViewAs,
      currentRole,
      can,
    ]
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

/**
 * Role ke naam se uski key banata hai — "Content Writer" se "content_writer".
 * Key hi database me jati hai, isliye usme sirf chhote akshar aur _ chalte
 * hain.
 */
function roleKeyFrom(name) {
  const base = String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 30);

  // Naam agar poora hindi/gujarati me ho to upar wali safai ke baad kuch bach
  // hi nahi sakta — tab ek apne aap wala naam de dete hain.
  return /^[a-z]/.test(base) ? base : `role_${Date.now().toString(36)}`;
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('useWorkspace must be used inside <WorkspaceProvider>');
  return context;
}
