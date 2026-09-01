# Agenda Profissa

Aplicação multiusuário e multitenant para agenda, clientes e serviços de profissionais de beleza, bem-estar, saúde e treinamento. A interface é mobile-first, em português brasileiro, e pode ser instalada como aplicativo no celular.

## Modos de execução

- **Local:** funciona imediatamente com dados de demonstração armazenados no navegador.
- **Online:** ao configurar as variáveis do Supabase, usa Supabase Auth, PostgreSQL e políticas RLS por negócio.

O login oferece recuperação de senha por e-mail e a opção **Manter meu acesso neste dispositivo**. A senha nunca é armazenada pelo aplicativo; somente a sessão segura do Supabase é mantida quando o usuário autoriza.

O site e o sistema iniciam em **modo escuro**. O botão de tema no cabeçalho permite alternar para o modo claro, e a escolha fica salva somente neste dispositivo em `agenda-facil-theme`.

## Páginas e perfis

- `/` — landing page pública, responsiva e com apresentação do produto.
- `/sistema` — login, recuperação de senha e área autenticada.
- `/sistema?cadastro=profissional` — cadastro de profissional ou negócio.
- `/sistema?cadastro=cliente` — cadastro de aluno ou cliente.
- `/faq` — central de perguntas frequentes.
- `/legal` — centro jurídico com links para Termos, Privacidade, Cookies, Diretrizes, Segurança e Direitos do Titular.

O cadastro exige aceite explícito dos Termos de Uso e do Aviso de Privacidade. No modo online, a versão aceita e a data ficam registradas em `legal_acceptances`.

## Rodar localmente no Windows

1. Instale o Node.js 22 LTS ou superior em https://nodejs.org/.
2. Abra o PowerShell na pasta do projeto.
3. Execute:

```powershell
npm install
npm run dev
```

Abra o endereço exibido no terminal, normalmente `http://localhost:3000`.

| Negócio de demonstração | E-mail | Senha |
|---|---|---|
| Studio Aurora | `marina@demo.com` | `demo123` |
| Movimento Personal | `rafael@demo.com` | `demo123` |

## Ativar o modo online

1. Crie um projeto no Supabase.
2. Copie `.env.example` para `.env.local`.
3. Preencha `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` com os valores públicos do projeto.
4. No Supabase, aplique a migration existente em `supabase/migrations`.
5. Configure `NEXT_PUBLIC_SITE_URL` com o domínio final.
6. Em Authentication → URL Configuration, defina a Site URL e adicione como Redirect URL o endereço final do aplicativo.
7. Reinicie `npm run dev`.

Quando as variáveis estão presentes, a tela de login passa automaticamente ao modo online. Uma conta profissional gera tenant, perfil e vínculo de proprietário dentro da mesma transação do Auth. Uma conta de aluno/cliente recebe um perfil pessoal sem acesso administrativo; os agendamentos aparecem após o profissional vincular o cadastro ao usuário.

### Recuperação de senha

O usuário seleciona **Esqueci minha senha**, informa o e-mail e recebe um link. Ao retornar pelo link, o aplicativo apresenta a tela para definir e confirmar a nova senha. Em produção, o domínio exato precisa estar autorizado nas Redirect URLs do Supabase.

> Nunca use `service_role`, secret key ou token do Mercado Pago no frontend. A publishable key pode ser pública porque todas as tabelas expostas estão protegidas por RLS.

## Supabase local opcional

Para executar toda a infraestrutura local, instale Docker Desktop e use:

```powershell
npm run supabase:start
npm run supabase:reset
npm run supabase:lint
```

O Docker não é necessário para testar o modo de demonstração.

## Verificações

```powershell
npm run lint
npm run build
```

## Segurança multitenant

- Todas as entidades de negócio carregam `tenant_id`.
- RLS verifica a tabela `memberships` em cada leitura e alteração.
- Chaves estrangeiras compostas impedem associar cliente ou serviço de outro tenant a um agendamento.
- O frontend nunca decide autorização; ele apenas reflete o que o banco permite.
- Campos de confirmação de pagamento não têm permissão de escrita pelo usuário autenticado e ficam reservados para backend/webhook.
- Índices cobrem as consultas comuns de tenant, agenda e status.
- Perfis de aluno/cliente só podem consultar seus próprios registros e agendamentos vinculados.
- O tipo de perfil não é usado isoladamente como autorização: as permissões efetivas continuam no banco por RLS.

