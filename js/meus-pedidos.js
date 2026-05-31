const clientOrdersLoading = document.getElementById("clientOrdersLoading");
const clientOrdersList = document.getElementById("clientOrdersList");
const embers = document.getElementById("embers");

let currentSession = null;

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

        <div class="clientOrderFuture">
          <div>
            <span>Mensagens do pedido</span>
            <strong>${order.message_count ? escapeHTML(order.message_count) : "Em preparação"}</strong>
          </div>
          <div>
            <span>Entrega final</span>
            ${order.delivery_url ? `<a href="${escapeHTML(order.delivery_url)}" target="_blank" rel="noopener">Abrir entrega</a>` : `<strong>Será exibida aqui futuramente</strong>`}
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

  renderOrders(data || []);
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