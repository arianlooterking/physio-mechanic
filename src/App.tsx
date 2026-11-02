import { lazy, Suspense, useEffect } from 'react';
import { AppBackdrop, LessonBackdrop } from './components/Backdrops';
import { fieldOf } from './content/fields';
import { ErrorBoundary } from './components/ErrorBoundary';
import { GlossaryHost, SubjectContext } from './components/Glossary';
import { Rich } from './components/Rich';
import { lessonById, SUBJECTS } from './content';
import { Shell } from './components/Shell';
import { ToastHost } from './components/ui';
import { useAccount } from './lib/account';
import { useRoute } from './lib/nav';
import { hasProgress } from './lib/state';
import { useAppState } from './lib/store';
import { CardsSession } from './screens/CardsSession';
import { WordCards } from './screens/WordCards';
import { Home } from './screens/Home';
import { Landing } from './landing/Landing';
import { Legal } from './landing/Legal';
import { Login } from './landing/Login';
import { LearnSession } from './screens/LearnSession';
import { LessonOverview } from './screens/LessonOverview';
import { Onboarding } from './screens/Onboarding';
import { MistakesSession, PracticeSession } from './screens/PracticeSession';
import { Profile } from './screens/Profile';
import { Progress } from './screens/Progress';
import { Review } from './screens/Review';
import { Lab } from './screens/Lab';
import { Warmup } from './screens/Warmup';
import { TestSession } from './screens/TestSession';
import { MockExam } from './screens/MockExam';
import { DailyChallenge } from './screens/DailyChallenge';
import { Plan } from './screens/Plan';
import { SummarySheet } from './screens/Sheet';

// Content preview for authors; only exists in development builds.
const DevCatalog = import.meta.env.DEV ? lazy(() => import('./screens/DevCatalog').then((m) => ({ default: m.DevCatalog }))) : null;
const MascotGallery = import.meta.env.DEV ? lazy(() => import('./screens/MascotGallery').then((m) => ({ default: m.MascotGallery }))) : null;
// Content reports for the site's admins (#/admin/reports); loaded only when opened.
const AdminReports = lazy(() => import('./screens/AdminReports').then((m) => ({ default: m.AdminReports })));

export function App() {
  const s = useAppState();
  const route = useRoute();
  const { account } = useAccount();
  const theme = s.profile.theme;

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
  }, [theme]);

  let view: React.ReactNode;
  // /privacy and /terms are real paths too (Google's consent screen links to them).
  const path = location.pathname.replace(/\/+$/, '');
  const legalPath = path === '/privacy' ? 'privacy' : path === '/terms' ? 'terms' : null;
  // The bare site address is the front door. A returning learner (signed in with Google, or a guest with
  // progress saved on this device) goes straight to their path, where «ادامه» picks up the lesson; anyone
  // else sees the landing page, which the logo always opens. Inside the app, home is «#/».
  const bare = location.hash === '' || location.hash === '#';
  const returning = Boolean(account) || hasProgress(s);
  const dev = DevCatalog && location.hash.startsWith('#/dev/') ? location.hash.slice(6).split('/') : null;
  if (MascotGallery && location.hash === '#/dev-mascot') {
    view = (
      <Suspense fallback={null}>
        <MascotGallery />
      </Suspense>
    );
  } else if (dev && DevCatalog) {
    view = (
      <Suspense fallback={null}>
        <DevCatalog lessonId={dev[0]} part={dev[1] ?? 'all'} only={dev[2]} />
      </Suspense>
    );
  } else if (route.name === 'legal' || legalPath) {
    view = <Legal page={route.name === 'legal' ? route.page : legalPath!} />;
  } else if (route.name === 'welcome' || (bare && !returning) || (!s.profile.onboarded && !account && route.name !== 'login' && route.name !== 'start')) {
    view = <Landing />;
  } else if (route.name === 'login') {
    view = <Login />;
  } else if (!s.profile.onboarded) {
    view = <Onboarding />;
  } else {
    switch (route.name) {
      case 'warmup':
        view = <Warmup lessonId={route.lessonId} next={route.next} />;
        break;
      case 'learn':
        view = <LearnSession lessonId={route.lessonId} conceptId={route.conceptId} />;
        break;
      case 'practice':
        view = <PracticeSession lessonId={route.lessonId} nodeId={route.nodeId} />;
        break;
      case 'test':
        view = <TestSession key={`${route.lessonId}:${route.set ?? ''}`} lessonId={route.lessonId} set={route.set} />;
        break;
      case 'cards':
        view = <CardsSession scope={route.scope} />;
        break;
      case 'words':
        view = <WordCards subject={route.subject} />;
        break;
      case 'mistakes':
        view = <MistakesSession />;
        break;
      case 'mock':
        view = <MockExam lessonId={route.lessonId} />;
        break;
      case 'daily':
        view = <DailyChallenge />;
        break;
      default:
        view = (
          <Shell route={route}>
            {(route.name === 'home' || route.name === 'start') && <Home />}
            {route.name === 'review' && <Review />}
            {route.name === 'lab' && <Lab tab={route.tab} />}
            {route.name === 'progress' && <Progress />}
            {route.name === 'profile' && <Profile />}
            {route.name === 'lesson' && <LessonOverview lessonId={route.lessonId} />}
            {route.name === 'plan' && <Plan />}
            {route.name === 'sheet' && <SummarySheet subject={route.subject} lessonId={route.lessonId} />}
            {route.name === 'admin' && (
              <Suspense fallback={null}>
                <AdminReports />
              </Suspense>
            )}
          </Shell>
        );
    }
  }

  // The subject on screen: formulas and terms explain themselves inside it (glossary cards).
  const routeLesson = 'lessonId' in route ? route.lessonId : route.name === 'cards' ? route.scope : dev?.[0];
  const screenSubject = fieldOf(route.name === 'sheet' ? SUBJECTS.find((x) => x.id === route.subject)?.id : routeLesson ? lessonById(routeLesson)?.subject : undefined);

  // Lively backgrounds: subject-themed behind sessions, soft symbols behind the tabs.
  let backdrop: React.ReactNode = null;
  const inSession = ['learn', 'warmup', 'practice', 'test', 'cards', 'words', 'mistakes', 'mock', 'daily'].includes(route.name);
  const landingLike = view !== null && (route.name === 'welcome' || route.name === 'login' || route.name === 'legal' || legalPath || (bare && !returning) || !s.profile.onboarded);
  if (route.name === 'lesson' && s.profile.onboarded) {
    // A lesson's overview gets its subject's own live backdrop too, framed by the sidebar and rail.
    backdrop = <LessonBackdrop subject={lessonById(route.lessonId)?.subject} framed />;
  } else if (inSession && s.profile.onboarded) {
    const lessonId = 'lessonId' in route ? route.lessonId : route.name === 'cards' ? route.scope : undefined;
    const wordsBook = route.name === 'words' ? SUBJECTS.find((x) => x.id === route.subject)?.id : undefined;
    backdrop = <LessonBackdrop subject={lessonId ? lessonById(lessonId)?.subject : wordsBook} />;
  } else if (!landingLike) {
    backdrop = <AppBackdrop subject={s.profile.focus} />;
  }

  return (
    <>
      {backdrop}
      <SubjectContext.Provider value={screenSubject}>
        <ErrorBoundary key={location.hash}>{view}</ErrorBoundary>
      </SubjectContext.Provider>
      <GlossaryHost render={(text) => <Rich text={text} />} />
      <ToastHost />
    </>
  );
}
