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
let supportConversation = null;
let selectedConversation = { type: "support", id: null };
let clientChatChannel = null;
let clientGlobalMessagesChannel = null;
let clientGlobalSupportChannel = null;
let clientChatPoll = null;
let clientUnreadCounts = {};
let clientLastMessages = {};
let clientMessageDates = {};
let supportUnreadCount = 0;
let supportLastMessage = null;
let supportLastMessageDate = null;

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

function getConversationFromUrl() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("atendimento")) return supportConversationKey(params.get("atendimento"));
  if (params.get("pedido")) return orderConversationKey(params.get("pedido"));
  return "";
}

function updateClientUrl(conversation) {
  const url = new URL(window.location.href);
  url.searchParams.delete("pedido");
  url.searchParams.delete("atendimento");
  if (conversation.type === "order") url.searchParams.set("pedido", conversation.id);
  if (conversation.type === "support") url.searchParams.set("atendimento", conversation.id);
  window.history.replaceState({}, "", url.toString());
}

async function loadClientMessageStats(orderIds) {
  clientUnreadCounts = {};
  clientLastMessages = {};
  clientMessageDates = {};
  supportUnreadCount = 0;
  supportLastMessage = null;
  supportLastMessageDate = supportConversation?.updated_at || supportConversation?.created_at || null;

  if (orderIds.length) {
    const { data, error } = await forjaDB
      .from("order_messages")
      .select("order_id, sender_role, message, created_at")
      .in("order_id", orderIds)
      .order("created_at", { ascending: false });

    if (!error) {
      const readStates = await fetchChatReadStates(orderIds, "cliente", clientChatSession.user.id);
      const grouped = {};

      (data || []).forEach((message) => {
        if (!grouped[message.order_id]) grouped[message.order_id] = [];
        grouped[message.order_id].push(message);
        if (!clientLastMessages[message.order_id]) {
          clientLastMessages[message.order_id] = message;
          clientMessageDates[message.order_id] = message.created_at;
        }
      });

      orderIds.forEach((orderId) => {
        clientUnreadCounts[orderId] = countUnreadMessages(grouped[orderId] || [], readStates[orderId], "admin");
      });
    } else {
      console.warn("Prévia do chat do cliente indisponível.", error);
    }
  }

  if (supportConversation?.id) {
    try {
      const messages = await fetchSupportMessages(supportConversation.id);
      supportLastMessage = messages[messages.length - 1] || null;
      supportLastMessageDate = supportLastMessage?.created_at || supportConversation.updated_at || supportConversation.created_at;
      const readStates = await fetchSupportReadStates([supportConversation.id], "cliente", clientChatSession.user.id);
      supportUnreadCount = countUnreadMessages(messages, readStates[supportConversation.id], "admin");
    } catch (error) {
      console.warn("Prévia do atendimento indisponível.", error);
    }
  }
}

function getClientOrderSortDate(order) {
  return new Date(clientMessageDates[order.id] || order.updated_at || order.created_at || 0).getTime();
}

function getSupportSortDate() {
  return new Date(supportLastMessageDate || supportConversation?.updated_at || supportConversation?.created_at || 0).getTime();
}

function renderClientOrderSelect() {
  const entries = [];

  if (supportConversation?.id) {
    entries.push({
      key: supportConversationKey(supportConversation.id),
      sort: getSupportSortDate(),
      label: `Dúvidas com a Forja${supportUnreadCount > 0 ? ` • ${supportUnreadCount} nova${supportUnreadCount > 1 ? "s" : ""}` : ""}`
    });
  }

  clientOrders.forEach((order) => {
    const unread = clientUnreadCounts[order.id] || 0;
    entries.push({
      key: orderConversationKey(order.id),
      sort: getClientOrderSortDate(order),
      label: `${order.package_name} • ${order.status}${unread > 0 ? ` • ${unread} nova${unread > 1 ? "s" : ""}` : ""}`
    });
  });

  entries.sort((a, b) => b.sort - a.sort);
  clientOrderSelect.innerHTML = entries.map((entry) => `<option value="${entry.key}">${chatEscapeHTML(entry.label)}</option>`).join("");

  const selectedKey = selectedConversation.type === "order" ? orderConversationKey(selectedConversation.id) : supportConversationKey(selectedConversation.id);
  if (selectedKey) clientOrderSelect.value = selectedKey;

  const totalUnread = Object.values(clientUnreadCounts).reduce((sum, count) => sum + Number(count || 0), 0) + supportUnreadCount;
  updateDocumentChatBadge(totalUnread);
}

async function refreshClientConversations({ keepSelection = true } = {}) {
  supportConversation = await fetchOrCreateSupportConversation(clientChatSession.user);

  const { data, error } = await forjaDB
    .from("orders")
    .select("id, package_name, status, created_at, updated_at, client_name")
    .eq("user_id", clientChatSession.user.id)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  clientOrders = data || [];
  await loadClientMessageStats(clientOrders.map((order) => order.id));
  renderClientOrderSelect();

  if (keepSelection && selectedConversation.type === "order" && !clientOrders.some((order) => order.id === selectedConversation.id)) {
    selectedConversation = { type: "support", id: supportConversation.id };
  }
}

async function loadClientChatOrders() {
  await refreshClientConversations({ keepSelection: false });

  const fromUrlKey = getConversationFromUrl();
  const parsed = parseConversationKey(fromUrlKey);
  const hasOrder = parsed.type === "order" && clientOrders.some((order) => order.id === parsed.id);
  const hasSupport = parsed.type === "support" && parsed.id === supportConversation?.id;

  if (hasOrder || hasSupport) {
    await selectClientConversation(fromUrlKey);
    return;
  }

  await selectClientConversation(supportConversationKey(supportConversation.id));
}

