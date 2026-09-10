import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import PageHeader from '../components/ui/PageHeader';
import { Card, CardBody } from '../components/ui/Card';
import { Note, SearchInput } from '../components/ui/Controls';
import { devGuideChapters } from '../data/developerGuideChapters';

/**
 * `key like this` -> inline code. The content file authors code/path/command
 * references this way because it reads naturally while being written, and
 * this is the one place that turns it into markup — no dangerouslySetInnerHTML,
 * every chapter is our own static data, never user input.
 */
function withInlineCode(text) {
  return text.split('`').map((part, index) =>
    index % 2 === 1 ? (
      <code key={index} className="mw-devguide__inline-code">
        {part}
      </code>
    ) : (
      part
    )
  );
}

function Fact({ term, children }) {
  return (
    <div className="mw-devguide__fact">
      <dt>{withInlineCode(term)}</dt>
      <dd>{withInlineCode(children)}</dd>
    </div>
  );
}

function FileCard({ card }) {
  return (
    <Card className="mb-3">
      <CardBody>
        <p className="mw-fs-13 mw-fw-700 mw-mono mb-3">{card.file}</p>
        <dl className="mb-0">
          <Fact term="What it does">{card.does}</Fact>
          <Fact term="Depends on it">{card.dependsOn}</Fact>
          <Fact term="Safe to change">{card.safe}</Fact>
          <Fact term="Be careful about">{card.careful}</Fact>
        </dl>
      </CardBody>
    </Card>
  );
}

