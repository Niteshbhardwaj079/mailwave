import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import PageHeader from '../components/ui/PageHeader';
import HelpButton from '../components/ui/HelpButton';
import { useI18n } from '../i18n/I18nProvider';
import { useTheme } from '../theme/ThemeProvider';
import { appConfig } from '../config/appConfig';
import { THEME_MODES } from '../config/themeColors';
import { Card, CardBody, CardFoot, CardHead } from '../components/ui/Card';
import { Note } from '../components/ui/Controls';
import StatusPill from '../components/ui/StatusPill';
import Sheet from '../components/ui/Sheet';
import EmptyState from '../components/ui/EmptyState';
import { useAuth } from '../store/AuthProvider';
import { useWorkspace } from '../store/WorkspaceProvider';
import { useApi } from '../api/useApi';
import { ApiError, api, apiBase } from '../api/client';
import { useToast } from '../components/ui/ToastProvider';
import { formatDateTime, formatNumber } from '../utils/format';
import { estimateSendTime, formatEstimate } from '../utils/sendEstimate';
import { batchOptionLabel, batchOptions } from '../data/constants';
import { LANGUAGES } from '../i18n/languages';
import { STORAGE_PROVIDERS, findStorageProvider } from '../data/storageProviders';

const SECTIONS = [
  { key: 'profile', labelKey: 'topbar.profile', icon: 'bi-person' },
  { key: 'appearance', labelKey: 'set.appearance', icon: 'bi-palette' },
  { key: 'language', labelKey: 'set.language', icon: 'bi-translate' },
  { key: 'accounts', labelKey: 'nav.accounts', icon: 'bi-envelope-at' },
  { key: 'sending', labelKey: 'set.sending', icon: 'bi-send' },
  { key: 'tracking', labelKey: 'set.tracking', icon: 'bi-eye' },
  { key: 'templates', labelKey: 'set.templateOptions', icon: 'bi-file-earmark-text' },
  { key: 'contacts', labelKey: 'nav.contacts', icon: 'bi-people' },
  { key: 'unsubscribe', labelKey: 'set.unsubscribe', icon: 'bi-box-arrow-right' },
  { key: 'storage', labelKey: 'set.storage', icon: 'bi-hdd-network' },
  { key: 'imageStorage', labelKey: 'set.imageStorageTitle', icon: 'bi-images' },
  { key: 'backup', labelKey: 'set.backup', icon: 'bi-shield-check' },
  { key: 'security', labelKey: 'topbar.security', icon: 'bi-shield-lock' },
  { key: 'api', labelKey: 'set.api', icon: 'bi-code-slash' },
  { key: 'webhooks', labelKey: 'set.webhooks', icon: 'bi-broadcast' },
];

const DELIVERY_TONE = { pending: 'warning', delivered: 'success', failed: 'danger' };

/** null/0 -> khali field (koi limit set nahi) — {value:'', unit:'MB'}. Warna MB/GB me, jo bhi saaf number bane. */
function bytesToDraftField(bytes) {
  if (!Number.isInteger(bytes) || bytes <= 0) return { value: '', unit: 'MB' };
  const useGb = bytes >= 1024 * 1024 * 1024 && bytes % (1024 * 1024 * 1024) === 0;
  return {
    value: useGb ? bytes / 1024 / 1024 / 1024 : Math.round(bytes / 1024 / 1024),
    unit: useGb ? 'GB' : 'MB',
  };
}

/** Ulta: draft ki value/unit se bytes — khali value ho to null (koi limit set nahi). */
function draftFieldToBytes(value, unit) {
  if (value === '' || value === null || value === undefined) return null;
  const mult = unit === 'GB' ? 1024 * 1024 * 1024 : 1024 * 1024;
  return Math.round(Number(value) * mult);
}

