function chatEscapeHTML(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function chatFormatDate(value) {
  if (!value) return "agora";
  return new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

function chatSenderLabel(message) {
  return message.sender_role === "admin" ? "Forja Narrativa" : "Cliente";
}

function renderChatMessages(messages, currentRole) {
  if (!messages || messages.length === 0) {
    return `
      <div class="chatStatus">
        Nenhuma mensagem ainda. Envie a primeira faísca dessa conversa.
      </div>
    `;
  }

  return messages.map((message) => {
    const mine = message.sender_role === currentRole;
    return `
      <article class="messageBubble ${mine ? "mine" : "theirs"}">
        <strong>${chatEscapeHTML(chatSenderLabel(message))}</strong>
        <p>${chatEscapeHTML(message.message)}</p>
        <time>${chatFormatDate(message.created_at)}</time>
      </article>
    `;
  }).join("");
}

function scrollMessagesToBottom(container) {
  if (!container) return;
  requestAnimationFrame(() => {
    container.scrollTop = container.scrollHeight;
  });
}

async function fetchOrderMessages(orderId) {
  const { data, error } = await forjaDB
    .from("order_messages")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data || [];
}

async function sendOrderMessage({ orderId, userId, role, message }) {
  const cleanMessage = String(message || "").trim();
  if (!cleanMessage) return { data: null, error: null };

  return forjaDB
    .from("order_messages")
    .insert({
      order_id: orderId,
      user_id: userId,
      sender_role: role,
      message: cleanMessage
    })
    .select("*")
    .single();
}

function subscribeToOrderMessages(orderId, onChange) {
  if (!orderId || !forjaDB.channel) return null;

  const channel = forjaDB
    .channel(`forja-order-messages-${orderId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "order_messages",
        filter: `order_id=eq.${orderId}`
      },
      () => onChange()
    )
    .subscribe();

  return channel;
}

async function removeChatSubscription(channel) {
  if (!channel || !forjaDB.removeChannel) return;
  try {
    await forjaDB.removeChannel(channel);
  } catch (error) {
    console.warn("Não foi possível remover canal antigo do chat.", error);
  }
}
