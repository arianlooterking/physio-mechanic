import { MotionConfig } from 'motion/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'katex/dist/katex.min.css';
import './styles/fonts.css';
import './styles/app.css';
import './styles/backdrops.css';
import './styles/library.css';
import './styles/glossary.css';
import './styles/path.css';
import './styles/lab.css';
import './styles/features.css';
import './styles/plan.css';
import { App } from './App';
import { pullFromServer } from './lib/account';
import { isApp } from './lib/platform';

// /admin/reports is a friendly address for the reports page, which lives at #/admin/reports.
if (location.pathname.replace(/\/+$/, '') === '/admin/reports') location.replace('/#/admin/reports');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <App />
    </MotionConfig>
  </StrictMode>,
);

void pullFromServer();

// inside the Android and iOS apps: live updates, back button, reminders (src/native; the site never loads it)
if (isApp) void import('./native').then((m) => m.startNative());

// Offline support for the built site (not during development, and not when embedded in another page).
if (import.meta.env.PROD && !isApp && 'serviceWorker' in navigator && location.protocol === 'https:' && window.top === window.self) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* offline support is optional */
    });
  });
}
