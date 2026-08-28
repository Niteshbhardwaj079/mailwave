import { Outlet } from 'react-router-dom';

import { Card } from '../ui/Card';
import EmptyState from '../ui/EmptyState';
import { useT } from '../../i18n/I18nProvider';
import { useWorkspace } from '../../store/WorkspaceProvider';
import { roleLabel } from '../../utils/roles';

/**
 * Hiding a link in the sidebar is not the same as blocking a page — anyone can
 * type the URL. This wraps the routes themselves, so a role without permission
 * gets the same clear message however it arrived.
 *
 *   <Route element={<RequireModule module="settings" />}>
 *     <Route path="/settings" element={<SettingsPage />} />
 *   </Route>
 */
export default function RequireModule({ module, action = 'view' }) {
  const t = useT();
  const { can, currentRole } = useWorkspace();

  if (can(module, action)) return <Outlet />;

  return (
    <Card>
      <EmptyState
        icon="bi-shield-lock"
        title={t('perm.deniedTitle')}
        text={t('perm.deniedText', { role: roleLabel(currentRole, t) || '—' })}
      />
    </Card>
  );
}
