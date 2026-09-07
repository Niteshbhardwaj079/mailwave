import PageHeader from '../components/ui/PageHeader';
import { Card, CardBody } from '../components/ui/Card';
import ImageLibrary from '../components/templates/ImageLibrary';
import { useT } from '../i18n/I18nProvider';

/**
 * Full-page Media Library — TemplateEditorPage ke "Images" tab jaisa hi
 * ImageLibrary component, bas apne alag route par taaki template edit kiye
 * bina bhi images manage ki ja sakein. `onInsert`/`onPick` kuch nahi diya
 * gaya — yahan sirf upload/search/sort/crop/delete/copy-URL management hai.
 */
export default function MediaLibraryPage() {
  const t = useT();

  return (
    <div className="mw-stack">
      <PageHeader title={t('media.title')} subtitle={t('media.subtitle')} helpTopic="templates" />

      <Card flush>
        <CardBody>
          <ImageLibrary />
        </CardBody>
      </Card>
    </div>
  );
}
