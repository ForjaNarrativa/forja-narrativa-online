const ordersList = document.getElementById("ordersList");
const loadingBox = document.getElementById("loadingBox");
const refreshBtn = document.getElementById("refreshBtn");
const logoutBtn = document.getElementById("logoutBtn");
const searchInput = document.getElementById("searchInput");
const packageFilter = document.getElementById("packageFilter");
const statusFilter = document.getElementById("statusFilter");
const showTestOrdersBtn = document.getElementById("showTestOrdersBtn");
const showArchivedOrdersBtn = document.getElementById("showArchivedOrdersBtn");
const clearFiltersBtn = document.getElementById("clearFiltersBtn");
const deleteTestOrdersBtn = document.getElementById("deleteTestOrdersBtn");

const totalOrders = document.getElementById("totalOrders");
const waitingOrders = document.getElementById("waitingOrders");
const unpaidOrders = document.getElementById("unpaidOrders");

const embers = document.getElementById("embers");

let ordersCache = [];
let currentUser = null;

const OWNER_ADMIN_EMAILS = ["forjanarrativa5790@gmail.com"];

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isOwnerAdminEmail(email) {
  return OWNER_ADMIN_EMAILS.includes(normalizeEmail(email));
}


function escapeHTML(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(dateValue) {
  if (!dateValue) return "Data não registrada";

  const date = new Date(dateValue);

  return date.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

async function isForjaAdminSession(session) {
  if (!session?.user) return false;
  if (isOwnerAdminEmail(session.user.email)) return true;

  try {
    const { data, error } = await forjaDB.rpc("is_forja_admin");
    if (!error && data === true) return true;
  } catch (error) {
    console.warn("RPC is_forja_admin indisponível. Tentando fallback local.", error);
  }

  try {
    const { data, error } = await forjaDB
      .from("admin_users")
      .select("user_id")
      .eq("user_id", session.user.id)
      .maybeSingle();

    return !error && !!data;
  } catch (error) {
    console.warn("Fallback admin_users falhou.", error);
    return false;
  }
}

async function requireAdminAccess() {
  loadingBox.style.display = "block";
  loadingBox.textContent = "Verificando acesso ao Painel da Forja...";

  const { data: sessionData } = await forjaDB.auth.getSession();

  if (!sessionData.session) {
    window.location.href = "login.html";
    return false;
  }

  currentUser = sessionData.session.user;

  const isAdmin = await isForjaAdminSession(sessionData.session);

  if (!isAdmin) {
    alert("Acesso negado. Esta sala é reservada para administradores da Forja.");
    window.location.href = "index.html";
    return false;
  }

  return true;
}

const statusPresets = [
  { label: "Análise", status: "aguardando análise", payment: null },
  { label: "Aguardando pagamento", status: "aguardando pagamento", payment: "não pago" },
  { label: "Pago / Produção", status: "em produção", payment: "pago" },
  { label: "Aguardando cliente", status: "aguardando resposta do cliente", payment: null },
  { label: "Revisão solicitada", status: "revisão solicitada", payment: null },
  { label: "Entregue", status: "entregue", payment: "pago" },
  { label: "Cancelado", status: "cancelado", payment: null },
  { label: "Arquivado", status: "arquivado", payment: null },
  { label: "Teste", status: "teste", payment: "isento" }
];

function updateStats(orders) {
  totalOrders.textContent = orders.length;

  waitingOrders.textContent = orders.filter((order) => {
    return String(order.status || "").toLowerCase().includes("aguardando");
  }).length;

  unpaidOrders.textContent = orders.filter((order) => {
    return String(order.payment_status || "").toLowerCase().includes("não pago");
  }).length;
}

function renderStatusButtons(order) {
  return statusPresets.map((preset) => {
    const payment = preset.payment || order.payment_status || "não pago";
    return `<button onclick="updateOrderStatus('${order.id}', '${preset.status}', '${payment}')">${preset.label}</button>`;
  }).join("");
}

function renderDeliveryBox(order) {
  const deliveryUrl = escapeHTML(order.delivery_url || "");
  const deliveryNote = escapeHTML(order.delivery_note || "");

  return `
    <div class="orderDeliveryZone">
      <div class="deliveryHeader">
        <strong>Entrega final</strong>
        <span>Preencha quando o resultado estiver pronto. O cliente verá isso em Meus Pedidos.</span>
      </div>

      <label>
        Link da entrega
        <input id="deliveryUrl-${order.id}" type="url" value="${deliveryUrl}" placeholder="https://..." />
      </label>

      <label>
        Observação da entrega
        <textarea id="deliveryNote-${order.id}" rows="3" placeholder="Mensagem curta para o cliente...">${deliveryNote}</textarea>
      </label>

      <div class="deliveryActions">
        <button type="button" onclick="saveOrderDelivery('${order.id}', false)">Salvar entrega</button>
        <button type="button" onclick="saveOrderDelivery('${order.id}', true)">Salvar e marcar entregue</button>
      </div>
    </div>
  `;
}

function renderDangerActions(order) {
  const isArchived = String(order.status || "").toLowerCase() === "arquivado";
  const archiveButton = isArchived
    ? `<button class="archiveOrderBtn" onclick="updateOrderStatus('${order.id}', 'aguardando análise', '${order.payment_status || "não pago"}')" title="Tirar pedido do arquivo">Restaurar</button>`
    : `<button class="archiveOrderBtn" onclick="archiveOrder('${order.id}')" title="Arquivar pedido sem excluir">Arquivar</button>`;

  return `
    ${archiveButton}
    <button class="deleteOrderBtn" onclick="deleteOrder('${order.id}')" title="Excluir pedido permanentemente">
      Excluir pedido
    </button>
  `;
}

function renderOrders() {
  const searchTerm = searchInput.value.trim().toLowerCase();
  const packageTerm = packageFilter.value.trim().toLowerCase();
  const statusTerm = statusFilter.value.trim().toLowerCase();

  let filtered = [...ordersCache];

  if (searchTerm) {
    filtered = filtered.filter((order) => {
      const searchable = [
        order.client_name,
        order.client_email,
        order.package_name,
        order.character_idea,
        order.status,
        order.payment_status
      ].join(" ").toLowerCase();

      return searchable.includes(searchTerm);
    });
  }

  if (packageTerm) {
    filtered = filtered.filter((order) => {
      return String(order.package_name || "").toLowerCase().includes(packageTerm);
    });
  }

  if (statusTerm) {
    filtered = filtered.filter((order) => {
      return String(order.status || "").toLowerCase() === statusTerm;
    });
  }

  if (filtered.length === 0) {
    ordersList.innerHTML = `
      <div class="emptyState">
        Nenhum pedido encontrado com esse filtro.
      </div>
    `;
    return;
  }

  ordersList.innerHTML = filtered.map((order) => {
    return `
      <article class="orderCard">
        <div class="orderTop">
          <div>
            <h3>${escapeHTML(order.client_name)}</h3>
            <p class="orderDate">${formatDate(order.created_at)}</p>
          </div>

          <div class="orderBadges">
            <span class="badge status">${escapeHTML(order.status)}</span>
            <span class="badge payment">${escapeHTML(order.payment_status)}</span>
          </div>
        </div>

        <div class="orderInfo">
          <p><strong>E-mail:</strong><br>${escapeHTML(order.client_email)}</p>
          <p><strong>Pacote:</strong><br>${escapeHTML(order.package_name)}</p>
        </div>

        <div class="orderIdea">
          <p><strong>Ideia do personagem:</strong></p>
          <p>${escapeHTML(order.character_idea)}</p>
        </div>

        <div class="orderActions">
          ${renderStatusButtons(order)}
        </div>

        ${renderDeliveryBox(order)}

        <div class="orderDangerZone">
          <div>
            <strong>Zona de limpeza</strong>
            <span>Use para remover pedidos de teste ou spam. Essa ação é permanente.</span>
          </div>
          ${renderDangerActions(order)}
        </div>
      </article>
    `;
  }).join("");
}

async function loadOrders() {
  loadingBox.style.display = "block";
  loadingBox.textContent = "Carregando pedidos da Forja...";
  ordersList.innerHTML = "";

  const { data, error } = await forjaDB
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);

    loadingBox.style.display = "none";

    ordersList.innerHTML = `
      <div class="errorBox">
        Erro ao carregar pedidos. Verifique as policies de admin no Supabase.
      </div>
    `;

    return;
  }

  ordersCache = data || [];

  updateStats(ordersCache);

  loadingBox.style.display = "none";

  renderOrders();
}

