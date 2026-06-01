# forja-discord-alert

Edge Function da Forja Narrativa para enviar avisos de novos pedidos e novas mensagens para um webhook privado do Discord.

Secrets necessários:

```bash
supabase secrets set DISCORD_WEBHOOK_URL="COLE_A_URL_DO_WEBHOOK_AQUI"
supabase secrets set FORJA_SITE_URL="https://forja-narrativa-online.vercel.app"
```

Deploy recomendado:

```bash
supabase functions deploy forja-discord-alert --no-verify-jwt
```

A função ainda valida manualmente o token do usuário pelo header `Authorization`, então o `--no-verify-jwt` serve principalmente para permitir CORS/OPTIONS sem travar o navegador.
