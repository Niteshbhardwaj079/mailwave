import { useEffect, useState } from 'react';

import { Card, CardBody, CardHead } from '../ui/Card';
import { Note } from '../ui/Controls';
import StatusPill from '../ui/StatusPill';
import Sheet from '../ui/Sheet';
import { useT } from '../../i18n/I18nProvider';
import { useApi } from '../../api/useApi';
import { ApiError, api } from '../../api/client';
import { useToast } from '../ui/ToastProvider';
import { formatNumber, percent } from '../../utils/format';

const TEST_TYPES = ['subject', 'content', 'subject_content', 'sender_name', 'sender_email'];
const METRICS = ['open_rate', 'click_rate', 'ctor'];
const DURATION_PRESETS = [60, 120, 240, 480, 720, 1440];
const LABELS = ['A', 'B', 'C', 'D'];

function emptyVariant(label) {
  return { label, subject: '', senderName: '', replyTo: '', html: '' };
}

function usesField(testType, field) {
  if (field === 'subject') return testType === 'subject' || testType === 'subject_content';
  if (field === 'html') return testType === 'content' || testType === 'subject_content';
  if (field === 'senderName') return testType === 'sender_name';
  if (field === 'replyTo') return testType === 'sender_email';
  return false;
}

/**
 * Ek campaign ka poora A/B life-cycle — setup se lekar winner tak — sab is
 * EK panel me. CampaignAnalyticsPage isi campaign ki tarah ise render karta
 * hai jaise "Add recipients" ka sheet karta hai: apna data khud laata hai,
 * kaam poora hote hi parent ko `onChanged()` se bata deta hai taaki upar ka
 * campaign card bhi taaza ho jaaye.
 */
