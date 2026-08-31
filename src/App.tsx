import { useCallback, useEffect, useState } from 'react';
import { useGameEngine, VW, VH } from './hooks/useGameEngine';
import { GameScreen } from './components/GameScreen';
import {
  MenuScreen, SetupScreen, DeckScreen, StatsScreen, SettingsScreen, InstallScreen, WrongBookScreen, DailyChallengeScreen, LeaderboardScreen, CampaignScreen, TeacherScreen,
  LevelCompleteScreen, GameOverScreen, PauseOverlay, type MenuView,
} from './components/Screens';
import { highScoreKey } from './lib/storage';
import { usePwaInstall } from './lib/pwa';
import { TutorialOverlay } from './components/TutorialOverlay';
import type { CategoryId, CEFRLevel, LangCode } from './data/vocabulary';

type Root = 'menu' | 'playing' | 'levelComplete' | 'gameOver';

export default function App() {
  const [root, setRoot] = useState<Root>('menu');
  const [view, setView] = useState<MenuView>(() => {
    const shortcut = new URLSearchParams(window.location.search).get('shortcut');
    return shortcut === 'deck' ? 'deck' : shortcut === 'start' ? 'setup' : 'menu';
  });
  const [uiLang, setUiLang] = useState<LangCode>('en');
  const [run, setRun] = useState<{ lang: LangCode; level: CEFRLevel; category: CategoryId }>({
    lang: 'en', level: 'A1', category: 'all',
  });
  const [viewport, setViewport] = useState({ width: VW, height: VH, left: 0, top: 0, scale: 1 });
  const pwa = usePwaInstall();
  const [showTutorial, setShowTutorial] = useState(() => {
    try { return localStorage.getItem('wi_tutorial_seen') !== '1'; } catch { return true; }
  });
  const dismissTutorial = useCallback(() => {
    try { localStorage.setItem('wi_tutorial_seen', '1'); } catch {}
    setShowTutorial(false);
  }, []);

  const api = useGameEngine((kind) => {
    setRoot(kind === 'gameOver' ? 'gameOver' : 'levelComplete');
  });

  useEffect(() => {
    const fit = () => {
      const vv = window.visualViewport;
      const width = vv?.width ?? window.innerWidth;
      const height = vv?.height ?? window.innerHeight;
      const left = vv?.offsetLeft ?? 0;
      const top = vv?.offsetTop ?? 0;
      setViewport({
        width,
        height,
        left,
        top,
        scale: Math.min(width / VW, height / VH),
      });
    };
    fit();
    window.addEventListener('resize', fit);
    window.addEventListener('orientationchange', fit);
    window.visualViewport?.addEventListener('resize', fit);
    window.visualViewport?.addEventListener('scroll', fit);
    return () => {
      window.removeEventListener('resize', fit);
      window.removeEventListener('orientationchange', fit);
      window.visualViewport?.removeEventListener('resize', fit);
      window.visualViewport?.removeEventListener('scroll', fit);
    };
  }, []);

  const start = useCallback((lang: LangCode, level: CEFRLevel, category: CategoryId, cloze?: boolean) => {
    setRun({ lang, level, category });
    api.startRun(lang, level, category, cloze);
    setRoot('playing');
  }, [api]);

  const isDesktop = viewport.width > 520;
  const a11yStyle: React.CSSProperties = {
    fontSize: `${(api.settings.fontScale ?? 1) * 16}px`,
    filter: api.settings.highContrast ? 'contrast(1.25) saturate(1.15)' : undefined,
    fontFamily: api.settings.dyslexia ? 'OpenDyslexic, Verdana, sans-serif' : undefined,
  };

  return (
    <div className={`fixed inset-0 overflow-hidden ${api.settings.reduceMotion ? 'reduce-motion' : ''} ${api.settings.highContrast ? 'high-contrast' : ''} ${api.settings.dyslexia ? 'dyslexia' : ''}`}
      style={{
        ...a11yStyle,
        background: api.settings.highContrast ? '#000' : 'radial-gradient(ellipse at 50% 0%, #101f4d 0%, #060d26 55%, #03060f 100%)',
        touchAction: 'none',
      }}>

      {/* ambient desktop glow */}
      {isDesktop && (
        <div className="fixed inset-0 pointer-events-none" style={{
          background: 'radial-gradient(circle at 20% 30%, rgba(0,212,255,0.07) 0%, transparent 45%), radial-gradient(circle at 80% 70%, rgba(255,46,99,0.06) 0%, transparent 45%)',
        }} />
      )}

      <div className="relative" style={{
        width: VW,
        height: VH,
        position: 'fixed',
        left: viewport.left + viewport.width / 2,
        top: viewport.top + viewport.height / 2,
        transform: `translate(-50%, -50%) scale(${viewport.scale})`,
        transformOrigin: 'center center',
        borderRadius: isDesktop ? 26 : 0,
        overflow: 'hidden',
        boxShadow: isDesktop
          ? '0 0 0 1px rgba(0,212,255,0.28), 0 0 70px rgba(0,102,255,0.3), 0 30px 90px rgba(0,0,0,0.75)'
          : 'none',
        background: '#060d26',
      }}>

        {root === 'menu' && (
          <>
            <MenuBackdrop />
            {view === 'menu' && <MenuScreen api={api} lang={uiLang} setLang={setUiLang} go={setView} pwa={pwa} onContinue={() => { if (api.continueRun()) { const s = api.state; setRun({ lang: s.lang, level: s.level, category: s.category }); setRoot('playing'); } }} />}
            {view === 'setup' && <SetupScreen api={api} lang={uiLang} setLang={setUiLang} onStart={start} onBack={() => setView('menu')} />}
            {view === 'deck' && <DeckScreen api={api} onBack={() => setView('menu')} />}
            {view === 'wrongbook' && <WrongBookScreen api={api} onBack={() => setView('menu')} onStart={(lang, lvl, ids) => { api.startWrongRun(lang, lvl, ids); setRun({ lang, level: lvl, category: 'all' }); setRoot('playing'); }} />}
            {view === 'daily' && <DailyChallengeScreen api={api} onBack={() => setView('menu')} onStart={(lang, lvl, ids) => { api.startWrongRun(lang, lvl, ids); setRun({ lang, level: lvl, category: 'all' }); setRoot('playing'); }} />}
            {view === 'stats' && <StatsScreen api={api} onBack={() => setView('menu')} />}
            {view === 'settings' && <SettingsScreen api={api} onBack={() => setView('menu')} />}
            {view === 'leaderboard' && <LeaderboardScreen api={api} onBack={() => setView('menu')} />}
            {view === 'campaign' && <CampaignScreen api={api} onBack={() => setView('menu')} onStart={(lang, lv) => start(lang, lv, 'all', false)} />}
            {view === 'teacher' && <TeacherScreen api={api} onBack={() => setView('menu')} />}
            {view === 'install' && (
              <InstallScreen
                canInstall={pwa.canInstall}
                installed={pwa.isInstalled}
                isIos={pwa.isIos}
                onInstall={pwa.install}
                onBack={() => setView('menu')}
              />
            )}
          </>
        )}

        {root === 'playing' && (
          <>
            <GameScreen api={api} crt={api.settings.crt} />
            {api.state.phase === 'paused' && (
              <PauseOverlay onResume={api.resume} onQuit={() => { api.quit(); setView('menu'); setRoot('menu'); }} />
            )}
          </>
        )}

        {root === 'levelComplete' && (
          <>
            <MenuBackdrop />
            <LevelCompleteScreen
              s={api.state}
              onNext={() => start(run.lang, run.level, run.category)}
              onMenu={() => { setView('menu'); setRoot('menu'); }}
            />
          </>
        )}

        {root === 'gameOver' && (
          <>
            <MenuBackdrop />
            <GameOverScreen
              s={api.state}
              best={api.stats.highScores[highScoreKey(run.lang, run.level)] ?? 0}
              onRetry={() => start(run.lang, run.level, run.category)}
              onMenu={() => { setView('menu'); setRoot('menu'); }}
            />
          </>
        )}

        {api.settings.crt && root !== 'playing' && <div className="crt absolute inset-0 pointer-events-none z-50" />}
        {showTutorial && root === 'menu' && <TutorialOverlay onDone={dismissTutorial} onSkip={dismissTutorial} />}
      </div>
    </div>
  );
}

