export function SubscriptionPaymentInfo() {
  return <div className="mt-6 text-left text-sm leading-6" aria-label="Pagamento da assinatura do sistema">
    <p><strong>Assinatura do Agenda Profissa.</strong> Paga pelo profissional para usar o sistema. Não inclui o valor dos atendimentos.</p>
    <p className="mt-2"><strong>Cartão de crédito ou débito.</strong> Escolha o meio disponível no checkout do Mercado Pago e autorize a cobrança recorrente do plano. A disponibilidade depende do cartão e do provedor.</p>
    <p className="mt-2"><strong>Pix Automático.</strong> Depende de habilitação no provedor e da sua autorização no banco. Use essa modalidade somente se ela aparecer no checkout; um PIX comum não autoriza renovações automáticas.</p>
    <p className="mt-2">Seus clientes não pagam assinatura ao Agenda Profissa. Os atendimentos são pagos diretamente a você, sem comissão da plataforma.</p>
  </div>;
}
