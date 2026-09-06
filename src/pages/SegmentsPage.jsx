import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import PageHeader from '../components/ui/PageHeader';
import { useT } from '../i18n/I18nProvider';
import { Card, CardBody, CardHead } from '../components/ui/Card';
import { Note } from '../components/ui/Controls';
import Sheet from '../components/ui/Sheet';
import EmptyState from '../components/ui/EmptyState';
import { ApiError, api } from '../api/client';
import { useApi } from '../api/useApi';
import { useToast } from '../components/ui/ToastProvider';
import { downloadCsv, objectsToRows } from '../utils/download';
import { formatNumber } from '../utils/format';

/**
 * Jo conditions screen par chuni ja sakti hain.
 *
 * Yeh list server ki list se bilkul milti hai (routes/segments.js). Dono ek
 * jaisi rehni chahiye — warna screen aisi cheez maang legi jo server samajh hi
 * nahi payega.
 */
const CONDITIONS = [
  { value: 'opened', labelKey: 'seg.cond.opened' },
  { value: 'not_opened', labelKey: 'seg.cond.notOpened' },
  { value: 'clicked', labelKey: 'seg.cond.clicked' },
  { value: 'not_clicked', labelKey: 'seg.cond.notClicked' },
  { value: 'failed', labelKey: 'seg.cond.failed' },
  { value: 'unsubscribed', labelKey: 'seg.cond.unsubscribed' },
];

const EMPTY_DRAFT = {
  name: '',
  tone: 'primary',
  first: 'opened',
  join: 'and',
  second: 'clicked',
};

