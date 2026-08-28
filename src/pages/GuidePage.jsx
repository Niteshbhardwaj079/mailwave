import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import PageHeader from '../components/ui/PageHeader';
import { Card, CardBody } from '../components/ui/Card';
import { Note } from '../components/ui/Controls';
import { useT } from '../i18n/I18nProvider';
import { guideChapters } from '../data/guideChapters';

export default function GuidePage() {
  const t = useT();
  const [params, setParams] = useSearchParams();
  const requested = Number(params.get('chapter'));
  const [active, setActive] = useState(
    guideChapters.some((chapter) => chapter.number === requested) ? requested : 1
  );

  useEffect(() => {
    if (guideChapters.some((chapter) => chapter.number === requested) && requested !== active) {
      setActive(requested);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requested]);

  function selectChapter(event) {
    const next = Number(event.currentTarget.dataset.number);
    setActive(next);
    setParams({ chapter: String(next) });
    window.scrollTo(0, 0);
  }

  const chapter = guideChapters.find((item) => item.number === active) || guideChapters[0];
  const index = guideChapters.indexOf(chapter);
  const previous = guideChapters[index - 1];
  const next = guideChapters[index + 1];

  return (
    <div className="mw-stack">
      <PageHeader title={t('guide.title')} subtitle={t('guide.subtitle')} />

      <div className="mw-guide">
        <Card flush>
          <nav className="mw-guide__nav" aria-label={t('guide.chapters')}>
            {guideChapters.map((item) => (
              <button
                key={item.key}
                type="button"
                data-number={item.number}
                onClick={selectChapter}
                className={`mw-guide__navitem ${item.number === active ? 'is-active' : ''}`.trim()}
              >
                <span className="mw-guide__num">{item.number}</span>
                <span className="flex-grow-1">{t(`guide.${item.key}.title`)}</span>
              </button>
            ))}
          </nav>
        </Card>

        <div className="mw-stack--sm d-flex flex-column">
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
