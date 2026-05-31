const ordersList = document.getElementById("ordersList");
const loadingBox = document.getElementById("loadingBox");
const refreshBtn = document.getElementById("refreshBtn");
const logoutBtn = document.getElementById("logoutBtn");
const searchInput = document.getElementById("searchInput");
const packageFilter = document.getElementById("packageFilter");

const totalOrders = document.getElementById("totalOrders");
const waitingOrders = document.getElementById("waitingOrders");
const unpaidOrders = document.getElementById("unpaidOrders");

const embers = document.getElementById("embers");

let ordersCache = [];
let currentUser = null;

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

async function requireAdminAccess() {
  loadingBox.style.display = "block";
  loadingBox.textContent = "Verificando acesso ao Painel da Forja...";

  const { data: sessionData } = await forjaDB.auth.getSession();

  if (!sessionData.session) {
    window.location.href = "login.html";
    return false;
  }

  currentUser = sessionData.session.user;

  const { data, error } = await forjaDB
    .from("admin_users")
    .select("user_id")
    .eq("user_id", currentUser.id)
    .single();

  if (error || !data) {
    console.error(error);

    await forjaDB.auth.signOut();

    alert("Acesso negado. Este usuário não é administrador da Forja.");
    window.location.href = "login.html";
    return false;
  }

  return true;
}

function updateStats(orders) {
  totalOrders.textContent = orders.length;

  waitingOrders.textContent = orders.filter((order) => {
    return String(order.status || "").toLowerCase().includes("aguardando");
  }).length;

  unpaidOrders.textContent = orders.filter((order) => {
    return String(order.payment_status || "").toLowerCase().includes("não pago");
  }).length;
}

function renderOrders() {
  const searchTerm = searchInput.value.trim().toLowerCase();
  const packageTerm = packageFilter.value.trim().toLowerCase();

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
          <button onclick="updateOrderStatus('${order.id}', 'aguardando análise', '${order.payment_status}')">
            Análise
          </button>

          <button onclick="updateOrderStatus('${order.id}', 'aguardando pagamento', '${order.payment_status}')">
            Aguardando pagamento
          </button>

          <button onclick="updateOrderStatus('${order.id}', 'em produção', 'pago')">
            Pago / Produção
          </button>

          <button onclick="updateOrderStatus('${order.id}', 'entregue', 'pago')">
            Entregue
          </button>
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

async function logout() {
  await forjaDB.auth.signOut();
  window.location.href = "login.html";
}

function createEmber() {
  if (!embers) return;

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

setInterval(createEmber, 300);

for (let i = 0; i < 20; i++) {
  createEmber();
}

async function initAdminPanel() {
  const hasAccess = await requireAdminAccess();

  if (!hasAccess) return;

  await loadOrders();
}

initAdminPanel();