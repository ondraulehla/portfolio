/**
 * Capability gate for the 3D playground. Three.js is only imported after the
 * user explicitly presses "start", so the main bundle stays 3D-free.
 */

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

export function initGate(): void {
  const gate = document.getElementById('gate');
  const enter = document.getElementById('gate-enter') as HTMLButtonElement | null;
  const note = document.getElementById('gate-note');
  const loading = document.getElementById('gate-loading');
  if (!gate || !enter || !note || !loading) return;
  // Guard against double-binding when init runs more than once on the same DOM
  // (initial load fires both the module script and astro:page-load).
  if (gate.dataset.bound) return;
  gate.dataset.bound = 'true';

  const strings = readStrings();
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasWebgl = webglAvailable();

  if (!hasWebgl) {
    note.textContent = strings.webgl;
    note.hidden = false;
    enter.hidden = true;
    return;
  }

  if (reducedMotion) {
    note.textContent = strings.motion;
    note.hidden = false;
    enter.textContent = strings.anyway;
  }

  enter.addEventListener('click', async () => {
    enter.disabled = true;
    loading.hidden = false;
    try {
      const { startExperience } = await import('./experience');
      await startExperience();
      gate.remove();
    } catch {
      // stale chunk from a previous deploy – one hard reload recovers
      try {
        if (sessionStorage.getItem('chunk-reload')) return;
        sessionStorage.setItem('chunk-reload', '1');
      } catch {}
      location.reload();
    }
  });
}

function readStrings() {
  // Fallback strings live here so the gate works even if the page markup changes.
  const lang = document.documentElement.lang;
  const cs = lang === 'cs';
  return {
    webgl: cs
      ? 'Váš prohlížeč nepodporuje WebGL, 3D svět zde nelze spustit.'
      : "Your browser doesn't support WebGL, so the 3D world can't run here.",
    motion: cs
      ? 'Máte zapnuté omezení animací, 3D zážitek je proto ve výchozím stavu vypnutý.'
      : 'You have reduced motion enabled, so the 3D experience is off by default.',
    anyway: cs ? 'Přesto načíst' : 'Load it anyway',
  };
}
