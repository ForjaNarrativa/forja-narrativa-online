const clientOrdersLoading = document.getElementById("clientOrdersLoading");
const clientOrdersList = document.getElementById("clientOrdersList");
const embers = document.getElementById("embers");

let currentSession = null;
let orderEventsCache = {};

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


function getEventTitle(event) {
  const type = String(event.event_type || "").toLowerCase();

  if (type === "created") return "Pedido criado";
  if (type === "status_changed") return "Status atualizado";
  if (type === "delivery_saved") return "Entrega preparada";
  if (type === "delivery_sent") return "Entrega final enviada";
  if (type === "note") return "Nota da Forja";

  return "Movimento registrado";
}

function getActorLabel(event) {
  const role = String(event.actor_role || "").toLowerCase();
  if (role === "admin") return "Forja Narrativa";
  if (role === "cliente") return "Você";
  return "Forja";
}

function renderClientTimeline(order) {
  const events = orderEventsCache[order.id] || [];
  const timeline = events.length ? events : [
    {
      event_type: "created",
      created_at: order.created_at,
      actor_role: "cliente",
      note: "Sua faísca chegou até a Forja."
    }
  ];

  return `
    <div class="clientTimelineBox">
      <div class="clientTimelineHeader">
        <strong>Linha do tempo</strong>
        <span>${events.length ? `${events.length} registro(s)` : "início do pedido"}</span>
      </div>

      <div class="clientTimelineList">
        ${timeline.slice(0, 5).map((event) => `
          <div class="clientTimelineItem">
            <span class="clientTimelineDot"></span>
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


function getOrderStage(status) {
  const normalized = String(status || "").toLowerCase();

  if (normalized.includes("cancelado")) return -1;
  if (normalized.includes("teste")) return 0;
  if (normalized.includes("entregue")) return 4;
  if (normalized.includes("revisão")) return 3;
  if (normalized.includes("produção")) return 3;
  if (normalized.includes("resposta")) return 2;
  if (normalized.includes("pagamento")) return 1;
  return 0;
}

function renderOrderProgress(order) {
  const stage = getOrderStage(order.status);
  const steps = ["Análise", "Pagamento", "Produção", "Revisão", "Entrega"];

  if (stage < 0) {
    return `
      <div class="clientOrderProgress cancelled">
        <span>Pedido cancelado</span>
        <p>Esse pedido foi encerrado. Caso tenha dúvida, entre em contato com a Forja.</p>
      </div>
    `;
  }

  return `
    <div class="clientOrderProgress" aria-label="Progresso do pedido">
      ${steps.map((step, index) => `
        <span class="${index <= stage ? "done" : ""}">${step}</span>
      `).join("")}
    </div>
  `;
}

function getNextStep(status, paymentStatus) {
  const normalizedStatus = String(status || "").toLowerCase();
  const normalizedPayment = String(paymentStatus || "").toLowerCase();

  if (normalizedStatus.includes("cancelado")) return "Pedido cancelado";
  if (normalizedStatus.includes("arquivado")) return "Pedido arquivado";
  if (normalizedStatus.includes("teste")) return "Pedido de teste";
  if (normalizedStatus.includes("entregue")) return "Pedido entregue";
  if (normalizedStatus.includes("revisão")) return "Revisão solicitada";
  if (normalizedStatus.includes("resposta")) return "Responder a Forja quando o chat estiver ativo";
  if (normalizedStatus.includes("produção")) return "Aguardar finalização da criação";
  if (normalizedStatus.includes("pagamento")) return "Realizar pagamento conforme combinado";
  if (normalizedPayment.includes("não pago")) return "Aguardar instruções de pagamento";

  return "Aguardar contato da Forja";
}

async function requireClientLogin() {
  const { data } = await forjaDB.auth.getSession();

  if (!data.session) {
    window.location.href = "auth.html?next=meus-pedidos.html";
    return false;
  }

  currentSession = data.session;
  return true;
}

function renderOrders(orders) {
  if (!orders || orders.length === 0) {
    clientOrdersList.innerHTML = `
      <div class="emptyClientOrders">
        <p>Você ainda não tem pedidos na Forja.</p>
        <a class="newOrderLink" href="cliente.html">Fazer meu primeiro pedido</a>
      </div>
    `;
    return;
  }

  clientOrdersList.innerHTML = orders.map((order) => {
    return `
      <article class="clientOrderCard">
        <div class="clientOrderTop">
          <div>
            <h3>${escapeHTML(order.package_name)}</h3>
            <span>${formatDate(order.created_at)}</span>
          </div>

          <div class="clientOrderBadges">
            <span class="clientOrderBadge status">${escapeHTML(order.status)}</span>
            <span class="clientOrderBadge payment">${escapeHTML(order.payment_status)}</span>
          </div>
        </div>

        ${renderOrderProgress(order)}

        ${renderClientTimeline(order)}

        <div class="clientOrderGrid">
          <div>
            <span>Código interno</span>
            <strong>${escapeHTML(order.order_code || "Sem código")}</strong>
          </div>

          <div>
            <span>Próximo passo</span>
            <strong>${escapeHTML(getNextStep(order.status, order.payment_status))}</strong>
          </div>

          <div>
            <span>Nome de contato</span>
            <strong>${escapeHTML(order.client_name)}</strong>
          </div>

          <div>
            <span>E-mail</span>
            <strong>${escapeHTML(order.client_email)}</strong>
          </div>
        </div>

        <div class="clientOrderIdea">
          <span>Ideia enviada</span>
          <p>${escapeHTML(order.character_idea)}</p>
        </div>

        <div class="clientOrderChatCall">
          <div>
            <span>Chat do pedido</span>
            <strong>Converse diretamente com a Forja sobre essa criação.</strong>
          </div>
          <a href="chat.html?pedido=${order.id}">Abrir conversa</a>
        </div>

        <div class="clientOrderFuture">
          <div>
            <span>Mensagens do pedido</span>
            <strong>${order.message_count ? escapeHTML(order.message_count) : "Em preparação"}</strong>
          </div>
          <div>
            <span>Entrega final</span>
            ${order.delivery_url ? `<a class="deliveryLink" href="${escapeHTML(order.delivery_url)}" target="_blank" rel="noopener">Abrir entrega final</a>` : `<strong>A entrega aparecerá aqui quando estiver pronta</strong>`}
            ${order.delivery_note ? `<p class="deliveryNote">${escapeHTML(order.delivery_note)}</p>` : ""}
          </div>
        </div>
      </article>
    `;
  }).join("");
}

async function loadClientOrders() {
  clientOrdersLoading.style.display = "block";
  clientOrdersLoading.textContent = "Carregando seus pedidos...";
  clientOrdersList.innerHTML = "";

  const { data, error } = await forjaDB
    .from("orders")
    .select("*")
    .eq("user_id", currentSession.user.id)
    .order("created_at", { ascending: false });

  clientOrdersLoading.style.display = "none";

  if (error) {
    console.error(error);
    clientOrdersList.innerHTML = `
      <div class="emptyClientOrders">
        Erro ao carregar seus pedidos.
      </div>
    `;
    return;
  }

  const orders = data || [];
  await loadOrderEvents(orders.map((order) => order.id));

  renderOrders(orders);
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

const perf = window.forjaPerformance || {};
setInterval(createEmber, perf.emberInterval || 360);
for (let i = 0; i < (perf.initialEmbers || 12); i += 1) createEmber();

async function initClientOrdersPage() {
  const hasLogin = await requireClientLogin();

  if (!hasLogin) return;

  await loadClientOrders();
}

initClientOrdersPage();