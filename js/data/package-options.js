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

function escapeOptionValue(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function buildPackageOptions({ packages, ranks }, config = {}) {
  const {
    placeholder = "Selecione um pacote",
    includeMemorial = true,
    emptyLabel = null,
    filterMode = false
  } = config;

  const firstOption = emptyLabel
    ? `<option value="">${emptyLabel}</option>`
    : `<option value="">${placeholder}</option>`;

  const mainOptions = packages
    .map((pkg) => {
      const value = filterMode ? pkg.name : `${pkg.name} - ${pkg.priceLabel}`;
      return `<option value="${escapeOptionValue(value)}" data-package-id="${escapeOptionValue(pkg.id)}" data-package-kind="principal">${escapeOptionValue(pkg.name)} — ${escapeOptionValue(pkg.priceLabel)}</option>`;
    })
    .join("");

  const rankOptions = ranks
    .map((rank) => {
      const value = filterMode ? rank.name : `${rank.name} - ${rank.priceLabel}`;
      return `<option value="${escapeOptionValue(value)}" data-package-id="${escapeOptionValue(rank.id)}" data-package-kind="memorial">${escapeOptionValue(rank.name)} — ${escapeOptionValue(rank.priceLabel)}</option>`;
    })
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
        emptyLabel: isFilter ? "Todos os pacotes" : null,
        filterMode: isFilter
      });
    });

    window.forjaPackageData = data;
    window.dispatchEvent(new CustomEvent("forja:packages-ready", { detail: data }));
  } catch (error) {
    console.warn("Mantendo opções fixas dos formulários.", error);
    window.dispatchEvent(new CustomEvent("forja:packages-error", { detail: error }));
    selects.forEach((select) => {
      if (!select.options.length) {
        select.innerHTML = `<option value="">Não foi possível carregar os pacotes</option>`;
      }
    });
  }
}

loadPackageOptions();
