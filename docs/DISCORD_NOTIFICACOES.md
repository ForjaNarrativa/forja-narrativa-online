# Forja Narrativa Online — Sinos da Forja via Vercel

Versão: 0.5.2

A versão 0.5.2 usa uma Function da Vercel em `api/discord-alert.js` para mandar avisos no Discord.
Isso evita depender do deploy de Edge Function pelo Supabase CLI.

## Por que mudou?

A integração 0.5.1 usava Supabase Edge Function. Ela é boa, mas exige Supabase CLI funcionando.
No Windows, o `supabase link` pode falhar por token/ref/branches, então a 0.5.2 usa a própria Vercel, que já hospeda o site.

## Variáveis necessárias na Vercel

Em Vercel → Projeto Forja → Settings → Environment Variables, crie:

```txt
DISCORD_WEBHOOK_URL=URL_NOVA_DO_WEBHOOK_DO_DISCORD
FORJA_SITE_URL=https://forja-narrativa-online.vercel.app
SUPABASE_URL=https://zhelpnscvozscbcoludo.supabase.co
SUPABASE_ANON_KEY=SUA_CHAVE_ANON_PUBLICA_DO_SUPABASE
```

A URL do webhook nunca deve ficar no JavaScript público.

## Como testar

1. Publique a versão 0.5.2 na Vercel.
2. Crie um pedido teste como cliente logado.
3. Veja se chega aviso no canal do Discord.
4. Envie mensagem no chat como cliente.
5. Veja se chega aviso de mensagem.

## Segurança

A Function exige token de sessão Supabase. Ela verifica o usuário logado antes de mandar para o Discord.
Isso reduz spam anônimo no endpoint `/api/discord-alert`.