/* Animated cortex backdrop behind menus */
function MenuBackdrop() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <svg width={VW} height={VH} className="absolute inset-0">
        <defs>
          <radialGradient id="mA" cx="50%" cy="12%">
            <stop offset="0%" stopColor="#1b3a8f" stopOpacity="0.85" /><stop offset="100%" stopColor="#060d26" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="mB" cx="50%" cy="92%">
            <stop offset="0%" stopColor="#5a1148" stopOpacity="0.7" /><stop offset="100%" stopColor="#060d26" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width={VW} height={VH} fill="#060d26" />
        <rect width={VW} height={VH} fill="url(#mA)" />
        <rect width={VW} height={VH} fill="url(#mB)" />
        {Array.from({ length: 60 }).map((_, i) => {
          const x = (i * 61.8) % VW;
          const y = (i * 37.3) % VH;
          return <rect key={i} x={x} y={y} width={i % 3 === 0 ? 2 : 1} height={i % 3 === 0 ? 2 : 1}
            fill={i % 7 === 0 ? '#ff2e63' : '#9fd8ff'} opacity={0.15 + (i % 5) * 0.09}>
            <animate attributeName="opacity" values={`${0.1 + (i % 4) * 0.08};${0.5};${0.1 + (i % 4) * 0.08}`}
              dur={`${2 + (i % 5)}s`} repeatCount="indefinite" begin={`${(i % 9) * 0.3}s`} />
          </rect>;
        })}
        {Array.from({ length: 16 }).map((_, i) => {
          const x1 = (i * 91.7) % VW, y1 = (i * 53.1) % VH;
          const x2 = ((i + 5) * 91.7) % VW, y2 = ((i + 5) * 53.1) % VH;
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#00d4ff" strokeWidth="0.5" opacity="0.07" />;
        })}
      </svg>
      <div className="absolute inset-0" style={{
        background: 'radial-gradient(ellipse at center, transparent 40%, rgba(3,6,15,0.85) 100%)',
      }} />
    </div>
  );
}
