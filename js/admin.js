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
let orderEventsCache = {};
let currentUser = null;

const OWNER_ADMIN_EMAILS = ["forjanarrativa5790@gmail.com"];

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isOwnerAdminEmail(email) {
  return OWNER_ADMIN_EMAILS.includes(normalizeEmail(email));
}

function ensureAdminUiLayer() {
  let toastRoot = document.getElementById("forjaToastRoot");
  if (!toastRoot) {
    toastRoot = document.createElement("div");
    toastRoot.id = "forjaToastRoot";
    toastRoot.className = "forjaToastRoot";
    toastRoot.setAttribute("aria-live", "polite");
    document.body.appendChild(toastRoot);
  }

  let modalRoot = document.getElementById("forjaModalRoot");
  if (!modalRoot) {
    modalRoot = document.createElement("div");
    modalRoot.id = "forjaModalRoot";
    document.body.appendChild(modalRoot);
  }

  return { toastRoot, modalRoot };
}

function showAdminToast(message, type = "info", details = "") {
  const { toastRoot } = ensureAdminUiLayer();
  const toast = document.createElement("div");
  toast.className = `forjaToast ${type}`;

  const labels = {
    success: "feito",
    error: "atenção",
    warning: "aviso",
    info: "forja"
  };

  toast.innerHTML = `
    <span>${labels[type] || labels.info}</span>
    <strong>${escapeHTML(message)}</strong>
    ${details ? `<p>${escapeHTML(details)}</p>` : ""}
    <button type="button" aria-label="Fechar aviso">×</button>
  `;

  const close = () => {
    toast.classList.add("leaving");
    setTimeout(() => toast.remove(), 180);
  };

  toast.querySelector("button").addEventListener("click", close);
  toastRoot.appendChild(toast);
  setTimeout(close, type === "error" ? 6500 : 4200);
}

function showAdminDialog({ title, message, confirmLabel = "Confirmar", cancelLabel = "Cancelar", danger = false, expectedText = null }) {
  const { modalRoot } = ensureAdminUiLayer();

  return new Promise((resolve) => {
    modalRoot.innerHTML = `
      <div class="forjaModalBackdrop" role="presentation">
        <section class="forjaModal" role="dialog" aria-modal="true" aria-labelledby="forjaModalTitle">
          <span class="forjaModalTag">Sala do Criador</span>
          <h2 id="forjaModalTitle">${escapeHTML(title)}</h2>
          <p>${escapeHTML(message)}</p>
          ${expectedText ? `
            <label class="forjaModalInputLabel">
              Digite <strong>${escapeHTML(expectedText)}</strong> para continuar
              <input id="forjaModalInput" type="text" autocomplete="off" />
            </label>
          ` : ""}
          <div class="forjaModalActions">
            <button type="button" class="modalCancel">${escapeHTML(cancelLabel)}</button>
            <button type="button" class="modalConfirm ${danger ? "danger" : ""}">${escapeHTML(confirmLabel)}</button>
          </div>
        </section>
      </div>
    `;

    const backdrop = modalRoot.querySelector(".forjaModalBackdrop");
    const cancelBtn = modalRoot.querySelector(".modalCancel");
    const confirmBtn = modalRoot.querySelector(".modalConfirm");
    const input = modalRoot.querySelector("#forjaModalInput");

    function close(value) {
      backdrop.classList.add("leaving");
      setTimeout(() => {
        modalRoot.innerHTML = "";
        resolve(value);
      }, 160);
    }

    cancelBtn.addEventListener("click", () => close(false));
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) close(false);
    });

    confirmBtn.addEventListener("click", () => {
      if (expectedText && String(input.value || "").trim() !== expectedText) {
        input.focus();
        input.classList.add("inputShake");
        showAdminToast("Confirmação incorreta.", "warning", `Digite ${expectedText} exatamente como aparece.`);
        setTimeout(() => input.classList.remove("inputShake"), 260);
        return;
      }
      close(true);
    });

    window.addEventListener("keydown", function handleKeydown(event) {
      if (!document.getElementById("forjaModalRoot")?.innerHTML) {
        window.removeEventListener("keydown", handleKeydown);
        return;
      }
      if (event.key === "Escape") {
        window.removeEventListener("keydown", handleKeydown);
        close(false);
      }
    });

    if (input) input.focus();
    else confirmBtn.focus();
  });
}

