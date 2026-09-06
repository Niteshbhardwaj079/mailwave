import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import PageHeader from '../components/ui/PageHeader';
import { Card, CardBody } from '../components/ui/Card';
import { Note, SearchInput } from '../components/ui/Controls';
import { useT } from '../i18n/I18nProvider';
import { guideChapters } from '../data/guideChapters';

// Steps beyond s5 are optional — some chapters have 6, most have 5.
const MAX_STEPS = 6;

export default function GuidePage() {
  const t = useT();
  const [params, setParams] = useSearchParams();
  const requested = Number(params.get('chapter'));
  const [active, setActive] = useState(
    guideChapters.some((chapter) => chapter.number === requested) ? requested : 1
  );
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (guideChapters.some((chapter) => chapter.number === requested) && requested !== active) {
      setActive(requested);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requested]);

  // One searchable blob per chapter (title + lede + every step + tip/warning),
  // in the language currently on screen — rebuilt only when that changes.
  const haystacks = useMemo(
    () =>
      guideChapters.map((item) => {
        const parts = [t(`guide.${item.key}.title`), t(`guide.${item.key}.lede`), t(`guide.${item.key}.tip`)];
        for (let n = 1; n <= MAX_STEPS; n += 1) {
          const key = `guide.${item.key}.s${n}`;
          const text = t(key);
          if (text !== key) parts.push(text);
        }
        if (item.hasWarning) parts.push(t(`guide.${item.key}.warn`));
        return parts.join(' \n ').toLowerCase();
      }),
    [t]
  );

  const needle = query.trim().toLowerCase();
  const filteredChapters = needle
    ? guideChapters.filter((item, index) => haystacks[index].includes(needle))
    : guideChapters;

  // Typing a search shows a matching chapter immediately, without needing a
  // click — if the one on screen no longer matches, jump to the first hit.
  const chapter =
    (needle
      ? filteredChapters.find((item) => item.number === active) || filteredChapters[0]
      : guideChapters.find((item) => item.number === active)) || guideChapters[0];
  const browseList = needle ? filteredChapters : guideChapters;
  const index = browseList.indexOf(chapter);
  const previous = browseList[index - 1];
  const next = browseList[index + 1];

  function selectChapter(event) {
    const nextNumber = Number(event.currentTarget.dataset.number);
    setActive(nextNumber);
    setParams({ chapter: String(nextNumber) });
    window.scrollTo(0, 0);
  }

  function clearSearch() {
    setQuery('');
  }

  return (
    <div className="mw-stack">
      <PageHeader title={t('guide.title')} subtitle={t('guide.subtitle')} />

      <SearchInput value={query} onChange={setQuery} placeholder={t('guide.searchPlaceholder')} id="guide-search" />

      {needle ? (
        <p className="mw-fs-12 mw-text-muted mw-fw-600">
          {t('guide.searchResultsCount', { count: filteredChapters.length })}
        </p>
      ) : null}

      <div className="mw-guide">
        <Card flush>
          <nav className="mw-guide__nav" aria-label={t('guide.chapters')}>
            {filteredChapters.map((item) => (
              <button
                key={item.key}
                type="button"
                data-number={item.number}
                onClick={selectChapter}
                className={`mw-guide__navitem ${item.number === chapter.number ? 'is-active' : ''}`.trim()}
              >
                <span className="mw-guide__num">{item.number}</span>
                <span className="flex-grow-1">{t(`guide.${item.key}.title`)}</span>
              </button>
            ))}
          </nav>
        </Card>

        <div className="mw-stack--sm d-flex flex-column">
          {filteredChapters.length === 0 ? (
            <Card>
              <CardBody className="text-center py-5">
                <span className="mw-empty__icon mx-auto" aria-hidden="true">
                  <i className="bi bi-search" />
                </span>
                <h2 className="mw-fs-18 mw-fw-700 mt-3 mb-1">{t('guide.noResults')}</h2>
                <p className="mw-fs-14 mw-text-muted mb-4">{t('guide.noResultsText')}</p>
                <button type="button" className="btn btn-outline-secondary" onClick={clearSearch}>
                  {t('guide.clearSearch')}
                </button>
              </CardBody>
            </Card>
          ) : (
            <Card>
              <CardBody>
                <div className="mw-row mb-3">
                  <span className="mw-quick__icon" aria-hidden="true">
                    <i className={`bi ${chapter.icon}`} />
                  </span>
                  <span className="mw-fs-12 mw-text-muted mw-fw-600">
                    {chapter.number} / {guideChapters.length} · {chapter.minutes} {t('guide.readingTime')}
                  </span>
                </div>

                <h2 className="mw-guide__h">{t(`guide.${chapter.key}.title`)}</h2>
                <p className="mw-guide__lede">{t(`guide.${chapter.key}.lede`)}</p>

                <ol className="mw-steps">
                  {chapter.steps.map((step) => (
                    <li key={step} className="mw-steps__item">
                      <p className="mw-steps__text">{t(`guide.${chapter.key}.${step}`)}</p>
                    </li>
                  ))}
                </ol>

                <div className="mt-4 mw-stack--sm d-flex flex-column">
                  <Note tone="success" icon="bi-lightbulb">
                    <strong>{t('guide.tip')}: </strong>
                    {t(`guide.${chapter.key}.tip`)}
                  </Note>

                  {chapter.hasWarning ? (
                    <Note tone="warning" icon="bi-exclamation-triangle">
                      <strong>{t('guide.warning')}: </strong>
                      {t(`guide.${chapter.key}.warn`)}
                    </Note>
                  ) : null}
                </div>

                {chapter.link ? (
                  <div className="mt-4">
                    <Link to={chapter.link.to} className="btn btn-primary">
                      <i className="bi bi-box-arrow-up-right me-2" />
                      {t('guide.doThis')}: {t(chapter.link.labelKey)}
                    </Link>
                  </div>
                ) : null}
              </CardBody>
            </Card>
          )}

          <div className="mw-row mw-row--between mw-row--wrap">
            {previous ? (
              <button
                type="button"
                className="btn btn-outline-secondary"
                data-number={previous.number}
                onClick={selectChapter}
              >
                <i className="bi bi-arrow-left me-2" />
                {t('guide.prev')}
              </button>
            ) : (
              <span />
            )}

            {next ? (
              <button type="button" className="btn btn-primary" data-number={next.number} onClick={selectChapter}>
                {t('guide.next')}
                <i className="bi bi-arrow-right ms-2" />
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
