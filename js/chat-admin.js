const adminContactsList = document.getElementById("adminContactsList");
const adminChatSearch = document.getElementById("adminChatSearch");
const adminConversationMeta = document.getElementById("adminConversationMeta");
const adminConversationTitle = document.getElementById("adminConversationTitle");
const adminOpenOrderLink = document.getElementById("adminOpenOrderLink");
const adminChatStatus = document.getElementById("adminChatStatus");
const adminMessages = document.getElementById("adminMessages");
const adminChatForm = document.getElementById("adminChatForm");
const adminMessageInput = document.getElementById("adminMessageInput");
const adminChatLogoutBtn = document.getElementById("adminChatLogoutBtn");

const ADMIN_CHAT_OWNER_EMAILS = ["forjanarrativa5790@gmail.com"];

let adminChatUser = null;
let adminChatOrders = [];
let selectedAdminOrderId = null;
let adminChatChannel = null;
let adminChatPoll = null;
let lastMessagesByOrder = {};

function normalizeAdminChatEmail(email) {
  return String(email || "").trim().toLowerCase();
}

async function isAdminChatUser(user) {
  if (!user) return false;
  if (ADMIN_CHAT_OWNER_EMAILS.includes(normalizeAdminChatEmail(user.email))) return true;

  try {
    const { data, error } = await forjaDB.rpc("is_forja_admin");
    return !error && data === true;
  } catch (error) {
    console.warn("Falha ao verificar admin do chat.", error);
    return false;
  }
}

function setAdminChatStatus(message, type = "info") {
  adminChatStatus.textContent = message;
  adminChatStatus.dataset.type = type;
}

async function requireAdminChatAccess() {
  const { data, error } = await forjaDB.auth.getSession();
  if (error || !data.session) {
    window.location.href = "login.html";
    return false;
  }

  const allowed = await isAdminChatUser(data.session.user);
  if (!allowed) {
    await forjaDB.auth.signOut();
    window.location.href = "login.html";
    return false;
  }

  adminChatUser = data.session.user;
  return true;
}

function contactMatchesSearch(order) {
  const term = adminChatSearch.value.trim().toLowerCase();
  if (!term) return true;

  return [
    order.client_name,
    order.client_email,
    order.package_name,
    order.status,
    order.character_idea
  ].some((value) => String(value || "").toLowerCase().includes(term));
}

function getLastMessagePreview(orderId) {
  const last = lastMessagesByOrder[orderId];
  if (!last) return "Nenhuma mensagem ainda.";
  const prefix = last.sender_role === "admin" ? "Você: " : "Cliente: ";
  return `${prefix}${last.message}`;
}

function renderContacts() {
  const visibleOrders = adminChatOrders.filter(contactMatchesSearch);

  if (visibleOrders.length === 0) {
    adminContactsList.innerHTML = `<div class="chatStatus">Nenhum contato encontrado.</div>`;
    return;
  }

  adminContactsList.innerHTML = visibleOrders.map((order) => `
    <button type="button" class="contactItem ${order.id === selectedAdminOrderId ? "active" : ""}" data-order-id="${order.id}">
      <strong>${chatEscapeHTML(order.client_name || "Cliente sem nome")}</strong>
      <span>${chatEscapeHTML(order.package_name || "Pedido")}</span>
      <small>${chatEscapeHTML(getLastMessagePreview(order.id))}</small>
      <small>${chatFormatDate(order.created_at)} • ${chatEscapeHTML(order.status || "sem status")}</small>
    </button>
  `).join("");

  adminContactsList.querySelectorAll(".contactItem").forEach((button) => {
    button.addEventListener("click", () => selectAdminOrder(button.dataset.orderId));
  });
}

async function loadLastMessagePreviews(orderIds) {
  lastMessagesByOrder = {};
  if (!orderIds.length) return;

  const { data, error } = await forjaDB
    .from("order_messages")
    .select("order_id, sender_role, message, created_at")
    .in("order_id", orderIds)
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("Prévia das mensagens indisponível.", error);
    return;
  }

  (data || []).forEach((message) => {
    if (!lastMessagesByOrder[message.order_id]) lastMessagesByOrder[message.order_id] = message;
  });
}

