(function initForjaChatWidget() {
  const blockedPages = ["auth.html", "login.html", "admin.html", "chat-admin.html", "chat.html"];
  const currentPage = window.location.pathname.split("/").pop() || "index.html";
  if (blockedPages.includes(currentPage)) return;
  if (!window.forjaDB) return;

  const OWNER_EMAILS = ["forjanarrativa5790@gmail.com"];
  let session = null;
  let order = null;
  let poll = null;
  let channel = null;

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
      <button type="button" class="forjaChatBubble" id="forjaChatBubble" aria-label="Abrir chat da Forja">✦</button>
    `;
    document.body.appendChild(root);
    return root;
  }

  async function loadLatestOrder(preferredOrderId = "") {
    let query = forjaDB
      .from("orders")
      .select("id, package_name, status, created_at")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });

    const { data, error } = await query;
    if (error || !data || data.length === 0) return null;

    return data.find((item) => item.id === preferredOrderId) || data[0];
  }

  async function refreshMiniMessages() {
    if (!order) return;
    const miniMessages = document.getElementById("miniMessages");
    const miniStatus = document.getElementById("miniChatStatus");
    const miniFullLink = document.getElementById("miniFullLink");
    const miniLabel = document.getElementById("miniChatOrderLabel");

    try {
      miniLabel.textContent = order.package_name || "Pedido";
      miniFullLink.href = `chat.html?pedido=${order.id}`;
      miniStatus.textContent = "Chat aberto. Você pode continuar navegando.";
      const messages = await fetchOrderMessages(order.id);
      miniMessages.innerHTML = renderChatMessages(messages.slice(-8), "cliente");
      scrollMessagesToBottom(miniMessages);
    } catch (error) {
      console.warn("Chat minimizado indisponível.", error);
      miniStatus.textContent = "Não foi possível carregar o chat agora.";
    }
  }

  async function openMiniPanel() {
    const panel = document.getElementById("forjaChatMiniPanel");
    panel.classList.add("open");
    localStorage.setItem("forjaChatMiniOpen", "true");

    if (!order) {
      order = await loadLatestOrder(localStorage.getItem("forjaChatMiniOrderId") || "");
    }

    if (!order) {
      document.getElementById("miniChatStatus").textContent = "Faça um pedido primeiro para iniciar uma conversa.";
      document.getElementById("miniMessages").innerHTML = "";
      return;
    }

    await refreshMiniMessages();
    if (poll) clearInterval(poll);
    poll = setInterval(refreshMiniMessages, 7000);

    await removeChatSubscription(channel);
    channel = subscribeToOrderMessages(order.id, refreshMiniMessages);
  }

  async function closeMiniPanel() {
    const panel = document.getElementById("forjaChatMiniPanel");
    panel.classList.remove("open");
    localStorage.setItem("forjaChatMiniOpen", "false");
    if (poll) clearInterval(poll);
    await removeChatSubscription(channel);
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
      if (!order) return;
      const input = document.getElementById("miniChatInput");
      const message = input.value.trim();
      if (!message) return;

      const { data: sentMessage, error } = await sendOrderMessage({
        orderId: order.id,
        userId: session.user.id,
        role: "cliente",
        message
      });

      if (!error) {
        if (window.notifyForjaDiscord) {
          window.notifyForjaDiscord("client_message", {
            orderId: order.id,
            messageId: sentMessage?.id,
            messagePreview: message
          });
        }
        input.value = "";
        await refreshMiniMessages();
      }
    });

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
