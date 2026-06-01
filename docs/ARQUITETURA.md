# Arquitetura — Forja Narrativa Online

Versão interna: **0.4.5 — histórico do pedido**.

## Páginas públicas

- `index.html` — início e apresentação da Forja.
- `pacotes.html` — pacotes principais e ranks do Memorial via JSON.
- `memorial.html` — conceito visual do Memorial da Forja via JSON.
- `creditos.html` — créditos Jhonata/Lumi com chibis interativos.
- `pedidos.html` — página explicando como fazer pedidos.
- `privacidade.html` — política simples de privacidade.
- `termos.html` — termos simples de uso.

## Páginas internas

- `auth.html` — login/cadastro do cliente, com recuperação de senha.
- `conta.html` — perfil do cliente, atalhos da conta e recuperação de senha.
- `cliente.html` — formulário de novo pedido logado.
- `meus-pedidos.html` — acompanhamento de pedidos do cliente.
- `login.html` — entrada reservada do admin.
- `admin.html` — painel da Forja.

## Dados

- `data/json/packages.json` — pacotes principais.
- `data/json/memorial-ranks.json` — ranks do Memorial.
- `data/json/site-pages.json` — navegação pública.
- `data/json/internal-pages.json` — páginas internas/legais documentadas.

## Camadas adicionadas

- **JSON:** dados de pacotes, memorial, créditos e páginas.
- **SVG:** logo, fenda e ornamentos.
- **CSS avançado:** visual global, responsividade e estados.
- **GSAP:** animações com trava para não repetir em excesso.
- **Canvas:** partículas da Forja com modo leve automático para mobile.
- **Markdown:** pasta de textos e loader simples em `js/markdown/render-markdown.js`.
- **TypeScript:** tipos base corrigidos em `ts/src/types.ts`.

## Supabase

A pasta `supabase/migrations/` documenta o banco esperado:

- `001_schema_base.sql` — tabelas `profiles`, `admin_users`, `orders`, `order_messages`, `order_deliveries`.
- `002_policies.sql` — RLS e policies para cliente/admin.
- `003_seed_admin_example.sql` — exemplo para registrar admin.
- `004_admin_delete_orders.sql` — permite exclusão de pedidos por admin.
- `005_admin_cleanup_panel_notes.sql` — documentação do painel de limpeza.
- `006_0_4_0_security_flow.sql` — entrega final, chat futuro seguro e função admin.
- `007_fix_orders_updated_at_and_status.sql` — correção oficial de `updated_at` e status aceitos.
- `008_0_4_3_client_account_profiles.sql` — conta do cliente e profiles.
- `009_0_4_5_order_events_history.sql` — linha do tempo/histórico do pedido.

Antes de divulgar para clientes reais, revise as policies no painel do Supabase.

## Correções aplicadas na versão 0.3

- Corrigido TypeScript: `SitePage` agora existe.
- Removido arquivo antigo `js/pedidos.js` que estava órfão.
- `pedidos.html` agora usa `css/pedidos.css` próprio.
- Menu esconde também links internos quando o usuário está na página atual.
- Adicionada recuperação de senha em `auth.html`.
- Adicionadas páginas `privacidade.html` e `termos.html`.
- Criadas migrations SQL oficiais para reconstruir banco/policies.
- Admin recebeu status extras: aguardando resposta, revisão, cancelado, arquivado e teste.
- JSON com mensagens de erro visíveis quando falha ao carregar.
- Canvas foi aliviado para mobile.
- GSAP não anima tudo repetidamente depois de conteúdo dinâmico.
- `Meus Pedidos` recebeu espaços preparados para mensagens e entrega final.


## Atualização 0.3.1 — Conta criadora e saída

- A navegação agora mostra **Sair da conta** quando existe sessão ativa.
- A conta `forjanarrativa5790@gmail.com` é reconhecida como criadora/admin no menu e no painel.
- O link **Sala do Criador** aparece automaticamente para essa conta, mesmo sem depender de cadastro manual em `admin_users`.
- A função SQL `public.is_forja_admin()` também reconhece esse e-mail para liberar leitura/atualização administrativa nas policies do Supabase.
- Outros administradores ainda podem ser adicionados pela tabela `admin_users`.

## Versão 0.3.2 — Correção do menu de conta

Correções aplicadas:

- `js/supabase.js` agora também expõe o cliente como `window.forjaDB`.
- `js/nav.js` agora usa `window.forjaDB` com fallback para `forjaDB` global.
- O menu agora re-renderiza quando o estado de autenticação muda.
- A opção `Sair da conta` aparece quando há sessão ativa.
- A opção `Sala do Criador` aparece quando a sessão ativa pertence ao e-mail oficial `forjanarrativa5790@gmail.com` ou a um usuário existente em `admin_users`.