function setButtonBusy(button, isBusy, busyText = "Salvando...") {
  if (!button) return;

  if (isBusy) {
    button.dataset.originalText = button.textContent;
    button.disabled = true;
    button.textContent = busyText;
  } else {
    button.disabled = false;
    button.textContent = button.dataset.originalText || button.textContent;
  }
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


function getActorLabel(event) {
  if (!event) return "Forja";
  if (String(event.actor_role || "").toLowerCase() === "admin") return "Sala do Criador";
  if (String(event.actor_role || "").toLowerCase() === "cliente") return "Cliente";
  return "Forja";
}

function getEventTitle(event) {
  const type = String(event.event_type || "").toLowerCase();

  if (type === "created") return "Pedido criado";
  if (type === "status_changed") return "Status atualizado";
  if (type === "delivery_saved") return "Entrega salva";
  if (type === "delivery_sent") return "Entrega final enviada";
  if (type === "note") return "Nota registrada";

  return "Movimento registrado";
}

function renderOrderTimeline(order) {
  const events = orderEventsCache[order.id] || [];

  const fallbackEvents = [
    {
      event_type: "created",
      created_at: order.created_at,
      actor_role: "cliente",
      note: "Pedido recebido pela Forja."
    }
  ];

  const timeline = events.length ? events : fallbackEvents;

  return `
    <div class="orderTimelineBox">
      <div class="timelineHeader">
        <strong>Linha do tempo</strong>
        <span>${events.length ? `${events.length} registro(s)` : "registro inicial"}</span>
      </div>

      <div class="timelineList">
        ${timeline.slice(0, 5).map((event) => `
          <div class="timelineItem">
            <span class="timelineDot"></span>
            <div>
              <strong>${escapeHTML(getEventTitle(event))}</strong>
              <small>${escapeHTML(getActorLabel(event))} • ${formatDate(event.created_at)}</small>
              ${event.old_status || event.new_status ? `
                <p>${escapeHTML(event.old_status || "—")} → ${escapeHTML(event.new_status || "—")}</p>
              ` : ""}
              ${event.note ? `<p>${escapeHTML(event.note)}</p>` : ""}
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

async function loadOrderEvents(orderIds) {
  orderEventsCache = {};

  if (!orderIds || orderIds.length === 0) return;

  try {
    const { data, error } = await forjaDB
      .from("order_events")
      .select("*")
      .in("order_id", orderIds)
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("Histórico de pedidos indisponível.", error);
      return;
    }

    (data || []).forEach((event) => {
      if (!orderEventsCache[event.order_id]) orderEventsCache[event.order_id] = [];
      orderEventsCache[event.order_id].push(event);
    });
  } catch (error) {
    console.warn("Histórico de pedidos ainda não está ativo.", error);
  }
}

async function logOrderEvent(orderId, eventType, payload = {}) {
  if (!orderId) return;

  try {
    const { error } = await forjaDB
      .from("order_events")
      .insert({
        order_id: orderId,
        actor_id: currentUser?.id || null,
        actor_email: currentUser?.email || null,
        actor_role: "admin",
        event_type: eventType,
        old_status: payload.old_status || null,
        new_status: payload.new_status || null,
        old_payment_status: payload.old_payment_status || null,
        new_payment_status: payload.new_payment_status || null,
        note: payload.note || null
      });

    if (error) {
      console.warn("Não foi possível registrar histórico do pedido.", error);
    }
  } catch (error) {
    console.warn("Histórico de pedidos ainda não está disponível.", error);
  }
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
    showAdminToast("Acesso negado.", "error", "Esta sala é reservada para administradores da Forja.");
    setTimeout(() => {
      window.location.href = "index.html";
    }, 1400);
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
    const isActive = String(order.status || "").toLowerCase() === preset.status.toLowerCase();
    return `<button class="${isActive ? "activeStatus" : ""}" onclick="updateOrderStatus('${order.id}', '${preset.status}', '${payment}')">${preset.label}</button>`;
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
        <button type="button" onclick="saveOrderDelivery('${order.id}', false, this)">Salvar entrega</button>
        <button type="button" onclick="saveOrderDelivery('${order.id}', true, this)">Salvar e marcar entregue</button>
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
      <article class="orderCard" data-status="${escapeHTML(order.status)}">
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

        ${renderOrderTimeline(order)}

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

    showAdminToast("Erro ao carregar pedidos.", "error", error.message || "Revise as policies de admin no Supabase.");
    return;
  }

  ordersCache = data || [];
  await loadOrderEvents(ordersCache.map((order) => order.id));

  updateStats(ordersCache);

  loadingBox.style.display = "none";

  renderOrders();
}

