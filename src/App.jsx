import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import AppLayout from './components/layout/AppLayout';
import PageLoader from './components/ui/PageLoader';
import RequireAuth from './components/routing/RequireAuth';
import RequireModule from './components/routing/RequireModule';
import LoginPage from './pages/LoginPage';

// Every screen behind the login is its own chunk, so a visitor who only ever
// sees the sign-in page never downloads the charts, the template editor or the
// permission matrix. LoginPage stays in the main bundle because it is the
// first thing an unauthenticated visitor sees.
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const CampaignsPage = lazy(() => import('./pages/CampaignsPage'));
const CampaignWizardPage = lazy(() => import('./pages/CampaignWizardPage'));
const CampaignAnalyticsPage = lazy(() => import('./pages/CampaignAnalyticsPage'));
const ContactsPage = lazy(() => import('./pages/ContactsPage'));
const ImportContactsPage = lazy(() => import('./pages/ImportContactsPage'));
const SegmentsPage = lazy(() => import('./pages/SegmentsPage'));
const SubscribersPage = lazy(() => import('./pages/SubscribersPage'));
const TemplatesPage = lazy(() => import('./pages/TemplatesPage'));
const TemplateEditorPage = lazy(() => import('./pages/TemplateEditorPage'));
const TemplatePreviewPage = lazy(() => import('./pages/TemplatePreviewPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const EmailAccountsPage = lazy(() => import('./pages/EmailAccountsPage'));
const ConnectAccountPage = lazy(() => import('./pages/ConnectAccountPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const GuidePage = lazy(() => import('./pages/GuidePage'));
const UsersPage = lazy(() => import('./pages/UsersPage'));
const ActivityLogPage = lazy(() => import('./pages/ActivityLogPage'));
const OnboardingPage = lazy(() => import('./pages/OnboardingPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const ConfirmEmailPage = lazy(() => import('./pages/ConfirmEmailPage'));
const SystemEmailsPage = lazy(() => import('./pages/SystemEmailsPage'));
const BackupPage = lazy(() => import('./pages/BackupPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

/**
 * Two things guard these routes:
 *   <RequireAuth>    nobody sees the app without signing in
 *   <RequireModule>  a role only reaches the sections its permissions allow
 *
 * The second one matters because the sidebar merely HIDES links it cannot use.
 * Without a guard on the route itself, typing the address would still work.
 *
 * The <Suspense> here only covers the standalone screens; AppLayout has its own
 * boundary around <Outlet />, so moving between pages keeps the sidebar and
 * topbar on screen instead of blanking the whole window.
 */
export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage mode="reset" />} />
        <Route path="/set-password" element={<ResetPasswordPage mode="invite" />} />
        <Route path="/confirm-email" element={<ConfirmEmailPage />} />
        {/* Standalone so the link can be shared without the rest of the app */}
        <Route path="/templates/:templateId/preview" element={<TemplatePreviewPage />} />

        <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
            <Route element={<RequireModule module="dashboard" />}>
              <Route path="/" element={<DashboardPage />} />
            </Route>

            <Route element={<RequireModule module="campaigns" />}>
              <Route path="/campaigns" element={<CampaignsPage />} />
              <Route path="/campaigns/:campaignId" element={<CampaignAnalyticsPage />} />
            </Route>
            <Route element={<RequireModule module="campaigns" action="create" />}>
              <Route path="/campaigns/new" element={<CampaignWizardPage />} />
            </Route>

            <Route element={<RequireModule module="contacts" />}>
              <Route path="/contacts" element={<ContactsPage />} />
              <Route path="/subscribers" element={<SubscribersPage />} />
            </Route>
            <Route element={<RequireModule module="contacts" action="create" />}>
              <Route path="/contacts/import" element={<ImportContactsPage />} />
            </Route>

            <Route element={<RequireModule module="segments" />}>
              <Route path="/segments" element={<SegmentsPage />} />
            </Route>

            <Route element={<RequireModule module="templates" />}>
              <Route path="/templates" element={<TemplatesPage />} />
              <Route path="/templates/:templateId/edit" element={<TemplateEditorPage />} />
            </Route>
            <Route element={<RequireModule module="templates" action="create" />}>
              <Route path="/templates/new" element={<TemplateEditorPage />} />
            </Route>

            <Route element={<RequireModule module="reports" />}>
              <Route path="/reports" element={<ReportsPage />} />
            </Route>

            <Route element={<RequireModule module="accounts" />}>
              <Route path="/accounts" element={<EmailAccountsPage />} />
            </Route>
            <Route element={<RequireModule module="accounts" action="create" />}>
              <Route path="/accounts/connect" element={<ConnectAccountPage />} />
            </Route>

            <Route element={<RequireModule module="settings" />}>
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/system-emails" element={<SystemEmailsPage />} />
              <Route path="/backups" element={<BackupPage />} />
            </Route>

            <Route element={<RequireModule module="users" />}>
              <Route path="/users" element={<UsersPage />} />
            </Route>

            <Route element={<RequireModule module="activity" />}>
              <Route path="/activity" element={<ActivityLogPage />} />
            </Route>

            {/* The guide and the setup checklist are open to everyone. */}
            <Route path="/guide" element={<GuidePage />} />
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/404" element={<NotFoundPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>
    </Suspense>
  );
}
