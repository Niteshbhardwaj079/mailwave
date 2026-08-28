import { Link } from 'react-router-dom';

import EmptyState from '../components/ui/EmptyState';
import { Card } from '../components/ui/Card';
import { useT } from '../i18n/I18nProvider';

export default function NotFoundPage() {
  const t = useT();

  return (
    <Card>
      <EmptyState
        icon="bi-compass"
        title={t('nf.title')}
        text={t('nf.text')}
        action={
          <Link to="/" className="btn btn-primary">
            <i className="bi bi-house me-2" />
            {t('nf.back')}
          </Link>
        }
      />
    </Card>
  );
}
