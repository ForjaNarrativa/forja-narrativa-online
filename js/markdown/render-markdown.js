async function loadMarkdown(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Não foi possível carregar ${path}`);
  return response.text();
}

function escapeMarkdownHTML(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function simpleMarkdownToHTML(markdown) {
  return escapeMarkdownHTML(markdown)
    .split(/\n{2,}/)
    .map((block) => {
      const text = block.trim();
      if (!text) return "";
      if (text.startsWith("### ")) return `<h3>${text.slice(4)}</h3>`;
      if (text.startsWith("## ")) return `<h2>${text.slice(3)}</h2>`;
      if (text.startsWith("# ")) return `<h1>${text.slice(2)}</h1>`;
      return `<p>${text.replaceAll("\n", "<br>")}</p>`;
    })
    .join("\n");
}

async function renderMarkdownBlocks() {
  const targets = document.querySelectorAll("[data-markdown-src]");
  if (!targets.length) return;

  for (const target of targets) {
    try {
      const markdown = await loadMarkdown(target.dataset.markdownSrc);
      target.innerHTML = simpleMarkdownToHTML(markdown);
    } catch (error) {
      console.error(error);
      target.innerHTML = `<div class="dataError">Não foi possível carregar este texto agora.</div>`;
    }
  }
}

renderMarkdownBlocks();
