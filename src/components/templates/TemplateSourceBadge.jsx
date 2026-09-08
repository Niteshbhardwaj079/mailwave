import { useT } from '../../i18n/I18nProvider';

const BADGE_CLASS = {
  custom: 'bg-primary',
  html_upload: 'bg-info',
  builder: 'bg-success',
};

const LABEL_KEY = {
  custom: 'tpl.source.custom',
  html_upload: 'tpl.source.htmlUpload',
  builder: 'tpl.source.builder',
};

/** Badge dikhata hai ki template kis tareeke se banayi gayi — Custom / HTML Upload / Drag & Drop. Anjaan/legacy value par kuch nahi dikhata, kabhi crash nahi karta. */
export default function TemplateSourceBadge({ source, className = '' }) {
  const t = useT();
  const badgeClass = BADGE_CLASS[source];
  if (!badgeClass) return null;
  return <span className={`badge ${badgeClass} ${className}`.trim()}>{t(LABEL_KEY[source])}</span>;
}
