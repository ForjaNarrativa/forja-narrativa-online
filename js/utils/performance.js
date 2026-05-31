(() => {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const narrowScreen = window.innerWidth <= 720;
  const tinyScreen = window.innerWidth <= 520;
  const lowPowerHint = navigator.deviceMemory && navigator.deviceMemory <= 4;
  const isMobileLight = reducedMotion || coarsePointer || narrowScreen || lowPowerHint;

  window.forjaPerformance = {
    reducedMotion,
    coarsePointer,
    narrowScreen,
    tinyScreen,
    lowPowerHint,
    isMobileLight,
    emberLimit: reducedMotion ? 0 : (tinyScreen ? 5 : isMobileLight ? 8 : 22),
    initialEmbers: reducedMotion ? 0 : (tinyScreen ? 3 : isMobileLight ? 6 : 18),
    emberInterval: reducedMotion ? 999999 : (tinyScreen ? 950 : isMobileLight ? 650 : 300),
    canvasParticles: reducedMotion ? 0 : (tinyScreen ? 8 : isMobileLight ? 14 : 46),
    gsapCardLimit: isMobileLight ? 18 : 80
  };
})();
