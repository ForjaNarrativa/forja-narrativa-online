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
let adminSupportConversations = [];
let selectedAdminConversation = { type: "", id: null };
let adminChatChannel = null;
let adminGlobalMessagesChannel = null;
let adminGlobalSupportChannel = null;
let adminChatPoll = null;
let adminContactsPoll = null;
let lastMessagesByKey = {};
let unreadCountsByKey = {};
let messageDatesByKey = {};

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

function buildConversationItems() {
  const orderItems = adminChatOrders.map((order) => ({
    type: "order",
    id: order.id,
    key: orderConversationKey(order.id),
    title: order.client_name || "Cliente sem nome",
    subtitle: order.package_name || "Pedido",
    meta: `${order.client_email || "sem e-mail"} • ${order.status || "sem status"}`,
    search: [order.client_name, order.client_email, order.package_name, order.status, order.character_idea].join(" "),
    sort: new Date(messageDatesByKey[orderConversationKey(order.id)] || order.updated_at || order.created_at || 0).getTime(),
    href: `admin.html#pedido-${order.id}`
  }));

  const supportItems = adminSupportConversations.map((conversation) => ({
    type: "support",
    id: conversation.id,
    key: supportConversationKey(conversation.id),
    title: conversation.client_name || conversation.client_email || "Dúvida pré-pedido",
    subtitle: conversation.subject || "Dúvida pré-pedido",
    meta: `${conversation.client_email || "sem e-mail"} • ${conversation.status || "aberta"}`,
    search: [conversation.client_name, conversation.client_email, conversation.subject, conversation.status].join(" "),
    sort: new Date(messageDatesByKey[supportConversationKey(conversation.id)] || conversation.updated_at || conversation.created_at || 0).getTime(),
    href: "admin.html"
  }));

  const term = adminChatSearch.value.trim().toLowerCase();
  return [...supportItems, ...orderItems]
    .filter((item) => !term || item.search.toLowerCase().includes(term))
    .sort((a, b) => b.sort - a.sort);
}

function getLastMessagePreview(key) {
  const last = lastMessagesByKey[key];
  if (!last) return key.startsWith("support:") ? "Dúvida aberta antes do pedido." : "Nenhuma mensagem ainda.";
  const prefix = last.sender_role === "admin" ? "Você: " : "Cliente: ";
  return `${prefix}${last.message}`;
}

function renderContacts() {
  const items = buildConversationItems();

  if (items.length === 0) {
    adminContactsList.innerHTML = `<div class="chatStatus">Nenhuma conversa encontrada.</div>`;
    updateDocumentChatBadge(Object.values(unreadCountsByKey).reduce((sum, count) => sum + Number(count || 0), 0));
    return;
  }

  adminContactsList.innerHTML = items.map((item) => {
    const unread = unreadCountsByKey[item.key] || 0;
    const activeClass = item.key === (selectedAdminConversation.type ? `${selectedAdminConversation.type}:${selectedAdminConversation.id}` : "") ? "active" : "";
    const unreadClass = unread > 0 ? "hasUnread" : "";
    const typeLabel = item.type === "support" ? "Pré-pedido" : "Pedido";
    return `
      <button type="button" class="contactItem ${activeClass} ${unreadClass} ${item.type === "support" ? "preOrderContact" : ""}" data-conversation-key="${item.key}">
        <span class="contactTopLine">
          <strong>${chatEscapeHTML(item.title)}</strong>
          ${createUnreadBadge(unread, "mensagens pendentes")}
        </span>
        <span>${chatEscapeHTML(typeLabel)} • ${chatEscapeHTML(item.subtitle)}</span>
        <small>${chatEscapeHTML(getLastMessagePreview(item.key))}</small>
        <small>${chatFormatDate(messageDatesByKey[item.key] || item.sort)} • ${chatEscapeHTML(item.meta)}</small>
      </button>
    `;
  }).join("");

  adminContactsList.querySelectorAll(".contactItem").forEach((button) => {
    button.addEventListener("click", () => selectAdminConversation(button.dataset.conversationKey));
  });

  const totalUnread = Object.values(unreadCountsByKey).reduce((sum, count) => sum + Number(count || 0), 0);
  updateDocumentChatBadge(totalUnread);
}