Motivo da correção:

- O cliente Supabase existia como `const forjaDB`, mas `nav.js` procurava por `window.forjaDB`. Como `const` global não cria uma propriedade automática em `window`, o menu achava que não havia Supabase e sempre montava a navegação como visitante.

## Versão 0.3.3 — Exclusão de pedidos na Sala do Criador

Mudanças:

- A Sala do Criador agora possui uma zona de limpeza em cada pedido.
- Administradores podem excluir pedidos permanentemente pelo painel.
- A exclusão pede duas confirmações: confirmação comum e digitar `EXCLUIR`.
- A ação deve ser usada para pedidos de teste, spam ou registros que não devem permanecer no banco.
- Nova migration: `supabase/migrations/004_admin_delete_orders.sql`.

Supabase:

- Rode a migration 004 no SQL Editor para liberar `DELETE` em `orders` apenas para administradores.
- Como `order_messages` e `order_deliveries` têm `on delete cascade`, dados internos ligados ao pedido também são apagados.


## Versão 0.3.4 — Painel de limpeza da Sala do Criador

Adições:

- Filtro por status no painel admin.
- Botões rápidos para ver pedidos com status `teste` e `arquivado`.
- Botão para limpar filtros do painel.
- Ação individual para arquivar/restaurar pedidos sem excluir.
- Ação em massa para excluir todos os pedidos com status `teste`.
- Confirmação dupla para limpeza em massa: o admin precisa digitar `LIMPAR TESTES`.

Observação Supabase:

- Esta versão não exige SQL novo se as policies de `UPDATE` e `DELETE` para admin já estiverem funcionando.
- A migration `005_admin_cleanup_panel_notes.sql` existe apenas como documentação do recurso.

## Versão 0.3.5 — Remake visual da Sala de Créditos

Mudanças:

- A página `creditos.html` agora tem uma introdução própria: **Sala dos Criadores**.
- A seção de créditos foi refeita para parecer uma cena única, não dois cards separados.
- Jhonata e Lumi ficam em lados opostos da mesma sala, com a fenda no centro.
- A fenda central recebeu brilho mais controlado, melhor alinhamento e melhor responsividade.
- Os chibis ficaram maiores e com melhor destaque visual.
- A versão mobile agora organiza a sala em sequência vertical: Jhonata → fenda → Lumi.
- Mantida a troca de sprite por hover no PC e toque no celular.

## Versão 0.3.6 — Créditos em realidades abertas

- Remake visual da página `creditos.html` sem caixa/card central.
- Jhonata e Lumi agora flutuam em lados opostos da mesma cena.
- Lado Jhonata: paleta preta/dourada, fogo dourado e partículas de cinza.
- Lado Lumi: paleta azul/roxa, telas holográficas e linhas de código flutuando.
- Centro: fenda/distorção misturando dourado, roxo e azul.
- Mantida a troca de sprite por hover no PC e toque no celular.

## Versão 0.3.7 — Remake da página Início

Mudanças:

- `index.html` foi refeito como uma entrada cinematográfica da Forja, não apenas um hero com card.
- A primeira dobra virou uma cena aberta com brilho dourado, rachaduras roxas, núcleo/símbolo da Forja e CTA direto.
- Adicionado o bloco **Manifesto da Forja**, explicando a missão: proteger ideias criativas e ajudar criações a respirarem.
- Adicionado fluxo visual **Faísca → Forja → Legado**.
- Os caminhos principais agora aparecem como áreas de navegação mais imersivas: Pacotes, Pedidos e Memorial.
- Adicionada seção de promessa criativa para reforçar que ideias incompletas também têm valor.
- `js/animations/forja-gsap.js` foi atualizado para animar também os novos blocos do index.

## Versão 0.3.8 — Remake da página Pacotes

Mudanças:

- `pacotes.html` foi refeito como uma vitrine principal da Forja, com hero próprio e navegação direta para pacotes, Memorial e pedido.
- Os pacotes principais agora aparecem como cartões premium gerados por JSON, com preço grande, descrição, lista de entregas e botão individual de escolha.
- Adicionada seção de orientação “Como escolher?”, explicando rapidamente a diferença entre os quatro pacotes principais.
- Os ranks do Memorial agora aparecem como uma trilha/caminho de contribuição memorial, separada dos pacotes principais.
- Mantida a lógica de dados em `data/json/packages.json` e `data/json/memorial-ranks.json`.
- `js/data/render-packages.js` foi atualizado para gerar a nova estrutura visual.
- `css/style.css` recebeu os estilos da página `packagesPage`, incluindo bússola, cards, trilha de ranks e responsividade.