function SwitchRow({ id, title, desc, checked, onChange, disabled }) {
  return (
    <div className="mw-switchrow">
      <div className="mw-switchrow__body">
        <div className="mw-switchrow__title">{title}</div>
        <p className="mw-switchrow__desc mb-0">{desc}</p>
      </div>
      <div className="form-check form-switch">
        <input
          className="form-check-input"
          type="checkbox"
          role="switch"
          id={id}
          checked={checked}
          onChange={onChange}
          disabled={disabled}
        />
        <label className="form-check-label visually-hidden" htmlFor={id}>
          {title}
        </label>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { t, language, languages, setLanguage } = useI18n();
  const { mode, setMode, accent, setAccent, accents } = useTheme();
  const toast = useToast();
  const [section, setSection] = useState('profile');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);

  // Jo abhi sign in hai uski apni detail — profile isi ko badalti hai.
  const { user, reloadSession } = useAuth();
  const { can } = useWorkspace();
  const canEditSettings = can('settings', 'edit');

  // --- profile ---------------------------------------------------------------
  const [profileName, setProfileName] = useState(user?.name ?? '');
  const [profileDepartment, setProfileDepartment] = useState(user?.department ?? '');
  const [profileLanguage, setProfileLanguage] = useState(user?.language ?? 'en');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');

  // user context load hone ke baad (ya kisi aur tab me badalne ke baad) box
  // usi se bhar jaaye.
  useEffect(() => {
    setProfileName(user?.name ?? '');
    setProfileDepartment(user?.department ?? '');
    setProfileLanguage(user?.language ?? 'en');
  }, [user?.name, user?.department, user?.language]);

  async function saveProfile() {
    if (!profileName.trim()) {
      setProfileError(t('set.nameNeeded'));
      return;
    }
    setProfileSaving(true);
    setProfileError('');
    try {
      await api.put('/api/auth/me', {
        name: profileName.trim(),
        department: profileDepartment.trim(),
        language: profileLanguage,
      });
      await reloadSession();
      toast.success(t('set.profileSaved'));
    } catch (error) {
      setProfileError(error instanceof ApiError ? error.message : t('toast.networkError'));
    } finally {
      setProfileSaving(false);
    }
  }

  // --- security / password ----------------------------------------------------
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [securitySaving, setSecuritySaving] = useState(false);
  const [securityError, setSecurityError] = useState('');
  const [securityDone, setSecurityDone] = useState('');

  async function changePassword() {
    setSecurityError('');
    setSecurityDone('');
    if (!currentPassword) {
      setSecurityError(t('set.needCurrentPassword'));
      return;
    }
    if (newPassword.length < 8) {
      setSecurityError(t('auth.errShort'));
      return;
    }

    setSecuritySaving(true);
    try {
      await api.post('/api/auth/change-password', { currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setSecurityDone(t('set.passwordChanged'));
      toast.success(t('set.passwordChanged'));
    } catch (error) {
      setSecurityError(error instanceof ApiError ? error.message : t('toast.networkError'));
    } finally {
      setSecuritySaving(false);
    }
  }

  // --- workspace settings (sending/tracking/contacts/unsubscribe) ------------
  //
  // Chaaron ek hi table se aate hain (settings, key se). Load ek hi baar hoti
  // hai; har card apna khud ka draft rakhta hai taaki ek card badalne se
  // doosre ka "unsaved" nishaan na lag jaye.
  const settingsCall = useApi('/api/settings');
  const serverSettings = settingsCall.data?.settings ?? {};

  const [sendingDraft, setSendingDraft] = useState(null);
  const [estimateSampleSize, setEstimateSampleSize] = useState(1000);
  const [trackingDraft, setTrackingDraft] = useState(null);
  const [contactsDraft, setContactsDraft] = useState(null);
  const [unsubDraft, setUnsubDraft] = useState(null);
  // templateSourcesSaved = aakhri baar server par jo save hua tha (Cancel
  // isi par wapas jaata hai); templateSourcesDraft = abhi-abhi ho raha edit,
  // jab tak Save na dabaya jaaye kabhi server tak nahi jaata.
  const [templateSourcesDraft, setTemplateSourcesDraft] = useState(null);
  const [templateSourcesSaved, setTemplateSourcesSaved] = useState(null);
  // imageStorageSaved/Draft — bilkul templateSources jaisa hi pattern (Cancel
  // aakhri saved value par wapas jaata hai, Save na dabaya ho to server tak
  // kuch nahi jaata).
  const [imageStorageDraft, setImageStorageDraft] = useState(null);
  const [imageStorageSaved, setImageStorageSaved] = useState(null);
  // backupDraft.maxStorageValue/Unit — server sirf bytes rakhta hai; yeh
  // draft me MB/GB me dikhata hai, save karte waqt hi bytes me wapas jodta hai.
  const [backupDraft, setBackupDraft] = useState(null);
  // Dono khali (null) rakh sakte ho — tab Backups/Media Library sirf "kitna
  // use hua" dikhate hain, percentage nahi (koi fake number banaya nahi jata).
  const [storageLimitsDraft, setStorageLimitsDraft] = useState(null);
  const [storageLimitsSaved, setStorageLimitsSaved] = useState(null);
  const [savingKey, setSavingKey] = useState('');

  useEffect(() => {
    if (serverSettings.sending && !sendingDraft) setSendingDraft(serverSettings.sending);
    if (serverSettings.tracking && !trackingDraft) setTrackingDraft(serverSettings.tracking);
    if (serverSettings.contacts && !contactsDraft) setContactsDraft(serverSettings.contacts);
    if (serverSettings.unsubscribe && !unsubDraft) {
      // Purane saved settings me `applyGlobally` nahi hoga — default false
      // (per-account) rakhte hain taaki checkbox hamesha ek pakka boolean
      // dikhaye, kabhi undefined nahi.
      setUnsubDraft({ applyGlobally: false, ...serverSettings.unsubscribe });
    }
    // Row abhi tak DB me na bhi ho (is setting ke aane se pehle ki production
    // database) — tab bhi sab `true` maan kar dikhate hain, backend ka
    // enabledTemplateSources() bhi isi tarah default karta hai. Isliye
    // `settingsCall.loading` khatam hone ka intezaar karte hain, `.templateSources`
    // ke maujood hone ka nahi — warna spinner hamesha ke liye ghoomta reh jaata.
    if (!settingsCall.loading && !templateSourcesDraft) {
      const value = { custom: true, html_upload: true, builder: true, ...(serverSettings.templateSources || {}) };
      setTemplateSourcesDraft(value);
      setTemplateSourcesSaved(value);
    }
    // Row missing ho (aaj production ka haal, is setting ke aane se pehle)
    // to bhi dono `true` maan kar dikhate hain — backend ka
    // resolveImageStorageMode() bhi isi tarah default karta hai, aur yehi
    // aaj (is feature se pehle) ka asli behavior bhi hai.
    if (!settingsCall.loading && !imageStorageDraft) {
      const value = { db: true, external: true, ...(serverSettings.imageStorage || {}) };
      setImageStorageDraft(value);
      setImageStorageSaved(value);
    }
    // Row missing ho (is setting se pehle ki production) to bhi backend ke
    // defaults (2 mahine, 500 MB) hi dikhate hain — services/backup.js ka
    // getBackupSettings() bhi isi tarah default karta hai.
    if (!settingsCall.loading && !backupDraft) {
      const raw = serverSettings.backupSettings || {};
      const bytes = Number.isInteger(raw.maxStorageBytes) ? raw.maxStorageBytes : 500 * 1024 * 1024;
      const useGb = bytes >= 1024 * 1024 * 1024 && bytes % (1024 * 1024 * 1024) === 0;
      setBackupDraft({
        retentionMonths: Number.isInteger(raw.retentionMonths) ? raw.retentionMonths : 2,
        maxStorageValue: useGb ? bytes / 1024 / 1024 / 1024 : Math.round(bytes / 1024 / 1024),
        maxStorageUnit: useGb ? 'GB' : 'MB',
      });
    }
    // Yeh dono hamesha OPTIONAL hain (schema `.nullable()`) — na set kiya ho
    // to draft me khali string rakhte hain, "0 MB" nahi (warna lagta jaise
    // koi asli limit hai).
    if (!settingsCall.loading && !storageLimitsDraft) {
      const raw = serverSettings.storageLimits || {};
      const db = bytesToDraftField(raw.databaseBytes);
      const media = bytesToDraftField(raw.mediaBytes);
      const value = {
        databaseValue: db.value,
        databaseUnit: db.unit,
        mediaValue: media.value,
        mediaUnit: media.unit,
      };
      setStorageLimitsDraft(value);
      setStorageLimitsSaved(value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverSettings, settingsCall.loading]);

  const isTemplateSourcesDirty =
    templateSourcesDraft && templateSourcesSaved && JSON.stringify(templateSourcesDraft) !== JSON.stringify(templateSourcesSaved);

  function cancelTemplateSourcesDraft() {
    setTemplateSourcesDraft(templateSourcesSaved);
  }

  const isMediaLimitDirty =
    storageLimitsDraft &&
    storageLimitsSaved &&
    (storageLimitsDraft.mediaValue !== storageLimitsSaved.mediaValue ||
      storageLimitsDraft.mediaUnit !== storageLimitsSaved.mediaUnit);

  const isImageStorageDirty =
    (imageStorageDraft && imageStorageSaved && JSON.stringify(imageStorageDraft) !== JSON.stringify(imageStorageSaved)) ||
    isMediaLimitDirty;

  function cancelImageStorageDraft() {
    setImageStorageDraft(imageStorageSaved);
    setStorageLimitsDraft((current) => ({
      ...current,
      mediaValue: storageLimitsSaved.mediaValue,
      mediaUnit: storageLimitsSaved.mediaUnit,
    }));
  }

  /** Returns true on success — kuch callers (jaise Template Options) ko save ke baad apna "last saved" snapshot bhi update karna hota hai. */
  async function saveWorkspaceSetting(key, value) {
    setSavingKey(key);
    try {
      await api.put(`/api/settings/${key}`, value);
      toast.success(t('toast.settingsSaved'));
      return true;
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('toast.networkError'));
      return false;
    } finally {
      setSavingKey('');
    }
  }

  async function saveTemplateSources() {
    const ok = await saveWorkspaceSetting('templateSources', templateSourcesDraft);
    if (ok) setTemplateSourcesSaved(templateSourcesDraft);
  }

  async function saveImageStorage() {
    const ok = await saveWorkspaceSetting('imageStorage', imageStorageDraft);
    if (ok) setImageStorageSaved(imageStorageDraft);
    await saveStorageLimits();
  }

  async function saveBackupSettings() {
    const mult = backupDraft.maxStorageUnit === 'GB' ? 1024 * 1024 * 1024 : 1024 * 1024;
    await saveWorkspaceSetting('backupSettings', {
      retentionMonths: backupDraft.retentionMonths,
      maxStorageBytes: Math.round(Number(backupDraft.maxStorageValue || 0) * mult),
    });
    await saveStorageLimits();
  }

  /** Backups aur Media Library, dono ke "kitna bhara hai" bar ke liye — dono optional. */
  async function saveStorageLimits() {
    const ok = await saveWorkspaceSetting('storageLimits', {
      databaseBytes: draftFieldToBytes(storageLimitsDraft.databaseValue, storageLimitsDraft.databaseUnit),
      mediaBytes: draftFieldToBytes(storageLimitsDraft.mediaValue, storageLimitsDraft.mediaUnit),
    });
    if (ok) setStorageLimitsSaved(storageLimitsDraft);
  }

  // --- API keys ---------------------------------------------------------------
  const apiKeysCall = useApi('/api/api-keys');
  const apiKeys = apiKeysCall.data?.keys ?? [];

  const [createKeyOpen, setCreateKeyOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [creatingKey, setCreatingKey] = useState(false);
  const [createKeyError, setCreateKeyError] = useState('');
  // Asli key sirf isi state me, sirf banne ke turant baad — kahin save nahi
  // hoti, page chhodte hi hamesha ke liye chali jati hai.
  const [revealedKey, setRevealedKey] = useState(null);
  const [copied, setCopied] = useState(false);
  const [revokeFor, setRevokeFor] = useState(null);

  function openCreateKey() {
    setNewKeyName('');
    setCreateKeyError('');
    setCreateKeyOpen(true);
  }

  async function createKey() {
    if (!newKeyName.trim()) {
      setCreateKeyError(t('set.apiKeyNameNeeded'));
      return;
    }
    setCreatingKey(true);
    setCreateKeyError('');
    try {
      const data = await api.post('/api/api-keys', { name: newKeyName.trim() });
      setCreateKeyOpen(false);
      setRevealedKey(data.key);
      apiKeysCall.reload();
    } catch (error) {
      setCreateKeyError(error instanceof ApiError ? error.message : t('toast.networkError'));
    } finally {
      setCreatingKey(false);
    }
  }

  function copyRevealedKey() {
    navigator.clipboard?.writeText(revealedKey.token);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function closeRevealedKey() {
    setRevealedKey(null);
    setCopied(false);
  }

  async function confirmRevokeKey() {
    const key = revokeFor;
    setRevokeFor(null);
    if (!key) return;
    try {
      await api.delete(`/api/api-keys/${key.id}`);
      apiKeysCall.reload();
      toast.success(t('set.apiKeyRevoked'), key.name);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('toast.networkError'));
    }
  }

  // --- webhooks ----------------------------------------------------------------
  const webhookCall = useApi('/api/webhooks');
  const webhook = webhookCall.data?.webhook ?? null;
  const deliveriesCall = useApi('/api/webhooks/deliveries', { deps: [section] });
  const deliveries = deliveriesCall.data?.deliveries ?? [];

  const [webhookUrlDraft, setWebhookUrlDraft] = useState('');
  const [webhookEnabledDraft, setWebhookEnabledDraft] = useState(false);
  const [webhookSaving, setWebhookSaving] = useState(false);
  const [webhookTesting, setWebhookTesting] = useState(false);
  const [webhookTestResult, setWebhookTestResult] = useState(null);
  const [rotateConfirmOpen, setRotateConfirmOpen] = useState(false);
  const [rotatingSecret, setRotatingSecret] = useState(false);
  // Asli secret sirf isi state me, sirf banne/badalne ke turant baad.
  const [revealedSecret, setRevealedSecret] = useState(null);
  const [secretCopied, setSecretCopied] = useState(false);

  useEffect(() => {
    if (webhook) {
      setWebhookUrlDraft(webhook.url);
      setWebhookEnabledDraft(webhook.enabled);
    }
  }, [webhook]);

  async function saveWebhook() {
    setWebhookSaving(true);
    setWebhookTestResult(null);
    try {
      await api.put('/api/webhooks', { url: webhookUrlDraft.trim(), enabled: webhookEnabledDraft });
      webhookCall.reload();
      toast.success(t('toast.webhookSaved'));
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('toast.networkError'));
    } finally {
      setWebhookSaving(false);
    }
  }

  async function testWebhook() {
    setWebhookTesting(true);
    setWebhookTestResult(null);
    try {
      const data = await api.post('/api/webhooks/test');
      setWebhookTestResult(data);
      if (data.ok) toast.success(t('toast.webhookTestSent'));
      else toast.error(t('set.webhookTestFailed'));
      deliveriesCall.reload();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('toast.networkError'));
    } finally {
      setWebhookTesting(false);
    }
  }

  async function rotateSecret() {
    setRotatingSecret(true);
    try {
      const data = await api.post('/api/webhooks/rotate-secret');
      setRotateConfirmOpen(false);
      setRevealedSecret(data.secret);
      webhookCall.reload();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('toast.networkError'));
    } finally {
      setRotatingSecret(false);
    }
  }

  function copyRevealedSecret() {
    navigator.clipboard?.writeText(revealedSecret);
    setSecretCopied(true);
    window.setTimeout(() => setSecretCopied(false), 1800);
  }

  // --- Image Storage (client ka apna S3-compatible bucket) -------------------
  const storageCall = useApi('/api/storage-settings');
  const storage = storageCall.data?.storage ?? null;

  const [storageDraft, setStorageDraft] = useState({
    provider: 's3',
    bucket: '',
    region: 'auto',
    endpoint: '',
    accessKeyId: '',
    secretAccessKey: '',
    publicUrlBase: '',
  });
  const [storageSaving, setStorageSaving] = useState(false);
  const [storageTesting, setStorageTesting] = useState(false);
  const [storageTestResult, setStorageTestResult] = useState(null);
  const [storageUploadTesting, setStorageUploadTesting] = useState(false);
  const [storageUploadUrl, setStorageUploadUrl] = useState(null);
  const [storageDisconnectOpen, setStorageDisconnectOpen] = useState(false);

  useEffect(() => {
    if (storage?.provider) {
      setStorageDraft((current) => ({
        ...current,
        provider: storage.provider,
        bucket: storage.bucket || '',
        region: storage.region || 'auto',
        endpoint: storage.endpoint || '',
        publicUrlBase: storage.publicUrlBase || '',
        // accessKeyId/secretAccessKey jaan-boojh kar bharte nahi — write-only
        // fields hain, purani value kabhi wapas nahi dikhti.
      }));
    }
  }, [storage]);

  const activeProviderMeta = findStorageProvider(storageDraft.provider);

  function setStorageField(field, value) {
    setStorageDraft((current) => ({ ...current, [field]: value }));
  }

  async function saveStorageSettings() {
    setStorageSaving(true);
    setStorageTestResult(null);
    try {
      await api.put('/api/storage-settings', storageDraft);
      storageCall.reload();
      toast.success(t('set.storageSaved'));
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('toast.networkError'));
    } finally {
      setStorageSaving(false);
    }
  }

  async function testStorageConnection() {
    setStorageTesting(true);
    setStorageTestResult(null);
    try {
      const data = await api.post('/api/storage-settings/test');
      setStorageTestResult(data);
      storageCall.reload();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('toast.networkError'));
    } finally {
      setStorageTesting(false);
    }
  }

  async function testStorageUpload() {
    setStorageUploadTesting(true);
    setStorageUploadUrl(null);
    try {
      const data = await api.post('/api/storage-settings/test-upload');
      setStorageUploadUrl(data.url);
      toast.success(t('set.storageUploadOk'));
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('toast.networkError'));
    } finally {
      setStorageUploadTesting(false);
    }
  }

  async function confirmDisconnectStorage() {
    setStorageDisconnectOpen(false);
    try {
      await api.delete('/api/storage-settings');
      storageCall.reload();
      setStorageTestResult(null);
      setStorageUploadUrl(null);
      toast.success(t('set.storageDisconnected'));
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('toast.networkError'));
    }
  }

  function handleSection(event) {
    setSection(event.currentTarget.dataset.key);
  }

  function handleLanguage(event) {
    setLanguage(event.currentTarget.dataset.code);
  }

  function handleMode(event) {
    setMode(event.currentTarget.dataset.mode);
  }

  function handleAccent(event) {
    setAccent(event.currentTarget.dataset.accent);
  }

  return (
    <div className="mw-stack">
      <PageHeader title={t('set.title')} subtitle={t('set.subtitle')} helpTopic="settings" />

      <div className="mw-grid-side-main">
        <Card flush>
          <nav className="mw-settingsnav" aria-label={t('set.sections')}>
            {SECTIONS.map((item) => (
              <button
                key={item.key}
                type="button"
                data-key={item.key}
                onClick={handleSection}
                className={`mw-settingsnav__item ${section === item.key ? 'is-active' : ''}`.trim()}
              >
                <i className={`bi ${item.icon}`} aria-hidden="true" />
                {t(item.labelKey)}
              </button>
            ))}
          </nav>
        </Card>

        <div className="mw-stack--sm d-flex flex-column">
          {section === 'profile' ? (
            <Card>
              <CardHead title={t('set.profileTitle')} subtitle={t('set.profileSub', { app: appConfig.name })} />
              <CardBody>
                {profileError ? (
                  <Note tone="warning" icon="bi-exclamation-triangle">
                    {profileError}
                  </Note>
                ) : null}

                <div className="mw-row mb-4">
                  <span className="mw-avatar mw-avatar--lg">{user?.initials ?? ''}</span>
                  <div>
                    <div className="mw-fs-16 mw-fw-700">{user?.name ?? ''}</div>
                    <div className="mw-fs-13 mw-text-muted">{user?.email ?? ''}</div>
                  </div>
                </div>

                <div className="row g-3">
                  <div className="col-12 col-md-6">
                    <label className="form-label" htmlFor="p-name">{t('set.fullName')}</label>
                    <input
                      id="p-name"
                      type="text"
                      className="form-control"
                      value={profileName}
                      onChange={(event) => setProfileName(event.target.value)}
                    />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label" htmlFor="p-email">{t('set.loginEmail')}</label>
                    <input id="p-email" type="email" className="form-control" value={user?.email ?? ''} readOnly disabled />
                    <div className="form-text">{t('set.emailChangeNote')}</div>
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label" htmlFor="p-company">{t('common.company')}</label>
                    <input
                      id="p-company"
                      type="text"
                      className="form-control"
                      value={profileDepartment}
                      onChange={(event) => setProfileDepartment(event.target.value)}
                    />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label" htmlFor="p-email-language">{t('set.emailLanguage')}</label>
                    <select
                      id="p-email-language"
                      className="form-select"
                      value={profileLanguage}
                      onChange={(event) => setProfileLanguage(event.target.value)}
                    >
                      {LANGUAGES.map((item) => (
                        <option key={item.code} value={item.code}>
                          {item.flag} {item.native}
                        </option>
                      ))}
                    </select>
                    <div className="form-text">{t('set.emailLanguageHelp')}</div>
                  </div>
                </div>
              </CardBody>
              <CardFoot>
                <button type="button" className="btn btn-primary" onClick={saveProfile} disabled={profileSaving}>
                  {profileSaving ? t('common.loading') : t('common.saveChanges')}
                </button>
              </CardFoot>
            </Card>
          ) : null}

          {section === 'appearance' ? (
            <Card>
              <CardHead title={t('theme.title')} subtitle={t('theme.subtitle')} />
              <CardBody>
                <p className="mw-fs-14 mw-fw-700 mb-2">{t('theme.mode')}</p>
                <div className="mw-optiongrid mb-4">
                  {THEME_MODES.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      data-mode={item.key}
                      onClick={handleMode}
                      className={`mw-option ${mode === item.key ? 'is-selected' : ''}`.trim()}
                    >
                      <span className="mw-option__icon" aria-hidden="true">
                        <i className={`bi ${item.icon}`} />
                      </span>
                      <span>
                        <span className="d-block mw-option__title">{t(item.labelKey)}</span>
                      </span>
                      {mode === item.key ? (
                        <i className="bi bi-check-circle-fill mw-option__check" aria-hidden="true" />
                      ) : null}
                    </button>
                  ))}
                </div>

                <p className="mw-fs-14 mw-fw-700 mb-2">{t('theme.colour')}</p>
                <div className="mw-accentgrid mw-accentgrid--lg mb-3">
                  {accents.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      data-accent={item.key}
                      onClick={handleAccent}
                      className={`mw-accentdot mw-accentdot--${item.key} ${accent === item.key ? 'is-active' : ''}`.trim()}
                      aria-label={t(item.labelKey)}
                      title={t(item.labelKey)}
                    >
                      {accent === item.key ? <i className="bi bi-check-lg" /> : null}
                    </button>
                  ))}
                </div>
                <p className="form-text mb-4">{t('theme.help')}</p>

                <hr className="my-4" />

                <p className="mw-fs-14 mw-fw-700 mb-2">{t('set.brand')}</p>
                <div className="mw-kv">
                  <span className="mw-kv__key">{t('common.name')}</span>
                  <span className="mw-kv__value">{appConfig.name}</span>
                </div>
                <div className="mw-kv">
                  <span className="mw-kv__key">{t('app.tagline')}</span>
                  <span className="mw-kv__value">{appConfig.tagline}</span>
                </div>
                <div className="mw-kv">
                  <span className="mw-kv__key">{t('common.company')}</span>
                  <span className="mw-kv__value">{appConfig.company}</span>
                </div>
                {/* Support email, website aur pata bhi yahin dikhate hain, taki
                    ek nazar me pata chale ki client ko kya dikh raha hai.
                    Teeno brand.config.js se aate hain. */}
                <div className="mw-kv">
                  <span className="mw-kv__key">{t('set.supportEmail')}</span>
                  <span className="mw-kv__value">{appConfig.supportEmail || '—'}</span>
                </div>
                <div className="mw-kv">
                  <span className="mw-kv__key">{t('set.website')}</span>
                  <span className="mw-kv__value">{appConfig.website || '—'}</span>
                </div>
                <div className="mw-kv">
                  <span className="mw-kv__key">{t('set.address')}</span>
                  <span className="mw-kv__value">{appConfig.address || '—'}</span>
                </div>

                {!appConfig.address ? (
                  <Note tone="warning" icon="bi-exclamation-triangle">
                    {t('set.addressMissing')}
                  </Note>
                ) : null}

                <Note tone="info" icon="bi-file-earmark-code">
                  {t('theme.brandNote')}
                </Note>
              </CardBody>
            </Card>
          ) : null}

          {section === 'language' ? (
            <Card>
              <CardHead title={t('set.language')} subtitle={t('set.languageHelp')} />
              <CardBody>
                <div className="mw-optiongrid">
                  {languages.map((item) => (
                    <button
                      key={item.code}
                      type="button"
                      data-code={item.code}
                      onClick={handleLanguage}
                      className={`mw-option ${item.code === language.code ? 'is-selected' : ''}`.trim()}
                    >
                      <span className="mw-option__icon" aria-hidden="true">
                        {item.flag}
                      </span>
                      <span>
                        <span className="d-block mw-option__title">{item.native}</span>
                        <span className="d-block mw-option__desc">
                          {item.english} · {item.code.toUpperCase()}
                          {item.dir === 'rtl' ? ' · RTL' : ''}
                        </span>
                      </span>
                      {item.code === language.code ? (
                        <i className="bi bi-check-circle-fill mw-option__check" aria-hidden="true" />
                      ) : null}
                    </button>
                  ))}
                </div>

                <Note tone="info" icon="bi-translate">
                  {t('set.addLanguageNote')}
                </Note>
              </CardBody>
            </Card>
          ) : null}

          {section === 'accounts' ? (
            <Card>
              <CardHead title={t('acc.title')} subtitle={t('acc.subtitle')} />
              <CardBody>
                <p className="mw-fs-14 mw-text-muted">{t('set.accountsNote')}</p>
                <Link to="/accounts" className="btn btn-primary">
                  <i className="bi bi-envelope-at me-2" />
                  {t('set.openAccounts')}
                </Link>
              </CardBody>
            </Card>
          ) : null}

          {section === 'sending' ? (
            <Card>
              <CardHead title={t('set.sendingTitle')} subtitle={t('set.sendingSub')} />
              <CardBody>
                {!sendingDraft ? (
                  <div className="p-3 text-center mw-text-muted">
                    <div className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                    {t('common.loading')}
                  </div>
                ) : (
                  <>
                    <div className="row g-3 mb-3">
                      <div className="col-12 col-md-6">
                        <label className="form-label" htmlFor="s-batch">{t('set.defaultBatch')}</label>
                        <select
                          id="s-batch"
                          className="form-select"
                          value={sendingDraft.defaultBatchSize}
                          onChange={(event) =>
                            setSendingDraft((current) => ({ ...current, defaultBatchSize: Number(event.target.value) }))
                          }
                        >
                          {batchOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {batchOptionLabel(t, option, formatNumber)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-12 col-md-6">
                        <label className="form-label" htmlFor="s-delay">{t('set.minutesBetween')}</label>
                        <input
                          id="s-delay"
                          type="number"
                          className="form-control"
                          value={sendingDraft.batchDelayMinutes}
                          min={0}
                          max={1440}
                          onChange={(event) =>
                            setSendingDraft((current) => ({ ...current, batchDelayMinutes: Number(event.target.value) || 0 }))
                          }
                        />
                      </div>
                    </div>

                    <div className="row g-3 mb-3">
                      <div className="col-12 col-md-6">
                        <label className="form-label" htmlFor="s-estimate-size">{t('send.estimateSampleLabel')}</label>
                        <input
                          id="s-estimate-size"
                          type="number"
                          className="form-control"
                          value={estimateSampleSize}
                          min={0}
                          onChange={(event) => setEstimateSampleSize(Math.max(0, Number(event.target.value) || 0))}
                        />
                      </div>
                    </div>
                    {estimateSampleSize > 0 ? (
                      <Note tone="info" icon="bi-stopwatch">
                        {formatEstimate(
                          t,
                          estimateSendTime({
                            recipientCount: estimateSampleSize,
                            batchSize: sendingDraft.defaultBatchSize,
                            batchDelayMinutes: sendingDraft.batchDelayMinutes,
                          })
                        )}{' '}
                        {t('send.estimateAccountNote')}
                      </Note>
                    ) : null}

                    <SwitchRow
                      id="s-retry"
                      title={t('set.retryTitle')}
                      desc={t('set.retryDesc')}
                      checked={sendingDraft.retryOnce}
                      onChange={(event) => setSendingDraft((current) => ({ ...current, retryOnce: event.target.checked }))}
                    />
                    <SwitchRow
                      id="s-quiet"
                      title={t('set.quietTitle')}
                      desc={t('set.quietDesc')}
                      checked={sendingDraft.quietHours}
                      onChange={(event) => setSendingDraft((current) => ({ ...current, quietHours: event.target.checked }))}
                    />

                    <Note tone="info" icon="bi-info-circle">
                      {t('set.sendingNote')}
                    </Note>
                  </>
                )}
              </CardBody>
              <CardFoot>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => saveWorkspaceSetting('sending', sendingDraft)}
                  disabled={!sendingDraft || savingKey === 'sending'}
                >
                  {savingKey === 'sending' ? t('common.loading') : t('common.saveChanges')}
                </button>
              </CardFoot>
            </Card>
          ) : null}

          {section === 'tracking' ? (
            <Card>
              <CardHead title={t('set.trackingTitle')} subtitle={t('set.trackingSub')} />
              <CardBody>
                {!trackingDraft ? (
                  <div className="p-3 text-center mw-text-muted">
                    <div className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                    {t('common.loading')}
                  </div>
                ) : (
                  <>
                    <SwitchRow
                      id="t-open"
                      title={t('set.openDefaultTitle')}
                      desc={t('set.openDefaultDesc')}
                      checked={trackingDraft.openByDefault}
                      onChange={(event) => setTrackingDraft((current) => ({ ...current, openByDefault: event.target.checked }))}
                    />
                    <SwitchRow
                      id="t-click"
                      title={t('set.clickDefaultTitle')}
                      desc={t('set.clickDefaultDesc')}
                      checked={trackingDraft.clickByDefault}
                      onChange={(event) => setTrackingDraft((current) => ({ ...current, clickByDefault: event.target.checked }))}
                    />
                    <SwitchRow
                      id="t-device"
                      title={t('set.deviceTitle')}
                      desc={t('set.deviceDesc')}
                      checked={trackingDraft.recordDevice}
                      onChange={(event) => setTrackingDraft((current) => ({ ...current, recordDevice: event.target.checked }))}
                    />
                    <SwitchRow
                      id="t-location"
                      title={t('set.locationTitle')}
                      desc={t('set.locationDesc')}
                      checked={trackingDraft.recordLocation}
                      onChange={(event) => setTrackingDraft((current) => ({ ...current, recordLocation: event.target.checked }))}
                    />

                    <Note tone="warning" icon="bi-exclamation-circle">
                      {t('set.openEstimateNote')}
                    </Note>
                    <Note tone="info" icon="bi-info-circle">
                      {t('set.trackingNote')}
                    </Note>
                  </>
                )}
              </CardBody>
              <CardFoot>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => saveWorkspaceSetting('tracking', trackingDraft)}
                  disabled={!trackingDraft || savingKey === 'tracking'}
                >
                  {savingKey === 'tracking' ? t('common.loading') : t('common.saveChanges')}
                </button>
              </CardFoot>
            </Card>
          ) : null}

          {section === 'templates' ? (
            <Card>
              <CardHead title={t('set.templateOptions')} subtitle={t('set.templateOptionsSub')} />
              <CardBody>
                {!templateSourcesDraft ? (
                  <div className="p-3 text-center mw-text-muted">
                    <div className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                    {t('common.loading')}
                  </div>
                ) : (
                  <>
                    <SwitchRow
                      id="ts-custom"
                      title={t('set.tplSrcCustomTitle')}
                      desc={t('set.tplSrcCustomDesc')}
                      checked={templateSourcesDraft.custom}
                      disabled={!canEditSettings}
                      onChange={(event) => setTemplateSourcesDraft((current) => ({ ...current, custom: event.target.checked }))}
                    />
                    <SwitchRow
                      id="ts-upload"
                      title={t('set.tplSrcUploadTitle')}
                      desc={t('set.tplSrcUploadDesc')}
                      checked={templateSourcesDraft.html_upload}
                      disabled={!canEditSettings}
                      onChange={(event) => setTemplateSourcesDraft((current) => ({ ...current, html_upload: event.target.checked }))}
                    />
                    <SwitchRow
                      id="ts-builder"
                      title={t('set.tplSrcBuilderTitle')}
                      desc={t('set.tplSrcBuilderDesc')}
                      checked={templateSourcesDraft.builder}
                      disabled={!canEditSettings}
                      onChange={(event) => setTemplateSourcesDraft((current) => ({ ...current, builder: event.target.checked }))}
                    />

                    <Note tone="info" icon="bi-info-circle">
                      {t('set.templateOptionsNote')}
                    </Note>
                  </>
                )}
              </CardBody>
              <CardFoot className="d-flex gap-2">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={saveTemplateSources}
                  disabled={!canEditSettings || !isTemplateSourcesDirty || savingKey === 'templateSources'}
                >
                  {savingKey === 'templateSources' ? t('common.loading') : t('common.saveChanges')}
                </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={cancelTemplateSourcesDraft}
                  disabled={!isTemplateSourcesDirty || savingKey === 'templateSources'}
                >
                  {t('common.cancel')}
                </button>
              </CardFoot>
            </Card>
          ) : null}

          {section === 'contacts' ? (
            <Card>
              <CardHead title={t('set.contactsTitle')} subtitle={t('set.contactsSub')} />
              <CardBody>
                {!contactsDraft ? (
                  <div className="p-3 text-center mw-text-muted">
                    <div className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                    {t('common.loading')}
                  </div>
                ) : (
                  <>
                    <SwitchRow
                      id="c-dedupe"
                      title={t('set.dedupeTitle')}
                      desc={t('set.dedupeDesc')}
                      checked={contactsDraft.dedupeOnImport}
                      onChange={(event) => setContactsDraft((current) => ({ ...current, dedupeOnImport: event.target.checked }))}
                    />
                    <SwitchRow
                      id="c-consent"
                      title={t('set.consentTitle')}
                      desc={t('set.consentDesc')}
                      checked={contactsDraft.requireConsent}
                      onChange={(event) => setContactsDraft((current) => ({ ...current, requireConsent: event.target.checked }))}
                    />
                    <div className="mt-4">
                      <label className="form-label" htmlFor="c-fields">{t('set.customFields')}</label>
                      <input
                        id="c-fields"
                        type="text"
                        className="form-control"
                        value={contactsDraft.customFields.join(', ')}
                        onChange={(event) =>
                          setContactsDraft((current) => ({
                            ...current,
                            customFields: event.target.value.split(',').map((f) => f.trim()).filter(Boolean),
                          }))
                        }
                      />
                      <div className="form-text">{t('set.customFieldsHelp')}</div>
                    </div>

                    <Note tone="info" icon="bi-info-circle">
                      {t('set.contactsNote')}
                    </Note>
                  </>
                )}
              </CardBody>
              <CardFoot>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => saveWorkspaceSetting('contacts', contactsDraft)}
                  disabled={!contactsDraft || savingKey === 'contacts'}
                >
                  {savingKey === 'contacts' ? t('common.loading') : t('common.saveChanges')}
                </button>
              </CardFoot>
            </Card>
          ) : null}

          {section === 'unsubscribe' ? (
            <Card>
              <CardHead title={t('set.unsubTitle')} subtitle={t('set.unsubSub')} />
              <CardBody>
                {!unsubDraft ? (
                  <div className="p-3 text-center mw-text-muted">
                    <div className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                    {t('common.loading')}
                  </div>
                ) : (
                  <>
                    <div className="mb-3">
                      <label className="form-label" htmlFor="u-text">{t('set.unsubLinkText')}</label>
                      <input
                        id="u-text"
                        type="text"
                        className="form-control"
                        value={unsubDraft.linkText}
                        onChange={(event) => setUnsubDraft((current) => ({ ...current, linkText: event.target.value }))}
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label" htmlFor="u-page">{t('set.unsubMessage')}</label>
                      <textarea
                        id="u-page"
                        className="form-control"
                        rows={3}
                        value={unsubDraft.confirmation}
                        onChange={(event) => setUnsubDraft((current) => ({ ...current, confirmation: event.target.value }))}
                      />
                    </div>
                    <SwitchRow
                      id="u-onelick"
                      title={t('set.oneClickTitle')}
                      desc={t('set.oneClickDesc')}
                      checked={unsubDraft.oneClickHeader}
                      onChange={(event) => setUnsubDraft((current) => ({ ...current, oneClickHeader: event.target.checked }))}
                    />
                    <SwitchRow
                      id="u-global"
                      title={t('set.unsubGlobalTitle')}
                      desc={t('set.unsubGlobalDesc')}
                      checked={Boolean(unsubDraft.applyGlobally)}
                      onChange={(event) => setUnsubDraft((current) => ({ ...current, applyGlobally: event.target.checked }))}
                    />
                    <Note tone="success" icon="bi-shield-check">
                      {t('set.unsubNote')}
                    </Note>
                  </>
                )}
              </CardBody>
              <CardFoot>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => saveWorkspaceSetting('unsubscribe', unsubDraft)}
                  disabled={!unsubDraft || savingKey === 'unsubscribe'}
                >
                  {savingKey === 'unsubscribe' ? t('common.loading') : t('common.saveChanges')}
                </button>
              </CardFoot>
            </Card>
          ) : null}

          {section === 'storage' ? (
            <Card>
              <CardHead title={t('set.storageTitle')} subtitle={t('set.storageSub')} />
              <CardBody>
                <Note tone="info" icon="bi-shield-lock">
                  {t('set.storagePrivateNote')}
                </Note>

                {storage?.provider ? (
                  <div className="mw-stack--sm d-flex flex-column mb-4">
                    <div className="mw-kv">
                      <span className="mw-kv__key">{t('common.status')}</span>
                      <span className="mw-kv__value">
                        <StatusPill
                          status={storage.connected ? t('set.storageConnected') : t('set.storageNotConnected')}
                          tone={storage.connected ? 'success' : 'warning'}
                        />
                      </span>
                    </div>
                    <div className="mw-kv">
                      <span className="mw-kv__key">{t('set.storageProvider')}</span>
                      <span className="mw-kv__value">{findStorageProvider(storage.provider)?.label ?? storage.provider}</span>
                    </div>
                    <div className="mw-kv">
                      <span className="mw-kv__key">{t('set.storageBucket')}</span>
                      <span className="mw-kv__value">{storage.bucket}</span>
                    </div>
                    <div className="mw-kv">
                      <span className="mw-kv__key">{t('set.storageRegion')}</span>
                      <span className="mw-kv__value">{storage.region || '—'}</span>
                    </div>
                    <div className="mw-kv">
                      <span className="mw-kv__key">{t('set.storageLastTest')}</span>
                      <span className="mw-kv__value">
                        {storage.lastTestedAt ? formatDateTime(storage.lastTestedAt) : t('set.storageNeverTested')}
                        {storage.lastTestMessage ? ` — ${storage.lastTestMessage}` : ''}
                      </span>
                    </div>
                    <div>
                      <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => setStorageDisconnectOpen(true)}>
                        {t('set.storageDisconnect')}
                      </button>
                    </div>
                    <hr className="my-2" />
                  </div>
                ) : null}

                <p className="mw-fs-14 mw-fw-700 mb-2">{t('set.storageChangeTitle')}</p>
                <div className="row g-3">
                  <div className="col-12 col-md-6">
                    <label className="form-label" htmlFor="st-provider">{t('set.storageProviderLabel')}</label>
                    <select
                      id="st-provider"
                      className="form-select"
                      value={storageDraft.provider}
                      onChange={(event) => setStorageField('provider', event.target.value)}
                    >
                      {STORAGE_PROVIDERS.map((provider) => (
                        <option key={provider.id} value={provider.id}>
                          {provider.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label" htmlFor="st-bucket">{t('set.storageBucketLabel')}</label>
                    <input
                      id="st-bucket"
                      type="text"
                      className="form-control"
                      value={storageDraft.bucket}
                      onChange={(event) => setStorageField('bucket', event.target.value)}
                    />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label" htmlFor="st-region">{t('set.storageRegionLabel')}</label>
                    <input
                      id="st-region"
                      type="text"
                      className="form-control"
                      value={storageDraft.region}
                      onChange={(event) => setStorageField('region', event.target.value)}
                    />
                    <div className="form-text">{activeProviderMeta?.regionHelp}</div>
                  </div>
                  {activeProviderMeta?.needsEndpoint ? (
                    <div className="col-12 col-md-6">
                      <label className="form-label" htmlFor="st-endpoint">{t('set.storageEndpointLabel')}</label>
                      <input
                        id="st-endpoint"
                        type="text"
                        className="form-control"
                        value={storageDraft.endpoint}
                        onChange={(event) => setStorageField('endpoint', event.target.value)}
                      />
                      <div className="form-text">{activeProviderMeta?.endpointHelp}</div>
                    </div>
                  ) : null}
                  <div className="col-12 col-md-6">
                    <label className="form-label" htmlFor="st-key">{t('set.storageAccessKeyLabel')}</label>
                    <input
                      id="st-key"
                      type="text"
                      className="form-control"
                      value={storageDraft.accessKeyId}
                      onChange={(event) => setStorageField('accessKeyId', event.target.value)}
                      placeholder={storage?.accessKeyIdMasked || ''}
                      autoComplete="off"
                    />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label" htmlFor="st-secret">{t('set.storageSecretLabel')}</label>
                    <input
                      id="st-secret"
                      type="password"
                      className="form-control"
                      value={storageDraft.secretAccessKey}
                      onChange={(event) => setStorageField('secretAccessKey', event.target.value)}
                      placeholder={storage?.provider ? t('set.storageSecretUnchanged') : ''}
                      autoComplete="new-password"
                    />
                    <div className="form-text">{t('set.storageSecretHelp')}</div>
                  </div>
                </div>

                {storageTestResult ? (
                  <Note tone={storageTestResult.ok ? 'success' : 'warning'} icon={storageTestResult.ok ? 'bi-check-circle' : 'bi-exclamation-triangle'}>
                    {storageTestResult.message}
                  </Note>
                ) : null}

                {storageUploadUrl ? (
                  <Note tone="success" icon="bi-image">
                    {t('set.storageUploadOk')}
                    <div className="mt-2">
                      <img src={storageUploadUrl} alt="" width="64" height="64" style={{ borderRadius: 8 }} />
                    </div>
                  </Note>
                ) : null}
              </CardBody>
              <CardFoot>
                <button type="button" className="btn btn-outline-secondary" onClick={testStorageConnection} disabled={storageTesting || !storage?.provider && !storageDraft.bucket}>
                  {storageTesting ? t('common.loading') : t('set.storageTestConnection')}
                </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={testStorageUpload}
                  disabled={storageUploadTesting || !storage?.connected}
                >
                  {storageUploadTesting ? t('common.loading') : t('set.storageTestUpload')}
                </button>
                <button type="button" className="btn btn-primary" onClick={saveStorageSettings} disabled={storageSaving}>
                  {storageSaving ? t('common.loading') : t('common.saveChanges')}
                </button>
              </CardFoot>
            </Card>
          ) : null}

          {section === 'imageStorage' ? (
            <Card>
              <CardHead title={t('set.imageStorageTitle')} subtitle={t('set.imageStorageSub')} />
              <CardBody>
                {!imageStorageDraft ? (
                  <div className="p-3 text-center mw-text-muted">
                    <div className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                    {t('common.loading')}
                  </div>
                ) : (
                  <>
                    <SwitchRow
                      id="is-db"
                      title={t('set.imgStoreDbTitle')}
                      desc={t('set.imgStoreDbDesc')}
                      checked={imageStorageDraft.db}
                      disabled={!canEditSettings}
                      onChange={(event) => setImageStorageDraft((current) => ({ ...current, db: event.target.checked }))}
                    />
                    <SwitchRow
                      id="is-external"
                      title={t('set.imgStoreExternalTitle')}
                      desc={t('set.imgStoreExternalDesc')}
                      checked={imageStorageDraft.external}
                      disabled={!canEditSettings}
                      onChange={(event) => setImageStorageDraft((current) => ({ ...current, external: event.target.checked }))}
                    />

                    <Note tone="info" icon="bi-info-circle">
                      {t('set.imageStorageNote')}
                    </Note>

                    {storageLimitsDraft ? (
                      <div className="mt-3">
                        <label className="form-label" htmlFor="s-media-storage">{t('set.mediaStorageLimit')}</label>
                        <div className="input-group" style={{ maxWidth: '22rem' }}>
                          <input
                            id="s-media-storage"
                            type="number"
                            className="form-control"
                            min={0}
                            placeholder={t('set.storageLimitNone')}
                            value={storageLimitsDraft.mediaValue}
                            onChange={(event) =>
                              setStorageLimitsDraft((current) => ({
                                ...current,
                                mediaValue: event.target.value === '' ? '' : Math.max(0, Number(event.target.value) || 0),
                              }))
                            }
                          />
                          <select
                            className="form-select"
                            style={{ maxWidth: '6.5rem' }}
                            value={storageLimitsDraft.mediaUnit}
                            aria-label={t('set.backupMaxStorageUnit')}
                            onChange={(event) =>
                              setStorageLimitsDraft((current) => ({ ...current, mediaUnit: event.target.value }))
                            }
                          >
                            <option value="MB">MB</option>
                            <option value="GB">GB</option>
                          </select>
                        </div>
                        <p className="form-text mb-0">{t('set.mediaStorageLimitHelp')}</p>
                      </div>
                    ) : null}
                  </>
                )}
              </CardBody>
              <CardFoot className="d-flex gap-2">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={saveImageStorage}
                  disabled={!canEditSettings || !isImageStorageDirty || savingKey === 'imageStorage'}
                >
                  {savingKey === 'imageStorage' ? t('common.loading') : t('common.saveChanges')}
                </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={cancelImageStorageDraft}
                  disabled={!isImageStorageDirty || savingKey === 'imageStorage'}
                >
                  {t('common.cancel')}
                </button>
              </CardFoot>
            </Card>
          ) : null}

          {section === 'backup' ? (
            <Card>
              <CardHead title={t('set.backupTitle')} subtitle={t('set.backupSub')} />
              <CardBody>
                {!backupDraft ? (
                  <div className="p-3 text-center mw-text-muted">
                    <div className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                    {t('common.loading')}
                  </div>
                ) : (
                  <>
                    <div className="row g-3 mb-3">
                      <div className="col-12 col-md-6">
                        <label className="form-label" htmlFor="s-bak-retention">{t('set.backupRetention')}</label>
                        <select
                          id="s-bak-retention"
                          className="form-select"
                          value={backupDraft.retentionMonths}
                          onChange={(event) =>
                            setBackupDraft((current) => ({ ...current, retentionMonths: Number(event.target.value) }))
                          }
                        >
                          {[1, 2, 3, 4, 5, 6].map((n) => (
                            <option key={n} value={n}>
                              {t(n === 1 ? 'set.backupRetentionMonth' : 'set.backupRetentionMonths', { count: n })}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-12 col-md-6">
                        <label className="form-label" htmlFor="s-bak-storage">{t('set.backupMaxStorage')}</label>
                        <div className="input-group">
                          <input
                            id="s-bak-storage"
                            type="number"
                            className="form-control"
                            min={1}
                            value={backupDraft.maxStorageValue}
                            onChange={(event) =>
                              setBackupDraft((current) => ({
                                ...current,
                                maxStorageValue: Math.max(1, Number(event.target.value) || 0),
                              }))
                            }
                          />
                          <select
                            className="form-select"
                            style={{ maxWidth: '6.5rem' }}
                            value={backupDraft.maxStorageUnit}
                            aria-label={t('set.backupMaxStorageUnit')}
                            onChange={(event) =>
                              setBackupDraft((current) => ({ ...current, maxStorageUnit: event.target.value }))
                            }
                          >
                            <option value="MB">MB</option>
                            <option value="GB">GB</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <Note tone="info" icon="bi-info-circle">
                      {t('set.backupNote')}
                    </Note>

                    {storageLimitsDraft ? (
                      <div className="mt-3">
                        <label className="form-label" htmlFor="s-db-storage">{t('set.dbStorageLimit')}</label>
                        <div className="input-group" style={{ maxWidth: '22rem' }}>
                          <input
                            id="s-db-storage"
                            type="number"
                            className="form-control"
                            min={0}
                            placeholder={t('set.storageLimitNone')}
                            value={storageLimitsDraft.databaseValue}
                            onChange={(event) =>
                              setStorageLimitsDraft((current) => ({
                                ...current,
                                databaseValue: event.target.value === '' ? '' : Math.max(0, Number(event.target.value) || 0),
                              }))
                            }
                          />
                          <select
                            className="form-select"
                            style={{ maxWidth: '6.5rem' }}
                            value={storageLimitsDraft.databaseUnit}
                            aria-label={t('set.backupMaxStorageUnit')}
                            onChange={(event) =>
                              setStorageLimitsDraft((current) => ({ ...current, databaseUnit: event.target.value }))
                            }
                          >
                            <option value="MB">MB</option>
                            <option value="GB">GB</option>
                          </select>
                        </div>
                        <p className="form-text mb-0">{t('set.dbStorageLimitHelp')}</p>
                      </div>
                    ) : null}
                  </>
                )}
              </CardBody>
              <CardFoot>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={saveBackupSettings}
                  disabled={!backupDraft || savingKey === 'backupSettings'}
                >
                  {savingKey === 'backupSettings' ? t('common.loading') : t('common.saveChanges')}
                </button>
              </CardFoot>
            </Card>
          ) : null}

          {section === 'security' ? (
            <Card>
              <CardHead title={t('topbar.security')} subtitle={t('set.securitySub')} />
              <CardBody>
                {securityError ? (
                  <Note tone="warning" icon="bi-exclamation-triangle">
                    {securityError}
                  </Note>
                ) : null}
                {securityDone ? (
                  <Note tone="success" icon="bi-check-circle">
                    {securityDone}
                  </Note>
                ) : null}

                <div className="row g-3 mb-3">
                  <div className="col-12 col-md-6">
                    <label className="form-label" htmlFor="sec-current">{t('set.currentPassword')}</label>
                    <div className="input-group">
                      <input
                        id="sec-current"
                        type={showCurrentPass ? 'text' : 'password'}
                        className="form-control"
                        placeholder="••••••••"
                        value={currentPassword}
                        onChange={(event) => setCurrentPassword(event.target.value)}
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        className="btn btn-outline-secondary"
                        onClick={() => setShowCurrentPass((current) => !current)}
                        aria-label={showCurrentPass ? t('auth.hidePassword') : t('auth.showPassword')}
                      >
                        <i className={`bi ${showCurrentPass ? 'bi-eye-slash' : 'bi-eye'}`} />
                      </button>
                    </div>
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label" htmlFor="sec-new">{t('auth.newPassword')}</label>
                    <div className="input-group">
                      <input
                        id="sec-new"
                        type={showNewPass ? 'text' : 'password'}
                        className="form-control"
                        placeholder="••••••••"
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        className="btn btn-outline-secondary"
                        onClick={() => setShowNewPass((current) => !current)}
                        aria-label={showNewPass ? t('auth.hidePassword') : t('auth.showPassword')}
                      >
                        <i className={`bi ${showNewPass ? 'bi-eye-slash' : 'bi-eye'}`} />
                      </button>
                    </div>
                  </div>
                </div>

                <Note tone="info" icon="bi-shield-lock">
                  {t('set.passwordChangeNote')}
                </Note>

                <hr className="my-4" />

                {/* Yeh switch nahi hai — audit log kabhi band nahi hoti, isliye
                    ek jhoothi toggle dikhane ki bajaye seedha bata dete hain
                    ki yeh pehle se chalu hai aur kahan dekhi ja sakti hai. */}
                <div className="mw-switchrow">
                  <div className="mw-switchrow__body">
                    <div className="mw-switchrow__title">{t('set.auditTitle')}</div>
                    <p className="mw-switchrow__desc mb-0">{t('set.auditDesc')}</p>
                  </div>
                  <Link to="/activity" className="btn btn-sm btn-outline-secondary">
                    {t('set.viewAuditLog')}
                  </Link>
                </div>
              </CardBody>
              <CardFoot>
                <button type="button" className="btn btn-primary" onClick={changePassword} disabled={securitySaving}>
                  {securitySaving ? t('common.loading') : t('set.changePassword')}
                </button>
              </CardFoot>
            </Card>
          ) : null}

          {section === 'api' ? (
            <>
              <Card flush>
                <CardHead
                  title={
                    <span className="mw-row">
                      {t('set.apiTitle')}
                      <HelpButton topic="settingsApi" />
                    </span>
                  }
                  subtitle={t('set.apiSub')}
                  tools={
                    <button type="button" className="btn btn-primary btn-sm" onClick={openCreateKey}>
                      <i className="bi bi-plus-lg me-2" />
                      {t('set.newApiKey')}
                    </button>
                  }
                />

                {apiKeysCall.loading && apiKeys.length === 0 ? (
                  <div className="p-4 text-center mw-text-muted">
                    <div className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                    {t('common.loading')}
                  </div>
                ) : apiKeys.length === 0 ? (
                  <EmptyState
                    icon="bi-code-slash"
                    title={t('set.noApiKeys')}
                    text={t('set.noApiKeysText')}
                    action={
                      <button type="button" className="btn btn-primary" onClick={openCreateKey}>
                        {t('set.newApiKey')}
                      </button>
                    }
                  />
                ) : (
                  <div className="mw-tablewrap">
                    <table className="mw-table">
                      <thead>
                        <tr>
                          <th scope="col">{t('common.name')}</th>
                          <th scope="col">{t('set.apiKey')}</th>
                          <th scope="col">{t('set.createdBy')}</th>
                          <th scope="col">{t('set.lastUsed')}</th>
                          <th scope="col" className="text-end">{t('common.actions')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {apiKeys.map((key) => (
                          <tr key={key.id}>
                            <td className="mw-table__primary">{key.name}</td>
                            <td className="mw-mono mw-fs-12 mw-text-muted">{key.prefix}…</td>
                            <td className="mw-table__muted">{key.createdBy ?? '—'}</td>
                            <td className="mw-table__muted mw-nowrap">
                              {key.lastUsedAt ? formatDateTime(key.lastUsedAt) : t('set.neverUsed')}
                            </td>
                            <td className="text-end">
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => setRevokeFor(key)}
                              >
                                {t('set.revoke')}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>

              <Note tone="info" icon="bi-terminal">
                <strong>{t('set.apiUsageTitle')} </strong>
                {t('set.apiUsageText')}
                <pre className="mw-codearea mw-codearea--sm mt-2 mb-0">{`curl ${apiBase}/api/campaigns \\\n  -H "Authorization: Bearer mw_live_..."`}</pre>
              </Note>
            </>
          ) : null}

          {section === 'webhooks' ? (
            <>
              <Card>
                <CardHead
                  title={
                    <span className="mw-row">
                      {t('set.webhooksTitle')}
                      <HelpButton topic="settingsWebhooks" />
                    </span>
                  }
                  subtitle={t('set.webhooksSub')}
                />
                <CardBody>
                  <p className="mw-fs-14 mb-3">{t('set.webhooksIntro')}</p>

                  <Note tone="success" icon="bi-magic">
                    <strong>{t('set.webhooksNoCodeTitle')} </strong>
                    {t('set.webhooksNoCodeText')}
                  </Note>

                  {!webhook ? (
                    <div className="p-3 text-center mw-text-muted">
                      <div className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                      {t('common.loading')}
                    </div>
                  ) : (
                    <>
                      <div className="mt-4">
                        <label className="form-label" htmlFor="wh-url">{t('set.webhookUrlLabel')}</label>
                        <input
                          id="wh-url"
                          type="url"
                          className="form-control"
                          placeholder={t('set.webhookUrlPlaceholder')}
                          value={webhookUrlDraft}
                          onChange={(event) => setWebhookUrlDraft(event.target.value)}
                        />
                      </div>

                      <SwitchRow
                        id="wh-enabled"
                        title={t('set.webhookEnabledTitle')}
                        desc={t('set.webhookEnabledDesc')}
                        checked={webhookEnabledDraft}
                        onChange={(event) => setWebhookEnabledDraft(event.target.checked)}
                      />

                      {webhookTestResult ? (
                        <Note tone={webhookTestResult.ok ? 'success' : 'warning'} icon={webhookTestResult.ok ? 'bi-check-circle' : 'bi-exclamation-triangle'}>
                          {webhookTestResult.ok
                            ? t('toast.webhookTestSent')
                            : `${t('set.webhookTestFailed')}${webhookTestResult.statusCode ? ` (HTTP ${webhookTestResult.statusCode})` : ''}${webhookTestResult.error ? `: ${webhookTestResult.error}` : ''}`}
                        </Note>
                      ) : null}

                      <hr className="my-4" />

                      <div className="mw-switchrow">
                        <div className="mw-switchrow__body">
                          <div className="mw-switchrow__title">{t('set.webhookSecretTitle')}</div>
                          <p className="mw-switchrow__desc mb-0">{t('set.webhookSecretDesc')}</p>
                          <p className="mw-fs-12 mw-mono mw-text-muted mt-1 mb-0">
                            {webhook.hasSecret ? webhook.secretPrefix : t('set.webhookSecretNotSet')}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => (webhook.hasSecret ? setRotateConfirmOpen(true) : rotateSecret())}
                        >
                          {webhook.hasSecret ? t('set.rotateSecret') : t('set.generateSecret')}
                        </button>
                      </div>
                    </>
                  )}
                </CardBody>
                <CardFoot>
                  <button type="button" className="btn btn-outline-secondary" onClick={testWebhook} disabled={webhookTesting || !webhook?.url}>
                    <i className="bi bi-send me-2" />
                    {webhookTesting ? t('common.loading') : t('set.sendTestWebhook')}
                  </button>
                  <button type="button" className="btn btn-primary" onClick={saveWebhook} disabled={webhookSaving}>
                    {webhookSaving ? t('common.loading') : t('common.saveChanges')}
                  </button>
                </CardFoot>
              </Card>

              <Card flush>
                <CardHead title={t('set.recentDeliveries')} subtitle={t('set.recentDeliveriesSub')} />
                {deliveries.length === 0 ? (
                  <EmptyState icon="bi-broadcast" title={t('set.noDeliveriesYet')} text={t('set.noDeliveriesYetText')} />
                ) : (
                  <div className="mw-tablewrap">
                    <table className="mw-table">
                      <thead>
                        <tr>
                          <th scope="col">{t('common.status')}</th>
                          <th scope="col">Event</th>
                          <th scope="col">{t('bak.when')}</th>
                          <th scope="col">{t('common.actions')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {deliveries.map((delivery) => (
                          <tr key={delivery.id}>
                            <td>
                              <StatusPill
                                status={t(`set.deliveryStatus.${delivery.status}`)}
                                tone={DELIVERY_TONE[delivery.status] ?? 'muted'}
                              />
                            </td>
                            <td className="mw-mono mw-fs-12">{delivery.event}</td>
                            <td className="mw-table__muted mw-nowrap">{formatDateTime(delivery.createdAt)}</td>
                            <td className="mw-fs-12 mw-text-muted">
                              {delivery.lastStatusCode ? `HTTP ${delivery.lastStatusCode}` : ''}
                              {delivery.lastError ? ` — ${delivery.lastError}` : ''}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </>
          ) : null}
        </div>
      </div>

      {/* Naya key banao — naam poochte hain, taki list me pehchana ja sake
          ki kaunsi key kis kaam ke liye hai. */}
      <Sheet
        open={createKeyOpen}
        title={t('set.newApiKey')}
        onClose={() => setCreateKeyOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-outline-secondary flex-fill" onClick={() => setCreateKeyOpen(false)}>
              {t('common.cancel')}
            </button>
            <button type="button" className="btn btn-primary flex-fill" onClick={createKey} disabled={creatingKey}>
              {creatingKey ? t('common.loading') : t('set.createKey')}
            </button>
          </>
        }
      >
        {createKeyError ? (
          <Note tone="warning" icon="bi-exclamation-triangle">
            {createKeyError}
          </Note>
        ) : null}
        <label className="form-label" htmlFor="new-key-name">{t('set.apiKeyName')}</label>
        <input
          id="new-key-name"
          type="text"
          className="form-control"
          placeholder={t('set.apiKeyNamePlaceholder')}
          value={newKeyName}
          onChange={(event) => setNewKeyName(event.target.value)}
        />
        <div className="form-text">{t('set.apiKeyNameHelp')}</div>
      </Sheet>

      {/* Asli key — sirf ek baar. Yeh Sheet band hote hi key hamesha ke liye
          gayab ho jati hai; wapas dekhne ka koi tarika nahi hai. */}
      <Sheet
        open={Boolean(revealedKey)}
        title={t('set.apiKeyCreated')}
        onClose={closeRevealedKey}
        footer={
          <button type="button" className="btn btn-primary flex-fill" onClick={closeRevealedKey}>
            {t('set.apiKeySaved')}
          </button>
        }
      >
        <Note tone="warning" icon="bi-exclamation-triangle">
          {t('set.apiKeyOnceWarning')}
        </Note>
        {revealedKey ? (
          <div className="mw-urlbox mt-3">
            <span className="mw-urlbox__text mw-mono">{revealedKey.token}</span>
            <button type="button" className="mw-urlbox__btn" onClick={copyRevealedKey}>
              {copied ? t('common.copied') : t('common.copy')}
            </button>
          </div>
        ) : null}
      </Sheet>

      {/* Revoke pakka karo — yeh key istemal karne wala har program turant
          rukk jayega, dobara chalu nahi ho sakta. */}
      <Sheet
        open={Boolean(revokeFor)}
        title={t('set.revokeKeyTitle')}
        onClose={() => setRevokeFor(null)}
        footer={
          <>
            <button type="button" className="btn btn-outline-secondary flex-fill" onClick={() => setRevokeFor(null)}>
              {t('common.cancel')}
            </button>
            <button type="button" className="btn btn-danger flex-fill" onClick={confirmRevokeKey}>
              {t('set.revoke')}
            </button>
          </>
        }
      >
        {revokeFor ? (
          <p className="mw-fs-14 mb-0">
            <strong>{revokeFor.name}</strong> — {t('set.revokeKeyText')}
          </p>
        ) : null}
      </Sheet>

      {/* Secret badalna pakka karo — jo bhi purane secret se jaanch kar raha
          hai, uska verify turant fail hone lagega jab tak wo bhi apdate na kare. */}
      <Sheet
        open={rotateConfirmOpen}
        title={t('set.rotateSecretConfirmTitle')}
        onClose={() => setRotateConfirmOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-outline-secondary flex-fill" onClick={() => setRotateConfirmOpen(false)}>
              {t('common.cancel')}
            </button>
            <button type="button" className="btn btn-danger flex-fill" onClick={rotateSecret} disabled={rotatingSecret}>
              {rotatingSecret ? t('common.loading') : t('set.rotateSecret')}
            </button>
          </>
        }
      >
        <p className="mw-fs-14 mb-0">{t('set.rotateSecretConfirmText')}</p>
      </Sheet>

      {/* Asli secret — sirf ek baar. Yeh Sheet band hote hi hamesha ke liye
          gayab ho jata hai; wapas dekhne ka koi tarika nahi hai. */}
      <Sheet
        open={Boolean(revealedSecret)}
        title={t('set.webhookSecretCreated')}
        onClose={() => setRevealedSecret(null)}
        footer={
          <button type="button" className="btn btn-primary flex-fill" onClick={() => setRevealedSecret(null)}>
            {t('set.webhookSecretSaved')}
          </button>
        }
      >
        <Note tone="warning" icon="bi-exclamation-triangle">
          {t('set.webhookSecretOnceWarning')}
        </Note>
        {revealedSecret ? (
          <div className="mw-urlbox mt-3">
            <span className="mw-urlbox__text mw-mono">{revealedSecret}</span>
            <button type="button" className="mw-urlbox__btn" onClick={copyRevealedSecret}>
              {secretCopied ? t('common.copied') : t('common.copy')}
            </button>
          </div>
        ) : null}
      </Sheet>

      {/* Disconnect confirm — credentials hatane se pehle poochte hain.
          Pehle se maujood images kabhi nahi hatti, sirf naya connection hata hai. */}
      <Sheet
        open={storageDisconnectOpen}
        title={t('set.storageDisconnectConfirmTitle')}
        onClose={() => setStorageDisconnectOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-outline-secondary flex-fill" onClick={() => setStorageDisconnectOpen(false)}>
              {t('common.cancel')}
            </button>
            <button type="button" className="btn btn-danger flex-fill" onClick={confirmDisconnectStorage}>
              {t('set.storageDisconnect')}
            </button>
          </>
        }
      >
        <p className="mw-fs-14 mb-0">{t('set.storageDisconnectConfirmText')}</p>
      </Sheet>
    </div>
  );
}
