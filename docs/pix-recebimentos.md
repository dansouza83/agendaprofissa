# Recebimentos PIX diretos

O cliente paga na conta do profissional. Este fluxo não movimenta dinheiro, não consulta o banco e não confirma transferências automaticamente.

## Separação da assinatura da plataforma

- **Profissional → Agenda Profissa:** assinatura de R$ 35 mensais ou R$ 350 a cada 12 meses. O checkout usa os preços ativos do servidor, não valores enviados pelo navegador. Os meios de pagamento e a autorização da recorrência são escolhidos no Mercado Pago, conforme disponibilidade. Não alteramos os contratos de assinaturas existentes.
- **Cliente → profissional:** pagamento integral do atendimento na chave PIX do próprio profissional. O cliente não paga assinatura à plataforma; não há repasse ou comissão do Agenda Profissa sobre esse atendimento.
- O PIX do atendimento não é usado para pagar a assinatura. Um QR Code estático não é Pix Automático.
- **Pix Automático da assinatura:** ainda é necessário confirmar CNPJ ativo do recebedor, habilitação no provedor e disponibilidade no checkout. A autorização bancária e uma cobrança de teste precisam ser validadas antes de anunciar a modalidade como ativa. Cartão de débito recorrente também depende da opção oferecida pelo provedor/banco; não pode ser garantido apenas pelo código.
- Referências oficiais: [Assinaturas Mercado Pago](https://www.mercadopago.com.br/developers/pt/docs/subscriptions/overview), [checkout sem meio pré-definido](https://www.mercadopago.com.br/developers/pt/docs/subscriptions/integration-configuration/subscription-no-associated-plan/pending-payments), [requisitos do Pix Automático — Banco Central](https://www.bcb.gov.br/estabilidadefinanceira/pix-automatico-participantes).

## Visibilidade da chave

A tabela `tenant_payment_settings` não permite leitura anônima. O profissional/equipe do negócio pode gerenciar seus dados; um cliente autenticado só lê a chave se houver cadastro associado ao seu usuário e agendamento no mesmo negócio. A tela também rejeita configurações PIX e comprovantes de outro negócio. A segurança real é aplicada pelas políticas do banco, não apenas pela interface.

## Uso

1. No painel profissional, abra **Mais → Gerenciamento PIX**. Salve o tipo de chave, a chave registrada no banco, o nome e a cidade do recebedor.
2. Nos agendamentos com valor, o cliente pode escanear o QR Code ou usar **PIX Copia e Cola**. Dados PIX antigos e incompletos continuam com a opção de copiar a chave, mas não geram QR inválido.
3. O cliente envia uma imagem ou PDF de até 5 MB. O envio mantém o pagamento pendente.
4. O profissional abre **Ver comprovante → Abrir arquivo**, inicia a conferência e consulta o extrato bancário.
5. Ao confirmar o recebimento, o sistema registra data/responsável, atualiza o pagamento e notifica o cliente internamente. Para avisar pelo WhatsApp, abra **Agenda → menu ⋯ do agendamento → Enviar atualização no WhatsApp**. O sistema prepara a mensagem com o status atual; o profissional confere e toca em **Enviar** no próprio WhatsApp. Este fluxo manual não usa a API da Meta nem exige suas credenciais.
6. Se houver problema, use **Solicitar novo comprovante**, informando o motivo. O cliente recebe um aviso, vê o histórico e pode reenviar sem pagar novamente. O comprovante anterior permanece preservado.

## Garantias e limites

- QR Code SVG gerado localmente; nenhuma chave é enviada a um gerador externo.
- BR Code estático com valor em centavos, referência do agendamento e CRC16. Referência: [Manual de iniciação do PIX — Banco Central](https://www.bcb.gov.br/content/estabilidadefinanceira/pix/Regulamento_Pix/II_ManualdePadroesparaIniciacaodoPix.pdf).
- O formato da chave é validado, mas sua existência e titularidade não são verificadas. O cliente deve conferir o recebedor no banco.
- O valor fica associado ao agendamento; uma alteração posterior no preço do serviço não muda esse valor. Cliente, serviço e valor ficam protegidos após existir um comprovante.
- Somente membros autenticados do negócio, com assinatura ativa, podem revisar comprovantes. Clientes não podem alterar decisões ou confirmar pagamentos.
- Arquivos privados e links temporários de até 5 minutos. Motivos e nomes de arquivos são renderizados como texto, nunca como HTML.
- Pedir outro comprovante não estorna, cancela nem desfaz uma transferência. Nenhum documento, sozinho, comprova a liquidação bancária.
- A migração é compatível com dados PIX antigos. Não preencha automaticamente dados de titularidade desconhecidos.

## Verificação

`pnpm test` executa a build, os testes existentes, o gerador PIX e a renderização dos componentes sem navegador ou rede. Os testes incluem o vetor CRC16 oficial do Banco Central e contraste matemático das novas cores.

`tests/pix-database.sql` valida o fluxo com identidades de demonstração já existentes, registros temporários e **ROLLBACK**. Requer conexão administrativa, não envia mensagens externas, não cria usuários, não efetua pagamentos e não mantém registros de teste. Não execute testes destrutivos diretamente em arquivos do Storage.

Pendências externas: leitura do QR no aplicativo bancário real e confirmação do envio manual no WhatsApp. Abrir o link não comprova que a mensagem foi enviada ou entregue. Os testes automatizados não substituem esses testes de integração.
