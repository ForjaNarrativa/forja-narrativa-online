const clientOrderForm = document.getElementById("clientOrderForm");
const clientOrderBtn = document.getElementById("clientOrderBtn");
const clientMessage = document.getElementById("clientMessage");
const embers = document.getElementById("embers");
const draftKey = "forja_cliente_pedido_rascunho_v1";

let currentSession = null;
let packageDataCache = null;

function setClientMessage(text, type) {
  if (!clientMessage) return;
  clientMessage.textContent = text;
  clientMessage.className = `clientMessage ${type || ""}`;
}

function generateOrderCode() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const numbers = "23456789";
  let code = "FORJA-";

  for (let i = 0; i < 3; i++) code += letters[Math.floor(Math.random() * letters.length)];
  code += "-";
  for (let i = 0; i < 4; i++) code += numbers[Math.floor(Math.random() * numbers.length)];

  return code;
}

function getFormFields() {
  return {
    clientName: document.getElementById("clientName"),
    packageName: document.getElementById("packageName"),
    characterIdea: document.getElementById("characterIdea")
  };
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function getSelectedPackageFromData() {
  const { packageName } = getFormFields();
  if (!packageName || !packageDataCache) return null;

  const selectedOption = packageName.selectedOptions?.[0];
  const selectedId = selectedOption?.dataset?.packageId;
  const selectedKind = selectedOption?.dataset?.packageKind;

  const allOptions = [
    ...(packageDataCache.packages || []).map((item) => ({ ...item, kind: "principal" })),
    ...(packageDataCache.ranks || []).map((item) => ({ ...item, kind: "memorial" }))
  ];

  if (selectedId) {
    return allOptions.find((item) => item.id === selectedId && (!selectedKind || item.kind === selectedKind)) || null;
  }

  const currentValue = normalizeText(packageName.value);
  return allOptions.find((item) => currentValue.includes(normalizeText(item.name))) || null;
}

function updatePackageGuide() {
  const title = document.getElementById("selectedPackageTitle");
  const price = document.getElementById("selectedPackagePrice");
  const description = document.getElementById("selectedPackageDescription");
  const items = document.getElementById("selectedPackageItems");

  if (!title || !price || !description || !items) return;

  const selected = getSelectedPackageFromData();

  if (!selected) {
    title.textContent = "Escolha um caminho";
    price.textContent = "Pacote ainda não selecionado";
    description.textContent = "Quando você escolher um pacote, a Forja mostra aqui o que será enviado junto do pedido.";
    items.innerHTML = `
      <li>Nome de contato</li>
      <li>Tipo de pedido</li>
      <li>Ideia principal</li>
    `;
    return;
  }

  title.textContent = selected.name;
  price.textContent = selected.priceLabel || "Valor simbólico";
  description.textContent = selected.short || selected.description || selected.visual || "Pedido selecionado para a Forja.";

  const selectedItems = selected.items || [selected.description, selected.visual].filter(Boolean);
  items.innerHTML = selectedItems.map((item) => `<li>${item}</li>`).join("");
}

function saveDraft() {
  const { clientName, packageName, characterIdea } = getFormFields();
  if (!clientName || !packageName || !characterIdea) return;

  const payload = {
    clientName: clientName.value,
    packageName: packageName.value,
    characterIdea: characterIdea.value,
    savedAt: new Date().toISOString()
  };

  try {
    localStorage.setItem(draftKey, JSON.stringify(payload));
    const notice = document.getElementById("draftNotice");
    if (notice) notice.textContent = "Rascunho salvo automaticamente neste navegador.";
  } catch (error) {
    console.warn("Não foi possível salvar rascunho local.", error);
  }
}

function restoreDraft() {
  const { clientName, packageName, characterIdea } = getFormFields();
  if (!clientName || !packageName || !characterIdea) return;

  try {
    const raw = localStorage.getItem(draftKey);
    if (!raw) return;

    const draft = JSON.parse(raw);
    if (draft.clientName && !clientName.value.trim()) clientName.value = draft.clientName;
    if (draft.characterIdea && !characterIdea.value.trim()) characterIdea.value = draft.characterIdea;
    if (draft.packageName && !packageName.value) packageName.value = draft.packageName;

    const notice = document.getElementById("draftNotice");
    if (notice) notice.textContent = "Rascunho recuperado automaticamente.";
  } catch (error) {
    console.warn("Não foi possível restaurar rascunho local.", error);
  }
}

function clearDraft() {
  try {
    localStorage.removeItem(draftKey);
  } catch (error) {
    console.warn("Não foi possível limpar rascunho local.", error);
  }
}

function applyPackageFromUrl() {
  const { packageName } = getFormFields();
  if (!packageName) return;

  const params = new URLSearchParams(window.location.search);
  const packageId = params.get("pacote");
  const packageKind = params.get("tipo");
  if (!packageId) return;

  const option = Array.from(packageName.options).find((item) => {
    const sameId = item.dataset.packageId === packageId;
    const sameKind = !packageKind || item.dataset.packageKind === packageKind;
    return sameId && sameKind;
  });

  if (option) {
    packageName.value = option.value;
    updatePackageGuide();
    saveDraft();
  }
}

async function requireClientLogin() {
  const { data } = await forjaDB.auth.getSession();

  if (!data.session) {
    const next = encodeURIComponent(`cliente.html${window.location.search || ""}`);
    window.location.href = `auth.html?next=${next}`;
    return false;
  }

  currentSession = data.session;
  return true;
}

async function loadClientProfileName() {
  if (!currentSession) return;

  const { data, error } = await forjaDB
    .from("profiles")
    .select("nome,email")
    .eq("user_id", currentSession.user.id)
    .maybeSingle();

  if (error) {
    console.warn("Não foi possível carregar perfil do cliente.", error);
    return;
  }

  const { clientName } = getFormFields();
  if (data?.nome && clientName && !clientName.value.trim()) clientName.value = data.nome;

  if (!data) {
    await forjaDB.from("profiles").insert({
      user_id: currentSession.user.id,
      email: currentSession.user.email,
      nome: ""
    });
  }
}

async function saveClientProfileName(clientName) {
  if (!currentSession || !clientName) return;

  const { error } = await forjaDB.from("profiles").upsert({
    user_id: currentSession.user.id,
    email: currentSession.user.email,
    nome: clientName
  }, { onConflict: "user_id" });

  if (error) console.warn("Não foi possível salvar nome no perfil.", error);
}

async function logClientOrderCreated(order, note) {
  if (!order?.id) return;

  try {
    const { error } = await forjaDB.from("order_events").insert({
      order_id: order.id,
      actor_id: currentSession?.user?.id || null,
      actor_email: currentSession?.user?.email || null,
      actor_role: "cliente",
      event_type: "created",
      new_status: order.status || "aguardando análise",
      new_payment_status: order.payment_status || "aguardando pagamento",
      note: note || "Pedido enviado pelo cliente."
    });

    if (error) console.warn("Histórico do pedido ainda não está ativo.", error);
  } catch (error) {
    console.warn("Histórico do pedido ainda não está disponível.", error);
  }
}

async function handleClientOrderSubmit(event) {
  event.preventDefault();

  if (!currentSession) {
    const hasLogin = await requireClientLogin();
    if (!hasLogin) return;
    await loadClientProfileName();
  }

  const { clientName, packageName, characterIdea } = getFormFields();
  const clientNameValue = clientName.value.trim();
  const packageNameValue = packageName.value;
  const characterIdeaValue = characterIdea.value.trim();
  const selectedPackage = getSelectedPackageFromData();
  const orderCode = generateOrderCode();

  if (!clientNameValue || !packageNameValue || !characterIdeaValue) {
    setClientMessage("Preencha todos os campos antes de enviar.", "error");
    return;
  }

  clientOrderBtn.disabled = true;
  clientOrderBtn.textContent = "Enviando pedido...";
  setClientMessage("A Forja está recebendo sua faísca...", "loading");

  await saveClientProfileName(clientNameValue);

  const { data: createdOrder, error } = await forjaDB.from("orders").insert({
    user_id: currentSession.user.id,
    client_name: clientNameValue,
    client_email: currentSession.user.email,
    package_name: packageNameValue,
    character_idea: characterIdeaValue,
    order_code: orderCode,
    payment_status: "aguardando pagamento",
    status: "aguardando análise"
  }).select("*").single();

  if (error) {
    console.error(error);
    setClientMessage(`Erro ao enviar pedido: ${error.message}`, "error");
    clientOrderBtn.disabled = false;
    clientOrderBtn.textContent = "Enviar pedido para a Forja";
    return;
  }

  await logClientOrderCreated(createdOrder, `Pedido criado no pacote ${packageNameValue}.`);

  clearDraft();
  setClientMessage(`Pedido enviado com sucesso! ${selectedPackage?.name ? `${selectedPackage.name} foi enviado para a Forja.` : "Ele já está em Meus Pedidos."}`, "success");
  clientOrderForm.reset();
  updatePackageGuide();

  setTimeout(() => {
    window.location.href = "meus-pedidos.html";
  }, 1000);
}

function bindDraftListeners() {
  const { clientName, packageName, characterIdea } = getFormFields();
  [clientName, packageName, characterIdea].forEach((field) => {
    if (!field) return;
    field.addEventListener("input", () => {
      if (field === packageName) updatePackageGuide();
      saveDraft();
    });
    field.addEventListener("change", () => {
      if (field === packageName) updatePackageGuide();
      saveDraft();
    });
  });
}

function createEmber() {
  const perf = window.forjaPerformance || {};
  if (!embers || perf.reducedMotion) return;
  if (embers.children.length >= (perf.emberLimit || 14)) return;

  const ember = document.createElement("span");
  ember.className = "ember";

  const size = Math.random() * 4 + 2;
  const left = Math.random() * 100;
  const duration = Math.random() * 8 + 6;
  const delay = Math.random() * 2;

  ember.style.width = `${size}px`;
  ember.style.height = `${size}px`;
  ember.style.left = `${left}%`;
  ember.style.animationDuration = `${duration}s`;
  ember.style.animationDelay = `${delay}s`;

  embers.appendChild(ember);

  setTimeout(() => {
    ember.remove();
  }, (duration + delay) * 1000);
}

async function initClientPage() {
  if (!clientOrderForm) return;

  clientOrderForm.addEventListener("submit", handleClientOrderSubmit);
  bindDraftListeners();
  restoreDraft();
  updatePackageGuide();

  window.addEventListener("forja:packages-ready", (event) => {
    packageDataCache = event.detail;
    restoreDraft();
    applyPackageFromUrl();
    updatePackageGuide();
  });

  if (window.forjaPackageData) {
    packageDataCache = window.forjaPackageData;
    applyPackageFromUrl();
    updatePackageGuide();
  }

  const hasLogin = await requireClientLogin();
  if (!hasLogin) return;
  await loadClientProfileName();
}

const perf = window.forjaPerformance || {};
setInterval(createEmber, perf.emberInterval || 360);
for (let i = 0; i < (perf.initialEmbers || 12); i += 1) createEmber();

initClientPage();
