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

async function fetchChatReadStates(orderIds, readerRole, userId) {
  if (!orderIds || orderIds.length === 0 || !userId) return {};

  try {
    const { data, error } = await forjaDB
      .from("order_chat_reads")
      .select("order_id, last_read_at")
      .in("order_id", orderIds)
      .eq("reader_role", readerRole)
      .eq("user_id", userId);

    if (error) {
      console.warn("Leitura do chat indisponível. Rode a migration 012.", error);
      return {};
    }

    return (data || []).reduce((acc, item) => {
      acc[item.order_id] = item.last_read_at;
      return acc;
    }, {});
  } catch (error) {
    console.warn("Falha ao buscar leituras do chat.", error);
    return {};
  }
}

async function markChatOrderRead(orderId, readerRole, userId) {
  if (!orderId || !readerRole || !userId) return;

  try {
    const { error } = await forjaDB
      .from("order_chat_reads")
      .upsert(
        {
          order_id: orderId,
          user_id: userId,
          reader_role: readerRole,
          last_read_at: new Date().toISOString()
        },
        { onConflict: "order_id,user_id,reader_role" }
      );

    if (error) console.warn("Não foi possível marcar conversa como lida.", error);
  } catch (error) {
    console.warn("Falha ao marcar conversa como lida.", error);
  }
}

function countUnreadMessages(messages, lastReadAt, oppositeRole) {
  const lastReadTime = lastReadAt ? new Date(lastReadAt).getTime() : 0;
  return (messages || []).filter((message) => {
    if (message.sender_role !== oppositeRole) return false;
    return new Date(message.created_at).getTime() > lastReadTime;
  }).length;
}

function createUnreadBadge(count, label = "mensagens não lidas") {
  const total = Number(count || 0);
  if (total <= 0) return "";
  const safeTotal = total > 99 ? "99+" : String(total);
  return `<span class="chatUnreadBadge" aria-label="${safeTotal} ${chatEscapeHTML(label)}">${safeTotal}</span>`;
}

function updateDocumentChatBadge(count) {
  const total = Number(count || 0);
  const baseTitle = document.title.replace(/^\(\d+\)\s*/, "");
  document.title = total > 0 ? `(${total}) ${baseTitle}` : baseTitle;
}


/* Forja 0.5.4 — Chat aberto pré-pedido */
function supportConversationKey(conversationId) {
  return `support:${conversationId}`;
}

function orderConversationKey(orderId) {
  return `order:${orderId}`;
}

function parseConversationKey(value) {
  const [type, ...rest] = String(value || "").split(":");
  return { type, id: rest.join(":") };
}

async function fetchOrCreateSupportConversation(user) {
  if (!user?.id) throw new Error("Usuário não encontrado para conversa de suporte.");

  const email = user.email || "";
  const { data: existing, error: existingError } = await forjaDB
    .from("support_conversations")
    .select("*")
    .eq("user_id", user.id)
    .neq("status", "fechada")
    .order("updated_at", { ascending: false })
    .limit(1);

  if (existingError) throw existingError;
  if (existing && existing[0]) return existing[0];

  const { data: profile } = await forjaDB
    .from("profiles")
    .select("display_name")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data, error } = await forjaDB
    .from("support_conversations")
    .insert({
      user_id: user.id,
      client_email: email,
      client_name: profile?.display_name || email || "Cliente",
      subject: "Dúvida pré-pedido",
      status: "aberta"
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

async function fetchSupportMessages(conversationId) {
  const { data, error } = await forjaDB
    .from("support_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data || [];
}

async function sendSupportMessage({ conversationId, userId, role, message }) {
  const cleanMessage = String(message || "").trim();
  if (!cleanMessage) return { data: null, error: null };

  return forjaDB
    .from("support_messages")
    .insert({
      conversation_id: conversationId,
      user_id: userId,
      sender_role: role,
      message: cleanMessage
    })
    .select("*")
    .single();
}

function subscribeToSupportMessages(conversationId, onChange) {
  if (!conversationId || !forjaDB.channel) return null;

  return forjaDB
    .channel(`forja-support-messages-${conversationId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "support_messages",
        filter: `conversation_id=eq.${conversationId}`
      },
      () => onChange()
    )
    .subscribe();
}

async function fetchSupportReadStates(conversationIds, readerRole, userId) {
  if (!conversationIds || conversationIds.length === 0 || !userId) return {};

  try {
    const { data, error } = await forjaDB
      .from("support_chat_reads")
      .select("conversation_id, last_read_at")
      .in("conversation_id", conversationIds)
      .eq("reader_role", readerRole)
      .eq("user_id", userId);

    if (error) {
      console.warn("Leitura do atendimento indisponível. Rode a migration 013.", error);
      return {};
    }

    return (data || []).reduce((acc, item) => {
      acc[item.conversation_id] = item.last_read_at;
      return acc;
    }, {});
  } catch (error) {
    console.warn("Falha ao buscar leituras do atendimento.", error);
    return {};
  }
}

async function markSupportChatRead(conversationId, readerRole, userId) {
  if (!conversationId || !readerRole || !userId) return;

  try {
    const { error } = await forjaDB
      .from("support_chat_reads")
      .upsert(
        {
          conversation_id: conversationId,
          user_id: userId,
          reader_role: readerRole,
          last_read_at: new Date().toISOString()
        },
        { onConflict: "conversation_id,user_id,reader_role" }
      );

    if (error) console.warn("Não foi possível marcar atendimento como lido.", error);
  } catch (error) {
    console.warn("Falha ao marcar atendimento como lido.", error);
  }
}