## Versão 0.3.9 — Remake da página Pedidos

Mudanças:

- `pedidos.html` foi refeito como a página explicativa oficial de encomendas da Forja.
- A página agora abre com uma cena própria de pedido, com texto mais emocional e CTAs para entrar, ver pacotes e acompanhar pedidos.
- Adicionado um cartão visual de “Contrato de criação”, reforçando a ideia de que o pedido vai da faísca ao arquivo final.
- Criado o fluxo visual **Escolha o caminho → Envie a faísca → Ajuste em conversa → Receba o resultado**.
- Adicionada seção para explicar que ideias incompletas são aceitas: Faísca, Metal bruto e Peça quase pronta.
- O checklist de informações ganhou aparência mais polida e continua deixando claro que nada precisa estar perfeito.
- Adicionado um “Portal de pedido” final com CTA para começar pedido ou ver pedidos já enviados.
- `css/pedidos.css` recebeu a identidade visual nova da página, com efeitos dourados/roxos, contrato, trilha de etapas, cards e responsividade.
- `js/animations/forja-gsap.js` foi atualizado para animar os novos blocos da página.


## Versão 0.4.0 — Temperagem da Forja

Foco: segurança, fluxo final e preparação para testes reais.

- `package.json` atualizado para `0.4.0`.
- Login admin agora verifica se a sessão é realmente admin antes de redirecionar para `admin.html`.
- Cliente comum que entra em `login.html` não é mais deslogado automaticamente; recebe aviso de área reservada.
- Sala do Criador recebeu campos de entrega final por pedido: link e observação.
- `meus-pedidos.html` passa a exibir observação de entrega quando existir.
- Criada migration `006_0_4_0_security_flow.sql` com:
  - coluna `delivery_note` em `orders`;
  - recriação segura de `is_forja_admin()` com `set search_path = public`;
  - policy de chat futuro impedindo cliente de inserir mensagem como `admin`;
  - reforço de policies para entregas.
- Criado `js/utils/performance.js` para modo mobile leve automático.
- Canvas, brasas e GSAP agora respeitam `forjaPerformance` para reduzir efeitos em celular fraco, telas pequenas e preferência de movimento reduzido.


## Versão 0.4.0 — Temperagem da Forja

Mudanças principais:

- `package.json` atualizado para `0.4.0`.
- Login admin agora verifica permissão antes de entrar na Sala do Criador.
- Cliente comum não é mais deslogado à força ao acessar a entrada admin.
- Sala do Criador recebeu campos de entrega final: link e observação.
- `Meus Pedidos` mostra observação da entrega quando existir.
- Adicionado modo mobile leve em `js/utils/performance.js`.
- Canvas, brasas e GSAP reduzem efeitos em mobile/movimento reduzido.
- Migration `006_0_4_0_security_flow.sql` criada.

## Versão 0.4.1 — Correções de estabilidade

Correções aplicadas:

- Recuperação de senha não exige mais e-mail quando o usuário já está no modo de redefinição por link.
- O filtro de pacote no admin agora usa somente o nome do pacote/rank como valor, evitando falhas quando preços mudam.
- Tentativa de login admin com conta comum agora desfaz a sessão e informa que a área é reservada.
- Adicionada migration `007_fix_orders_updated_at_and_status.sql`, registrando oficialmente a correção do erro `record "new" has no field "updated_at"`.
- A migration 007 também inclui `isento` em `payment_status`, usado pelo status de teste.

## Versão 0.4.2 — Polimento interno

Mudanças:

- Sala do Criador recebeu avisos visuais próprios no lugar de `alert()` para ações comuns.
- Confirmações perigosas agora usam modal estilizado da Forja, mantendo proteção para exclusões.
- Botões de status mostram visualmente o status ativo do pedido.
- Salvamento de entrega mostra estado de carregamento no botão.
- `Meus Pedidos` recebeu trilha visual de progresso: análise, pagamento, produção, revisão e entrega.
- Links de entrega ficaram mais claros para o cliente.
- `package.json` atualizado para `0.4.2`.

Observação:

- Não exige SQL novo caso a migration 007 já tenha sido rodada no Supabase.


## 0.4.3 — Conta do Cliente

- Adicionada `conta.html` como área de perfil do cliente.
- Adicionados `css/conta.css` e `js/conta.js`.
- Menu logado agora exibe **Conta** / **Minha Conta** e esconde a página atual.
- `cliente.html` passa a preencher o nome automaticamente usando `profiles.nome`.
- Ao enviar pedido, o nome usado é salvo/atualizado em `profiles`.
- Criada migration `008_0_4_3_client_account_profiles.sql` para reforçar tabela/policies de `profiles`.

