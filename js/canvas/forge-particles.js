const forgeCanvas = document.getElementById("forgeCanvas");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
const tinyScreen = window.innerWidth < 520;

if (forgeCanvas && !reducedMotion) {
  const ctx = forgeCanvas.getContext("2d");
  const particles = [];
  const maxParticles = tinyScreen ? 12 : (coarsePointer || window.innerWidth < 720 ? 20 : 48);
  let animationFrameId = null;

  function resizeCanvas() {
    forgeCanvas.width = window.innerWidth * window.devicePixelRatio;
    forgeCanvas.height = window.innerHeight * window.devicePixelRatio;
    ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
  }

  function createParticle() {
    return {
      x: Math.random() * window.innerWidth,
      y: window.innerHeight + Math.random() * 120,
      size: Math.random() * 2.1 + 0.7,
      speed: Math.random() * 0.38 + 0.14,
      drift: Math.random() * 0.35 - 0.175,
      hue: Math.random() > 0.68 ? "purple" : "gold",
      alpha: Math.random() * 0.48 + 0.16
    };
  }

  function resetParticle(particle) {
    Object.assign(particle, createParticle());
    particle.y = window.innerHeight + 20;
  }

  function bootParticles() {
    particles.length = 0;
    for (let i = 0; i < maxParticles; i += 1) particles.push(createParticle());
  }

  function draw() {
    if (document.hidden) {
      animationFrameId = requestAnimationFrame(draw);
      return;
    }

    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    particles.forEach((particle) => {
      particle.y -= particle.speed;
      particle.x += particle.drift;

      if (particle.y < -20 || particle.x < -30 || particle.x > window.innerWidth + 30) resetParticle(particle);

      const color = particle.hue === "gold" ? "226, 184, 90" : "158, 100, 216";
      ctx.beginPath();
      ctx.fillStyle = `rgba(${color}, ${particle.alpha})`;
      ctx.shadowColor = `rgba(${color}, 0.65)`;
      ctx.shadowBlur = tinyScreen ? 6 : 10;
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    animationFrameId = requestAnimationFrame(draw);
  }

  window.addEventListener("resize", () => {
    resizeCanvas();
    bootParticles();
  });

  window.addEventListener("beforeunload", () => {
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
  });

  resizeCanvas();
  bootParticles();
  draw();
}