async function loadLastMessagePreviews() {
  lastMessagesByKey = {};
  unreadCountsByKey = {};
  messageDatesByKey = {};

  const orderIds = adminChatOrders.map((order) => order.id);
  if (orderIds.length) {
    const { data, error } = await forjaDB
      .from("order_messages")
      .select("order_id, sender_role, message, created_at")
      .in("order_id", orderIds)
      .order("created_at", { ascending: false });

    if (!error) {
      const readStates = await fetchChatReadStates(orderIds, "admin", adminChatUser.id);
      const grouped = {};

      (data || []).forEach((message) => {
        const key = orderConversationKey(message.order_id);
        if (!grouped[message.order_id]) grouped[message.order_id] = [];
        grouped[message.order_id].push(message);
        if (!lastMessagesByKey[key]) {
          lastMessagesByKey[key] = message;
          messageDatesByKey[key] = message.created_at;
        }
      });

      orderIds.forEach((orderId) => {
        unreadCountsByKey[orderConversationKey(orderId)] = countUnreadMessages(grouped[orderId] || [], readStates[orderId], "cliente");
      });
    } else {
      console.warn("Prévia das mensagens de pedido indisponível.", error);
    }
  }

  const supportIds = adminSupportConversations.map((conversation) => conversation.id);
  if (supportIds.length) {
    const { data, error } = await forjaDB
      .from("support_messages")
      .select("conversation_id, sender_role, message, created_at")
      .in("conversation_id", supportIds)
      .order("created_at", { ascending: false });

    if (!error) {
      const readStates = await fetchSupportReadStates(supportIds, "admin", adminChatUser.id);
      const grouped = {};

      (data || []).forEach((message) => {
        const key = supportConversationKey(message.conversation_id);
        if (!grouped[message.conversation_id]) grouped[message.conversation_id] = [];
        grouped[message.conversation_id].push(message);
        if (!lastMessagesByKey[key]) {
          lastMessagesByKey[key] = message;
          messageDatesByKey[key] = message.created_at;
        }
      });

      supportIds.forEach((conversationId) => {
        unreadCountsByKey[supportConversationKey(conversationId)] = countUnreadMessages(grouped[conversationId] || [], readStates[conversationId], "cliente");
      });
    } else {
      console.warn("Prévia das dúvidas pré-pedido indisponível.", error);
    }
  }
}

async function refreshAdminContacts({ keepSelection = true } = {}) {
  const { data: orders, error: ordersError } = await forjaDB
    .from("orders")
    .select("id, client_name, client_email, package_name, character_idea, status, payment_status, created_at, updated_at")
    .order("updated_at", { ascending: false });

  if (ordersError) throw ordersError;
  adminChatOrders = orders || [];

  const { data: support, error: supportError } = await forjaDB
    .from("support_conversations")
    .select("id, user_id, client_name, client_email, subject, status, created_at, updated_at")
    .order("updated_at", { ascending: false });

  if (supportError) {
    console.warn("Atendimentos pré-pedido indisponíveis. Rode a migration 013.", supportError);
    adminSupportConversations = [];
  } else {
    adminSupportConversations = support || [];
  }

  await loadLastMessagePreviews();
  renderContacts();

  if (keepSelection && selectedAdminConversation.id) {
    const exists = buildConversationItems().some((item) => item.key === `${selectedAdminConversation.type}:${selectedAdminConversation.id}`);
    if (!exists) selectedAdminConversation = { type: "", id: null };
  }
}

async function loadAdminChatOrders() {
  adminContactsList.innerHTML = `<div class="chatStatus">Carregando contatos...</div>`;
  await refreshAdminContacts({ keepSelection: false });

  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get("atendimento") ? supportConversationKey(params.get("atendimento")) : (params.get("pedido") ? orderConversationKey(params.get("pedido")) : "");
  const items = buildConversationItems();
  const chosen = items.find((item) => item.key === fromUrl) || items[0];
  if (chosen) await selectAdminConversation(chosen.key);
}

function updateAdminChatUrl(conversation) {
  const url = new URL(window.location.href);
  url.searchParams.delete("pedido");
  url.searchParams.delete("atendimento");
  if (conversation.type === "order") url.searchParams.set("pedido", conversation.id);
  if (conversation.type === "support") url.searchParams.set("atendimento", conversation.id);
  window.history.replaceState({}, "", url.toString());
}

