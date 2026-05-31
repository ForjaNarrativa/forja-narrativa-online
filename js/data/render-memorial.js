async function loadMemorialRanks() {
  const response = await fetch("data/json/memorial-ranks.json");
  if (!response.ok) throw new Error("Não foi possível carregar os ranks do Memorial.");
  return response.json();
}

function sampleRegionContent(rank) {
  if (rank.id === "chama") {
    return `
      <div class="stoneField">
        <div class="memoryStone"><strong>Nome da personagem</strong><p>“A frase que mantém a chama acesa.”</p></div>
        <div class="memoryStone mutedStone"><strong>Próxima memória</strong><p>Uma nova criação poderá ser gravada aqui.</p></div>
        <div class="memoryStone mutedStone"><strong>Espaço reservado</strong><p>O Memorial cresce conforme a Forja cresce.</p></div>
      </div>`;
  }

  if (rank.id === "estatua") {
    return `
      <div class="statueGallery">
        <div class="statuePlaceholder"><div class="statueHead"></div><div class="statueBody"></div><span>Estátua futura</span></div>
        <div class="statuePlaceholder shadowStatue"><div class="statueHead"></div><div class="statueBody"></div><span>Aguardando criação</span></div>
      </div>`;
  }

  if (rank.id === "santuario") {
    return `
      <div class="sanctuaryPreview">
        <div class="sanctuaryScene"><span>Ruína dourada</span></div>
        <div class="sanctuaryScene purpleScene"><span>Jardim roxo</span></div>
      </div>`;
  }

  return `
    <a class="legacyDoor" href="pedidos.html">
      <span>Abrir futuro arquivo</span>
      <strong>Página exclusiva da personagem</strong>
      <small>Clique para pedir um Legado</small>
    </a>`;
}

function createRegion(rank) {
  const classByRank = {
    chama: "flameRegion",
    estatua: "statueRegion",
    santuario: "sanctuaryRegion",
    legado: "legacyRegion"
  };

  return `
    <article class="memorialRegion ${classByRank[rank.id] || ""}" data-gsap-card>
      <div class="regionHeader">
        <span>${rank.name} — ${rank.priceLabel}</span>
        <h3>${rank.region}</h3>
        <p>${rank.description}</p>
        <small>Carregamento futuro: até ${rank.limit} memórias por bloco.</small>
      </div>
      ${sampleRegionContent(rank)}
    </article>
  `;
}

async function renderMemorialWorld() {
  const target = document.querySelector("[data-memorial-world]");
  if (!target) return;

  try {
    const ranks = await loadMemorialRanks();
    target.innerHTML = ranks.map(createRegion).join("");
    window.dispatchEvent(new CustomEvent("forja:content-ready"));
  } catch (error) {
    console.error(error);
    target.innerHTML = `
      <div class="dataError">
        Não foi possível carregar o Memorial agora. Use o Live Server no teste local ou atualize a página publicada.
      </div>
    `;
  }
}

renderMemorialWorld();