async function loadAdminChatOrders() {
  adminContactsList.innerHTML = `<div class="chatStatus">Carregando contatos...</div>`;

  const { data, error } = await forjaDB
    .from("orders")
    .select("id, client_name, client_email, package_name, character_idea, status, payment_status, created_at")
    .order("updated_at", { ascending: false });

  if (error) throw error;

  adminChatOrders = data || [];
  await loadLastMessagePreviews(adminChatOrders.map((order) => order.id));
  renderContacts();

  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get("pedido");
  const chosen = adminChatOrders.find((order) => order.id === fromUrl) || adminChatOrders[0];
  if (chosen) await selectAdminOrder(chosen.id);
}

function updateAdminChatUrl(orderId) {
  const url = new URL(window.location.href);
  url.searchParams.set("pedido", orderId);
  window.history.replaceState({}, "", url.toString());
}

async function selectAdminOrder(orderId) {
  selectedAdminOrderId = orderId;
  updateAdminChatUrl(orderId);
  renderContacts();

  const order = adminChatOrders.find((item) => item.id === orderId);
  if (!order) return;

  adminConversationMeta.textContent = `${order.client_email || "sem e-mail"} • ${order.status || "sem status"}`;
  adminConversationTitle.textContent = `${order.client_name || "Cliente"} — ${order.package_name || "Pedido"}`;
  adminOpenOrderLink.href = `admin.html#pedido-${order.id}`;
  adminMessageInput.disabled = false;
  adminChatForm.querySelector("button").disabled = false;

  await removeChatSubscription(adminChatChannel);
  if (adminChatPoll) clearInterval(adminChatPoll);

  await renderAdminConversation();
  adminChatChannel = subscribeToOrderMessages(orderId, async () => {
    await renderAdminConversation();
    await loadLastMessagePreviews(adminChatOrders.map((item) => item.id));
    renderContacts();
  });
  adminChatPoll = setInterval(renderAdminConversation, 6500);
}

async function renderAdminConversation() {
  if (!selectedAdminOrderId) return;

  try {
    setAdminChatStatus("Conversa aberta. Responda como Forja Narrativa.");
    const messages = await fetchOrderMessages(selectedAdminOrderId);
    adminMessages.innerHTML = renderChatMessages(messages, "admin");
    scrollMessagesToBottom(adminMessages);
  } catch (error) {
    console.error(error);
    setAdminChatStatus("Não foi possível carregar as mensagens dessa conversa.", "error");
  }
}

adminChatSearch.addEventListener("input", renderContacts);

adminChatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!selectedAdminOrderId) return;

  const button = adminChatForm.querySelector("button");
  const message = adminMessageInput.value.trim();
  if (!message) return;

  button.disabled = true;
  button.textContent = "Enviando...";

  const { error } = await sendOrderMessage({
    orderId: selectedAdminOrderId,
    userId: adminChatUser.id,
    role: "admin",
    message
  });

  button.disabled = false;
  button.textContent = "Enviar";

  if (error) {
    console.error(error);
    setAdminChatStatus("A resposta não foi enviada. Confira as policies do Supabase.", "error");
    return;
  }

  adminMessageInput.value = "";
  await renderAdminConversation();
  await loadLastMessagePreviews(adminChatOrders.map((order) => order.id));
  renderContacts();
});

adminChatLogoutBtn.addEventListener("click", async () => {
  await forjaDB.auth.signOut();
  window.location.href = "index.html";
});

async function initAdminChat() {
  const allowed = await requireAdminChatAccess();
  if (!allowed) return;

  try {
    await loadAdminChatOrders();
  } catch (error) {
    console.error(error);
    adminContactsList.innerHTML = `<div class="chatStatus">Erro ao carregar contatos.</div>`;
  }
}

initAdminChat();
