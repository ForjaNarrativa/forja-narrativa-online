async function loadJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Não foi possível carregar ${path}`);
  return response.json();
}

function createList(items) {
  return `<ul>${items.map((item) => `<li>${item}</li>`).join("")}</ul>`;
}

function createPackageCard(pkg, index) {
  const tier = index + 1;
  const isFeatured = pkg.id === "personagem-vivo" || pkg.id === "arquivo-secreto";
  const featuredClass = isFeatured ? " featured" : "";

  return `
    <article class="forgePackageCard${featuredClass}" data-gsap-card style="--tier:${tier}">
      <div class="packageCardTopline">
        <span>${pkg.badge}</span>
        <small>Pacote ${String(tier).padStart(2, "0")}</small>
      </div>

      <div class="packageCardHeader">
        <h3>${pkg.name}</h3>
        <p class="packagePrice">${pkg.priceLabel}</p>
      </div>

      <p class="packageShort">${pkg.short}</p>
      <p class="packageIdeal"><b>Ideal para:</b> ${pkg.idealFor}</p>

      <div class="packageIncludes">
        <span>Inclui</span>
        ${createList(pkg.items)}
      </div>

      <a href="cliente.html" class="packageOrderLink" aria-label="Fazer pedido do pacote ${pkg.name}">Escolher este pacote</a>
    </article>
  `;
}

function createRankCard(rank, index) {
  const legacyClass = rank.id === "legado" ? " legacy" : "";
  return `
    <article class="memorialStoreRank${legacyClass}" data-gsap-card style="--rank:${index + 1}">
      <div class="rankOrb"><span>${index + 1}</span></div>
      <div>
        <span class="rankRegion">${rank.region}</span>
        <h3>${rank.name}</h3>
        <strong>${rank.priceLabel}</strong>
        <p>${rank.description}</p>
        <small>${rank.visual}</small>
      </div>
    </article>
  `;
}

function showDataError(target, message) {
  if (!target) return;
  target.innerHTML = `<div class="dataError">${message}</div>`;
}

async function renderPackagesPage() {
  const packageTarget = document.querySelector("[data-packages-list]");
  const rankTarget = document.querySelector("[data-ranks-list]");

  try {
    if (packageTarget) {
      const packages = await loadJson("data/json/packages.json");
      packageTarget.innerHTML = packages.map(createPackageCard).join("");
    }
  } catch (error) {
    console.error(error);
    showDataError(packageTarget, "Não foi possível carregar os pacotes agora. Tente atualizar a página ou abrir pelo Live Server.");
  }

  try {
    if (rankTarget) {
      const ranks = await loadJson("data/json/memorial-ranks.json");
      rankTarget.innerHTML = ranks.map(createRankCard).join("");
    }
  } catch (error) {
    console.error(error);
    showDataError(rankTarget, "Não foi possível carregar os ranks do Memorial agora.");
  }

  window.dispatchEvent(new CustomEvent("forja:content-ready"));
}

renderPackagesPage();
