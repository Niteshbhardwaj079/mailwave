import { useParams } from 'react-router-dom';

import TemplateEditorPage from './TemplateEditorPage';
import TemplateUploadPage from './TemplateUploadPage';
import TemplateBuilderPage from './TemplateBuilderPage';
import { useWorkspace } from '../store/WorkspaceProvider';

/**
 * `/templates/:templateId/edit` ek hi route hai — yeh sirf tay karta hai
 * KAUNSA editor khulega, template ki apni `source` (jis tareeke se wo banayi
 * gayi thi) ke hisaab se. Dispatch hamesha DB ki value se hota hai, kabhi
 * HTML content ke andaaze se nahi — isliye ek template hamesha usi tool me
 * wapas khulti hai jisne use banaya tha, kabhi galti se dusre me nahi.
 * `source` na ho ya anjaani ho (purani row) to Custom editor hi khulta hai —
 * yehi humesha se in sab templates ka asli ghar raha hai.
 */
export default function TemplateEditRouterPage() {
  const { templateId } = useParams();
  const { getTemplate } = useWorkspace();
  const existing = getTemplate(templateId);

  if (existing?.source === 'html_upload') return <TemplateUploadPage />;
  if (existing?.source === 'builder') return <TemplateBuilderPage />;
  return <TemplateEditorPage />;
}