export default function SegmentsPage() {
  const t = useT();
  const toast = useToast();

  const segmentsCall = useApi('/api/segments');
  const segments = segmentsCall.data?.segments ?? [];

  const [builderOpen, setBuilderOpen] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  // null = naya segment bana rahe hain; id ho to usi ko badal rahe hain.
  const [editingId, setEditingId] = useState(null);

  // Builder me rule badalte hi "kitne log aayenge" dikhta hai — save karne se
  // pehle hi. Yahi builder ki sabse kaam ki cheez hai.
  const [preview, setPreview] = useState(null);

  const ruleFromDraft = useCallback(
    (value) => ({
      description: '',
      join: value.join,
      conditions: [{ kind: value.first, value: '' }, { kind: value.second, value: '' }],
    }),
    []
  );

  useEffect(() => {
    if (!builderOpen) return undefined;

    let alive = true;
    setPreview(null);

    // Har dropdown badalne par turant request nahi bhejte — 300ms ruk jate
    // hain, warna teen dropdown badalne par teen request chali jati.
    const timer = setTimeout(async () => {
      try {
        const data = await api.post('/api/segments/preview', { rule: ruleFromDraft(draft) });
        if (alive) setPreview(data.count ?? 0);
      } catch (error) {
        if (alive) setPreview(null);
      }
    }, 300);

    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [builderOpen, draft, ruleFromDraft]);

  function openBuilder() {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setFormError('');
    setBuilderOpen(true);
  }

  /**
   * Segment hamesha isi builder se banta hai, isliye uska rule hamesha
   * "do conditions + join" ke shape ka hi hota hai — edit karte waqt wahi
   * do wapas box me bhar dete hain.
   */
  function openEditBuilder(event) {
    const { id } = event.currentTarget.dataset;
    const segment = segments.find((item) => item.id === id);
    if (!segment) return;

    const [first, second] = segment.rule?.conditions ?? [];
    setEditingId(id);
    setDraft({
      name: segment.name,
      tone: segment.tone,
      first: first?.kind ?? EMPTY_DRAFT.first,
      join: segment.rule?.join ?? EMPTY_DRAFT.join,
      second: second?.kind ?? EMPTY_DRAFT.second,
    });
    setFormError('');
    setBuilderOpen(true);
  }

  function closeBuilder() {
    setBuilderOpen(false);
  }

  function handleField(event) {
    const { name, value } = event.target;
    setDraft((current) => ({ ...current, [name]: value }));
    setFormError('');
  }

  async function saveSegment() {
    if (!draft.name.trim()) {
      setFormError(t('seg.nameNeeded'));
      return;
    }

    setSaving(true);
    try {
      const first = CONDITIONS.find((c) => c.value === draft.first);
      const second = CONDITIONS.find((c) => c.value === draft.second);

      const body = {
        name: draft.name.trim(),
        tone: draft.tone,
        rule: {
          // Screen par ek line me dikhane ke liye — English me rakhte hain
          // taki har bhasha me ek jaisa dikhe.
          description: `${first?.value} ${draft.join.toUpperCase()} ${second?.value}`,
          join: draft.join,
          conditions: [{ kind: draft.first, value: '' }, { kind: draft.second, value: '' }],
        },
      };

      if (editingId) {
        await api.put(`/api/segments/${editingId}`, body);
      } else {
        await api.post('/api/segments', body);
      }

      setBuilderOpen(false);
      segmentsCall.reload();
      toast.success(t('toast.segmentSaved'), draft.name);
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : t('toast.networkError'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(event) {
    const { id, name } = event.currentTarget.dataset;

    try {
      await api.delete(`/api/segments/${id}`);
      segmentsCall.reload();
      toast.success(t('toast.segmentDeleted'), name);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('toast.networkError'));
    }
  }

  /**
   * Segment ke log CSV me.
   *
   * Segment apne aap me ek rule hai, list nahi — isliye export ke waqt server
   * se taaza list mangwate hain. Kal ye list apne aap alag ho sakti hai, aur
   * yahi segment ka fayda hai.
   */
  async function handleExport(event) {
    const { id, name } = event.currentTarget.dataset;

    try {
      const data = await api.get(`/api/segments/${id}/contacts`);

      downloadCsv(
        `${name.toLowerCase().replace(/\s+/g, '-')}.csv`,
        objectsToRows(data.contacts ?? [], [
          { key: 'name', label: 'Name' },
          { key: 'email', label: 'Email' },
          { key: 'phone', label: 'Phone' },
          { key: 'company', label: 'Company' },
          { key: 'status', label: 'Status' },
        ])
      );

      toast.success(t('bulk.doneExport', { count: (data.contacts ?? []).length }));
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('toast.networkError'));
    }
  }

  return (
    <div className="mw-stack">
      <PageHeader
        title={t('nav.segments')}
        subtitle={t('seg.subtitle')}
        helpTopic="segments"
        actions={
          <button type="button" className="btn btn-primary mw-btn-block-mobile" onClick={openBuilder}>
            <i className="bi bi-plus-lg me-2" />
            {t('seg.new')}
          </button>
        }
      />

      <Note tone="primary" icon="bi-diagram-3">
        {t('seg.autoNote')}
      </Note>

      {segmentsCall.loading && segments.length === 0 ? (
        <div className="p-5 text-center mw-text-muted">
          <div className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
          {t('common.loading')}
        </div>
      ) : segments.length === 0 ? (
        <EmptyState
          icon="bi-diagram-3"
          title={t('seg.emptyTitle')}
          text={t('seg.emptyText')}
          action={
            <button type="button" className="btn btn-primary" onClick={openBuilder}>
              {t('seg.new')}
            </button>
          }
        />
      ) : (
        <div className="mw-optiongrid">
          {segments.map((segment) => (
            <article key={segment.id} className="mw-option">
              <span className={`mw-option__icon mw-kpi__icon--${segment.tone}`} aria-hidden="true">
                <i className="bi bi-funnel" />
              </span>
              <span>
                <span className="d-block mw-option__title">{segment.name}</span>
                <span className="d-block mw-option__desc mw-mono">{segment.ruleText}</span>
                <span className="d-block mw-fs-16 mw-fw-700 mw-text-ink mt-2">
                  {formatNumber(segment.count)}{' '}
                  <span className="mw-fs-12 mw-fw-500 mw-text-muted">{t('seg.contacts')}</span>
                </span>
                <span className="mw-row mt-3">
                  <Link to={`/campaigns/new?segment=${segment.id}`} className="btn btn-sm btn-outline-primary">
                    {t('tpl.useInCampaign')}
                  </Link>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    data-id={segment.id}
                    onClick={openEditBuilder}
                  >
                    {t('common.edit')}
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    data-id={segment.id}
                    data-name={segment.name}
                    onClick={handleExport}
                  >
                    {t('common.export')}
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-danger"
                    data-id={segment.id}
                    data-name={segment.name}
                    onClick={handleDelete}
                  >
                    {t('common.delete')}
                  </button>
                </span>
              </span>
            </article>
          ))}
        </div>
      )}

      <Card>
        <CardHead title={t('seg.automationTitle')} subtitle={t('seg.automationSub')} />
        <CardBody>
          <div className="mw-grid-2">
            <div className="mw-option">
              <span className="mw-option__icon" aria-hidden="true">
                <i className="bi bi-arrow-repeat" />
              </span>
              <span>
                <span className="d-block mw-option__title">{t('camp.resendUnopened')}</span>
                <span className="d-block mw-option__desc">{t('seg.resendDesc')}</span>
              </span>
            </div>
            <div className="mw-option">
              <span className="mw-option__icon" aria-hidden="true">
                <i className="bi bi-send-check" />
              </span>
              <span>
                <span className="d-block mw-option__title">{t('seg.followClicked')}</span>
                <span className="d-block mw-option__desc">{t('seg.followClickedDesc')}</span>
              </span>
            </div>
          </div>
        </CardBody>
      </Card>

      <Sheet
        open={builderOpen}
        title={editingId ? t('seg.editTitle') : t('seg.buildTitle')}
        onClose={closeBuilder}
        footer={
          <>
            <button type="button" className="btn btn-outline-secondary flex-fill" onClick={closeBuilder}>
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="btn btn-primary flex-fill"
              onClick={saveSegment}
              disabled={saving}
            >
              {saving ? t('common.loading') : t('seg.save')}
            </button>
          </>
        }
      >
        {formError ? (
          <div className="mw-note mw-note--warning mb-3" role="alert">
            <i className="bi bi-exclamation-triangle mw-note__icon" aria-hidden="true" />
            <div>{formError}</div>
          </div>
        ) : null}

        <div className="row g-3">
          <div className="col-12">
            <label className="form-label" htmlFor="segment-name">{t('seg.name')}</label>
            <input
              id="segment-name"
              name="name"
              type="text"
              className="form-control"
              placeholder="Interested Leads"
              value={draft.name}
              onChange={handleField}
            />
          </div>
          <div className="col-12">
            <label className="form-label" htmlFor="segment-c1">{t('seg.condition', { number: 1 })}</label>
            <select id="segment-c1" name="first" className="form-select" value={draft.first} onChange={handleField}>
              {CONDITIONS.map((condition) => (
                <option key={condition.value} value={condition.value}>
                  {t(condition.labelKey)}
                </option>
              ))}
            </select>
          </div>
          <div className="col-12">
            <label className="form-label" htmlFor="segment-join">{t('seg.joinWith')}</label>
            <select id="segment-join" name="join" className="form-select" value={draft.join} onChange={handleField}>
              <option value="and">{t('seg.joinAnd')}</option>
              <option value="or">{t('seg.joinOr')}</option>
            </select>
          </div>
          <div className="col-12">
            <label className="form-label" htmlFor="segment-c2">{t('seg.condition', { number: 2 })}</label>
            <select id="segment-c2" name="second" className="form-select" value={draft.second} onChange={handleField}>
              {CONDITIONS.map((condition) => (
                <option key={condition.value} value={condition.value}>
                  {t(condition.labelKey)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Asli ginti, server se — save karne se pehle hi pata chal jata hai
            ki kitne log aayenge. */}
        <div className="mw-note mw-note--success mt-4">
          <i className="bi bi-people mw-note__icon" aria-hidden="true" />
          <div>
            {preview === null
              ? t('common.loading')
              : t('seg.matchCount', { count: formatNumber(preview) })}
          </div>
        </div>
      </Sheet>
    </div>
  );
}