function Section({ section }) {
  return (
    <div className="mw-devguide__section">
      {section.heading ? <h3 className="mw-devguide__h3">{section.heading}</h3> : null}

      {(section.paragraphs ?? []).map((p, i) => (
        <p key={i} className="mw-devguide__p">
          {withInlineCode(p)}
        </p>
      ))}

      {section.list ? (
        <ul className="mw-devguide__list">
          {section.list.map((item, i) => (
            <li key={i}>{withInlineCode(item)}</li>
          ))}
        </ul>
      ) : null}

      {section.numbered ? (
        <ol className="mw-devguide__list">
          {section.numbered.map((item, i) => (
            <li key={i}>{withInlineCode(item)}</li>
          ))}
        </ol>
      ) : null}

      {section.code ? (
        <>
          {section.codeLabel ? <p className="mw-fs-12 mw-text-muted mw-fw-600 mb-1">{section.codeLabel}</p> : null}
          <pre className="mw-codeblock">
            <code>{section.code}</code>
          </pre>
        </>
      ) : null}

      {section.facts ? (
        <dl className="mb-3">
          {section.facts.map(([term, desc], i) => (
            <Fact key={i} term={term}>
              {desc}
            </Fact>
          ))}
        </dl>
      ) : null}

      {section.fileCards ? <div>{section.fileCards.map((card) => <FileCard key={card.file} card={card} />)}</div> : null}

      {section.table ? (
        <div className="mw-tablewrap mb-3">
          <table className="mw-table">
            <thead>
              <tr>
                {section.table.headers.map((h, i) => (
                  <th key={i} scope="col">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section.table.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j} className={j === 0 ? 'mw-table__primary' : ''}>
                      {withInlineCode(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {section.note ? (
        <Note tone={section.note.tone} icon={section.note.icon}>
          {withInlineCode(section.note.text)}
        </Note>
      ) : null}
    </div>
  );
}

/**
 * This page documents internal architecture (file paths, env var names,
 * deployment steps) — nothing a search engine should ever surface. Access
 * control is the real protection (route guard + sign-in, see App.jsx); this
 * is only an instruction to well-behaved crawlers, added and removed with
 * the page itself so it never affects any other route.
 */
function useNoIndex() {
  useEffect(() => {
    let tag = document.querySelector('meta[name="robots"]');
    const created = !tag;
    if (!tag) {
      tag = document.createElement('meta');
      tag.setAttribute('name', 'robots');
      document.head.appendChild(tag);
    }
    const previous = tag.getAttribute('content');
    tag.setAttribute('content', 'noindex, nofollow');

    return () => {
      if (created) {
        tag.remove();
      } else if (previous !== null) {
        tag.setAttribute('content', previous);
      }
    };
  }, []);
}

export default function DeveloperGuidePage() {
  useNoIndex();

  const [params, setParams] = useSearchParams();
  const requested = Number(params.get('chapter'));
  const [active, setActive] = useState(
    devGuideChapters.some((chapter) => chapter.number === requested) ? requested : 1
  );
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (devGuideChapters.some((chapter) => chapter.number === requested) && requested !== active) {
      setActive(requested);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requested]);

  const haystacks = useMemo(
    () =>
      devGuideChapters.map((chapter) => {
        const parts = [chapter.title];
        for (const section of chapter.sections) {
          if (section.heading) parts.push(section.heading);
          if (section.paragraphs) parts.push(...section.paragraphs);
          if (section.list) parts.push(...section.list);
          if (section.numbered) parts.push(...section.numbered);
          if (section.facts) section.facts.forEach(([t, d]) => parts.push(t, d));
          if (section.fileCards) section.fileCards.forEach((c) => parts.push(c.file, c.does, c.dependsOn, c.safe, c.careful));
        }
        return parts.join(' \n ').toLowerCase();
      }),
    []
  );

  const needle = query.trim().toLowerCase();
  const filteredChapters = needle
    ? devGuideChapters.filter((item, index) => haystacks[index].includes(needle))
    : devGuideChapters;

  const chapter =
    (needle
      ? filteredChapters.find((item) => item.number === active) || filteredChapters[0]
      : devGuideChapters.find((item) => item.number === active)) || devGuideChapters[0];
  const browseList = needle ? filteredChapters : devGuideChapters;
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
      <PageHeader
        title="Developer Guide"
        subtitle="How MailWave is actually built — for whoever maintains, deploys, or migrates this codebase next."
      />

      <Note tone="warning" icon="bi-eye-slash">
        Internal technical documentation — not shown to search engines, and only reachable while signed in. Never
        paste a real secret value (passwords, API keys, `JWT_SECRET`, database or SMTP credentials) into this page or
        anywhere in this codebase; every example below uses a placeholder.
      </Note>

      <SearchInput value={query} onChange={setQuery} placeholder="Search the Developer Guide…" id="devguide-search" />

      {needle ? (
        <p className="mw-fs-12 mw-text-muted mw-fw-600">
          {filteredChapters.length} {filteredChapters.length === 1 ? 'chapter matches' : 'chapters match'}
        </p>
      ) : null}

      <div className="mw-guide">
        <Card flush>
          <nav className="mw-guide__nav" aria-label="Developer Guide chapters">
            {filteredChapters.map((item) => (
              <button
                key={item.key}
                type="button"
                data-number={item.number}
                onClick={selectChapter}
                className={`mw-guide__navitem ${item.number === chapter.number ? 'is-active' : ''}`.trim()}
              >
                <span className="mw-guide__num">{item.number}</span>
                <span className="flex-grow-1">{item.title}</span>
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
                <h2 className="mw-fs-18 mw-fw-700 mt-3 mb-1">No matching chapters</h2>
                <p className="mw-fs-14 mw-text-muted mb-4">Try a different word, or clear the search.</p>
                <button type="button" className="btn btn-outline-secondary" onClick={clearSearch}>
                  Clear search
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
                    {chapter.number} / {devGuideChapters.length} · {chapter.minutes} min read
                  </span>
                </div>

                <h2 className="mw-guide__h">{chapter.title}</h2>

                <div className="mw-guide__body">
                  {chapter.sections.map((section, i) => (
                    <Section key={i} section={section} />
                  ))}
                </div>
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
                Previous
              </button>
            ) : (
              <span />
            )}

            {next ? (
              <button type="button" className="btn btn-primary" data-number={next.number} onClick={selectChapter}>
                Next
                <i className="bi bi-arrow-right ms-2" />
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