async function saveOrderDelivery(orderId, markDelivered) {
  const urlInput = document.getElementById(`deliveryUrl-${orderId}`);
  const noteInput = document.getElementById(`deliveryNote-${orderId}`);

  if (!urlInput || !noteInput) {
    alert("Campos de entrega não encontrados. Atualize o painel e tente novamente.");
    return;
  }

  const deliveryUrl = urlInput.value.trim();
  const deliveryNote = noteInput.value.trim();

  const updatePayload = {
    delivery_url: deliveryUrl || null,
    delivery_note: deliveryNote || null
  };

  if (markDelivered) {
    updatePayload.status = "entregue";
    updatePayload.payment_status = "pago";
  }

  const { error } = await forjaDB
    .from("orders")
    .update(updatePayload)
    .eq("id", orderId);

  if (error) {
    console.error(error);
    alert("Erro ao salvar entrega. Rode a migration 006 da versão 0.4.0 no Supabase.");
    return;
  }

  await loadOrders();
  alert(markDelivered ? "Entrega salva e pedido marcado como entregue." : "Entrega salva.");
}

async function updateOrderStatus(orderId, newStatus, newPaymentStatus) {
  const { error } = await forjaDB
    .from("orders")
    .update({
      status: newStatus,
      payment_status: newPaymentStatus
    })
    .eq("id", orderId);

  if (error) {
    console.error(error);
    alert("Erro ao atualizar pedido. Verifique se você está logado como admin.");
    return;
  }

  await loadOrders();
}

