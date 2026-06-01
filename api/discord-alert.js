const MAX_DISCORD_CONTENT = 1800;

function json(res, statusCode, body) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function clean(value, fallback = "—") {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text || fallback;
}

function clip(value, limit = 220) {
  const text = clean(value, "");
  if (!text) return "—";
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - 1)}…`;
}

async function readBody(req) {
  return await new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 40_000) {
        reject(new Error("Payload muito grande."));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

async function verifySupabaseUser(accessToken) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    throw new Error("SUPABASE_URL ou SUPABASE_ANON_KEY ausente nas variáveis da Vercel.");
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) return null;
  return await response.json();
}

function buildDiscordMessage(type, payload, user) {
  const siteUrl = clean(process.env.FORJA_SITE_URL || payload.siteUrl || "https://forja-narrativa-online.vercel.app");
  const email = clean(user?.email || payload.email);
  const clientName = clean(payload.clientName || payload.name || payload.nome || email, "Cliente");
  const packageName = clean(payload.packageName || payload.package || payload.pacote, "Não informado");
  const orderId = clean(payload.orderId || payload.order_id || payload.id, "Sem ID");
  const messagePreview = clip(payload.messagePreview || payload.message || payload.text || "", 300);

  if (type === "new_order") {
    return {
      username: "Sinos da Forja",
      avatar_url: "https://cdn-icons-png.flaticon.com/512/3176/3176272.png",
      embeds: [
        {
          title: "🔥 Novo pedido recebido",
          color: 0xd8a83f,
          description: "Uma nova faísca entrou na Forja Narrativa.",
          fields: [
            { name: "Cliente", value: clientName, inline: true },
            { name: "E-mail", value: email, inline: true },
            { name: "Pacote", value: packageName, inline: false },
            { name: "Ideia", value: clip(payload.idea || payload.ideia || payload.description || payload.descricao, 500), inline: false },
            { name: "Abrir painel", value: `${siteUrl}/admin.html`, inline: false }
          ],
          footer: { text: `Pedido: ${orderId}` },
          timestamp: new Date().toISOString()
        }
      ]
    };
  }

  if (type === "client_message") {
    return {
      username: "Sinos da Forja",
      avatar_url: "https://cdn-icons-png.flaticon.com/512/3176/3176272.png",
      embeds: [
        {
          title: "💬 Nova mensagem no chat",
          color: 0x7c4dff,
          description: "Um cliente mandou uma mensagem para a Forja.",
          fields: [
            { name: "Cliente", value: clientName, inline: true },
            { name: "E-mail", value: email, inline: true },
            { name: "Pacote/Pedido", value: packageName, inline: false },
            { name: "Mensagem", value: messagePreview, inline: false },
            { name: "Abrir chat admin", value: `${siteUrl}/chat-admin.html`, inline: false }
          ],
          footer: { text: `Pedido: ${orderId}` },
          timestamp: new Date().toISOString()
        }
      ]
    };
  }

  return {
    username: "Sinos da Forja",
    content: `🔔 Evento da Forja: ${clean(type)}\nCliente: ${clientName}\nE-mail: ${email}`.slice(0, MAX_DISCORD_CONTENT)
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, { error: "Método não permitido." });
  }

  try {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) {
      return json(res, 500, { error: "DISCORD_WEBHOOK_URL não configurado na Vercel." });
    }

    const authorization = req.headers.authorization || "";
    const accessToken = authorization.replace(/^Bearer\s+/i, "").trim();
    if (!accessToken) {
      return json(res, 401, { error: "Sessão ausente." });
    }

    const user = await verifySupabaseUser(accessToken);
    if (!user?.id) {
      return json(res, 401, { error: "Sessão inválida." });
    }

    const rawBody = await readBody(req);
    const body = rawBody ? JSON.parse(rawBody) : {};
    const discordPayload = buildDiscordMessage(body.type, body, user);

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(discordPayload)
    });

    if (!response.ok) {
      const details = await response.text().catch(() => "");
      return json(res, 502, { error: "Discord recusou o aviso.", details });
    }

    return json(res, 200, { ok: true });
  } catch (error) {
    return json(res, 500, { error: error.message || "Erro inesperado." });
  }
}
