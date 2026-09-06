import { useEffect, useMemo, useRef, useState } from 'react';

import PageHeader from '../components/ui/PageHeader';
import { useDebouncedValue } from '../utils/useDebouncedValue';
import { Card, CardBody, CardFoot, CardHead } from '../components/ui/Card';
import { Note, SearchInput, Segmented } from '../components/ui/Controls';
import FilterSelect, { FilterBar } from '../components/ui/FilterSelect';
import StatusPill from '../components/ui/StatusPill';
import EmptyState from '../components/ui/EmptyState';
import HtmlPreview from '../components/templates/HtmlPreview';
import ImageLibrary from '../components/templates/ImageLibrary';
import { useT } from '../i18n/I18nProvider';
import { useWorkspace } from '../store/WorkspaceProvider';
import { EMAIL_GROUPS, fillPreview } from '../data/systemEmails';
import { LANGUAGES, findLanguage } from '../i18n/languages';

export default function SystemEmailsPage() {
  const t = useT();
  const {
    systemEmails,
    updateSystemEmail,
    loadSystemEmailsForLanguage,
    deleteSystemEmailTranslation,
    resetSystemEmail,
    toggleSystemEmail,
    sendTestSystemEmail,
    loading,
  } = useWorkspace();

  const [selectedKey, setSelectedKey] = useState(systemEmails[0]?.key || '');
  const [group, setGroup] = useState('all');
  const [query, setQuery] = useState('');
  // Box me turant, chhantai 200ms ruk kar — type karte waqt atakta nahi.
  const search = useDebouncedValue(query, 200);
  const [tab, setTab] = useState('preview');
  const [testSending, setTestSending] = useState(false);
  const [testSentTo, setTestSentTo] = useState('');

  // Editor me kaunsi language khuli hai — English hi is page ka default hai.
  // Badalte hi poori list us language ke content ke saath dobara aati hai.
  // Pehli baar English hi chahiye, jo workspace load par already aa chuki
  // hai — isliye pehla render skip karte hain, koi extra request nahi.
  const [language, setLanguage] = useState('en');
  const skippedFirstLoad = useRef(false);
  useEffect(() => {
    if (!skippedFirstLoad.current) {
      skippedFirstLoad.current = true;
      return;
    }
    loadSystemEmailsForLanguage(language);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  // Har keystroke par server ko bachana galat tha — type karte waqt screen
  // atakti thi aur do jaldi-jaldi save ek dusre ko overwrite kar sakte the.
  // Ab yahin draft me rakhte hain, "Save" dabane par hi asli save hota hai.
  const [draftSubject, setDraftSubject] = useState('');
  const [draftHtml, setDraftHtml] = useState('');
  const [saving, setSaving] = useState(false);
  const htmlRef = useRef(null);

  const visible = useMemo(() => {
    const text = search.trim().toLowerCase();
    return systemEmails.filter((item) => {
      const groupOk = group === 'all' || item.group === group;
      const textOk =
        !text ||
        item.name.toLowerCase().includes(text) ||
        item.event.toLowerCase().includes(text) ||
        item.key.toLowerCase().includes(text);
      return groupOk && textOk;
    });
  }, [systemEmails, group, search]);

  const selected = systemEmails.find((item) => item.key === selectedKey) || systemEmails[0];

  // Selection badle, ya save/reset ke baad server se naya subject/html aaye,
  // to draft ko usi se bhar dete hain. Typing ke dauraan yeh nahi chalta —
  // subject/html tabhi badalte hain jab Save ya Reset khud unhe badal de.
  useEffect(() => {
    setDraftSubject(selected?.subject ?? '');
    setDraftHtml(selected?.html ?? '');
  }, [selected?.key, selected?.subject, selected?.html]);

  const dirty = Boolean(selected) && (draftSubject !== selected.subject || draftHtml !== selected.html);
  // Jab is language ka kuch saved nahi (English dikh rahi hai), tab bhi Save
  // dabaya ja sake — bina kuch badle bhi, taaki English content isi language
  // ke starting point ki tarah lock ho sake.
  const canSave = dirty || Boolean(selected?.isFallback);

  function pick(event) {
    setSelectedKey(event.currentTarget.dataset.key);
    setTestSentTo('');
  }

  async function handleSendTest() {
    setTestSending(true);
    setTestSentTo('');
    const data = await sendTestSystemEmail(selected.key, language);
    if (data) setTestSentTo(data.to);
    setTestSending(false);
  }

  function handleSubject(event) {
    setDraftSubject(event.target.value);
  }

  function handleHtml(event) {
    setDraftHtml(event.target.value);
  }

  function insertAtCursor(snippet) {
    const field = htmlRef.current;
    if (!field) {
      setDraftHtml((current) => current + snippet);
      return;
    }
    const start = field.selectionStart ?? draftHtml.length;
    const end = field.selectionEnd ?? draftHtml.length;
    const next = `${draftHtml.slice(0, start)}${snippet}${draftHtml.slice(end)}`;
    setDraftHtml(next);
    window.requestAnimationFrame(() => {
      field.focus();
      field.selectionStart = start + snippet.length;
      field.selectionEnd = start + snippet.length;
    });
  }

  async function handleSave() {
    setSaving(true);
    await updateSystemEmail(selected.key, { subject: draftSubject, html: draftHtml }, language);
    setSaving(false);
  }

  function handleToggle() {
    toggleSystemEmail(selected.key);
  }

  function handleDeleteTranslation() {
    deleteSystemEmailTranslation(selected.key, language);
  }

  function handleReset() {
    resetSystemEmail(selected.key);
  }

  function clearFilters() {
    setGroup('all');
    setQuery('');
  }

  const enabledCount = systemEmails.filter((item) => item.enabled).length;

  return (
    <div className="mw-stack">
      <PageHeader title={t('sysmail.title')} subtitle={t('sysmail.subtitle')} helpTopic="sysmail" />

      <Note tone="primary" icon="bi-lightning-charge">
        {t('sysmail.intro')}
      </Note>

      <Card flush>
        <FilterBar onClear={clearFilters} clearLabel={t('common.clear')}>
          <div className="mw-filterbar__search">
            <SearchInput value={query} onChange={setQuery} placeholder={t('sysmail.searchPlaceholder')} />
          </div>
          <FilterSelect
            id="sysmail-group"
            label={t('sysmail.group')}
            icon="bi-collection"
            value={group}
            onChange={setGroup}
            options={[
              { value: 'all', label: t('common.all') },
              ...EMAIL_GROUPS.map((item) => ({ value: item.key, label: t(item.labelKey) })),
            ]}
          />
          <FilterSelect
            id="sysmail-language"
            label={t('sysmail.language')}
            icon="bi-translate"
            value={language}
            onChange={setLanguage}
            options={LANGUAGES.map((item) => ({ value: item.code, label: `${item.flag} ${item.native}` }))}
          />
        </FilterBar>

        <CardFoot>
          <span className="mw-fs-12 mw-text-muted">
            {t('common.showing')} {visible.length} {t('common.of')} {systemEmails.length} · {enabledCount}{' '}
            {t('sysmail.turnedOn')}
          </span>
        </CardFoot>
      </Card>

      <div className="mw-editor mw-editor--list">
        <Card flush>
          <CardHead title={t('sysmail.list')} subtitle={t('sysmail.listSub')} />

          <div className="mw-mailist">
            {loading && systemEmails.length === 0 ? (
              <div className="p-5 text-center mw-text-muted">
                <div className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                {t('common.loading')}
              </div>
            ) : visible.length === 0 ? (
              <EmptyState icon="bi-envelope" title={t('common.noResults')} text={t('common.noResultsText')} />
            ) : (
              visible.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  data-key={item.key}
                  onClick={pick}
                  className={`mw-mailrow ${item.key === selected?.key ? 'is-active' : ''}`.trim()}
                >
                  <span className={`mw-logicon mw-kpi__icon--${item.enabled ? 'primary' : 'muted'}`} aria-hidden="true">
                    <i className={`bi ${item.critical ? 'bi-shield-lock' : 'bi-envelope'}`} />
                  </span>

                  <span className="flex-grow-1 min-w-0">
                    <span className="d-block mw-mailrow__name">{item.name}</span>
                    <span className="d-block mw-mailrow__event">{item.event}</span>
                    <span className="d-block mw-mailrow__key mw-mono">{item.key}</span>
                  </span>

                  {item.enabled ? null : <StatusPill status={t('sysmail.off')} tone="muted" />}
                </button>
              ))
            )}
          </div>
        </Card>

        {selected ? (
          <Card flush>
            <CardHead
              title={selected.name}
              subtitle={selected.event}
              tools={
                <>
                  {/* Yahin sabse upar bhi — sirf "Details" tab me chhupa hota to
                      log dhoondh nahi paate ki band/chalu kahan se karein. */}
                  <div className="mw-row mw-row--wrap align-items-center">
                    <StatusPill
                      status={selected.enabled ? t('sysmail.statusOn') : t('sysmail.statusOff')}
                      tone={selected.enabled ? 'success' : 'muted'}
                    />
                    <div className="form-check form-switch mb-0">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        role="switch"
                        id="sysmail-enabled-header"
                        checked={selected.enabled}
                        disabled={selected.critical}
                        onChange={handleToggle}
                      />
                      <label className="form-check-label visually-hidden" htmlFor="sysmail-enabled-header">
                        {t('sysmail.enabled')}
                      </label>
                    </div>
                  </div>
                  <Segmented
                    items={[
                      { value: 'preview', label: t('common.preview') },
                      { value: 'edit', label: t('common.edit') },
                      { value: 'images', label: t('img.title') },
                      { value: 'info', label: t('sysmail.details') },
                    ]}
                    value={tab}
                    onChange={setTab}
                    ariaLabel={t('common.preview')}
                  />
                </>
              }
            />

            <CardBody>
              {tab === 'preview' ? (
                <>
                  <div className="mw-mailmeta">
                    <div className="mw-kv">
                      <span className="mw-kv__key">{t('sysmail.to')}</span>
                      <span className="mw-kv__value">{selected.to}</span>
                    </div>
                    <div className="mw-kv">
                      <span className="mw-kv__key">{t('tpl.subject')}</span>
                      <span className="mw-kv__value">{fillPreview(selected.subject)}</span>
                    </div>
                  </div>
                  <HtmlPreview html={fillPreview(selected.html)} title={selected.name} />
                  <p className="form-text mt-2 mb-0">{t('sysmail.previewNote')}</p>
                </>
              ) : null}

              {tab === 'edit' ? (
                <>
                  {selected.isFallback ? (
                    <Note tone="info" icon="bi-translate">
                      {t('sysmail.fallbackNote', { language: findLanguage(language).native })}
                    </Note>
                  ) : null}

                  <div className="mb-3">
                    <label className="form-label" htmlFor="sysmail-subject">
                      {t('tpl.subject')}
                    </label>
                    <input
                      id="sysmail-subject"
                      type="text"
                      className="form-control"
                      value={draftSubject}
                      onChange={handleSubject}
                    />
                  </div>

                  <div className="mb-3">
                    <span className="form-label d-block">{t('sysmail.variables')}</span>
                    <div className="mw-row mw-row--wrap">
                      {(selected.variables ?? []).map((name) => (
                        <span key={name} className="mw-var">{`{{${name}}}`}</span>
                      ))}
                    </div>
                    <p className="form-text mt-2 mb-0">{t('sysmail.variablesHelp')}</p>
                  </div>

                  <label className="form-label" htmlFor="sysmail-html">
                    {t('tpl.html')}
                  </label>
                  <textarea
                    id="sysmail-html"
                    ref={htmlRef}
                    className="mw-codearea"
                    value={draftHtml}
                    onChange={handleHtml}
                    spellCheck="false"
                  />
                  <p className="form-text">{t('tpl.unsavedNote')}</p>

                  <div className="mw-row mw-row--wrap mt-3">
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={handleSave}
                      disabled={!canSave || saving}
                    >
                      <i className="bi bi-save me-2" />
                      {saving ? t('common.loading') : t('common.save')}
                    </button>
                    {language === 'en' ? (
                      <button type="button" className="btn btn-outline-secondary btn-sm" onClick={handleReset}>
                        <i className="bi bi-arrow-counterclockwise me-2" />
                        {t('sysmail.reset')}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-outline-danger btn-sm"
                        onClick={handleDeleteTranslation}
                        disabled={selected.isFallback}
                      >
                        <i className="bi bi-x-circle me-2" />
                        {t('sysmail.removeTranslation')}
                      </button>
                    )}
                  </div>
                </>
              ) : null}

              {tab === 'images' ? <ImageLibrary onInsert={insertAtCursor} /> : null}

              {tab === 'info' ? (
                <>
                  <div className="mw-kv">
                    <span className="mw-kv__key">{t('sysmail.eventKey')}</span>
                    <span className="mw-kv__value mw-mono">{selected.key}</span>
                  </div>
                  <div className="mw-kv">
                    <span className="mw-kv__key">{t('sysmail.when')}</span>
                    <span className="mw-kv__value">{selected.event}</span>
                  </div>
                  <div className="mw-kv">
                    <span className="mw-kv__key">{t('sysmail.to')}</span>
                    <span className="mw-kv__value">{selected.to}</span>
                  </div>
                  <div className="mw-kv">
                    <span className="mw-kv__key">{t('sysmail.group')}</span>
                    <span className="mw-kv__value">
                      {t(EMAIL_GROUPS.find((item) => item.key === selected.group)?.labelKey || selected.group)}
                    </span>
                  </div>

                  <div className="mw-switchrow mt-3">
                    <div className="mw-switchrow__body">
                      <div className="mw-row mw-row--wrap mb-1">
                        <span className="mw-switchrow__title mb-0">{t('sysmail.enabled')}</span>
                        <StatusPill
                          status={selected.enabled ? t('sysmail.statusOn') : t('sysmail.statusOff')}
                          tone={selected.enabled ? 'success' : 'muted'}
                        />
                      </div>
                      <p className="mw-switchrow__desc mb-0">
                        {selected.critical ? t('sysmail.criticalNote') : t('sysmail.optionalNote')}
                      </p>
                    </div>
                    <div className="form-check form-switch">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        role="switch"
                        id="sysmail-enabled"
                        checked={selected.enabled}
                        disabled={selected.critical}
                        onChange={handleToggle}
                      />
                      <label className="form-check-label visually-hidden" htmlFor="sysmail-enabled">
                        {t('sysmail.enabled')}
                      </label>
                    </div>
                  </div>

                  <div className="mw-switchrow mt-2">
                    <div className="mw-switchrow__body">
                      <div className="mw-switchrow__title">{t('sysmail.sendTest')}</div>
                      <p className="mw-switchrow__desc mb-0">{t('sysmail.testNote')}</p>
                      {testSentTo ? (
                        <p className="mw-fs-12 mw-text-success mt-1 mb-0">
                          <i className="bi bi-check-circle me-1" />
                          {t('sysmail.testSentTo', { email: testSentTo })}
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm"
                      onClick={handleSendTest}
                      disabled={testSending}
                    >
                      <i className="bi bi-envelope-check me-2" />
                      {testSending ? t('common.loading') : t('sysmail.sendTest')}
                    </button>
                  </div>

                  <h3 className="mw-fs-14 mw-fw-700 mt-4 mb-2">{t('sysmail.forDevs')}</h3>
                  <pre className="mw-codearea mw-codearea--sm mb-0">{`sendSystemEmail('${selected.key}', {
  to: recipient.email,
  vars: {
${(selected.variables ?? []).map((name) => `    ${name}: …,`).join('\n')}
  },
});`}</pre>
                </>
              ) : null}
            </CardBody>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