async function archiveOrder(orderId) {
  const order = ordersCache.find((item) => item.id === orderId);

  if (!order) {
    alert("Pedido não encontrado na lista atual. Atualize o painel e tente de novo.");
    return;
  }

  const confirmArchive = confirm(
    `Arquivar o pedido de ${order.client_name || "cliente sem nome"}?\n\n` +
    "Ele não será excluído. Você ainda poderá encontrá-lo pelo filtro Arquivado."
  );

  if (!confirmArchive) return;

  await updateOrderStatus(orderId, "arquivado", order.payment_status || "não pago");
}

async function deleteOrder(orderId) {
  const order = ordersCache.find((item) => item.id === orderId);

  if (!order) {
    alert("Pedido não encontrado na lista atual. Atualize o painel e tente de novo.");
    return;
  }

  const clientName = order.client_name || "cliente sem nome";
  const packageName = order.package_name || "pacote não informado";

  const firstConfirm = confirm(
    `Excluir permanentemente o pedido de ${clientName} (${packageName})?\n\n` +
    "Use isso apenas para pedidos de teste, spam ou registros que você realmente não quer manter."
  );

  if (!firstConfirm) return;

  const typed = prompt(
    "Para confirmar a exclusão permanente, digite EXCLUIR em letras maiúsculas."
  );

  if (typed !== "EXCLUIR") {
    alert("Exclusão cancelada.");
    return;
  }

  const { error } = await forjaDB
    .from("orders")
    .delete()
    .eq("id", orderId);

  if (error) {
    console.error(error);
    alert("Erro ao excluir pedido. Verifique se a policy de DELETE para admin foi aplicada no Supabase.");
    return;
  }

  ordersCache = ordersCache.filter((item) => item.id !== orderId);
  updateStats(ordersCache);
  renderOrders();

  alert("Pedido excluído da Sala do Criador.");
}

async function deleteAllTestOrders() {
  const testOrders = ordersCache.filter((order) => {
    return String(order.status || "").toLowerCase() === "teste";
  });

  if (testOrders.length === 0) {
    alert("Nenhum pedido com status Teste encontrado.");
    return;
  }

  const firstConfirm = confirm(
    `Excluir permanentemente ${testOrders.length} pedido(s) com status Teste?\n\n` +
    "Use isso apenas para limpar pedidos falsos criados durante testes."
  );

  if (!firstConfirm) return;

  const typed = prompt(
    "Para confirmar a limpeza em massa, digite LIMPAR TESTES em letras maiúsculas."
  );

  if (typed !== "LIMPAR TESTES") {
    alert("Limpeza em massa cancelada.");
    return;
  }

  deleteTestOrdersBtn.disabled = true;
  deleteTestOrdersBtn.textContent = "Limpando...";

  const ids = testOrders.map((order) => order.id);

  const { error } = await forjaDB
    .from("orders")
    .delete()
    .in("id", ids);

  deleteTestOrdersBtn.disabled = false;
  deleteTestOrdersBtn.textContent = "Excluir todos os testes";

  if (error) {
    console.error(error);
    alert("Erro ao limpar pedidos teste. Verifique se a policy de DELETE para admin está ativa.");
    return;
  }

  ordersCache = ordersCache.filter((order) => !ids.includes(order.id));
  updateStats(ordersCache);
  renderOrders();

  alert("Pedidos teste excluídos da Sala do Criador.");
}

function setStatusFilter(status) {
  statusFilter.value = status;
  renderOrders();
}

function clearAdminFilters() {
  searchInput.value = "";
  packageFilter.value = "";
  statusFilter.value = "";
  renderOrders();
}

async function logout() {
  await forjaDB.auth.signOut();
  window.location.href = "login.html";
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

refreshBtn.addEventListener("click", loadOrders);
logoutBtn.addEventListener("click", logout);
searchInput.addEventListener("input", renderOrders);
packageFilter.addEventListener("change", renderOrders);
statusFilter.addEventListener("change", renderOrders);
showTestOrdersBtn.addEventListener("click", () => setStatusFilter("teste"));
showArchivedOrdersBtn.addEventListener("click", () => setStatusFilter("arquivado"));
clearFiltersBtn.addEventListener("click", clearAdminFilters);
deleteTestOrdersBtn.addEventListener("click", deleteAllTestOrders);

const perf = window.forjaPerformance || {};
setInterval(createEmber, perf.emberInterval || 360);

for (let i = 0; i < (perf.initialEmbers || 12); i += 1) {
  createEmber();
}

async function initAdminPanel() {
  const hasAccess = await requireAdminAccess();

  if (!hasAccess) return;

  await loadOrders();
}

initAdminPanel();