export default function ABTestPanel({ campaign, onChanged }) {
  const t = useT();
  const toast = useToast();
  const ab = campaign.ab;

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [variantsOpen, setVariantsOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [pickOpen, setPickOpen] = useState(null); // variantId jo confirm karna hai
  const [busy, setBusy] = useState(false);

  const [settingsDraft, setSettingsDraft] = useState({
    testType: ab.testType || 'subject',
    testPercent: ab.testPercent || 20,
    winnerMetric: ab.winnerMetric || 'open_rate',
    durationMinutes: ab.durationMinutes || 240,
    autoWinner: ab.autoWinner ?? true,
    autoSendWinner: ab.autoSendWinner ?? true,
    confidenceThreshold: ab.confidenceThreshold || 95,
  });

  const started = Boolean(ab.testStartedAt);
  const canConfigure = ['Draft', 'Scheduled'].includes(campaign.status) && !started;

  const statsCall = useApi(`/api/campaigns/${campaign.id}/ab/stats`, {
    deps: [campaign.id, campaign.status],
    enabled: ab.enabled,
  });
  const variants = statsCall.data?.variants ?? [];
  const preview = statsCall.data?.preview;

  const [variantDrafts, setVariantDrafts] = useState(null);
  useEffect(() => {
    if (!canConfigure) return;
    if (variants.length > 0) {
      setVariantDrafts(
        variants.map((v) => ({
          label: v.label,
          subject: v.subject || '',
          senderName: v.senderName || '',
          replyTo: v.replyTo || '',
          html: v.html || '',
        }))
      );
    } else if (!variantDrafts) {
      setVariantDrafts([emptyVariant('A'), emptyVariant('B')]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variants.length, canConfigure]);

  // --- countdown -------------------------------------------------------------
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (campaign.status !== 'Testing') return undefined;
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, [campaign.status]);
  const endsAt = ab.testEndsAt ? new Date(ab.testEndsAt).getTime() : null;
  const msRemaining = endsAt ? endsAt - now : null;
  const testEnded = msRemaining !== null && msRemaining <= 0;

  function formatRemaining(ms) {
    if (ms <= 0) return t('ab.testEnded');
    const minutes = Math.ceil(ms / 60000);
    if (minutes < 60) return t('ab.remainingMinutes', { count: minutes });
    const hours = Math.floor(minutes / 60);
    const restMinutes = minutes % 60;
    return restMinutes > 0
      ? t('ab.remainingHoursMinutes', { hours, minutes: restMinutes })
      : t('ab.remainingHours', { count: hours });
  }

  async function refreshAfterAction() {
    await statsCall.reload();
    onChanged?.();
  }

  // --- turn A/B on/off ---------------------------------------------------------
  async function enableAb() {
    setBusy(true);
    try {
      await api.put(`/api/campaigns/${campaign.id}/ab`, { ...settingsDraft, enabled: true });
      toast.success(t('ab.enabledToast'));
      onChanged?.();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('toast.networkError'));
    } finally {
      setBusy(false);
    }
  }

  async function saveSettings() {
    setBusy(true);
    try {
      await api.put(`/api/campaigns/${campaign.id}/ab`, { ...settingsDraft, enabled: true });
      toast.success(t('ab.settingsSavedToast'));
      setSettingsOpen(false);
      onChanged?.();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('toast.networkError'));
    } finally {
      setBusy(false);
    }
  }

  async function disableAb() {
    setBusy(true);
    try {
      await api.put(`/api/campaigns/${campaign.id}/ab`, { ...settingsDraft, enabled: false });
      toast.success(t('ab.disabledToast'));
      onChanged?.();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('toast.networkError'));
    } finally {
      setBusy(false);
    }
  }

  // --- variants ----------------------------------------------------------------
  function updateVariant(index, patch) {
    setVariantDrafts((current) => current.map((v, i) => (i === index ? { ...v, ...patch } : v)));
  }

  function addVariant() {
    setVariantDrafts((current) => [...current, emptyVariant(LABELS[current.length] || 'X')]);
  }

  function removeVariant(index) {
    setVariantDrafts((current) => current.filter((_, i) => i !== index));
  }

  async function saveVariants() {
    setBusy(true);
    try {
      await api.put(`/api/campaigns/${campaign.id}/ab/variants`, { variants: variantDrafts });
      toast.success(t('ab.variantsSavedToast'));
      setVariantsOpen(false);
      await refreshAfterAction();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('toast.networkError'));
    } finally {
      setBusy(false);
    }
  }

  // --- lifecycle actions ---------------------------------------------------------
  async function startTest() {
    setBusy(true);
    try {
      await api.post(`/api/campaigns/${campaign.id}/ab/start`);
      toast.success(t('ab.startedToast'));
      await refreshAfterAction();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('toast.networkError'));
    } finally {
      setBusy(false);
    }
  }

  async function decideWinnerNow(variantId) {
    setBusy(true);
    try {
      const data = await api.post(`/api/campaigns/${campaign.id}/ab/decide-winner`, variantId ? { variantId } : {});
      if (data.decided) {
        toast.success(t('ab.winnerDecidedToast'));
      } else {
        toast.error(
          data.reason === 'insufficient_sample'
            ? t('ab.insufficientSample')
            : data.reason === 'not_significant'
              ? t('ab.noSignificantWinner')
              : t('toast.networkError')
        );
      }
      setPickOpen(null);
      await refreshAfterAction();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('toast.networkError'));
    } finally {
      setBusy(false);
    }
  }

  async function sendWinnerNow() {
    setBusy(true);
    try {
      await api.post(`/api/campaigns/${campaign.id}/ab/send-winner`);
      toast.success(t('ab.winnerSentToast'));
      await refreshAfterAction();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('toast.networkError'));
    } finally {
      setBusy(false);
    }
  }

  async function cancelTest() {
    setBusy(true);
    try {
      await api.post(`/api/campaigns/${campaign.id}/ab/cancel`);
      toast.success(t('ab.cancelledToast'));
      setCancelOpen(false);
      await refreshAfterAction();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('toast.networkError'));
    } finally {
      setBusy(false);
    }
  }

  // --- render: A/B not enabled yet ------------------------------------------
  if (!ab.enabled) {
    if (!canConfigure) return null; // already sent as a normal campaign — nothing to offer here
    return (
      <Card>
        <CardHead title={t('ab.title')} subtitle={t('ab.subtitle')} />
        <CardBody>
          <button type="button" className="btn btn-outline-primary" onClick={enableAb} disabled={busy}>
            <i className="bi bi-signpost-split me-2" />
            {t('ab.enableButton')}
          </button>
        </CardBody>
      </Card>
    );
  }

  const winnerVariant = variants.find((v) => v.id === ab.winnerVariantId);

  return (
    <Card>
      <CardHead
        title={t('ab.title')}
        subtitle={t(`ab.testType.${ab.testType}`)}
        tools={
          canConfigure ? (
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setSettingsOpen(true)}>
              <i className="bi bi-gear me-1" />
              {t('common.edit')}
            </button>
          ) : null
        }
      />
      <CardBody>
        {canConfigure ? (
          <>
            <p className="mw-fs-13 mw-text-muted">
              {t('ab.setupSummary', {
                percent: ab.testPercent,
                metric: t(`ab.metric.${ab.winnerMetric}`),
                duration: formatRemaining(ab.durationMinutes * 60000),
              })}
            </p>

            <div className="mw-row mw-row--wrap mb-3">
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setVariantsOpen(true)}>
                <i className="bi bi-columns-gap me-1" />
                {t('ab.editVariants', { count: variantDrafts?.length ?? variants.length })}
              </button>
              <button type="button" className="btn btn-sm btn-outline-danger" onClick={disableAb} disabled={busy}>
                {t('ab.disableButton')}
              </button>
            </div>

            {variants.length < 2 ? (
              <Note tone="warning" icon="bi-exclamation-triangle">
                {t('ab.needVariants')}
              </Note>
            ) : (
              <button type="button" className="btn btn-primary" onClick={startTest} disabled={busy}>
                <i className="bi bi-play-fill me-2" />
                {t('ab.startTest')}
              </button>
            )}
          </>
        ) : (
          <>
            {campaign.status === 'Testing' ? (
              <div className="d-flex justify-content-between align-items-center mb-3">
                <StatusPill status={t('ab.testingTitle')} tone="primary" />
                <span className="mw-fs-13 mw-text-muted">
                  {testEnded ? t('ab.testEnded') : t('ab.testEndsIn', { time: formatRemaining(msRemaining) })}
                </span>
              </div>
            ) : null}

            {ab.winnerVariantId ? (
              <Note tone="success" icon="bi-trophy">
                <strong>{t('ab.winnerTitle', { label: winnerVariant?.label ?? '?' })}</strong>
                <span className="d-block mw-fs-13 mt-1">{statsCall.data?.winnerReason || t('ab.winnerReasonFallback')}</span>
              </Note>
            ) : null}

            <div className="mw-abvariants mt-3">
              {variants.map((variant) => (
                <div key={variant.id} className={`mw-abvariant ${variant.id === ab.winnerVariantId ? 'is-winner' : ''}`.trim()}>
                  <div className="mw-abvariant__head">
                    <span className="mw-fs-14 mw-fw-700">
                      {t('ab.variantLabel', { label: variant.label })}
                      {variant.id === ab.winnerVariantId ? <i className="bi bi-trophy-fill ms-2 mw-text-warning" /> : null}
                    </span>
                    {campaign.status === 'Testing' && !ab.winnerVariantId ? (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary"
                        onClick={() => setPickOpen(variant.id)}
                        disabled={busy}
                      >
                        {t('ab.pickThisVariant')}
                      </button>
                    ) : null}
                  </div>

                  {usesField(ab.testType, 'subject') && variant.subject ? (
                    <p className="mw-fs-12 mw-text-muted mb-2">"{variant.subject}"</p>
                  ) : null}

                  <div className="mw-abvariant__stats">
                    <div>
                      <span className="mw-fs-11 mw-text-muted-2 d-block">{t('ab.sent')}</span>
                      <span className="mw-fs-15 mw-fw-700">{formatNumber(variant.stats.sent)}</span>
                    </div>
                    <div>
                      <span className="mw-fs-11 mw-text-muted-2 d-block">{t('ab.openRate')}</span>
                      <span className="mw-fs-15 mw-fw-700">{percent(variant.stats.uniqueOpens, variant.stats.sent)}</span>
                    </div>
                    <div>
                      <span className="mw-fs-11 mw-text-muted-2 d-block">{t('ab.clickRate')}</span>
                      <span className="mw-fs-15 mw-fw-700">{percent(variant.stats.uniqueClicks, variant.stats.sent)}</span>
                    </div>
                    <div>
                      <span className="mw-fs-11 mw-text-muted-2 d-block">{t('ab.ctor')}</span>
                      <span className="mw-fs-15 mw-fw-700">{percent(variant.stats.uniqueClicks, variant.stats.uniqueOpens)}</span>
                    </div>
                    <div>
                      <span className="mw-fs-11 mw-text-muted-2 d-block">{t('ab.bounced')}</span>
                      <span className="mw-fs-15 mw-fw-700">{formatNumber(variant.stats.bounced)}</span>
                    </div>
                    <div>
                      <span className="mw-fs-11 mw-text-muted-2 d-block">{t('ab.unsubscribes')}</span>
                      <span className="mw-fs-15 mw-fw-700">{formatNumber(variant.stats.unsubscribes)}</span>
                    </div>
                    <div>
                      <span className="mw-fs-11 mw-text-muted-2 d-block" title={t('ab.spamComplaintsHelp')}>
                        {t('ab.spamComplaints')}
                      </span>
                      <span className="mw-fs-15 mw-fw-700 mw-text-muted">{t('ab.notAvailable')}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {campaign.status === 'Testing' && !ab.winnerVariantId ? (
              <div className="mw-row mw-row--wrap mt-3">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => decideWinnerNow(null)}
                  disabled={busy}
                >
                  <i className="bi bi-trophy me-2" />
                  {t('ab.decideNow')}
                </button>
                <button type="button" className="btn btn-outline-danger" onClick={() => setCancelOpen(true)} disabled={busy}>
                  {t('ab.cancelTest')}
                </button>
                {preview ? (
                  <span className="mw-fs-12 mw-text-muted align-self-center">
                    {preview.decided
                      ? t('ab.previewLeading', { label: variants.find((v) => v.id === preview.winnerVariantId)?.label ?? '?', confidence: Math.round(preview.confidence ?? 0) })
                      : preview.reason === 'insufficient_sample'
                        ? t('ab.insufficientSample')
                        : t('ab.previewNotYetSignificant', { confidence: Math.round(preview.confidence ?? 0) })}
                  </span>
                ) : null}
              </div>
            ) : null}

            {campaign.status === 'Winner Selected' ? (
              <button type="button" className="btn btn-primary mt-3" onClick={sendWinnerNow} disabled={busy}>
                <i className="bi bi-send me-2" />
                {t('ab.sendWinnerNow')}
              </button>
            ) : null}
          </>
        )}
      </CardBody>

      {/* --- settings sheet ----------------------------------------------------- */}
      <Sheet
        open={settingsOpen}
        title={t('ab.title')}
        onClose={() => setSettingsOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-outline-secondary flex-fill" onClick={() => setSettingsOpen(false)}>
              {t('common.cancel')}
            </button>
            <button type="button" className="btn btn-primary flex-fill" onClick={saveSettings} disabled={busy}>
              {busy ? t('common.loading') : t('ab.saveSettings')}
            </button>
          </>
        }
      >
        <div className="row g-3">
          <div className="col-12">
            <label className="form-label">{t('ab.testType')}</label>
            <select
              className="form-select"
              value={settingsDraft.testType}
              onChange={(e) => setSettingsDraft((c) => ({ ...c, testType: e.target.value }))}
            >
              {TEST_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t(`ab.testType.${type}`)}
                </option>
              ))}
            </select>
          </div>

          <div className="col-12 col-md-6">
            <label className="form-label">{t('ab.testPercent')}</label>
            <input
              type="number"
              min={1}
              max={100}
              className="form-control"
              value={settingsDraft.testPercent}
              onChange={(e) => setSettingsDraft((c) => ({ ...c, testPercent: Number(e.target.value) }))}
            />
            <div className="form-text">{t('ab.testPercentHelp')}</div>
          </div>

          <div className="col-12 col-md-6">
            <label className="form-label">{t('ab.winnerMetric')}</label>
            <select
              className="form-select"
              value={settingsDraft.winnerMetric}
              onChange={(e) => setSettingsDraft((c) => ({ ...c, winnerMetric: e.target.value }))}
            >
              {METRICS.map((metric) => (
                <option key={metric} value={metric}>
                  {t(`ab.metric.${metric}`)}
                </option>
              ))}
            </select>
          </div>

          <div className="col-12">
            <label className="form-label">{t('ab.duration')}</label>
            <div className="mw-row mw-row--wrap mb-2">
              {DURATION_PRESETS.map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  className={`mw-chip ${settingsDraft.durationMinutes === minutes ? 'is-active' : ''}`.trim()}
                  onClick={() => setSettingsDraft((c) => ({ ...c, durationMinutes: minutes }))}
                >
                  {formatRemaining(minutes * 60000)}
                </button>
              ))}
            </div>
            <input
              type="number"
              min={5}
              className="form-control"
              value={settingsDraft.durationMinutes}
              onChange={(e) => setSettingsDraft((c) => ({ ...c, durationMinutes: Number(e.target.value) }))}
              placeholder={t('ab.duration.custom')}
            />
          </div>

          <div className="col-12 col-md-6">
            <label className="form-label">{t('ab.confidenceThreshold')}</label>
            <input
              type="number"
              min={50}
              max={99}
              className="form-control"
              value={settingsDraft.confidenceThreshold}
              onChange={(e) => setSettingsDraft((c) => ({ ...c, confidenceThreshold: Number(e.target.value) }))}
            />
            <div className="form-text">{t('ab.confidenceThresholdHelp')}</div>
          </div>

          <div className="col-12">
            <div className="form-check form-switch">
              <input
                className="form-check-input"
                type="checkbox"
                role="switch"
                id="ab-auto-winner"
                checked={settingsDraft.autoWinner}
                onChange={(e) => setSettingsDraft((c) => ({ ...c, autoWinner: e.target.checked }))}
              />
              <label className="form-check-label" htmlFor="ab-auto-winner">
                {t('ab.autoWinner')}
              </label>
            </div>
            <div className="form-text">{t('ab.autoWinnerHelp')}</div>
          </div>

          <div className="col-12">
            <div className="form-check form-switch">
              <input
                className="form-check-input"
                type="checkbox"
                role="switch"
                id="ab-auto-send"
                checked={settingsDraft.autoSendWinner}
                onChange={(e) => setSettingsDraft((c) => ({ ...c, autoSendWinner: e.target.checked }))}
              />
              <label className="form-check-label" htmlFor="ab-auto-send">
                {t('ab.autoSendWinner')}
              </label>
            </div>
            <div className="form-text">{t('ab.autoSendWinnerHelp')}</div>
          </div>
        </div>
      </Sheet>

      {/* --- variants sheet ------------------------------------------------------- */}
      <Sheet
        open={variantsOpen}
        title={t('ab.variants')}
        onClose={() => setVariantsOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-outline-secondary flex-fill" onClick={() => setVariantsOpen(false)}>
              {t('common.cancel')}
            </button>
            <button type="button" className="btn btn-primary flex-fill" onClick={saveVariants} disabled={busy}>
              {busy ? t('common.loading') : t('ab.saveVariants')}
            </button>
          </>
        }
      >
        {(variantDrafts ?? []).map((variant, index) => (
          <div key={index} className="mw-card mw-card--flush p-3 mb-3">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <span className="mw-fs-14 mw-fw-700">{t('ab.variantLabel', { label: variant.label })}</span>
              {variantDrafts.length > 2 ? (
                <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => removeVariant(index)}>
                  {t('ab.removeVariant')}
                </button>
              ) : null}
            </div>

            {usesField(settingsDraft.testType, 'subject') ? (
              <div className="mb-2">
                <label className="form-label">{t('ab.variantSubject')}</label>
                <input
                  type="text"
                  className="form-control"
                  value={variant.subject}
                  onChange={(e) => updateVariant(index, { subject: e.target.value })}
                />
              </div>
            ) : null}

            {usesField(settingsDraft.testType, 'senderName') ? (
              <div className="mb-2">
                <label className="form-label">{t('ab.variantSenderName')}</label>
                <input
                  type="text"
                  className="form-control"
                  value={variant.senderName}
                  onChange={(e) => updateVariant(index, { senderName: e.target.value })}
                />
              </div>
            ) : null}

            {usesField(settingsDraft.testType, 'replyTo') ? (
              <div className="mb-2">
                <label className="form-label">{t('ab.variantReplyTo')}</label>
                <input
                  type="email"
                  className="form-control"
                  value={variant.replyTo}
                  onChange={(e) => updateVariant(index, { replyTo: e.target.value })}
                />
              </div>
            ) : null}

            {usesField(settingsDraft.testType, 'html') ? (
              <div>
                <label className="form-label">{t('ab.variantHtml')}</label>
                <textarea
                  className="form-control mw-mono"
                  rows={6}
                  value={variant.html}
                  onChange={(e) => updateVariant(index, { html: e.target.value })}
                />
                <div className="form-text">{t('ab.variantHtmlHelp')}</div>
              </div>
            ) : null}
          </div>
        ))}

        {(variantDrafts?.length ?? 0) < 4 ? (
          <button type="button" className="btn btn-outline-secondary w-100" onClick={addVariant}>
            <i className="bi bi-plus-lg me-2" />
            {t('ab.addVariant')}
          </button>
        ) : null}
      </Sheet>

      {/* --- cancel confirm ------------------------------------------------------- */}
      <Sheet open={cancelOpen} title={t('ab.confirmCancelTitle')} onClose={() => setCancelOpen(false)}>
        <p className="mw-fs-14 mw-text-muted mb-4">{t('ab.confirmCancelText')}</p>
        <div className="d-flex gap-2">
          <button type="button" className="btn btn-outline-secondary flex-fill" onClick={() => setCancelOpen(false)} disabled={busy}>
            {t('common.cancel')}
          </button>
          <button type="button" className="btn btn-danger flex-fill" onClick={cancelTest} disabled={busy}>
            {busy ? t('common.loading') : t('ab.cancelTest')}
          </button>
        </div>
      </Sheet>

      {/* --- manual pick confirm ---------------------------------------------------- */}
      <Sheet open={Boolean(pickOpen)} title={t('ab.pickThisVariant')} onClose={() => setPickOpen(null)}>
        <p className="mw-fs-14 mw-text-muted mb-4">
          {t('ab.confirmPickText', { label: variants.find((v) => v.id === pickOpen)?.label ?? '?' })}
        </p>
        <div className="d-flex gap-2">
          <button type="button" className="btn btn-outline-secondary flex-fill" onClick={() => setPickOpen(null)} disabled={busy}>
            {t('common.cancel')}
          </button>
          <button type="button" className="btn btn-primary flex-fill" onClick={() => decideWinnerNow(pickOpen)} disabled={busy}>
            {busy ? t('common.loading') : t('ab.pickThisVariant')}
          </button>
        </div>
      </Sheet>
    </Card>
  );
}
