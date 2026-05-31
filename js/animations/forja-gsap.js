function animateForjaPage(event) {
  if (!window.gsap) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reducedMotion) return;

  const firstRun = !window.__forjaIntroAnimated;

  if (firstRun) {
    window.__forjaIntroAnimated = true;
    gsap.from(".topbar", { y: -24, opacity: 0, duration: 0.7, ease: "power2.out" });
    gsap.from(".heroText, .pageHero, .clientHero, .ordersClientHero", { y: 24, opacity: 0, duration: 0.8, ease: "power2.out", stagger: 0.08 });
    gsap.from(".forgeCard, .clientPanel, .creditsStage", { scale: 0.98, opacity: 0, duration: 0.75, ease: "power2.out", delay: 0.12 });
  }

  const cards = gsap.utils.toArray("[data-gsap-card], .pathCard, .lorePanel, .stepCard, .infoListGrid div");
  cards.forEach((card, index) => {
    if (card.dataset.forjaAnimated === "true") return;
    card.dataset.forjaAnimated = "true";

    gsap.from(card, {
      y: 22,
      opacity: 0,
      duration: 0.55,
      delay: Math.min(index * 0.025, 0.25),
      ease: "power2.out",
      scrollTrigger: window.ScrollTrigger ? { trigger: card, start: "top 88%" } : undefined
    });
  });

  const rift = document.querySelector(".fusionRift");
  if (rift && !rift.dataset.forjaPulse) {
    rift.dataset.forjaPulse = "true";
    gsap.to(rift, { filter: "drop-shadow(0 0 26px rgba(158, 100, 216, 0.55))", duration: 1.8, repeat: -1, yoyo: true, ease: "sine.inOut" });
  }
}

window.addEventListener("load", animateForjaPage);
window.addEventListener("forja:content-ready", animateForjaPage);