async function selectAdminConversation(value) {
  const parsed = parseConversationKey(value);
  if (!parsed.id) return;

  selectedAdminConversation = parsed;
  updateAdminChatUrl(parsed);

  const item = buildConversationItems().find((conversation) => conversation.key === value);
  if (!item) return;

  adminConversationMeta.textContent = item.meta;
  adminConversationTitle.textContent = `${item.title} — ${item.subtitle}`;
  adminOpenOrderLink.href = item.href;
  adminOpenOrderLink.textContent = parsed.type === "order" ? "Ver pedido" : "Ver painel";
  adminMessageInput.disabled = false;
  adminChatForm.querySelector("button").disabled = false;

  await removeChatSubscription(adminChatChannel);
  if (adminChatPoll) clearInterval(adminChatPoll);

  if (parsed.type === "order") {
    await markChatOrderRead(parsed.id, "admin", adminChatUser.id);
    adminChatChannel = subscribeToOrderMessages(parsed.id, async () => {
      await renderAdminConversation({ markRead: true });
      await refreshAdminContacts({ keepSelection: true });
    });
  } else {
    await markSupportChatRead(parsed.id, "admin", adminChatUser.id);
    adminChatChannel = subscribeToSupportMessages(parsed.id, async () => {
      await renderAdminConversation({ markRead: true });
      await refreshAdminContacts({ keepSelection: true });
    });
  }

  await refreshAdminContacts({ keepSelection: true });
  await renderAdminConversation({ markRead: true });
  adminChatPoll = setInterval(() => renderAdminConversation({ markRead: true }), 6500);
}

async function renderAdminConversation({ markRead = false } = {}) {
  if (!selectedAdminConversation.id) return;

  try {
    if (selectedAdminConversation.type === "order") {
      setAdminChatStatus("Conversa de pedido aberta. Responda como Forja Narrativa.");
      const messages = await fetchOrderMessages(selectedAdminConversation.id);
      adminMessages.innerHTML = renderChatMessages(messages, "admin");
      if (markRead) {
        await markChatOrderRead(selectedAdminConversation.id, "admin", adminChatUser.id);
        unreadCountsByKey[orderConversationKey(selectedAdminConversation.id)] = 0;
      }
    } else {
      setAdminChatStatus("Dúvida pré-pedido aberta. Ajude a pessoa a escolher o melhor caminho.");
      const messages = await fetchSupportMessages(selectedAdminConversation.id);
      adminMessages.innerHTML = renderChatMessages(messages, "admin");
      if (markRead) {
        await markSupportChatRead(selectedAdminConversation.id, "admin", adminChatUser.id);
        unreadCountsByKey[supportConversationKey(selectedAdminConversation.id)] = 0;
      }
    }

    scrollMessagesToBottom(adminMessages);
    renderContacts();
  } catch (error) {
    console.error(error);
    setAdminChatStatus("Não foi possível carregar as mensagens dessa conversa.", "error");
  }
}

function startAdminGlobalNotifications() {
  if (!forjaDB.channel) return;

  if (!adminGlobalMessagesChannel) {
    adminGlobalMessagesChannel = forjaDB
      .channel("forja-admin-all-order-messages")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "order_messages" }, async (payload) => {
        await refreshAdminContacts({ keepSelection: true });
        if (selectedAdminConversation.type === "order" && payload?.new?.order_id === selectedAdminConversation.id) {
          await renderAdminConversation({ markRead: true });
        }
      })
      .subscribe();
  }

  if (!adminGlobalSupportChannel) {
    adminGlobalSupportChannel = forjaDB
      .channel("forja-admin-all-support-messages")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "support_messages" }, async (payload) => {
        await refreshAdminContacts({ keepSelection: true });
        if (selectedAdminConversation.type === "support" && payload?.new?.conversation_id === selectedAdminConversation.id) {
          await renderAdminConversation({ markRead: true });
        }
      })
      .subscribe();
  }
}

adminChatSearch.addEventListener("input", renderContacts);

adminChatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!selectedAdminConversation.id) return;

  const button = adminChatForm.querySelector("button");
  const message = adminMessageInput.value.trim();
  if (!message) return;

  button.disabled = true;
  button.textContent = "Enviando...";

  const result = selectedAdminConversation.type === "order"
    ? await sendOrderMessage({ orderId: selectedAdminConversation.id, userId: adminChatUser.id, role: "admin", message })
    : await sendSupportMessage({ conversationId: selectedAdminConversation.id, userId: adminChatUser.id, role: "admin", message });

  button.disabled = false;
  button.textContent = "Enviar";

  if (result.error) {
    console.error(result.error);
    setAdminChatStatus("A resposta não foi enviada. Confira as policies do Supabase.", "error");
    return;
  }

  adminMessageInput.value = "";
  await renderAdminConversation({ markRead: true });
  await refreshAdminContacts({ keepSelection: true });
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
    startAdminGlobalNotifications();
    if (adminContactsPoll) clearInterval(adminContactsPoll);
    adminContactsPoll = setInterval(() => refreshAdminContacts({ keepSelection: true }), 9000);
  } catch (error) {
    console.error(error);
    adminContactsList.innerHTML = `<div class="chatStatus">Erro ao carregar contatos.</div>`;
  }
}

initAdminChat();