## Preparação jurídica antes da publicação

Os documentos em `/legal` são minutas para o MVP e não substituem revisão jurídica. Antes de publicar:

1. Preencher razão social ou nome do responsável, CNPJ/CPF, endereço, suporte e canal de privacidade em `app/legal-shell.tsx`.
2. Confirmar os fornecedores reais de hospedagem, autenticação, banco e e-mail.
3. Aprovar uma tabela interna de retenção e um procedimento de atendimento aos titulares e resposta a incidentes.
4. Solicitar revisão de advogado com base na operação real e nas categorias profissionais atendidas.
5. Antes de ativar pagamentos, acrescentar preços, cobrança, cancelamento, reembolso, inadimplência e emissão fiscal.

## Assinaturas com Mercado Pago

O painel profissional possui dois planos recorrentes: mensal por R$ 49,90 e anual por R$ 478,80. Novas contas profissionais só acessam clientes, serviços e agendamentos depois que o Mercado Pago confirma a assinatura como `authorized`. A validação acontece no servidor e também nas políticas do banco; a área de aluno/cliente não exige assinatura.

Para ativar cobranças:

1. Aplique a migration `add_professional_subscriptions` no Supabase.
2. Copie as variáveis de `.env.example` para `.env.local` e preencha o Access Token, a chave secreta de webhook e a chave secreta do Supabase.
3. Use primeiro credenciais de teste e um endereço HTTPS público. O Mercado Pago não entrega notificações para `localhost`.
4. Cadastre/teste o webhook de assinaturas em `/api/billing/webhook` e só depois troque para credenciais de produção.
5. Nunca coloque Access Token ou chaves secretas em variáveis iniciadas por `NEXT_PUBLIC_`.

O Mercado Pago desta seção é usado somente na assinatura do profissional com o Agenda Profissa. O pagamento de cada atendimento pelo cliente usa o fluxo PIX direto descrito abaixo e não passa pelo Agenda Profissa.

## Recebimento PIX direto do atendimento

O profissional cadastra sua própria chave PIX no painel. Somente o cliente autenticado e vinculado ao agendamento pode visualizar essa chave. O cliente paga diretamente ao profissional, envia um comprovante privado (JPG, PNG, WebP ou PDF, até 5 MB) e o profissional confirma manualmente apenas depois de conferir a entrada do valor.

Para o aviso automático de pagamento confirmado no WhatsApp, publique a função `agenda-whatsapp-payment-confirmed` e configure como segredos do Supabase:

- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_PAYMENT_CONFIRMED_TEMPLATE`
- `WHATSAPP_GRAPH_API_VERSION` (opcional; padrão atual do projeto: `v23.0`)
- `WHATSAPP_TEMPLATE_LANGUAGE` (opcional; padrão: `pt_BR`)

O modelo aprovado no WhatsApp Manager precisa ter seis variáveis no corpo, nesta ordem: nome do cliente, serviço, data, horário, nome do negócio e contato do profissional. Exemplo: `Olá, {{1}}! O pagamento de {{2}} foi confirmado. Horário: {{3}} às {{4}}. Atendimento: {{5}}. Contato: {{6}}.`

Sem essas credenciais, a confirmação e a notificação interna continuam funcionando; somente o envio automático pelo WhatsApp permanece desativado. Chaves do WhatsApp nunca devem usar o prefixo `NEXT_PUBLIC_`.

## Publicação

Antes de publicar:

1. Aplicar a migration em um projeto Supabase de produção.
2. Executar o Security Advisor e o Performance Advisor.
3. Configurar confirmação de e-mail, SMTP, domínio permitido e proteção contra abuso no Auth.
4. Cadastrar as três variáveis públicas no provedor de hospedagem.
5. Executar `npm run lint` e `npm run build`.
6. Testar com dois usuários de tenants diferentes e confirmar que nenhum dado cruza entre as contas.

O primeiro pacote de produção foi validado localmente e preparado para publicação privada no OpenAI Sites.
