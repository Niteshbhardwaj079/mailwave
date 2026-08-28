import { useRef, useState } from 'react';

import { useT } from '../../i18n/I18nProvider';
import { escapeAttr } from '../../utils/html';
import { useWorkspace } from '../../store/WorkspaceProvider';
import { Note } from '../ui/Controls';
import EmptyState from '../ui/EmptyState';

const MAX_BYTES = 2 * 1024 * 1024;

function readableSize(bytes) {
  if (!bytes) return '—';
  if (bytes > 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

export default function ImageLibrary({ onInsert }) {
  const t = useT();
  const { images, addImage, removeImage, storageWarning } = useWorkspace();
  const fileRef = useRef(null);
  const [urlValue, setUrlValue] = useState('');
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  function openPicker() {
    fileRef.current?.click();
  }

  function handleFiles(event) {
    const files = Array.from(event.target.files || []);
    setError('');

    files.forEach((file) => {
      if (file.size > MAX_BYTES) {
        setError(t('img.tooBig'));
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        addImage({ name: file.name, url: String(reader.result), size: file.size, source: 'upload' });
      };
      reader.readAsDataURL(file);
    });

    event.target.value = '';
  }

  function handleUrlChange(event) {
    setUrlValue(event.target.value);
  }

  function addFromUrl() {
    const url = urlValue.trim();
    if (!url) return;

    // Only real image locations. Anything else (javascript:, file:, a typo)
    // would silently produce a broken image inside every email that uses it.
    if (!/^(https?:\/\/|data:image\/)/i.test(url)) {
      setError(t('img.badUrl'));
      return;
    }

    const name = url.split(/[?#]/)[0].split('/').pop() || 'image';
    setError('');
    addImage({ name, url, size: 0, source: 'url' });
    setUrlValue('');
  }

  function copyUrl(event) {
    const { url, id } = event.currentTarget.dataset;
    navigator.clipboard?.writeText(url);
    setCopiedId(id);
    window.setTimeout(() => setCopiedId(null), 1600);
  }

  function insert(event) {
    const { url, name } = event.currentTarget.dataset;
    // A file name can contain quotes and angle brackets; without escaping it
    // would break out of the alt="" attribute and corrupt the tag.
    onInsert?.(
      `\n<img src="${escapeAttr(url)}" alt="${escapeAttr(
        name
      )}" width="560" style="display:block;max-width:100%;border-radius:8px" />\n`
    );
  }

  function remove(event) {
    removeImage(event.currentTarget.dataset.id);
  }

  return (
    <div className="mw-stack--sm d-flex flex-column">
      <div>
        <h3 className="mw-fs-16 mw-fw-700 mb-1">{t('img.title')}</h3>
        <p className="mw-fs-13 mw-text-muted mb-0">{t('img.subtitle')}</p>
      </div>

      <ol className="mw-steps">
        <li className="mw-steps__item">
          <p className="mw-steps__text">{t('img.step1')}</p>
        </li>
        <li className="mw-steps__item">
          <p className="mw-steps__text">{t('img.step2')}</p>
        </li>
        <li className="mw-steps__item">
          <p className="mw-steps__text">{t('img.step3')}</p>
        </li>
      </ol>

      <div className="mw-row mw-row--wrap">
        <button type="button" className="btn btn-primary" onClick={openPicker}>
          <i className="bi bi-upload me-2" />
          {t('img.upload')}
        </button>
        <span className="mw-fs-12 mw-text-muted">{t('img.uploadHint')}</span>
      </div>

      <input
        ref={fileRef}
        type="file"
        className="visually-hidden"
        accept="image/png,image/jpeg,image/gif,image/webp"
        multiple
        onChange={handleFiles}
        aria-label={t('img.upload')}
      />

      {error ? (
        <Note tone="warning" icon="bi-exclamation-triangle">
          {error}
        </Note>
      ) : null}

      <div>
        <label className="form-label" htmlFor="image-url">
          {t('img.addByUrl')}
        </label>
        <div className="input-group">
          <input
            id="image-url"
            type="url"
            className="form-control"
            value={urlValue}
            onChange={handleUrlChange}
            placeholder={t('img.urlPlaceholder')}
          />
          <button type="button" className="btn btn-outline-primary" onClick={addFromUrl}>
            {t('img.add')}
          </button>
        </div>
      </div>

      {images.length === 0 ? (
        <EmptyState icon="bi-images" title={t('img.empty')} text={t('img.emptyText')} />
      ) : (
        <div className="mw-imggrid">
          {images.map((image) => (
            <figure key={image.id} className="mw-imgcard m-0">
              <div className="mw-imgcard__thumb">
                <img className="mw-imgcard__img" src={image.url} alt={image.name} loading="lazy" />
              </div>

              <figcaption className="mw-imgcard__body">
                <div className="mw-imgcard__name mw-truncate">{image.name}</div>
                <div className="mw-imgcard__meta">
                  {image.size ? `${t('img.size')}: ${readableSize(image.size)} · ` : ''}
                  {t('img.added')}: {image.addedAt}
                </div>

                <div className="mw-urlbox">
                  <span className="mw-urlbox__text">{image.url.slice(0, 120)}</span>
                  <button
                    type="button"
                    className="mw-urlbox__btn"
                    data-url={image.url}
                    data-id={image.id}
                    onClick={copyUrl}
                  >
                    {copiedId === image.id ? t('common.copied') : t('img.copyUrl')}
                  </button>
                </div>
              </figcaption>

              <div className="mw-imgcard__actions">
                {onInsert ? (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary flex-fill"
                    data-url={image.url}
                    data-name={image.name}
                    onClick={insert}
                  >
                    <i className="bi bi-box-arrow-in-down me-1" />
                    {t('img.insert')}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn btn-sm btn-outline-danger"
                  data-id={image.id}
                  onClick={remove}
                  aria-label={t('img.remove')}
                >
                  <i className="bi bi-trash3" />
                </button>
              </div>
            </figure>
          ))}
        </div>
      )}

      <Note tone="info" icon="bi-hdd">
        {t('img.localNote')}
      </Note>

      {storageWarning ? (
        <Note tone="warning" icon="bi-exclamation-triangle">
          {t('img.storageFull')}
        </Note>
      ) : null}
    </div>
  );
}
