(function initForjaChatWidget() {
  const blockedPages = ["auth.html", "login.html", "admin.html", "chat-admin.html", "chat.html"];
  const currentPage = window.location.pathname.split("/").pop() || "index.html";
  if (blockedPages.includes(currentPage)) return;
  if (!window.forjaDB) return;

  const OWNER_EMAILS = ["forjanarrativa5790@gmail.com"];
  let session = null;
  let conversation = { type: "support", id: null };
  let supportConversation = null;
  let orders = [];
  let unreadCounts = {};
  let supportUnread = 0;
  let poll = null;
  let channel = null;
  let globalOrderChannel = null;
  let globalSupportChannel = null;

  function isOwner(email) {
    return OWNER_EMAILS.includes(String(email || "").trim().toLowerCase());
  }

  async function isAdmin(user) {
    if (!user) return false;
    if (isOwner(user.email)) return true;
    try {
      const { data, error } = await forjaDB.rpc("is_forja_admin");
      return !error && data === true;
    } catch (error) {
      return false;
    }
  }

  function buildWidget() {
    const root = document.createElement("div");
    root.className = "forjaChatWidget";
    root.innerHTML = `
      <section class="forjaChatMiniPanel" id="forjaChatMiniPanel" aria-label="Chat minimizado da Forja">
        <div class="miniChatHeader">
          <div>
            <strong>Forja Narrativa</strong>
            <span id="miniChatOrderLabel">Conversa minimizada</span>
          </div>
          <button type="button" id="miniChatClose" aria-label="Fechar chat">×</button>
        </div>
        <div id="miniChatStatus" class="miniChatStatus">Preparando conversa...</div>
        <div id="miniMessages" class="miniMessages" aria-live="polite"></div>
        <form id="miniChatForm" class="miniChatComposer">
          <input id="miniChatInput" type="text" placeholder="Mensagem rápida..." />
          <button type="submit">Enviar</button>
          <a id="miniFullLink" class="miniFullLink" href="chat.html">Abrir página inteira</a>
        </form>
      </section>
      <button type="button" class="forjaChatBubble" id="forjaChatBubble" aria-label="Abrir chat da Forja">
        ✦ <span id="forjaChatBubbleBadge" class="chatUnreadBadge widgetBadge" hidden>0</span>
      </button>
    `;
    document.body.appendChild(root);
    return root;
  }

  async function loadOrders() {
    const { data, error } = await forjaDB
      .from("orders")
      .select("id, package_name, status, created_at, updated_at")
      .eq("user_id", session.user.id)
      .order("updated_at", { ascending: false });

    if (error || !data) return [];
    return data;
  }

  async function ensureSupport() {
    if (!supportConversation) supportConversation = await fetchOrCreateSupportConversation(session.user);
    return supportConversation;
  }

  async function refreshUnreadCounts() {
    orders = await loadOrders();
    supportConversation = await ensureSupport();
    unreadCounts = {};
    supportUnread = 0;

    if (orders.length) {
      const orderIds = orders.map((item) => item.id);
      const { data } = await forjaDB
        .from("order_messages")
        .select("order_id, sender_role, created_at")
        .in("order_id", orderIds)
        .order("created_at", { ascending: false });

      const readStates = await fetchChatReadStates(orderIds, "cliente", session.user.id);
      const grouped = {};
      (data || []).forEach((message) => {
        if (!grouped[message.order_id]) grouped[message.order_id] = [];
        grouped[message.order_id].push(message);
      });
      orderIds.forEach((orderId) => {
        unreadCounts[orderId] = countUnreadMessages(grouped[orderId] || [], readStates[orderId], "admin");
      });
    }

    if (supportConversation?.id) {
      const messages = await fetchSupportMessages(supportConversation.id).catch(() => []);
      const readStates = await fetchSupportReadStates([supportConversation.id], "cliente", session.user.id);
      supportUnread = countUnreadMessages(messages, readStates[supportConversation.id], "admin");
    }

    const total = Object.values(unreadCounts).reduce((sum, count) => sum + Number(count || 0), 0) + supportUnread;
    updateBubbleBadge(total);
  }

  function updateBubbleBadge(count) {
    const badge = document.getElementById("forjaChatBubbleBadge");
    if (!badge) return;
    const total = Number(count || 0);
    badge.hidden = total <= 0;
    badge.textContent = total > 99 ? "99+" : String(total);
    document.getElementById("forjaChatBubble")?.classList.toggle("hasUnread", total > 0);
  }

  async function chooseConversation(preferredKey = "") {
    await ensureSupport();
    if (!orders.length) orders = await loadOrders();

    const parsed = parseConversationKey(preferredKey);
    if (parsed.type === "order" && orders.some((item) => item.id === parsed.id)) return parsed;
    if (parsed.type === "support" && parsed.id === supportConversation.id) return parsed;

    return { type: "support", id: supportConversation.id };
  }

  async function refreshMiniMessages({ markRead = true } = {}) {
    if (!conversation.id) return;
    const miniMessages = document.getElementById("miniMessages");
    const miniStatus = document.getElementById("miniChatStatus");
    const miniFullLink = document.getElementById("miniFullLink");
    const miniLabel = document.getElementById("miniChatOrderLabel");

    try {
      if (conversation.type === "order") {
        const order = orders.find((item) => item.id === conversation.id);
        miniLabel.textContent = order?.package_name || "Pedido";
        miniFullLink.href = `chat.html?pedido=${conversation.id}`;
        miniStatus.textContent = "Chat de pedido aberto. Você pode continuar navegando.";
        const messages = await fetchOrderMessages(conversation.id);
        miniMessages.innerHTML = renderChatMessages(messages.slice(-8), "cliente");
        if (markRead) await markChatOrderRead(conversation.id, "cliente", session.user.id);
      } else {
        miniLabel.textContent = "Dúvidas com a Forja";
        miniFullLink.href = `chat.html?atendimento=${conversation.id}`;
        miniStatus.textContent = "Atendimento aberto. Tire dúvidas antes de comprar.";
        const messages = await fetchSupportMessages(conversation.id);
        miniMessages.innerHTML = renderChatMessages(messages.slice(-8), "cliente");
        if (markRead) await markSupportChatRead(conversation.id, "cliente", session.user.id);
      }
      scrollMessagesToBottom(miniMessages);
      await refreshUnreadCounts();
    } catch (error) {
      console.warn("Chat minimizado indisponível.", error);
      miniStatus.textContent = "Não foi possível carregar o chat agora.";
    }
  }

  async function openMiniPanel() {
    const panel = document.getElementById("forjaChatMiniPanel");
    panel.classList.add("open");
    localStorage.setItem("forjaChatMiniOpen", "true");

    conversation = await chooseConversation(localStorage.getItem("forjaChatMiniConversation") || "");
    localStorage.setItem("forjaChatMiniConversation", `${conversation.type}:${conversation.id}`);

    await refreshMiniMessages({ markRead: true });
    if (poll) clearInterval(poll);
    poll = setInterval(() => refreshMiniMessages({ markRead: true }), 7000);

    await removeChatSubscription(channel);
    channel = conversation.type === "order"
      ? subscribeToOrderMessages(conversation.id, () => refreshMiniMessages({ markRead: true }))
      : subscribeToSupportMessages(conversation.id, () => refreshMiniMessages({ markRead: true }));
  }

  async function closeMiniPanel() {
    const panel = document.getElementById("forjaChatMiniPanel");
    panel.classList.remove("open");
    localStorage.setItem("forjaChatMiniOpen", "false");
    if (poll) clearInterval(poll);
    await removeChatSubscription(channel);
  }

  function startGlobalWatch() {
    if (!forjaDB.channel) return;

    if (!globalOrderChannel) {
      globalOrderChannel = forjaDB.channel("forja-widget-order-chat-global")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "order_messages" }, refreshUnreadCounts)
        .subscribe();
    }

    if (!globalSupportChannel) {
      globalSupportChannel = forjaDB.channel("forja-widget-support-chat-global")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "support_messages" }, refreshUnreadCounts)
        .subscribe();
    }
  }

  async function start() {
    const { data } = await forjaDB.auth.getSession();
    if (!data.session) return;
    session = data.session;
    if (await isAdmin(session.user)) return;

    buildWidget();

    document.getElementById("forjaChatBubble").addEventListener("click", openMiniPanel);
    document.getElementById("miniChatClose").addEventListener("click", closeMiniPanel);

    document.getElementById("miniChatForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const input = document.getElementById("miniChatInput");
      const message = input.value.trim();
      if (!message) return;

      if (!conversation.id) conversation = await chooseConversation(localStorage.getItem("forjaChatMiniConversation") || "");

      const result = conversation.type === "order"
        ? await sendOrderMessage({ orderId: conversation.id, userId: session.user.id, role: "cliente", message })
        : await sendSupportMessage({ conversationId: conversation.id, userId: session.user.id, role: "cliente", message });

      if (!result.error) {
        if (window.notifyForjaDiscord) {
          window.notifyForjaDiscord("client_message", {
            orderId: conversation.id,
            packageName: conversation.type === "order" ? "Pedido da Forja" : "Dúvida pré-pedido",
            messageId: result.data?.id,
            messagePreview: message
          });
        }
        input.value = "";
        await refreshMiniMessages({ markRead: true });
      }
    });

    await refreshUnreadCounts();
    startGlobalWatch();
    setInterval(refreshUnreadCounts, 10000);

    if (localStorage.getItem("forjaChatMiniOpen") === "true") {
      openMiniPanel();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
