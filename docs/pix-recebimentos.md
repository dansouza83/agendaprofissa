# Recebimentos PIX diretos

O cliente paga na conta do profissional. Este fluxo não movimenta dinheiro, não consulta o banco e não confirma transferências automaticamente.

## Uso

1. No painel profissional, abra **Mais → Gerenciamento PIX**. Salve o tipo de chave, a chave registrada no banco, o nome e a cidade do recebedor.
2. Nos agendamentos com valor, o cliente pode escanear o QR Code ou usar **PIX Copia e Cola**. Dados PIX antigos e incompletos continuam com a opção de copiar a chave, mas não geram QR inválido.
3. O cliente envia uma imagem ou PDF de até 5 MB. O envio mantém o pagamento pendente.
4. O profissional abre **Ver comprovante → Abrir arquivo**, inicia a conferência e consulta o extrato bancário.
5. Ao confirmar o recebimento, o sistema registra data/responsável, atualiza o pagamento e notifica o cliente internamente. O envio de WhatsApp continua dependente das credenciais e do modelo oficial já documentados no projeto.
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

Pendências externas: leitura do QR no aplicativo bancário real e envio WhatsApp com as credenciais oficiais. Os testes automatizados não substituem esses testes de integração.
