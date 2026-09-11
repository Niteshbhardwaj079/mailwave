import { useMemo, useRef, useState } from 'react';
import ReactCrop, { centerCrop, convertToPixelCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

import { useT } from '../../i18n/I18nProvider';
import { escapeAttr } from '../../utils/html';
import { useWorkspace } from '../../store/WorkspaceProvider';
import { Note, SearchInput } from '../ui/Controls';
import FilterSelect from '../ui/FilterSelect';
import EmptyState from '../ui/EmptyState';
import Sheet from '../ui/Sheet';
import { api } from '../../api/client';
import { formatDateTime } from '../../utils/format';

const MAX_BYTES = 2 * 1024 * 1024;

function readableSize(bytes) {
  if (!bytes) return '—';
  if (bytes > 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

/**
 * Yeh image abhi KAHAN padi hai — data ka source hamesha `toApi()`
 * (`server/src/routes/images.js`) se aata hai, yeh sirf usko ek badge me
 * badalta hai. Kahin bhi migrate karo (Render/VPS/koi bhi), ya storage
 * provider badlo — yeh badge apne aap sahi dikhata rehta hai kyunki asli
 * data hi badal jata hai; koi hardcoded jagah nahi hai. Public URL (jo
 * copy hoti hai) hamesha isi app ke apne domain se hi jaati hai, kabhi
 * seedha bucket se nahi — isliye storage provider ya hosting badalne par
 * bhi pehle se bheji hui email me lagi image kabhi nahi tootti.
 */
function storageBadge(image, t) {
  if (image.source === 'url') return { text: t('img.storageExternal'), cls: 'bg-secondary' };
  if (image.storageProvider === 'object') return { text: t('img.storageObject'), cls: 'bg-success' };
  return { text: t('img.storageDb'), cls: 'bg-primary' };
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Crop area (natural-pixel %) ko ek nayi, chhoti PNG data: URL me badalta hai. */
function cropToDataUrl(image, crop) {
  const canvas = document.createElement('canvas');
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  canvas.width = Math.round(crop.width * scaleX);
  canvas.height = Math.round(crop.height * scaleY);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    canvas.width,
    canvas.height
  );
  return canvas.toDataURL('image/png');
}

/**
 * `onInsert(html)`  — editor ke raw HTML textarea me ek `<img>` tag daalta hai (Code tab).
 * `onPick(url,name)` — sirf URL wapas deta hai, ek field bharne ke liye (Design tab: logo/image block).
 * Dono me se koi bhi na ho to yeh sirf ek management library ki tarah kaam karta hai (Media Library page).
 */
export default function ImageLibrary({ onInsert, onPick }) {
  const t = useT();
  const { images, imageUsage, addImage, removeImage, updateImage, touchImage, storageWarning } = useWorkspace();
  const fileRef = useRef(null);
  const cropImgRef = useRef(null);
  const [urlValue, setUrlValue] = useState('');
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('recent');

  const [deleteFor, setDeleteFor] = useState(null);
  const [usage, setUsage] = useState(null);

  const [cropFor, setCropFor] = useState(null);
  const [crop, setCrop] = useState();
  const [completedCrop, setCompletedCrop] = useState(null);
  const [cropError, setCropError] = useState('');

  const visible = useMemo(() => {
    const text = search.trim().toLowerCase();
    const list = images.filter((image) => !text || image.name.toLowerCase().includes(text));
    return [...list].sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'size') return (b.size ?? 0) - (a.size ?? 0);
      if (sort === 'used') {
        if (!a.lastUsedAt && !b.lastUsedAt) return 0;
        if (!a.lastUsedAt) return 1;
        if (!b.lastUsedAt) return -1;
        return String(b.lastUsedAt).localeCompare(String(a.lastUsedAt));
      }
      return String(b.addedAt).localeCompare(String(a.addedAt));
    });
  }, [images, search, sort]);

  const sortOptions = [
    { value: 'recent', label: t('img.sortRecent') },
    { value: 'used', label: t('img.sortUsed') },
    { value: 'name', label: t('img.sortName') },
    { value: 'size', label: t('img.sortSize') },
  ];

  function openPicker() {
    fileRef.current?.click();
  }

  function handleFiles(event) {
    const files = Array.from(event.target.files || []);
    setError('');

    files.forEach(async (file) => {
      if (file.size > MAX_BYTES) {
        setError(t('img.tooBig'));
        return;
      }
      const dataUrl = await readFileAsDataUrl(file);
      addImage({ name: file.name, url: dataUrl, size: file.size, source: 'upload' });
    });

    event.target.value = '';
  }

  function handleUrlChange(event) {
    setUrlValue(event.target.value);
  }

  function addFromUrl() {
    const url = urlValue.trim();
    if (!url) return;

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
    const { url, name, id } = event.currentTarget.dataset;
    if (onPick) {
      onPick(url, name);
    } else {
      // A file name can contain quotes and angle brackets; without escaping it
      // would break out of the alt="" attribute and corrupt the tag.
      onInsert?.(
        `\n<img src="${escapeAttr(url)}" alt="${escapeAttr(
          name
        )}" width="560" style="display:block;max-width:100%;border-radius:8px" />\n`
      );
    }
    if (id) touchImage(id);
  }

  async function askRemove(event) {
    const id = event.currentTarget.dataset.id;
    const image = images.find((item) => item.id === id) ?? null;

    setDeleteFor(image);
    setUsage(null);
    if (!image) return;

    try {
      setUsage(await api.get(`/api/images/${id}/usage`));
    } catch (err) {
      setUsage(null);
    }
  }

  function cancelRemove() {
    setDeleteFor(null);
    setUsage(null);
  }

  function confirmRemove() {
    const image = deleteFor;
    setDeleteFor(null);
    setUsage(null);
    if (image) removeImage(image.id);
  }

  function openCrop(event) {
    const id = event.currentTarget.dataset.id;
    const image = images.find((item) => item.id === id) ?? null;
    setCropFor(image);
    setCrop(undefined);
    setCompletedCrop(null);
    setCropError('');
  }

  function closeCrop() {
    setCropFor(null);
    setCrop(undefined);
    setCompletedCrop(null);
    setCropError('');
  }

  function onCropImageLoad(event) {
    const { width, height } = event.currentTarget;
    const percentCrop = centerCrop(makeAspectCrop({ unit: '%', width: 90 }, width / height, width, height), width, height);
    setCrop(percentCrop);
    // ReactCrop sirf actual drag (mouseup) par onComplete chalata hai — is
    // shuruaati, khud-ba-khud lagi crop box ke liye kabhi nahi. Isliye bina
    // kuch hilaye seedha "Save" dabane par completedCrop hamesha khaali
    // rehta tha aur saveCrop() chup-chaap kuch nahi karta tha. Yahin turant
    // ek pixel-crop bana kar donon state set karte hain, taaki bina drag
    // kiye bhi Save turant kaam kare.
    setCompletedCrop(convertToPixelCrop(percentCrop, width, height));
  }

  /** Live crop-selection ka ASLI (natural-resolution) size — dikhaye gaye, chhote image ke pixels nahi. */
  const cropSelectionSize = useMemo(() => {
    const img = cropImgRef.current;
    if (!crop?.width || !crop?.height || !img?.naturalWidth || !img?.width) return null;
    const scaleX = img.naturalWidth / img.width;
    const scaleY = img.naturalHeight / img.height;
    return { width: Math.round(crop.width * scaleX), height: Math.round(crop.height * scaleY) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crop]);

  async function saveCrop() {
    if (!cropImgRef.current || !completedCrop?.width || !completedCrop?.height) return;
    setCropError('');
    try {
      const dataUrl = cropToDataUrl(cropImgRef.current, completedCrop);
      await updateImage(cropFor.id, { url: dataUrl });
      closeCrop();
    } catch {
      // Sabse aam wajah: image kisi doosre server se link ki gayi hai (source
      // 'url') jo CORS allow nahi karta — canvas "tainted" ho jaata hai aur
      // us se data nikaalna browser hi rok deta hai. Upload ki hui images
      // (data:/apna storage) is se kabhi prabhavit nahi hoti.
      setCropError(t('img.cropFailed'));
    }
  }

  return (
    <div className="mw-stack--sm d-flex flex-column">
      <div>
        <h3 className="mw-fs-16 mw-fw-700 mb-1">{t('img.title')}</h3>
        <p className="mw-fs-13 mw-text-muted mb-0">{t('img.subtitle')}</p>
      </div>

      {/* Kitni jagah abhi li hui hai — Object Storage jude jaane ke baad bhi
          "meri image kahan gayi" pata chalta rahe, isliye database aur
          Object Storage dono ka apna total alag dikhaya hai. */}
      {imageUsage ? (
        <div className="mw-note mw-note--info">
          <i className="bi bi-hdd mw-note__icon" aria-hidden="true" />
          <div>
            <span className="d-block mw-fs-13 mw-fw-600">
              {imageUsage.limitBytes
                ? t('img.usageValue', { used: imageUsage.totalText, max: imageUsage.limitText })
                : t('img.usageNoLimit', { used: imageUsage.totalText })}
            </span>
            <span className="d-block mw-fs-12 mw-text-muted mt-1">
              {t('img.usageBreakdown', { db: imageUsage.dbText, object: imageUsage.objectText })}
            </span>
            {imageUsage.limitBytes ? (
              <div className="progress mt-2" style={{ height: '0.6rem' }}>
                <div
                  className={`progress-bar ${imageUsage.usagePercent >= 90 ? 'bg-danger' : imageUsage.usagePercent >= 70 ? 'bg-warning' : 'bg-primary'}`}
                  role="progressbar"
                  style={{ width: `${imageUsage.usagePercent}%` }}
                  aria-valuenow={imageUsage.usagePercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                />
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

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

      <div className="mw-row mw-row--wrap align-items-end">
        <div className="mw-filterbar__search" style={{ minWidth: 220 }}>
          <SearchInput value={search} onChange={setSearch} placeholder={t('img.searchPlaceholder')} />
        </div>
        <FilterSelect
          id="img-sort"
          label={t('common.filter')}
          icon="bi-sort-down"
          value={sort}
          onChange={setSort}
          options={sortOptions}
        />
      </div>

      {images.length === 0 ? (
        <EmptyState icon="bi-images" title={t('img.empty')} text={t('img.emptyText')} />
      ) : visible.length === 0 ? (
        <EmptyState icon="bi-search" title={t('img.noResults')} text={t('img.noResultsText')} />
      ) : (
        <div className="mw-imggrid">
          {visible.map((image) => (
            <figure key={image.id} className="mw-imgcard m-0">
              <div className="mw-imgcard__thumb">
                <img className="mw-imgcard__img" src={image.url} alt={image.name} loading="lazy" />
              </div>

              <figcaption className="mw-imgcard__body">
                <div className="mw-row align-items-center mw-fs-12 mb-1">
                  <div className="mw-imgcard__name mw-truncate flex-grow-1">{image.name}</div>
                  <span className={`badge ${storageBadge(image, t).cls}`}>{storageBadge(image, t).text}</span>
                </div>
                <div className="mw-imgcard__meta">
                  {image.width && image.height ? `${image.width} × ${image.height} px · ` : ''}
                  {image.size ? `${t('img.size')}: ${readableSize(image.size)} · ` : ''}
                  {t('img.added')}: {formatDateTime(image.addedAt)}
                  {image.lastUsedAt ? ` · ${t('img.lastUsed')}: ${formatDateTime(image.lastUsedAt)}` : ''}
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
                {onInsert || onPick ? (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary flex-fill"
                    data-url={image.url}
                    data-name={image.name}
                    data-id={image.id}
                    onClick={insert}
                  >
                    <i className="bi bi-box-arrow-in-down me-1" />
                    {onPick ? t('img.useThis') : t('img.insert')}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  data-id={image.id}
                  onClick={openCrop}
                  aria-label={t('img.crop')}
                >
                  <i className="bi bi-crop" />
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-danger"
                  data-id={image.id}
                  onClick={askRemove}
                  aria-label={t('img.remove')}
                >
                  <i className="bi bi-trash3" />
                </button>
              </div>
            </figure>
          ))}
        </div>
      )}

      {storageWarning ? (
        <Note tone="warning" icon="bi-exclamation-triangle">
          {t('img.storageFull')}
        </Note>
      ) : null}

      {/* Delete se pehle poochna. Image mit jane ke baad wapas nahi aati. */}
      <Sheet
        open={Boolean(deleteFor)}
        title={t('img.deleteTitle')}
        onClose={cancelRemove}
        footer={
          <>
            <button type="button" className="btn btn-outline-secondary flex-fill" onClick={cancelRemove}>
              {t('common.cancel')}
            </button>
            <button type="button" className="btn btn-danger flex-fill" onClick={confirmRemove}>
              {t('common.delete')}
            </button>
          </>
        }
      >
        {deleteFor ? (
          <>
            <div className="mw-row mb-3">
              <img
                src={deleteFor.url}
                alt={deleteFor.name}
                width="72"
                height="72"
                style={{ objectFit: 'cover', borderRadius: 8, background: '#f1f1f1' }}
              />
              <span>
                <span className="d-block mw-fw-650">{deleteFor.name}</span>
                <span className="d-block mw-fs-12 mw-text-muted">{readableSize(deleteFor.size)}</span>
              </span>
            </div>

            {usage?.sentCount > 0 ? (
              <Note tone="warning" icon="bi-exclamation-triangle">
                {t('img.usedInSent', { count: usage.sentCount })}
              </Note>
            ) : null}

            {usage?.templates?.length ? (
              <Note tone="info" icon="bi-layout-wtf">
                {t('img.usedInTemplates', { count: usage.templates.length })}
                <span className="d-block mw-fs-12 mw-text-muted mt-1">
                  {usage.templates.slice(0, 5).join(', ')}
                </span>
              </Note>
            ) : null}

            {usage && !usage.inUse ? (
              <Note tone="success" icon="bi-check-circle">
                {t('img.notUsed')}
              </Note>
            ) : null}

            <p className="mw-fs-13 mw-text-muted mb-0 mt-3">{t('img.deleteNote')}</p>
          </>
        ) : null}
      </Sheet>

      {/* Crop — usi id/link par naye bytes chadhta hai, koi reference toothta nahi. */}
      <Sheet
        open={Boolean(cropFor)}
        title={t('img.crop')}
        onClose={closeCrop}
        footer={
          <>
            <button type="button" className="btn btn-outline-secondary flex-fill" onClick={closeCrop}>
              {t('common.cancel')}
            </button>
            <button type="button" className="btn btn-primary flex-fill" onClick={saveCrop}>
              {t('common.save')}
            </button>
          </>
        }
      >
        {cropFor ? (
          <>
            <p className="mw-fs-13 mw-text-muted">{t('img.cropHelp')}</p>
            {cropError ? (
              <Note tone="warning" icon="bi-exclamation-triangle">
                {cropError}
              </Note>
            ) : null}
            <ReactCrop crop={crop} onChange={(c) => setCrop(c)} onComplete={(c) => setCompletedCrop(c)}>
              {/* eslint-disable-next-line jsx-a11y/alt-text */}
              <img
                ref={cropImgRef}
                src={cropFor.url}
                crossOrigin="anonymous"
                onLoad={onCropImageLoad}
                style={{ maxWidth: '100%' }}
              />
            </ReactCrop>
            <p className="mw-fs-12 mw-text-muted mt-2 mb-0">
              {cropImgRef.current?.naturalWidth ? (
                <>
                  {t('img.originalSize')}: {cropImgRef.current.naturalWidth} × {cropImgRef.current.naturalHeight} px
                  {cropSelectionSize ? ' · ' : ''}
                </>
              ) : null}
              {cropSelectionSize ? (
                <>
                  {t('img.selectionSize')}: {cropSelectionSize.width} × {cropSelectionSize.height} px
                </>
              ) : null}
            </p>
          </>
        ) : null}
      </Sheet>
    </div>
  );
}
