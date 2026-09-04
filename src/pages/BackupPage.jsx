import { useRef, useState } from 'react';

import PageHeader from '../components/ui/PageHeader';
import { Card, CardBody, CardHead } from '../components/ui/Card';
import { Note } from '../components/ui/Controls';
import Sheet from '../components/ui/Sheet';
import EmptyState from '../components/ui/EmptyState';
import { ApiError, api, getAccessToken } from '../api/client';
import { useApi } from '../api/useApi';
import { useToast } from '../components/ui/ToastProvider';
import { useT } from '../i18n/I18nProvider';
import { formatDateTime } from '../utils/format';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function BackupPage() {
  const t = useT();
  const toast = useToast();

  const call = useApi('/api/backups');
  const backups = call.data?.backups ?? [];
  const settings = call.data?.settings ?? null;

  const [busy, setBusy] = useState(false);
  const [restoreFor, setRestoreFor] = useState(null);
  const [confirmText, setConfirmText] = useState('');
  const [deleteFor, setDeleteFor] = useState(null);
  const [restartNote, setRestartNote] = useState('');

  const fileRef = useRef(null);

  /** Ek click me abhi ka poora backup. */
  async function createBackup() {
    setBusy(true);
    try {
      await api.post('/api/backups');
      call.reload();
      toast.success(t('bak.created'));
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('toast.networkError'));
    } finally {
      setBusy(false);
    }
  }

  /**
   * Backup file apne computer par utaarna.
   *
   * Download seedhe `<a href>` se nahi ho sakta: file lene ke liye token
   * chahiye, aur token sirf memory me rehta hai (localStorage me nahi). Isliye
   * file yahan mangwa kar browser ko dete hain.
   */
  async function download(event) {
    const { name } = event.currentTarget.dataset;
    setBusy(true);

    try {
      const res = await fetch(`${API_BASE}/api/backups/${encodeURIComponent(name)}/download`, {
        credentials: 'include',
        headers: { Authorization: `Bearer ${getAccessToken()}` },
      });

      if (!res.ok) throw new ApiError(res.status, 'download_failed', t('bak.downloadFailed'));

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.href = url;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      toast.success(t('bak.downloaded'), name);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('toast.networkError'));
    } finally {
      setBusy(false);
    }
  }

  function askRestore(event) {
    setRestoreFor(event.currentTarget.dataset.name);
    setConfirmText('');
  }

  /**
   * Restore do kadam me hota hai: pehle nishaan lagta hai, phir server restart
   * hone par lagta hai.
   *
   * Chalte hue database ko beech me badalna khatarnak hai — aadha purana,
   * aadha naya reh sakta hai. Isliye seedha yahin nahi badalte.
   */
  async function doRestore() {
    setBusy(true);
    try {
      const data = await api.post(`/api/backups/${encodeURIComponent(restoreFor)}/restore`, {
        confirm: 'RESTORE',
      });

      setRestoreFor(null);
      setRestartNote(data.message ?? t('bak.restartNote'));
      toast.success(t('bak.restoreMarked'));
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('toast.networkError'));
    } finally {
      setBusy(false);
    }
  }

  async function doDelete() {
    const name = deleteFor;
    setDeleteFor(null);
    if (!name) return;

    try {
      await api.delete(`/api/backups/${encodeURIComponent(name)}`);
      call.reload();
      toast.success(t('bak.deleted'), name);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('toast.networkError'));
    }
  }

  /** Apne computer se rakha hua purana backup wapas daalna. */
  async function uploadBackup(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!/\.tar\.gz$/i.test(file.name)) {
      toast.error(t('bak.badFile'));
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/backups/upload`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          Authorization: `Bearer ${getAccessToken()}`,
          'Content-Type': 'application/gzip',
        },
        body: file,
      });

      const data = await res.json();
      if (!res.ok) throw new ApiError(res.status, 'upload_failed', data?.error?.message ?? t('bak.uploadFailed'));

      setRestartNote(data.message ?? t('bak.restartNote'));
      toast.success(t('bak.uploaded'), file.name);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('toast.networkError'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mw-stack">
      <PageHeader
        title={t('bak.title')}
        subtitle={t('bak.subtitle')}
        actions={
          <>
            <input
              ref={fileRef}
              type="file"
              className="visually-hidden"
              accept=".gz,.tar.gz"
              onChange={uploadBackup}
              aria-label={t('bak.upload')}
            />
            <button
              type="button"
              className="btn btn-outline-secondary mw-hide-mobile"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
            >
              <i className="bi bi-upload me-2" />
              {t('bak.upload')}
            </button>
            <button
              type="button"
              className="btn btn-primary mw-btn-block-mobile"
              onClick={createBackup}
              disabled={busy}
            >
              <i className="bi bi-shield-plus me-2" />
              {busy ? t('common.loading') : t('bak.createNow')}
            </button>
          </>
        }
      />

      {/* Restore ka nishaan lag gaya — ab server restart karna zaroori hai.
          Yeh sabse zaroori baat hai, isliye sabse upar. */}
      {restartNote ? (
        <Note tone="warning" icon="bi-arrow-clockwise">
          <strong>{t('bak.restartTitle')}</strong> {restartNote}
        </Note>
      ) : null}

      {settings ? (
        <Note tone="info" icon="bi-clock-history">
          {settings.note}
        </Note>
      ) : null}

      <Card flush>
        <CardHead title={t('bak.listTitle')} subtitle={t('bak.listSub')} />

        {call.loading && backups.length === 0 ? (
          <div className="p-5 text-center mw-text-muted">
            <div className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
            {t('common.loading')}
          </div>
        ) : backups.length === 0 ? (
          <EmptyState
            icon="bi-shield-check"
            title={t('bak.emptyTitle')}
            text={t('bak.emptyText')}
            action={
              <button type="button" className="btn btn-primary" onClick={createBackup}>
                {t('bak.createNow')}
              </button>
            }
          />
        ) : (
          <div className="mw-tablewrap">
            <table className="mw-table">
              <thead>
                <tr>
                  <th scope="col">{t('bak.file')}</th>
                  <th scope="col">{t('bak.when')}</th>
                  <th scope="col" className="mw-table__num">{t('bak.size')}</th>
                  <th scope="col" className="text-end">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {backups.map((backup) => (
                  <tr key={backup.name}>
                    <td className="mw-table__primary mw-mono mw-fs-12">{backup.name}</td>
                    <td className="mw-table__muted mw-nowrap">{formatDateTime(backup.createdAt)}</td>
                    <td className="mw-table__num">{backup.sizeText}</td>
                    <td className="text-end mw-nowrap">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary me-2"
                        data-name={backup.name}
                        onClick={download}
                        disabled={busy}
                      >
                        <i className="bi bi-download me-1" />
                        {t('common.download')}
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary me-2"
                        data-name={backup.name}
                        onClick={askRestore}
                        disabled={busy}
                      >
                        <i className="bi bi-arrow-counterclockwise me-1" />
                        {t('bak.restore')}
                      </button>
                      <button
                        type="button"
                        className="mw-iconbtn"
                        data-name={backup.name}
                        onClick={(event) => setDeleteFor(event.currentTarget.dataset.name)}
                        aria-label={`${t('common.delete')} ${backup.name}`}
                      >
                        <i className="bi bi-trash3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <CardHead title={t('bak.safeTitle')} subtitle={t('bak.safeSub')} />
        <CardBody>
          <div className="mw-grid-3">
            <div className="mw-note mw-note--success">
              <i className="bi bi-shield-check mw-note__icon" aria-hidden="true" />
              <div>{t('bak.safe1')}</div>
            </div>
            <div className="mw-note mw-note--primary">
              <i className="bi bi-cloud-arrow-down mw-note__icon" aria-hidden="true" />
              <div>{t('bak.safe2')}</div>
            </div>
            <div className="mw-note mw-note--info">
              <i className="bi bi-arrow-repeat mw-note__icon" aria-hidden="true" />
              <div>{t('bak.safe3')}</div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Restore poora data badal deta hai, isliye naam likhwa kar pakka
          karwate hain — galti se dab jaana yahan bahut mehnga padta hai. */}
      <Sheet
        open={Boolean(restoreFor)}
        title={t('bak.restoreTitle')}
        onClose={() => setRestoreFor(null)}
        footer={
          <>
            <button type="button" className="btn btn-outline-secondary flex-fill" onClick={() => setRestoreFor(null)}>
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="btn btn-danger flex-fill"
              onClick={doRestore}
              disabled={confirmText !== 'RESTORE' || busy}
            >
              {busy ? t('common.loading') : t('bak.restore')}
            </button>
          </>
        }
      >
        <p className="mw-fs-14 mb-3">{t('bak.restoreBody', { name: restoreFor ?? '' })}</p>

        <Note tone="warning" icon="bi-exclamation-triangle">
          {t('bak.restoreWarn')}
        </Note>

        <label className="form-label mt-3" htmlFor="restore-confirm">
          {t('bak.typeRestore')}
        </label>
        <input
          id="restore-confirm"
          type="text"
          className="form-control mw-mono"
          value={confirmText}
          onChange={(event) => setConfirmText(event.target.value)}
          placeholder="RESTORE"
          autoComplete="off"
        />
      </Sheet>

      <Sheet
        open={Boolean(deleteFor)}
        title={t('bak.deleteTitle')}
        onClose={() => setDeleteFor(null)}
        footer={
          <>
            <button type="button" className="btn btn-outline-secondary flex-fill" onClick={() => setDeleteFor(null)}>
              {t('common.cancel')}
            </button>
            <button type="button" className="btn btn-danger flex-fill" onClick={doDelete}>
              {t('common.delete')}
            </button>
          </>
        }
      >
        <p className="mw-fs-14 mb-0">
          <span className="mw-mono">{deleteFor}</span> — {t('bak.deleteBody')}
        </p>
      </Sheet>
    </div>
  );
}