async function selectClientConversation(value) {
  const parsed = parseConversationKey(value);
  if (!parsed.id) return;

  selectedConversation = parsed;
  clientOrderSelect.value = value;
  updateClientUrl(parsed);

  clientMessageInput.disabled = false;
  clientChatForm.querySelector("button").disabled = false;

  await removeChatSubscription(clientChatChannel);
  if (clientChatPoll) clearInterval(clientChatPoll);

  if (parsed.type === "order") {
    const order = clientOrders.find((item) => item.id === parsed.id);
    clientChatOrderLabel.textContent = order ? `Pedido • ${chatFormatDate(order.created_at)}` : "Pedido selecionado";
    clientChatTitle.textContent = order ? order.package_name : "Conversa da Forja";
    await markChatOrderRead(parsed.id, "cliente", clientChatSession.user.id);
    clientChatChannel = subscribeToOrderMessages(parsed.id, () => renderClientConversation({ markRead: true }));
  } else {
    clientChatOrderLabel.textContent = "Atendimento aberto";
    clientChatTitle.textContent = "Dúvidas com a Forja";
    await markSupportChatRead(parsed.id, "cliente", clientChatSession.user.id);
    clientChatChannel = subscribeToSupportMessages(parsed.id, () => renderClientConversation({ markRead: true }));
  }

  await loadClientMessageStats(clientOrders.map((item) => item.id));
  renderClientOrderSelect();
  await renderClientConversation({ markRead: true });
  clientChatPoll = setInterval(() => renderClientConversation({ markRead: true }), 6500);
}

async function renderClientConversation({ markRead = false } = {}) {
  if (!selectedConversation.id) return;

  try {
    if (selectedConversation.type === "order") {
      setClientChatStatus("Conversa do pedido aberta. Você pode mandar ajustes, dúvidas e detalhes por aqui.");
      const messages = await fetchOrderMessages(selectedConversation.id);
      clientMessages.innerHTML = renderChatMessages(messages, "cliente");
      if (markRead) {
        await markChatOrderRead(selectedConversation.id, "cliente", clientChatSession.user.id);
        clientUnreadCounts[selectedConversation.id] = 0;
      }
    } else {
      setClientChatStatus("Atendimento aberto. Tire dúvidas antes de comprar ou peça ajuda para escolher um pacote.");
      const messages = await fetchSupportMessages(selectedConversation.id);
      clientMessages.innerHTML = renderChatMessages(messages, "cliente");
      if (markRead) {
        await markSupportChatRead(selectedConversation.id, "cliente", clientChatSession.user.id);
        supportUnreadCount = 0;
      }
    }

    scrollMessagesToBottom(clientMessages);
    renderClientOrderSelect();
  } catch (error) {
    console.error(error);
    setClientChatStatus("Não foi possível carregar as mensagens agora.", "error");
  }
}

function startClientGlobalNotifications() {
  if (!forjaDB.channel) return;

  if (!clientGlobalMessagesChannel) {
    clientGlobalMessagesChannel = forjaDB
      .channel("forja-client-order-chat-messages")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "order_messages" }, async (payload) => {
        const belongsToClient = clientOrders.some((order) => order.id === payload?.new?.order_id);
        if (!belongsToClient) return;
        await refreshClientConversations({ keepSelection: true });
        if (selectedConversation.type === "order" && payload?.new?.order_id === selectedConversation.id) {
          await renderClientConversation({ markRead: true });
        }
      })
      .subscribe();
  }

  if (!clientGlobalSupportChannel && supportConversation?.id) {
    clientGlobalSupportChannel = forjaDB
      .channel("forja-client-support-chat-messages")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "support_messages", filter: `conversation_id=eq.${supportConversation.id}` }, async () => {
        await refreshClientConversations({ keepSelection: true });
        if (selectedConversation.type === "support") await renderClientConversation({ markRead: true });
      })
      .subscribe();
  }
}

clientOrderSelect.addEventListener("change", async () => {
  await selectClientConversation(clientOrderSelect.value);
});

clientChatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!selectedConversation.id) return;

  const button = clientChatForm.querySelector("button");
  const message = clientMessageInput.value.trim();
  if (!message) return;

  button.disabled = true;
  button.textContent = "Enviando...";

  let result;
  if (selectedConversation.type === "order") {
    result = await sendOrderMessage({ orderId: selectedConversation.id, userId: clientChatSession.user.id, role: "cliente", message });
  } else {
    result = await sendSupportMessage({ conversationId: selectedConversation.id, userId: clientChatSession.user.id, role: "cliente", message });
  }

  button.disabled = false;
  button.textContent = "Enviar";

  if (result.error) {
    console.error(result.error);
    setClientChatStatus("A mensagem não foi enviada. Tente novamente.", "error");
    return;
  }

  if (window.notifyForjaDiscord) {
    window.notifyForjaDiscord("client_message", {
      orderId: selectedConversation.id,
      packageName: selectedConversation.type === "order" ? "Pedido da Forja" : "Dúvida pré-pedido",
      messageId: result.data?.id,
      messagePreview: message
    });
  }

  clientMessageInput.value = "";
  await renderClientConversation({ markRead: true });
  await refreshClientConversations({ keepSelection: true });
});

minimizeChatBtn.addEventListener("click", () => {
  localStorage.setItem("forjaChatMiniOpen", "true");
  localStorage.setItem("forjaChatMiniConversation", selectedConversation.type === "order" ? orderConversationKey(selectedConversation.id) : supportConversationKey(selectedConversation.id));
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
    startClientGlobalNotifications();
    setInterval(() => refreshClientConversations({ keepSelection: true }), 9000);
  } catch (error) {
    console.error(error);
    setClientChatStatus("Não foi possível carregar o chat da Forja.", "error");
  }
}

initClientChat();
