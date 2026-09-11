import { useRef, useState } from 'react';

import PageHeader from '../components/ui/PageHeader';
import { Card, CardBody, CardHead } from '../components/ui/Card';
import { Note } from '../components/ui/Controls';
import StatusPill from '../components/ui/StatusPill';
import Sheet from '../components/ui/Sheet';
import EmptyState from '../components/ui/EmptyState';
import { ApiError, api, apiBase, getAccessToken } from '../api/client';
import { useApi } from '../api/useApi';
import { useToast } from '../components/ui/ToastProvider';
import { useT } from '../i18n/I18nProvider';
import { formatDateTime } from '../utils/format';

const STATUS_TONE = {
  successful: 'success',
  running: 'warning',
  pending: 'muted',
  failed: 'danger',
};


export default function BackupPage() {
  const t = useT();
  const toast = useToast();

  const call = useApi('/api/backups');
  const backups = call.data?.backups ?? [];
  const settings = call.data?.settings ?? null;
  const database = call.data?.database ?? null;

  const [busy, setBusy] = useState(false);
  const [restoreFor, setRestoreFor] = useState(null);
  const [confirmText, setConfirmText] = useState('');
  const [deleteFor, setDeleteFor] = useState(null);
  const [restartNote, setRestartNote] = useState('');
  // Asli Postgres par restore turant ho jata hai — restart ki zarurat nahi.
  // PGlite par ab bhi restart chahiye. Banner isi se apna roop badalta hai.
  const [restartRequired, setRestartRequired] = useState(true);

  const fileRef = useRef(null);

  /** Ek click me abhi ka poora backup. */
  async function createBackup() {
    setBusy(true);
    try {
      const data = await api.post('/api/backups');
      call.reload();
      toast.success(
        t('bak.created'),
        data.backup?.tableCount != null ? t('bak.createdDetail', { tables: data.backup.tableCount, rows: data.backup.rowCount }) : undefined
      );
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
   *
   * `busy` yahan set/reset nahi karta — dono callers (button click, aur
   * monthly-ready modal ka "Download Backup") apna khud ka busy sambhalte
   * hain, taaki modal ka apna flow (download + acknowledge) beech me busy
   * false na kar de.
   */
  async function downloadByName(name) {
    const res = await fetch(`${apiBase}/api/backups/${encodeURIComponent(name)}/download`, {
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
  }

  async function download(event) {
    const { name } = event.currentTarget.dataset;
    setBusy(true);
    try {
      await downloadByName(name);
      toast.success(t('bak.downloaded'), name);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('toast.networkError'));
    } finally {
      setBusy(false);
    }
  }

  /**
   * Monthly Backup Ready modal — "Download Backup" ya "Later", dono
   * server par notified_at set kar dete hain, taaki yeh modal isی backup ke
   * liye refresh par dobara na dikhe.
   */
  async function ackMonthlyNotice(shouldDownload) {
    const notice = settings?.pendingMonthlyNotice;
    if (!notice) return;

    setBusy(true);
    try {
      if (shouldDownload) {
        await downloadByName(notice.name);
        toast.success(t('bak.downloaded'), notice.name);
      }
      await api.post(`/api/backups/${encodeURIComponent(notice.name)}/acknowledge`);
      call.reload();
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
      setRestartRequired(data.restartRequired !== false);
      setRestartNote(data.message ?? t('bak.restartNote'));
      toast.success(data.restartRequired === false ? t('bak.restoreDone') : t('bak.restoreMarked'));
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
      const res = await fetch(`${apiBase}/api/backups/upload`, {
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

      if (data.restartRequired) {
        // PGlite ka purana raasta — file seedhi restore ke liye nishaan lag
        // gayi, list me nahi jud sakti (format hi alag hai).
        setRestartRequired(true);
        setRestartNote(data.message ?? t('bak.restartNote'));
        toast.success(t('bak.uploaded'), file.name);
      } else if (data.duplicate) {
        // Checksum se pehchana gaya: yeh upload abhi ke database jaisa hai,
        // ya kisi already-saved backup jaisa hai — dobara nahi joda.
        toast.info(t('bak.duplicateTitle'), data.message);
      } else {
        // Asli Postgres, naya/alag data: file jaanchi jaa chuki, list me aa
        // gayi hai — restore abhi nahi hua, admin jab chahe "Restore" dabayega.
        call.reload();
        toast.success(t('bak.differentTitle'), data.message);
      }
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
        helpTopic="backups"
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

      {/* Restore ho gaya — asli Postgres par turant, ya PGlite par nishaan
          lagne ke baad restart ka intezaar. Yeh sabse zaroori baat hai,
          isliye sabse upar. */}
      {restartNote ? (
        <Note tone={restartRequired ? 'warning' : 'success'} icon={restartRequired ? 'bi-arrow-clockwise' : 'bi-check-circle'}>
          <strong>{restartRequired ? t('bak.restartTitle') : t('bak.restoreDoneTitle')}</strong> {restartNote}
        </Note>
      ) : null}

      {settings ? (
        <Note tone="info" icon="bi-clock-history">
          {settings.note}
          {settings.lastSuccessfulAt ? ` ${t('bak.lastSuccessful', { time: formatDateTime(settings.lastSuccessfulAt) })}` : ''}
        </Note>
      ) : null}

      {/* Storage usage — configured limit ke against kitni jagah use ho rahi
          hai, taaki storage-limit cleanup shuru hone se pehle hi pata chal
          jaaye. */}
      {settings ? (
        <Card>
          <CardBody>
            <div className="d-flex justify-content-between align-items-baseline mb-2">
              <span className="mw-fs-13 mw-fw-600">{t('bak.storageUsageTitle')}</span>
              <span className="mw-fs-13 mw-text-muted">
                {t('bak.storageUsageValue', { used: settings.usedText, max: settings.maxStorageText })}
              </span>
            </div>
            <div className="progress" style={{ height: '0.8rem' }}>
              <div
                className={`progress-bar ${settings.usagePercent >= 90 ? 'bg-danger' : settings.usagePercent >= 70 ? 'bg-warning' : 'bg-primary'}`}
                role="progressbar"
                style={{ width: `${settings.usagePercent}%` }}
                aria-valuenow={settings.usagePercent}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
            <p className="mw-fs-12 mw-text-muted mb-0 mt-2">
              {t('bak.retentionNote', { months: settings.retentionMonths })}
            </p>
          </CardBody>
        </Card>
      ) : null}

      {/* Backup FILES kitni jagah le rahe hain, uske upar wala card dikha
          chuka — yeh asli DATABASE (contacts, campaigns, sab kuch) ki apni
          size hai, alag cheez. `pg_database_size()` se aata hai isliye kisi
          bhi Postgres host par (aaj ka ho ya kal koi aur) kaam karta hai. */}
      {database ? (
        <Card>
          <CardBody>
            <div className="d-flex justify-content-between align-items-baseline mb-2">
              <span className="mw-fs-13 mw-fw-600">{t('bak.dbUsageTitle')}</span>
              <span className="mw-fs-13 mw-text-muted">
                {database.supported
                  ? database.limitBytes
                    ? t('bak.dbUsageValue', { used: database.usedText, max: database.limitText })
                    : t('bak.dbUsageNoLimit', { used: database.usedText })
                  : ''}
              </span>
            </div>
            {database.supported ? (
              database.limitBytes ? (
                <div className="progress" style={{ height: '0.8rem' }}>
                  <div
                    className={`progress-bar ${database.usagePercent >= 90 ? 'bg-danger' : database.usagePercent >= 70 ? 'bg-warning' : 'bg-primary'}`}
                    role="progressbar"
                    style={{ width: `${database.usagePercent}%` }}
                    aria-valuenow={database.usagePercent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  />
                </div>
              ) : (
                <p className="mw-fs-12 mw-text-muted mb-0">{t('bak.dbUsageSetLimit')}</p>
              )
            ) : (
              <p className="mw-fs-12 mw-text-muted mb-0">{t('bak.dbUsageUnsupported')}</p>
            )}
          </CardBody>
        </Card>
      ) : null}

      {/* Sabse zaroori chetavni: agar backup sirf server ki apni disk par hai
          (S3-jaisi jagah set nahi hai), to Render jaisi hosting par yeh deploy
          hote hi mit sakta hai — screen isse chhupati nahi. */}
      {settings && !settings.storage.durable ? (
        <Note tone="warning" icon="bi-hdd-network">
          <strong>{t('bak.storageNotDurableTitle')} </strong>
          {settings.storage.description}
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
                  <th scope="col">{t('bak.type')}</th>
                  <th scope="col">{t('bak.when')}</th>
                  <th scope="col">{t('common.status')}</th>
                  <th scope="col" className="mw-table__num">{t('bak.size')}</th>
                  <th scope="col" className="text-end">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {backups.map((backup) => {
                  const usable = backup.status === 'successful';
                  return (
                  <tr key={backup.name}>
                    <td className="mw-table__primary mw-mono mw-fs-12">
                      {backup.name}
                      {backup.restoredAt ? (
                        <span className="d-block mw-fs-11 mw-text-muted">
                          {t('bak.restoredOn', { time: formatDateTime(backup.restoredAt) })}
                        </span>
                      ) : null}
                    </td>
                    <td>
                      <span className={`badge ${backup.kind === 'monthly' ? 'bg-primary' : 'bg-secondary'}`}>
                        {t(backup.kind === 'monthly' ? 'bak.kindMonthly' : 'bak.kindDaily')}
                      </span>
                    </td>
                    <td className="mw-table__muted mw-nowrap">{formatDateTime(backup.createdAt)}</td>
                    <td>
                      <StatusPill
                        status={t(`bak.status.${backup.status}`)}
                        tone={STATUS_TONE[backup.status] ?? 'muted'}
                      />
                      {backup.error ? (
                        <span className="d-block mw-fs-11 mw-text-danger mt-1">{backup.error}</span>
                      ) : null}
                    </td>
                    <td className="mw-table__num">{backup.sizeText}</td>
                    <td className="text-end mw-nowrap">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary me-2"
                        data-name={backup.name}
                        onClick={download}
                        disabled={busy || !usable}
                      >
                        <i className="bi bi-download me-1" />
                        {t('common.download')}
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary me-2"
                        data-name={backup.name}
                        onClick={askRestore}
                        disabled={busy || !usable}
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
                  );
                })}
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

      {/* Ek mahina poora ho gaya, uski monthly file ban gayi — ek baar
          dikhta hai, "Later" dabane par bhi dobara refresh par nahi aata
          (server par notified_at set ho jata hai). */}
      <Sheet
        open={Boolean(settings?.pendingMonthlyNotice)}
        title={t('bak.monthlyReadyTitle')}
        onClose={() => ackMonthlyNotice(false)}
        footer={
          <>
            <button
              type="button"
              className="btn btn-outline-secondary flex-fill"
              onClick={() => ackMonthlyNotice(false)}
              disabled={busy}
            >
              {t('bak.later')}
            </button>
            <button
              type="button"
              className="btn btn-primary flex-fill"
              onClick={() => ackMonthlyNotice(true)}
              disabled={busy}
            >
              {busy ? t('common.loading') : t('bak.downloadBackup')}
            </button>
          </>
        }
      >
        <p className="mw-fs-14 mb-0">{t('bak.monthlyReadyBody')}</p>
      </Sheet>
    </div>
  );
}
