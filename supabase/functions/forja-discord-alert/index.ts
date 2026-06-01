import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_PREVIEW = 220;

function clean(value: unknown, fallback = "") {
  return String(value ?? fallback).replace(/\s+/g, " ").trim();
}

function truncate(value: unknown, limit = MAX_PREVIEW) {
  const text = clean(value);
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - 1)}…`;
}

function brlDate(value: string | null | undefined) {
  if (!value) return "agora";
  try {
    return new Date(value).toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "America/Sao_Paulo",
    });
  } catch {
    return value;
  }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getPublishableKey() {
  const legacy = Deno.env.get("SUPABASE_ANON_KEY");
  if (legacy) return legacy;

  const raw = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (!raw) return "";

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed[0]?.key || parsed[0] || "";
    return parsed?.current || parsed?.key || Object.values(parsed)[0] || "";
  } catch {
    return "";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Método não permitido." }, 405);

  const discordWebhookUrl = Deno.env.get("DISCORD_WEBHOOK_URL");
  if (!discordWebhookUrl) {
    return jsonResponse({ error: "DISCORD_WEBHOOK_URL não configurado nos secrets da Edge Function." }, 500);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = getPublishableKey();
  if (!supabaseUrl || !publishableKey) {
    return jsonResponse({ error: "Supabase URL ou publishable/anon key indisponível na Edge Function." }, 500);
  }

  const authorization = req.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) {
    return jsonResponse({ error: "Sessão obrigatória para enviar aviso." }, 401);
  }

  const supabase = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return jsonResponse({ error: "Usuário não autenticado." }, 401);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "JSON inválido." }, 400);
  }

  const type = clean(payload.type);
  const orderId = clean(payload.orderId);
  const siteUrl = clean(payload.siteUrl, Deno.env.get("FORJA_SITE_URL") || "https://forja-narrativa-online.vercel.app");

  if (!["new_order", "client_message"].includes(type)) {
    return jsonResponse({ error: "Tipo de aviso inválido." }, 400);
  }

  if (!orderId) return jsonResponse({ error: "orderId é obrigatório." }, 400);

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, client_name, client_email, package_name, status, payment_status, created_at")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError || !order) {
    return jsonResponse({ error: "Pedido não encontrado ou sem permissão para leitura." }, 404);
  }

  const orderUrl = `${siteUrl.replace(/\/$/, "")}/admin.html#pedido-${order.id}`;
  const chatUrl = `${siteUrl.replace(/\/$/, "")}/chat-admin.html?pedido=${order.id}`;
  const preview = truncate(payload.messagePreview || payload.message || "");

  const isNewOrder = type === "new_order";
  const title = isNewOrder ? "🔥 Novo pedido recebido" : "💬 Nova mensagem na Forja";
  const description = isNewOrder
    ? "Uma nova faísca chegou para ser analisada na Sala do Criador."
    : preview || "Um cliente enviou uma nova mensagem no chat.";

  const fields = [
    { name: "Cliente", value: clean(order.client_name, "Cliente sem nome") || "Cliente sem nome", inline: true },
    { name: "E-mail", value: clean(order.client_email, "sem e-mail") || "sem e-mail", inline: true },
    { name: "Pacote", value: clean(order.package_name, "Pedido") || "Pedido", inline: true },
    { name: "Status", value: clean(order.status, "sem status") || "sem status", inline: true },
    { name: "Criado em", value: brlDate(order.created_at), inline: true },
  ];

  if (!isNewOrder && preview) fields.push({ name: "Prévia", value: preview, inline: false });

  fields.push({ name: "Abrir conversa", value: chatUrl, inline: false });
  fields.push({ name: "Abrir pedido", value: orderUrl, inline: false });

  const discordPayload = {
    username: "Sinos da Forja",
    avatar_url: "",
    allowed_mentions: { parse: [] },
    embeds: [
      {
        title,
        description,
        color: isNewOrder ? 0xd9a441 : 0x7c3aed,
        fields,
        timestamp: new Date().toISOString(),
        footer: { text: "Forja Narrativa Online" },
      },
    ],
  };

  const discordResponse = await fetch(discordWebhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(discordPayload),
  });

  if (!discordResponse.ok) {
    const details = await discordResponse.text().catch(() => "");
    return jsonResponse({ error: "Discord recusou o aviso.", details }, 502);
  }

  return jsonResponse({ ok: true });
});
