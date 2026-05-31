async function loadJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Não foi possível carregar ${path}`);
  return response.json();
}

function createList(items) {
  return `<ul>${items.map((item) => `<li>${item}</li>`).join("")}</ul>`;
}

function createPackageCard(pkg, index) {
  const promoClass = index === 0 ? " promo" : "";
  return `
    <article class="priceCard${promoClass}" data-gsap-card>
      <div class="discount">${pkg.badge}</div>
      <h3>${pkg.name}</h3>
      <p class="price">${pkg.priceLabel}</p>
      <p class="small">${pkg.short}</p>
      <p class="idealFor"><b>Ideal para:</b> ${pkg.idealFor}</p>
      ${createList(pkg.items)}
    </article>
  `;
}

function createRankCard(rank) {
  const legacyClass = rank.id === "legado" ? " legacy" : "";
  return `
    <article class="rankPriceCard${legacyClass}" data-gsap-card>
      <span>${rank.name}</span>
      <strong>${rank.priceLabel}</strong>
      <p>${rank.description}</p>
      <small>${rank.visual}</small>
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
