document.querySelectorAll("[data-chibi]").forEach((sprite) => {
  sprite.addEventListener("click", () => {
    sprite.classList.add("active");

    window.setTimeout(() => {
      sprite.classList.remove("active");
    }, 700);
  });
});
