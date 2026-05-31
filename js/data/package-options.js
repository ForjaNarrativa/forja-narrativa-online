async function getForjaPackageData() {
  const [packagesResponse, ranksResponse] = await Promise.all([
    fetch("data/json/packages.json"),
    fetch("data/json/memorial-ranks.json")
  ]);

  if (!packagesResponse.ok || !ranksResponse.ok) {
    throw new Error("Não foi possível carregar os pacotes da Forja.");
  }

  const packages = await packagesResponse.json();
  const ranks = await ranksResponse.json();
  return { packages, ranks };
}

function buildPackageOptions({ packages, ranks }, config = {}) {
  const {
    placeholder = "Selecione um pacote",
    includeMemorial = true,
    emptyLabel = null
  } = config;

  const firstOption = emptyLabel
    ? `<option value="">${emptyLabel}</option>`
    : `<option value="">${placeholder}</option>`;

  const mainOptions = packages
    .map((pkg) => `<option value="${pkg.name} - ${pkg.priceLabel}">${pkg.name} — ${pkg.priceLabel}</option>`)
    .join("");

  const rankOptions = ranks
    .map((rank) => `<option value="${rank.name} - ${rank.priceLabel}">${rank.name} — ${rank.priceLabel}</option>`)
    .join("");

  return `
    ${firstOption}
    <optgroup label="Pacotes principais">
      ${mainOptions}
    </optgroup>
    ${includeMemorial ? `
      <optgroup label="Memorial da Forja">
        ${rankOptions}
      </optgroup>
    ` : ""}
  `;
}

async function loadPackageOptions() {
  const selects = document.querySelectorAll("[data-package-options]");
  if (!selects.length) return;

  try {
    const data = await getForjaPackageData();

    selects.forEach((select) => {
      const mode = select.dataset.packageOptions || "all";
      const isFilter = select.dataset.packageFilter === "true";

      select.innerHTML = buildPackageOptions(data, {
        includeMemorial: mode !== "main",
        placeholder: select.dataset.placeholder || "Selecione um pacote",
        emptyLabel: isFilter ? "Todos os pacotes" : null
      });
    });
  } catch (error) {
    console.warn("Mantendo opções fixas dos formulários.", error);
    selects.forEach((select) => {
      if (!select.options.length) {
        select.innerHTML = `<option value="">Não foi possível carregar os pacotes</option>`;
      }
    });
  }
}

loadPackageOptions();
