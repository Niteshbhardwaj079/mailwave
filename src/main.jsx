import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import './styles/main.scss';

import { I18nProvider } from './i18n/I18nProvider';
import { ThemeProvider } from './theme/ThemeProvider';
import { AuthProvider } from './store/AuthProvider';
import { ToastProvider } from './components/ui/ToastProvider';
import { WorkspaceProvider } from './store/WorkspaceProvider';
import ErrorBoundary from './components/ui/ErrorBoundary';
import App from './App.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* Sabse bahar wali boundary — agar kisi provider me hi kuch toot jaye to
        bhi screen bilkul safed na ho. AppLayout ke andar ek aur hai, jo sirf
        page ko rokti hai aur sidebar/topbar chalte rehte hain. */}
    <ErrorBoundary>
      <ThemeProvider>
        <I18nProvider>
          <ToastProvider>
            <AuthProvider>
              <WorkspaceProvider>
                <BrowserRouter>
                  <App />
                </BrowserRouter>
              </WorkspaceProvider>
            </AuthProvider>
          </ToastProvider>
        </I18nProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
