const clientOrderSelect = document.getElementById("clientOrderSelect");
const clientChatOrderLabel = document.getElementById("clientChatOrderLabel");
const clientChatTitle = document.getElementById("clientChatTitle");
const clientChatStatus = document.getElementById("clientChatStatus");
const clientMessages = document.getElementById("clientMessages");
const clientChatForm = document.getElementById("clientChatForm");
const clientMessageInput = document.getElementById("clientMessageInput");
const minimizeChatBtn = document.getElementById("minimizeChatBtn");

let clientChatSession = null;
let clientOrders = [];
let selectedOrderId = null;
let clientChatChannel = null;
let clientChatPoll = null;

function setClientChatStatus(message, type = "info") {
  clientChatStatus.textContent = message;
  clientChatStatus.dataset.type = type;
}

async function requireChatLogin() {
  const { data, error } = await forjaDB.auth.getSession();
  if (error || !data.session) {
    window.location.href = "auth.html?next=chat.html";
    return false;
  }
  clientChatSession = data.session;
  return true;
}

function getOrderIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("pedido");
}

function updateClientUrl(orderId) {
  const url = new URL(window.location.href);
  url.searchParams.set("pedido", orderId);
  window.history.replaceState({}, "", url.toString());
}

async function loadClientChatOrders() {
  const { data, error } = await forjaDB
    .from("orders")
    .select("id, package_name, status, created_at, client_name")
    .eq("user_id", clientChatSession.user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;
  clientOrders = data || [];

  if (clientOrders.length === 0) {
    clientOrderSelect.innerHTML = "";
    clientChatTitle.textContent = "Nenhum pedido encontrado";
    setClientChatStatus("Faça um pedido primeiro para abrir uma conversa com a Forja.", "warning");
    clientMessageInput.disabled = true;
    clientChatForm.querySelector("button").disabled = true;
    clientMessages.innerHTML = `<div class="chatStatus">A conversa nasce junto com um pedido.</div>`;
    return;
  }

  clientOrderSelect.innerHTML = clientOrders.map((order) => `
    <option value="${order.id}">${chatEscapeHTML(order.package_name)} • ${chatEscapeHTML(order.status)}</option>
  `).join("");

  const fromUrl = getOrderIdFromUrl();
  const chosen = clientOrders.find((order) => order.id === fromUrl) || clientOrders[0];
  await selectClientOrder(chosen.id);
}

async function selectClientOrder(orderId) {
  selectedOrderId = orderId;
  clientOrderSelect.value = orderId;
  updateClientUrl(orderId);

  const order = clientOrders.find((item) => item.id === orderId);
  clientChatOrderLabel.textContent = order ? `Pedido • ${chatFormatDate(order.created_at)}` : "Pedido selecionado";
  clientChatTitle.textContent = order ? order.package_name : "Conversa da Forja";

  clientMessageInput.disabled = false;
  clientChatForm.querySelector("button").disabled = false;

  await removeChatSubscription(clientChatChannel);
  if (clientChatPoll) clearInterval(clientChatPoll);

  await renderClientConversation();
  clientChatChannel = subscribeToOrderMessages(orderId, renderClientConversation);
  clientChatPoll = setInterval(renderClientConversation, 6500);
}

async function renderClientConversation() {
  if (!selectedOrderId) return;

  try {
    setClientChatStatus("Conversa aberta. Você pode mandar ajustes, dúvidas e detalhes por aqui.");
    const messages = await fetchOrderMessages(selectedOrderId);
    clientMessages.innerHTML = renderChatMessages(messages, "cliente");
    scrollMessagesToBottom(clientMessages);
  } catch (error) {
    console.error(error);
    setClientChatStatus("Não foi possível carregar as mensagens agora.", "error");
  }
}

clientOrderSelect.addEventListener("change", async () => {
  await selectClientOrder(clientOrderSelect.value);
});

clientChatForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!selectedOrderId) return;

  const button = clientChatForm.querySelector("button");
  const message = clientMessageInput.value.trim();
  if (!message) return;

  button.disabled = true;
  button.textContent = "Enviando...";

  const { error } = await sendOrderMessage({
    orderId: selectedOrderId,
    userId: clientChatSession.user.id,
    role: "cliente",
    message
  });

  button.disabled = false;
  button.textContent = "Enviar";

  if (error) {
    console.error(error);
    setClientChatStatus("A mensagem não foi enviada. Tente novamente.", "error");
    return;
  }

  clientMessageInput.value = "";
  await renderClientConversation();
});

minimizeChatBtn.addEventListener("click", () => {
  localStorage.setItem("forjaChatMiniOpen", "true");
  localStorage.setItem("forjaChatMiniOrderId", selectedOrderId || "");
  const fallback = "index.html";
  try {
    const ref = document.referrer ? new URL(document.referrer) : null;
    if (ref && ref.origin === window.location.origin && !ref.pathname.endsWith("chat.html")) {
      window.location.href = ref.href;
      return;
    }
  } catch (error) {
    console.warn("Referência indisponível para minimizar chat.", error);
  }
  window.location.href = fallback;
});

async function initClientChat() {
  const ok = await requireChatLogin();
  if (!ok) return;

  try {
    await loadClientChatOrders();
  } catch (error) {
    console.error(error);
    setClientChatStatus("Não foi possível carregar seus pedidos para o chat.", "error");
  }
}

initClientChat();