---

## Versão 0.4.4 — Pedido Inteligente

Foco: deixar a escolha de pacote mais conectada ao formulário real de encomenda.

Mudanças:

- Cards dos pacotes principais agora apontam para `cliente.html?tipo=principal&pacote=<id>`.
- Ranks do Memorial agora também possuem botão direto para pedido.
- `cliente.html` ganhou painel lateral de resumo do pacote selecionado.
- `cliente.js` agora lê parâmetros da URL e pré-seleciona o pacote/rank correto.
- Formulário de pedido agora tem rascunho automático em `localStorage`.
- O rascunho é restaurado ao voltar para a página e limpo após envio bem-sucedido.
- `package-options.js` agora expõe `window.forjaPackageData` e dispara `forja:packages-ready`.
- A experiência de pedido ficou mais clara para clientes que chegam pela página Pacotes.

SQL:

- Esta versão não exige migration nova no Supabase.

## Versão 0.4.5 — Histórico do Pedido

Adições:

- Criada a migration `009_0_4_5_order_events_history.sql`.
- Nova tabela `order_events` para registrar movimentos importantes do pedido.
- Cliente vê uma linha do tempo em `meus-pedidos.html`.
- Admin vê uma linha do tempo dentro de cada pedido na Sala do Criador.
- O formulário de pedido registra evento inicial quando a tabela já está ativa.
- A Sala do Criador registra eventos ao mudar status e salvar/enviar entrega final.
- O histórico é append-only: eventos não são editados; se algo mudar, outro evento é registrado.

Supabase:

- Rode a migration 009 no SQL Editor para ativar o histórico real.
- Sem a migration, o site continua funcionando, mas exibe apenas o fallback de criação do pedido.

Próximo marco sugerido:

- `0.5.0 — Chat por Pedido`, usando `order_messages` para conversa real entre cliente e Forja.

## 0.5.0 — Chat por Pedido

A versão 0.5.0 ativa o primeiro sistema real de conversa da Forja:

- `chat.html` — página do cliente para conversar diretamente com a Forja sobre seus pedidos.
- `chat-admin.html` — painel de conversas da Sala do Criador em formato inspirado em WhatsApp Web: contatos/pedidos à esquerda e conversa aberta à direita.
- `js/chat-shared.js` — funções compartilhadas de mensagem, envio, renderização e assinatura de mensagens.
- `js/chat.js` — lógica da página de chat do cliente.
- `js/chat-admin.js` — lógica do painel de conversas do criador.
- `js/chat-widget.js` — chat minimizado para o cliente continuar navegando pelo site enquanto conversa.
- `css/chat.css` — estilo das páginas e do widget de chat.
- `supabase/migrations/010_0_5_0_order_chat.sql` — policies e índices oficiais do chat por pedido.

### Modelo de experiência

Cliente:
- acessa uma página inteira de chat;
- escolhe o pedido em um seletor simples, sem lista lateral de contatos;
- pode minimizar o chat e continuar navegando pelo site;
- o widget minimizado continua disponível nas páginas públicas/logadas.

Criador:
- acessa `chat-admin.html` pela opção Conversas/Sala do Criador;
- vê contatos/pedidos em uma coluna lateral;
- abre uma conversa por vez na área principal;
- responde como Forja Narrativa.

### Banco

O chat usa `order_messages`:

- cliente só pode inserir mensagens como `sender_role = 'cliente'` nos próprios pedidos;
- admin só pode inserir mensagens como `sender_role = 'admin'`;
- ambos podem ler as conversas permitidas por RLS;
- mensagens não são editadas, apenas enviadas em sequência.


## 0.5.1 — Sinos da Forja

- Adicionada Edge Function `forja-discord-alert` para avisos no Discord.
- Adicionado helper `js/notifications/discord-alerts.js`.
- Novos pedidos e mensagens de cliente tentam enviar aviso externo sem bloquear o fluxo.
- Adicionada documentação `docs/DISCORD_NOTIFICACOES.md`.
- Adicionada migration marcador `011_0_5_1_discord_notifications.sql`.


## Versão 0.5.2 — Sinos da Forja via Vercel

- Substitui chamada direta para Supabase Edge Function por `/api/discord-alert`.
- Adiciona `api/discord-alert.js` como Vercel Function.
- Mantém a URL do Discord Webhook protegida em variável de ambiente da Vercel.
- Evita depender do `supabase link`/deploy de Edge Functions para notificações.
- O endpoint verifica a sessão Supabase do cliente antes de mandar aviso ao Discord.