async function saveOrderDelivery(orderId, markDelivered, triggerButton = null) {
  const oldOrder = ordersCache.find((item) => item.id === orderId);
  const urlInput = document.getElementById(`deliveryUrl-${orderId}`);
  const noteInput = document.getElementById(`deliveryNote-${orderId}`);

  if (!urlInput || !noteInput) {
    showAdminToast("Campos de entrega não encontrados.", "error", "Atualize o painel e tente novamente.");
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

  setButtonBusy(triggerButton, true, markDelivered ? "Entregando..." : "Salvando...");

  const { error } = await forjaDB
    .from("orders")
    .update(updatePayload)
    .eq("id", orderId);

  setButtonBusy(triggerButton, false);

  if (error) {
    console.error(error);
    showAdminToast("Erro ao salvar entrega.", "error", error.message || "Confira se as migrations 006 e 007 foram rodadas no Supabase.");
    return;
  }

  await logOrderEvent(orderId, markDelivered ? "delivery_sent" : "delivery_saved", {
    old_status: oldOrder?.status || null,
    new_status: markDelivered ? "entregue" : oldOrder?.status || null,
    old_payment_status: oldOrder?.payment_status || null,
    new_payment_status: markDelivered ? "pago" : oldOrder?.payment_status || null,
    note: deliveryNote || (deliveryUrl ? "Link de entrega atualizado." : "Entrega atualizada.")
  });

  await loadOrders();
  showAdminToast(markDelivered ? "Entrega salva e pedido marcado como entregue." : "Entrega salva.", "success");
}

async function updateOrderStatus(orderId, newStatus, newPaymentStatus) {
  const oldOrder = ordersCache.find((item) => item.id === orderId);

  const { error } = await forjaDB
    .from("orders")
    .update({
      status: newStatus,
      payment_status: newPaymentStatus
    })
    .eq("id", orderId);

  if (error) {
    console.error(error);
    showAdminToast("Erro ao atualizar pedido.", "error", error.message || "Verifique se você está logado como admin.");
    return;
  }

  await logOrderEvent(orderId, "status_changed", {
    old_status: oldOrder?.status || null,
    new_status: newStatus,
    old_payment_status: oldOrder?.payment_status || null,
    new_payment_status: newPaymentStatus || null,
    note: `Status atualizado pela Sala do Criador.`
  });

  await loadOrders();
  showAdminToast(`Pedido movido para: ${newStatus}.`, "success");
}

async function archiveOrder(orderId) {
  const order = ordersCache.find((item) => item.id === orderId);

  if (!order) {
    showAdminToast("Pedido não encontrado.", "error", "Atualize o painel e tente novamente.");
    return;
  }

  const confirmArchive = await showAdminDialog({
    title: "Arquivar pedido?",
    message: `Arquivar o pedido de ${order.client_name || "cliente sem nome"}? Ele não será excluído e poderá ser restaurado depois.`,
    confirmLabel: "Arquivar"
  });

  if (!confirmArchive) return;

  await updateOrderStatus(orderId, "arquivado", order.payment_status || "não pago");
}

async function deleteOrder(orderId) {
  const order = ordersCache.find((item) => item.id === orderId);

  if (!order) {
    showAdminToast("Pedido não encontrado.", "error", "Atualize o painel e tente novamente.");
    return;
  }

  const clientName = order.client_name || "cliente sem nome";
  const packageName = order.package_name || "pacote não informado";

  const confirmed = await showAdminDialog({
    title: "Excluir pedido permanentemente?",
    message: `Pedido de ${clientName} (${packageName}). Use isso apenas para testes, spam ou registros que não devem ficar no banco.`,
    confirmLabel: "Excluir pedido",
    danger: true,
    expectedText: "EXCLUIR"
  });

  if (!confirmed) return;

  const { error } = await forjaDB
    .from("orders")
    .delete()
    .eq("id", orderId);

  if (error) {
    console.error(error);
    showAdminToast("Erro ao excluir pedido.", "error", error.message || "Verifique se a policy de DELETE para admin está ativa.");
    return;
  }

  ordersCache = ordersCache.filter((item) => item.id !== orderId);
  updateStats(ordersCache);
  renderOrders();

  showAdminToast("Pedido excluído da Sala do Criador.", "success");
}

async function deleteAllTestOrders() {
  const testOrders = ordersCache.filter((order) => {
    return String(order.status || "").toLowerCase() === "teste";
  });

  if (testOrders.length === 0) {
    showAdminToast("Nenhum pedido teste encontrado.", "info");
    return;
  }

  const confirmed = await showAdminDialog({
    title: "Limpar pedidos teste?",
    message: `Excluir permanentemente ${testOrders.length} pedido(s) com status Teste? Use isso apenas para limpar registros falsos.`,
    confirmLabel: "Limpar testes",
    danger: true,
    expectedText: "LIMPAR TESTES"
  });

  if (!confirmed) return;

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
    showAdminToast("Erro ao limpar pedidos teste.", "error", error.message || "Verifique se a policy de DELETE para admin está ativa.");
    return;
  }

  ordersCache = ordersCache.filter((order) => !ids.includes(order.id));
  updateStats(ordersCache);
  renderOrders();

  showAdminToast("Pedidos teste excluídos da Sala do Criador.", "success");
}

function setStatusFilter(status) {
  statusFilter.value = status;
  renderOrders();
  showAdminToast(status ? `Filtro aplicado: ${status}.` : "Filtro limpo.", "info");
}

function clearAdminFilters() {
  searchInput.value = "";
  packageFilter.value = "";
  statusFilter.value = "";
  renderOrders();
  showAdminToast("Filtros limpos.", "info");
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

refreshBtn.addEventListener("click", async () => {
  await loadOrders();
  showAdminToast("Painel atualizado.", "success");
});
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
  ensureAdminUiLayer();
  const hasAccess = await requireAdminAccess();

  if (!hasAccess) return;

  await loadOrders();
  showAdminToast("Sala do Criador pronta.", "success", "Pedidos carregados com segurança.");
}

initAdminPanel();
