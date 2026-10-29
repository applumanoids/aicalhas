/* =====================================================================
   AiCalhas — Cenário 4: Contratação centralizada
   O cliente fecha a solução com a AiCalhas (materiais + instalação),
   que coordena compras, entrega, agenda, execução com parceiros,
   pagamentos, repasses, custos e pós-venda.
   ===================================================================== */
(function () {
  'use strict';
  const A = AiC, e = A.esc, I = A.icon;
  const db = () => A.db();
  const MYPRO = 'PRF-101', MYCLI = 'CLI-201';
  const REPASSE = 0.75, FRETE = 60, FRETE_CUSTO = 45;
  const GESTOR = { nome: 'Ricardo Alves (Gerência)', perfil: 'mediador' };
  const COORD = { nome: 'Paula Nogueira (Coordenação)', perfil: 'mediador' };
  const pro = (id) => db().pros.find((p) => p.id === id);
  const cli = (id) => db().clientes.find((c) => c.id === id);
  const ven = (id) => db().vendas.find((v) => v.id === id);
  const mat = (id) => db().materiais.find((m) => m.id === id);
  const forn = (id) => db().fornecedores.find((f) => f.id === id);
  const srvName = (id) => (db().servicos.find((s) => s.id === id) || { nome: id }).nome;
  const ET = {
    avaliacao: 'Avaliação técnica', proposta: 'Proposta em elaboração', alcada: 'Aguardando alçada', enviada: 'Proposta enviada', aprovada: 'Aguardando pagamento', pago: 'Pago — comprar materiais',
    compra: 'Materiais em compra', entrega: 'Programar entrega e instalação', agendada: 'Instalação agendada', execucao: 'Em execução', concluido: 'Concluído — aguardando confirmação', posvenda: 'Pós-venda', cancelada: 'Cancelada',
  };
  const ETK = Object.keys(ET);
  const TONE = { avaliacao: 'info', proposta: 'warn', alcada: 'warn', enviada: 'warn', aprovada: 'warn', pago: 'info', compra: 'info', entrega: 'warn', agendada: 'info', execucao: 'info', concluido: 'warn', posvenda: 'ok', cancelada: 'bad' };
  const etBadge = (v) => A.badge(ET[v.etapa], TONE[v.etapa]);
  const STEPS = ['Proposta', 'Aprovação', 'Pagamento', 'Materiais', 'Instalação', 'Conclusão', 'Pós-venda'];
  const stepOf = (v) => ({ avaliacao: 0, proposta: 0, alcada: 0, enviada: 1, aprovada: 2, pago: 3, compra: 3, entrega: 3, agendada: 4, execucao: 4, concluido: 5, posvenda: v.pos && v.pos.avaliacao ? 7 : 6, cancelada: 0 })[v.etapa];
  const EXEC = ['Conferência dos materiais', 'Remoção da calha antiga', 'Instalação da nova calha', 'Condutores e vedação', 'Teste de escoamento', 'Limpeza e registro fotográfico'];
  const COND = 'Pix à vista com 5% de desconto, cartão em até 3x sem juros ou boleto à vista.';
  const ALCADAS = [
    { tema: 'Desconto em proposta', regra: 'Até 5%', quem: 'Mediador' }, { tema: 'Desconto em proposta', regra: 'De 5% a 10%', quem: 'Coordenação' }, { tema: 'Desconto em proposta', regra: 'Acima de 10%', quem: 'Gerência' },
    { tema: 'Compra de materiais', regra: 'Até R$ 5.000 por pedido', quem: 'Mediador' }, { tema: 'Compra de materiais', regra: 'Acima de R$ 5.000', quem: 'Gerência' },
    { tema: 'Custo adicional em obra', regra: 'Até R$ 300', quem: 'Mediador' }, { tema: 'Custo adicional em obra', regra: 'Acima de R$ 300', quem: 'Coordenação' },
    { tema: 'Alteração de escopo', regra: 'Qualquer valor', quem: 'Mediador + aceite do cliente' }, { tema: 'Solução de reclamação', regra: 'Sem custo / refazer serviço', quem: 'Mediador' }, { tema: 'Solução de reclamação', regra: 'Reembolso ou abatimento', quem: 'Gerência' },
    { tema: 'Repasse ao parceiro', regra: 'Após confirmação do cliente', quem: 'Financeiro (Mediador registra)' },
  ];
  const nivelDesc = (pct) => (pct > 10 ? 'Gerência' : pct > 5 ? 'Coordenação' : 'Mediador');

  /* Cálculos da proposta */
  const pMat = (p) => A.sum(p ? p.itens : [], (x) => x.qtd * x.preco);
  const pCusto = (p) => A.sum(p ? p.itens : [], (x) => x.qtd * x.custo);
  const pBruto = (p) => (p ? pMat(p) + (+p.inst.valor || 0) + (+p.frete || 0) : 0);
  const pDesc = (p) => (p ? Math.round(pBruto(p) * (+p.descPct || 0)) / 100 : 0);
  const pTotal = (p) => pBruto(p) - pDesc(p);
  const pRepasse = (p) => Math.round((+p.inst.valor || 0) * REPASSE * 100) / 100;
  const adicionais = (v) => A.sum(v.custos || [], 'valor');
  const margem = (v) => { const p = v.prop; if (!p) return 0; const receita = v.pag && v.pag.status === 'Pago' ? v.pag.valor : pTotal(p); return receita - pCusto(p) - pRepasse(p) - FRETE_CUSTO - adicionais(v); };

  /* ------------------------------------------------------------------
     Dados fictícios
     ------------------------------------------------------------------ */
  function seed() {
    const b = A.base(), d = A.d;
    b.pros.forEach((p) => { p.status = p.status === 'Publicado' ? 'Ativo' : 'Em homologação'; p.contrato = p.status === 'Ativo' ? 'Contrato de parceria vigente' : 'Pendente'; });
    b.clientes.push({ id: 'CLI-209', nome: 'Sérgio Almeida', tipo: 'Residencial', cidade: 'Sumaré', bairro: 'Jardim Bela Vista', endereco: 'Rua Tupi, 88', tel: '(19) 98333-4455', email: 'sergio.almeida@email.demo', desde: d(-60) });
    b.clientes.push({ id: 'CLI-210', nome: 'Tiago Moreira', tipo: 'Residencial', cidade: 'Campinas', bairro: 'Nova Campinas', endereco: 'Rua Hermantino Coelho, 210', tel: '(19) 98222-6611', email: 'tiago.moreira@email.demo', desde: d(-25) });
    const it = (id, qtd) => { const m = b.materiais.find((x) => x.id === id); return { id: id, nome: m.nome, un: m.un, qtd: qtd, preco: m.preco, custo: m.custo }; };
    const H = (ts, txt, by, vis) => ({ ts: ts, txt: txt, by: by || '', vis: vis || 'all' });
    const prop = (itens, instDesc, instV, desc, emitida, status) => ({ versao: 1, itens: itens, inst: { desc: instDesc, valor: instV }, frete: FRETE, descPct: desc, validade: d(10), condicoes: COND, emitida: emitida, status: status, obs: 'Garantia de 12 meses para materiais e instalação.' });
    const execE = (n, ts) => EXEC.map((x, i) => ({ n: x, ok: i < n, ts: i < n ? ts : null }));
    const V = [];
    // 1. Destaque: proposta enviada à Mariana
    V.push({ id: 'VEN-4021', ts: d(-4, '09:15'), clienteId: 'CLI-201', srv: 'SRV-02', titulo: 'Troca da calha frontal com vazamento', desc: 'A calha da frente está vazando na emenda perto da garagem.', fotos: ['vazamento', 'calha-frontal'], etapa: 'enviada',
      aval: { pro: 'PRF-101', data: d(-2, '10:00'), status: 'Realizada', medidas: '9,5 m de calha frontal; 1 descida de 3 m', obs: 'Emenda corroída e suportes soltos; recomendada troca total da calha frontal.', fotos: ['vazamento'] },
      prop: prop([it('MAT-01', 9.5), it('MAT-07', 2), it('MAT-06', 1), it('MAT-08', 12), it('MAT-09', 2), it('MAT-10', 2)], 'Remoção da calha existente, instalação de 9,5 m de calha galvanizada, novo bocal, ligação ao condutor, vedação e teste de escoamento.', 950, 0, d(-1, '16:00'), 'Enviada'),
      pag: null, compra: null, entrega: null, inst: { pro: 'PRF-101', data: null, status: 'A agendar', etapas: execE(0), repasse: null }, ocorrencias: [], custos: [], pos: null,
      m: { criado: d(-4, '09:15'), proposta: d(-1, '16:00') },
      hist: [H(d(-4, '09:15'), 'Pedido de orçamento recebido', 'Mariana Costa'), H(d(-3, '11:00'), 'Avaliação técnica agendada com Mendes Calhas & Coberturas', 'Juliana Rocha'), H(d(-2, '10:40'), 'Avaliação técnica realizada', 'Carlos Mendes'), H(d(-1, '16:00'), 'Proposta AiCalhas enviada ao cliente', 'Juliana Rocha')] });
    // 2. Avaliação técnica hoje (Carlos)
    V.push({ id: 'VEN-4024', ts: d(-1, '14:20'), clienteId: 'CLI-208', srv: 'SRV-07', titulo: 'Revisão de calhas e rufos do prédio', desc: 'Prédio de dois andares com infiltração no 2º andar.', fotos: ['rufo'], etapa: 'avaliacao',
      aval: { pro: 'PRF-101', data: d(0, '15:30'), status: 'Agendada' }, prop: null, pag: null, compra: null, entrega: null, inst: null, ocorrencias: [], custos: [], pos: null, m: { criado: d(-1, '14:20') },
      hist: [H(d(-1, '14:20'), 'Pedido de orçamento recebido', 'Clínica Vida Plena'), H(d(-1, '16:00'), 'Avaliação técnica agendada', 'Juliana Rocha')] });
    // 3. Proposta em elaboração (avaliação feita por Ana)
    V.push({ id: 'VEN-4022', ts: d(-3, '10:00'), clienteId: 'CLI-202', srv: 'SRV-03', titulo: 'Correção de vazamento e troca de rufo', desc: 'Infiltração na edícula junto ao rufo.', fotos: ['rufo'], etapa: 'proposta',
      aval: { pro: 'PRF-103', data: d(-1, '14:00'), status: 'Realizada', medidas: '6 m de rufo; 2 m de calha', obs: 'Vedação ressecada e trecho solto do rufo.', fotos: ['rufo'], sugestao: [{ id: 'MAT-04', qtd: 6 }, { id: 'MAT-10', qtd: 2 }, { id: 'MAT-01', qtd: 2 }], maoObraSug: 520 },
      prop: null, pag: null, compra: null, entrega: null, inst: { pro: 'PRF-103', data: null, status: 'A agendar', etapas: execE(0), repasse: null }, ocorrencias: [], custos: [], pos: null, m: { criado: d(-3, '10:00') },
      hist: [H(d(-3, '10:00'), 'Pedido de orçamento recebido', 'Roberto Nunes'), H(d(-1, '14:50'), 'Avaliação técnica realizada', 'Ana Beatriz Souza')] });
    // 4. Aguardando alçada (desconto 12%)
    V.push({ id: 'VEN-4020', ts: d(-6, '09:00'), clienteId: 'CLI-203', srv: 'SRV-02', titulo: 'Troca de calhas e condutores — bloco B', desc: 'Calhas e condutores do bloco B com vazamentos.', fotos: ['condutor'], etapa: 'alcada',
      aval: { pro: 'PRF-102', data: d(-4, '09:00'), status: 'Realizada', medidas: '28 m de calha; 5 descidas', obs: 'Troca total recomendada.', fotos: ['condutor'] },
      prop: Object.assign(prop([it('MAT-01', 28), it('MAT-08', 36), it('MAT-06', 5), it('MAT-05', 6), it('MAT-09', 10), it('MAT-11', 15), it('MAT-10', 4)], 'Troca completa de 28 m de calha e 5 descidas do bloco B.', 2600, 12, d(0, '09:30'), 'Aguardando alçada'), { alcada: { nivel: 'Gerência', motivo: 'Síndica pediu desconto para aprovar em assembleia; contrato de manutenção anual em negociação.' } }),
      pag: null, compra: null, entrega: null, inst: { pro: 'PRF-102', data: null, status: 'A agendar', etapas: execE(0), repasse: null }, ocorrencias: [], custos: [], pos: null, m: { criado: d(-6, '09:00') },
      hist: [H(d(-6, '09:00'), 'Pedido de orçamento recebido', 'Cond. Jardim das Palmeiras'), H(d(-4, '10:00'), 'Avaliação técnica realizada', 'Rafael Lima'), H(d(0, '09:30'), 'Proposta com 12% de desconto aguardando aprovação da Gerência', 'Juliana Rocha', 'interno')] });
    // 5. Pago — gerar pedido de compra
    const p5 = prop([it('MAT-05', 3), it('MAT-09', 4), it('MAT-11', 6), it('MAT-06', 1), it('MAT-12', 10)], 'Troca do condutor lateral e instalação de tela protetora.', 640, 0, d(-4, '15:00'), 'Aprovada');
    V.push({ id: 'VEN-4018', ts: d(-7, '10:00'), clienteId: 'CLI-207', srv: 'SRV-06', titulo: 'Troca de condutor e tela contra folhas', desc: 'Condutor lateral transbordando.', fotos: ['condutor'], etapa: 'pago',
      aval: { pro: 'PRF-106', data: d(-5, '09:00'), status: 'Realizada', medidas: '9 m de condutor; 10 m de calha', obs: 'Condutor subdimensionado e entupido.', fotos: [] }, prop: p5,
      pag: { forma: 'Pix', parcelas: 1, valor: Math.round(pTotal(p5) * 95) / 100, status: 'Pago', ts: d(-1, '11:20') }, compra: null, entrega: null, inst: { pro: 'PRF-106', data: null, status: 'A agendar', etapas: execE(0), repasse: { valor: pRepasse(p5), status: 'Previsto' } }, ocorrencias: [], custos: [], pos: null,
      m: { criado: d(-7, '10:00'), proposta: d(-4, '15:00'), aprovado: d(-2, '18:00'), pago: d(-1, '11:20') },
      hist: [H(d(-7, '10:00'), 'Pedido de orçamento recebido', 'Gustavo Ramos'), H(d(-2, '18:00'), 'Proposta aprovada pelo cliente', 'Gustavo Ramos'), H(d(-1, '11:20'), 'Pagamento confirmado (Pix)', 'Sistema')] });
    // 6. Compra confirmada
    const p6 = prop([it('MAT-02', 16), it('MAT-08', 20), it('MAT-06', 2), it('MAT-05', 3)], 'Instalação de 16 m de calha de alumínio e duas descidas.', 1300, 5, d(-8, '10:00'), 'Aprovada');
    V.push({ id: 'VEN-4016', ts: d(-10, '09:00'), clienteId: 'CLI-204', srv: 'SRV-01', titulo: 'Calhas de alumínio na casa nova', desc: 'Casa sem calhas na fachada e nos fundos.', fotos: ['aluminio'], etapa: 'compra',
      aval: { pro: 'PRF-105', data: d(-9, '14:00'), status: 'Realizada', medidas: '16 m de calha; 2 descidas', obs: '', fotos: [] }, prop: p6,
      pag: { forma: 'Cartão', parcelas: 3, valor: pTotal(p6), status: 'Pago', ts: d(-5, '20:10') }, compra: { id: 'OC-0311', forn: 'FOR-2', valor: pCusto(p6), status: 'Confirmada', previsao: d(1, '10:00'), ts: d(-4, '09:00') }, entrega: null,
      inst: { pro: 'PRF-105', data: null, status: 'A agendar', etapas: execE(0), repasse: { valor: pRepasse(p6), status: 'Previsto' } }, ocorrencias: [], custos: [], pos: null,
      m: { criado: d(-10, '09:00'), proposta: d(-8, '10:00'), aprovado: d(-6, '10:00'), pago: d(-5, '20:10'), compra: d(-4, '09:00') },
      hist: [H(d(-10, '09:00'), 'Pedido de orçamento recebido', 'Helena Martins'), H(d(-5, '20:10'), 'Pagamento confirmado (cartão 3x)', 'Sistema'), H(d(-4, '09:00'), 'Pedido de compra OC-0311 enviado à Casa das Calhas Atacado', 'Juliana Rocha'), H(d(-3, '15:00'), 'Fornecedor confirmou entrega para ' + A.fd(d(1)), 'Juliana Rocha')] });
    // 7. Instalação agendada amanhã (Carlos)
    const p7 = prop([it('MAT-01', 26), it('MAT-08', 32), it('MAT-05', 4), it('MAT-06', 4), it('MAT-10', 3)], 'Troca completa das calhas da quadra coberta.', 2300, 0, d(-12, '10:00'), 'Aprovada');
    V.push({ id: 'VEN-4015', ts: d(-14, '10:00'), clienteId: 'CLI-206', srv: 'SRV-02', titulo: 'Troca de calhas da quadra coberta', desc: 'Calhas da quadra com vários pontos de vazamento.', fotos: ['calha-frontal'], etapa: 'agendada',
      aval: { pro: 'PRF-101', data: d(-13, '09:00'), status: 'Realizada', medidas: '26 m de calha; 4 descidas', obs: '', fotos: [] }, prop: p7,
      pag: { forma: 'Boleto', parcelas: 1, valor: pTotal(p7), status: 'Pago', ts: d(-9, '10:00') }, compra: { id: 'OC-0308', forn: 'FOR-1', valor: pCusto(p7), status: 'Recebida', previsao: d(-3, '10:00'), ts: d(-8, '09:00') },
      entrega: { data: d(0, '16:00'), status: 'Programada' }, inst: { pro: 'PRF-101', data: d(1, '08:00'), status: 'Agendada', etapas: execE(0), repasse: { valor: pRepasse(p7), status: 'Previsto' }, conferidos: [] }, ocorrencias: [], custos: [], pos: null,
      m: { criado: d(-14, '10:00'), proposta: d(-12, '10:00'), aprovado: d(-10, '09:00'), pago: d(-9, '10:00'), compra: d(-8, '09:00') },
      hist: [H(d(-14, '10:00'), 'Pedido de orçamento recebido', 'Escola Pequeno Saber'), H(d(-9, '10:00'), 'Pagamento confirmado (boleto)', 'Sistema'), H(d(-3, '10:00'), 'Materiais recebidos no depósito', 'Juliana Rocha'), H(d(-2, '11:00'), 'Entrega e instalação programadas', 'Juliana Rocha')] });
    // 8. Em execução com ocorrência (faltou peça)
    const p8 = prop([it('MAT-01', 14), it('MAT-08', 18), it('MAT-06', 2), it('MAT-05', 2), it('MAT-10', 3)], 'Troca de 14 m de calha e duas descidas sobre a área de produção.', 1400, 0, d(-11, '10:00'), 'Aprovada');
    V.push({ id: 'VEN-4012', ts: d(-13, '15:00'), clienteId: 'CLI-205', srv: 'SRV-02', titulo: 'Troca de calha sobre a área do forno', desc: 'Calha antiga com furos sobre a produção.', fotos: ['vazamento'], etapa: 'execucao',
      aval: { pro: 'PRF-101', data: d(-12, '08:00'), status: 'Realizada', medidas: '14 m de calha; 2 descidas', obs: '', fotos: [] }, prop: p8,
      pag: { forma: 'Pix', parcelas: 1, valor: Math.round(pTotal(p8) * 95) / 100, status: 'Pago', ts: d(-8, '09:30') }, compra: { id: 'OC-0305', forn: 'FOR-1', valor: pCusto(p8), status: 'Recebida', previsao: d(-4, '10:00'), ts: d(-7, '09:00') },
      entrega: { data: d(-1, '07:30'), status: 'Entregue', recebidoPor: 'Antônio Ribeiro' }, inst: { pro: 'PRF-101', data: d(-1, '08:00'), status: 'Em execução', inicio: d(-1, '08:10'), fimPrev: d(0, '17:00'), etapas: execE(3, d(-1, '15:00')), repasse: { valor: pRepasse(p8), status: 'Previsto' }, conferidos: [] },
      ocorrencias: [{ id: 'OCR-07', tipo: 'Falta de material', desc: 'Faltou 1 bocal de saída 88 mm para a segunda descida. Instalação parada nesse trecho.', ts: d(0, '10:30'), status: 'Aberta', por: 'Carlos Mendes' }], custos: [], pos: null,
      m: { criado: d(-13, '15:00'), proposta: d(-11, '10:00'), aprovado: d(-9, '10:00'), pago: d(-8, '09:30'), compra: d(-7, '09:00'), entrega: d(-1, '07:30') },
      hist: [H(d(-13, '15:00'), 'Pedido de orçamento recebido', 'Padaria Pão Dourado'), H(d(-1, '07:30'), 'Materiais entregues no local', 'Juliana Rocha'), H(d(-1, '08:10'), 'Instalação iniciada', 'Carlos Mendes'), H(d(0, '10:30'), 'Ocorrência: faltou 1 bocal de saída 88 mm', 'Carlos Mendes')] });
    // 9. Concluído aguardando confirmação
    const p9 = prop([it('MAT-02', 8), it('MAT-08', 10), it('MAT-06', 1), it('MAT-05', 1)], 'Instalação de calha de alumínio na área gourmet.', 680, 0, d(-15, '10:00'), 'Aprovada');
    V.push({ id: 'VEN-4010', ts: d(-18, '10:00'), clienteId: 'CLI-210', srv: 'SRV-01', titulo: 'Calha de alumínio na área gourmet', desc: '', fotos: ['aluminio'], etapa: 'concluido',
      aval: { pro: 'PRF-102', data: d(-17, '10:00'), status: 'Realizada', medidas: '8 m', obs: '', fotos: [] }, prop: p9,
      pag: { forma: 'Cartão', parcelas: 2, valor: pTotal(p9), status: 'Pago', ts: d(-13, '10:00') }, compra: { id: 'OC-0302', forn: 'FOR-2', valor: pCusto(p9), status: 'Recebida', previsao: d(-9), ts: d(-12, '09:00') }, entrega: { data: d(-3, '08:00'), status: 'Entregue', recebidoPor: 'Tiago Moreira' },
      inst: { pro: 'PRF-102', data: d(-2, '08:00'), status: 'Concluída', inicio: d(-2, '08:00'), fim: d(-1, '15:00'), fimPrev: d(-1, '17:00'), etapas: execE(6, d(-1, '15:00')), repasse: { valor: pRepasse(p9), status: 'Previsto' }, conclusao: { obs: 'Instalação concluída e testada.', fotos: ['aluminio'] } }, ocorrencias: [], custos: [], pos: null,
      m: { criado: d(-18, '10:00'), proposta: d(-15, '10:00'), aprovado: d(-14, '10:00'), pago: d(-13, '10:00'), compra: d(-12, '09:00'), entrega: d(-3, '08:00'), concluido: d(-1, '15:00') },
      hist: [H(d(-18, '10:00'), 'Pedido de orçamento recebido', 'Tiago Moreira'), H(d(-1, '15:00'), 'Instalação concluída pelo parceiro', 'Rafael Lima')] });
    // 10. Pós-venda com chamado de garantia e repasse liberado
    const p10 = prop([it('MAT-01', 12), it('MAT-08', 15), it('MAT-06', 1), it('MAT-05', 2)], 'Troca de 12 m de calha da frente do sobrado.', 1100, 0, d(-35, '10:00'), 'Aprovada');
    V.push({ id: 'VEN-4006', ts: d(-38, '09:00'), clienteId: 'CLI-209', srv: 'SRV-02', titulo: 'Troca de 12 m de calha em sobrado', desc: '', fotos: ['calha-frontal'], etapa: 'posvenda',
      aval: { pro: 'PRF-104', data: d(-36, '10:00'), status: 'Realizada', medidas: '12 m', obs: '', fotos: [] }, prop: p10,
      pag: { forma: 'Pix', parcelas: 1, valor: Math.round(pTotal(p10) * 95) / 100, status: 'Pago', ts: d(-33, '10:00') }, compra: { id: 'OC-0297', forn: 'FOR-1', valor: pCusto(p10), status: 'Recebida', previsao: d(-30), ts: d(-32, '09:00') }, entrega: { data: d(-29, '08:00'), status: 'Entregue', recebidoPor: 'Sérgio Almeida' },
      inst: { pro: 'PRF-104', data: d(-28, '08:00'), status: 'Concluída', inicio: d(-28, '08:00'), fim: d(-28, '16:00'), fimPrev: d(-28, '17:00'), etapas: execE(6, d(-28, '16:00')), repasse: { valor: pRepasse(p10), status: 'Liberado', ts: d(-26, '10:00') } }, ocorrencias: [], custos: [{ desc: 'Frete de entrega', valor: FRETE_CUSTO, tipo: 'Frete', ts: d(-29) }],
      confirmCli: d(-27, '10:00'), pos: { garantiaAte: d(337), chamados: [{ id: 'CH-031', tipo: 'Garantia', desc: 'Pingando na emenda perto da descida depois da chuva de ontem.', ts: d(-1, '19:00'), status: 'Aberto', resp: [] }], avaliacao: { nota: 4, txt: 'Bom serviço, mas apareceu uma goteira.', ts: d(-27, '10:05') } },
      m: { criado: d(-38, '09:00'), proposta: d(-35, '10:00'), aprovado: d(-34, '10:00'), pago: d(-33, '10:00'), compra: d(-32, '09:00'), entrega: d(-29, '08:00'), concluido: d(-28, '16:00') },
      hist: [H(d(-38, '09:00'), 'Pedido de orçamento recebido', 'Sérgio Almeida'), H(d(-27, '10:00'), 'Cliente confirmou a conclusão', 'Sérgio Almeida'), H(d(-1, '19:00'), 'Chamado de garantia aberto', 'Sérgio Almeida')] });
    // Pedido anterior da Mariana
    const p11 = prop([it('MAT-12', 18)], 'Limpeza completa e instalação de tela protetora em 18 m de calha.', 380, 0, d(-64, '10:00'), 'Aprovada');
    V.push({ id: 'VEN-3988', ts: d(-66, '09:00'), clienteId: 'CLI-201', srv: 'SRV-04', titulo: 'Limpeza e tela protetora nas calhas', desc: '', fotos: ['limpeza'], etapa: 'posvenda',
      aval: { pro: 'PRF-103', data: d(-65, '10:00'), status: 'Realizada', medidas: '18 m', obs: '', fotos: [] }, prop: p11,
      pag: { forma: 'Pix', parcelas: 1, valor: Math.round(pTotal(p11) * 95) / 100, status: 'Pago', ts: d(-63, '10:00') }, compra: { id: 'OC-0280', forn: 'FOR-2', valor: pCusto(p11), status: 'Recebida', previsao: d(-61), ts: d(-63, '12:00') }, entrega: { data: d(-60, '08:00'), status: 'Entregue', recebidoPor: 'Mariana Costa' },
      inst: { pro: 'PRF-103', data: d(-60, '08:00'), status: 'Concluída', inicio: d(-60, '08:00'), fim: d(-60, '12:00'), fimPrev: d(-60, '17:00'), etapas: execE(6, d(-60, '12:00')), repasse: { valor: pRepasse(p11), status: 'Pago', ts: d(-55, '10:00') } }, ocorrencias: [], custos: [{ desc: 'Frete de entrega', valor: FRETE_CUSTO, tipo: 'Frete', ts: d(-60) }],
      confirmCli: d(-59, '09:00'), pos: { garantiaAte: d(305), chamados: [], avaliacao: { nota: 5, txt: 'Tudo resolvido com um único contato. Recomendo!', ts: d(-59, '09:05') } },
      m: { criado: d(-66, '09:00'), proposta: d(-64, '10:00'), aprovado: d(-63, '09:00'), pago: d(-63, '10:00'), compra: d(-63, '12:00'), entrega: d(-60, '08:00'), concluido: d(-60, '12:00') }, hist: [H(d(-66, '09:00'), 'Pedido de orçamento recebido', 'Mariana Costa'), H(d(-59, '09:05'), 'Pedido avaliado: 5 estrelas', 'Mariana Costa')] });
    // Histórico para financeiro e relatórios
    const rnd = A.rng(77);
    const nomes = [['Luciana Prado', 'Valinhos'], ['Ricardo Sato', 'Campinas'], ['Daniela Vieira', 'Paulínia'], ['Rogério Campos', 'Jundiaí'], ['Patrícia Lemos', 'Indaiatuba'], ['André Luiz', 'Americana'], ['Fábio Nogueira', 'Campinas'], ['Marta Ribeiro', 'Valinhos'], ['Vinícius Rocha', 'Sumaré'], ['Vanessa Dias', 'Hortolândia'], ['Caio Mendonça', 'Campinas'], ['Sílvia Torres', 'Vinhedo'], ['Otávio Brandão', 'Jundiaí'], ['Lígia Paiva', 'Campinas'], ['Hugo Tavares', 'Sumaré'], ['Renato Pires', 'Hortolândia'], ['Bruna Castro', 'Campinas'], ['Felipe Araújo', 'Valinhos']];
    const ativos = b.pros.filter((p) => p.status === 'Ativo');
    nomes.forEach((n, i) => {
      const cand = ativos.filter((p) => p.regioes.indexOf(n[1]) >= 0);
      const pr = cand[Math.floor(rnd() * cand.length)];
      const srv = pr.servicos[Math.floor(rnd() * pr.servicos.length)];
      const t0 = -(8 + i * 5 + Math.floor(rnd() * 3));
      const base = [['MAT-01', 6 + Math.floor(rnd() * 16)], ['MAT-08', 8 + Math.floor(rnd() * 14)], ['MAT-06', 1 + Math.floor(rnd() * 2)], ['MAT-05', 1 + Math.floor(rnd() * 3)], ['MAT-10', 1 + Math.floor(rnd() * 3)], ['MAT-12', 6 + Math.floor(rnd() * 10)]];
      const itens = base.filter((x, k) => k < 2 || rnd() < 0.6).map((x) => it(x[0], x[1]));
      const p = prop(itens, 'Serviço de ' + b.servicos.find((s) => s.id === srv).nome.toLowerCase() + '.', 500 + Math.round(rnd() * 16) * 100, rnd() < 0.3 ? 5 : 0, d(t0 + 2, '10:00'), 'Aprovada');
      const forma = ['Pix', 'Cartão', 'Boleto'][Math.floor(rnd() * 3)];
      const val = forma === 'Pix' ? Math.round(pTotal(p) * 95) / 100 : pTotal(p);
      const pay = t0 + 3, cpra = t0 + 3, ent = t0 + 6, ins = t0 + 7, conc = Math.min(-1, t0 + 7 + (rnd() < 0.2 ? 2 : 0));
      const adic = rnd() < 0.22 ? [{ desc: 'Reposição de peça faltante', valor: 18.5 + Math.round(rnd() * 3) * 12, tipo: 'Adicional', ts: d(conc) }] : [];
      const rep = i < 2 ? 'Liberado' : 'Pago';
      V.push({ id: 'VEN-' + (3990 + i), ts: d(t0, '09:00'), clienteId: '', clienteNome: n[0], cidadeAvulsa: n[1], srv: srv, titulo: b.servicos.find((s) => s.id === srv).nome, desc: '', fotos: [], etapa: 'posvenda',
        aval: { pro: pr.id, data: d(t0 + 1, '10:00'), status: 'Realizada', medidas: '', obs: '', fotos: [] }, prop: p, pag: { forma: forma, parcelas: forma === 'Cartão' ? 3 : 1, valor: val, status: 'Pago', ts: d(pay, '10:00') },
        compra: { id: 'OC-' + String(250 + i * 2).padStart(4, '0'), forn: ['FOR-1', 'FOR-2', 'FOR-3'][i % 3], valor: pCusto(p), status: 'Recebida', previsao: d(cpra + 2), ts: d(cpra, '14:00') }, entrega: { data: d(ent, '08:00'), status: 'Entregue', recebidoPor: n[0] },
        inst: { pro: pr.id, data: d(ins, '08:00'), status: 'Concluída', inicio: d(ins, '08:00'), fim: d(conc, '16:00'), fimPrev: d(ins, '17:00'), etapas: execE(6, d(conc, '16:00')), repasse: { valor: pRepasse(p), status: rep, ts: d(Math.min(0, conc + 5), '10:00') } },
        ocorrencias: adic.length ? [{ id: 'OCR-H' + i, tipo: 'Falta de material', desc: 'Peça faltante reposta.', ts: d(conc, '10:00'), status: 'Resolvida', custo: adic[0].valor, solucao: 'Reposição de peça' }] : [],
        custos: [{ desc: 'Frete de entrega', valor: FRETE_CUSTO, tipo: 'Frete', ts: d(ent) }].concat(adic), confirmCli: d(Math.min(0, conc + 1), '09:00'), atrasou: conc > ins,
        pos: { garantiaAte: d(conc + 365), chamados: rnd() < 0.15 ? [{ id: 'CH-H' + i, tipo: 'Dúvida', desc: 'Dúvida sobre limpeza da tela.', ts: d(Math.min(0, conc + 3), '10:00'), status: 'Resolvido', resp: [{ ts: d(Math.min(0, conc + 3), '14:00'), txt: 'Orientação enviada.', por: 'Juliana Rocha' }] }] : [], avaliacao: { nota: rnd() < 0.15 ? 3 : rnd() < 0.45 ? 4 : 5, txt: '', ts: d(Math.min(0, conc + 1), '09:05') } },
        m: { criado: d(t0, '09:00'), proposta: d(t0 + 2, '10:00'), aprovado: d(t0 + 3, '09:00'), pago: d(pay, '10:00'), compra: d(cpra, '14:00'), entrega: d(ent, '08:00'), concluido: d(conc, '16:00') }, hist: [H(d(t0, '09:00'), 'Pedido de orçamento recebido', n[0]), H(d(conc, '16:00'), 'Instalação concluída', pr.nome)] });
    });
    b.vendas = V;
    b.repasseFixo = REPASSE;
    return b;
  }
  function seedLogs() {
    return A.L([
      [-5, '20:10', 'Sistema', 'sistema', 'Pagamento confirmado (cartão 3x)', 'VEN-4016'],
      [-4, '09:00', 'Juliana Rocha', 'mediador', 'Pedido de compra enviado ao fornecedor', 'OC-0311 · Casa das Calhas Atacado'],
      [-3, '10:00', 'Juliana Rocha', 'mediador', 'Recebimento de materiais registrado', 'OC-0308 · VEN-4015'],
      [-2, '10:40', 'Carlos Mendes', 'profissional', 'Avaliação técnica registrada', 'VEN-4021'],
      [-2, '11:00', 'Juliana Rocha', 'mediador', 'Entrega e instalação programadas', 'VEN-4015 · Mendes Calhas & Coberturas'],
      [-2, '18:00', 'Gustavo Ramos', 'cliente', 'Proposta aprovada', 'VEN-4018'],
      [-1, '08:10', 'Carlos Mendes', 'profissional', 'Instalação iniciada', 'VEN-4012'],
      [-1, '11:20', 'Sistema', 'sistema', 'Pagamento confirmado (Pix)', 'VEN-4018'],
      [-1, '14:50', 'Ana Beatriz Souza', 'profissional', 'Avaliação técnica registrada', 'VEN-4022'],
      [-1, '15:00', 'Rafael Lima', 'profissional', 'Instalação concluída', 'VEN-4010'],
      [-1, '16:00', 'Juliana Rocha', 'mediador', 'Proposta enviada ao cliente', 'VEN-4021 · ' + A.money(1908.9)],
      [-1, '19:00', 'Sérgio Almeida', 'cliente', 'Chamado de garantia aberto', 'VEN-4006 · CH-031'],
      [0, '09:30', 'Juliana Rocha', 'mediador', 'Proposta enviada para aprovação de alçada (desconto 12%)', 'VEN-4020 · Gerência'],
      [0, '10:30', 'Carlos Mendes', 'profissional', 'Ocorrência registrada: falta de material', 'VEN-4012 · OCR-07'],
    ]);
  }

  /* ------------------------------------------------------------------
     Auxiliares
     ------------------------------------------------------------------ */
  const nomeCli = (v) => (v.clienteId ? cli(v.clienteId).nome : v.clienteNome);
  const cidadeOf = (v) => (v.clienteId ? cli(v.clienteId).cidade : v.cidadeAvulsa);
  const proDe = (v) => (v.inst && v.inst.pro) || (v.aval && v.aval.pro);
  const ensureInst = (v) => { if (!v.inst) v.inst = { pro: (v.aval && v.aval.pro) || 'PRF-101', data: null, status: 'A agendar', etapas: EXEC.map((n) => ({ n: n, ok: false, ts: null })), repasse: null }; return v.inst; };
  const hist = (v, txt, vis, by) => v.hist.push({ ts: A.now(), txt: txt, by: by || A.me().nome, vis: vis || 'all' });
  const meus = () => { const p = A.profile(); return db().vendas.filter((v) => (p === 'cliente' ? v.clienteId === MYCLI : p === 'profissional' ? proDe(v) === MYPRO : true)); };
  const ativos = () => db().vendas.filter((v) => ['posvenda', 'cancelada'].indexOf(v.etapa) < 0 || (v.pos && v.pos.chamados.some((c) => c.status !== 'Resolvido')) || (v.inst && v.inst.repasse && v.inst.repasse.status === 'Liberado'));
  function pendMed(v) {
    const o = [];
    if (v.etapa === 'avaliacao' && !v.aval) o.push('Agendar avaliação técnica');
    if (v.etapa === 'proposta') o.push('Montar proposta');
    if (v.etapa === 'alcada') o.push('Aprovação de alçada (' + v.prop.alcada.nivel + ')');
    if (v.etapa === 'pago') o.push('Gerar pedido de compra');
    if (v.etapa === 'compra' && v.compra.status === 'Solicitada') o.push('Confirmar pedido com fornecedor');
    if (v.etapa === 'compra' && v.compra.status === 'Confirmada') o.push('Registrar recebimento dos materiais');
    if (v.etapa === 'entrega') o.push('Programar entrega e instalação');
    if (v.etapa === 'agendada' && v.entrega.status !== 'Entregue') o.push('Registrar entrega no local');
    v.ocorrencias.filter((x) => x.status === 'Aberta').forEach((x) => o.push('Tratar ocorrência: ' + x.tipo.toLowerCase()));
    if (v.etapa === 'concluido') o.push('Confirmar conclusão com o cliente');
    if (v.inst && v.inst.repasse && v.inst.repasse.status === 'Liberado') o.push('Pagar repasse ao parceiro');
    if (v.pos) v.pos.chamados.filter((c) => c.status !== 'Resolvido').forEach((c) => o.push('Responder chamado: ' + c.tipo.toLowerCase()));
    return o;
  }
  function propTable(p, showCost) {
    return A.table([{ l: 'Material', f: (x) => e(x.nome) }, { l: 'Qtd.', cls: 'r', f: (x) => A.num(x.qtd, x.qtd % 1 ? 1 : 0) + ' ' + e(x.un) }, { l: 'Unitário', cls: 'r', f: (x) => A.money(x.preco) }].concat(showCost ? [{ l: 'Custo unit.', cls: 'r', f: (x) => A.money(x.custo) }] : []).concat([{ l: 'Subtotal', cls: 'r', f: (x) => A.money(x.qtd * x.preco) }]), p.itens, { empty: 'Sem materiais.' }) +
      '<div class="calc"><dl><dt>Materiais</dt><dd>' + A.money(pMat(p)) + '</dd><dt>Instalação — ' + e(p.inst.desc) + '</dt><dd>' + A.money(p.inst.valor) + '</dd><dt>Frete e entrega</dt><dd>' + A.money(p.frete) + '</dd>' + (+p.descPct ? '<dt>Desconto (' + A.num(p.descPct, 1) + '%)</dt><dd>− ' + A.money(pDesc(p)) + '</dd>' : '') + '<dt class="tot">Total da proposta</dt><dd class="tot">' + A.money(pTotal(p)) + '</dd></dl></div>';
  }
  function finBox(v) {
    const p = v.prop; if (!p) return A.empty('Sem proposta.');
    const rec = v.pag && v.pag.status === 'Pago' ? v.pag.valor : pTotal(p);
    const m = margem(v);
    return '<div class="calc"><dl><dt>Receita ' + (v.pag && v.pag.status === 'Pago' ? 'recebida' : 'prevista') + '</dt><dd>' + A.money(rec) + '</dd><dt>(−) Custo dos materiais</dt><dd>' + A.money(pCusto(p)) + '</dd><dt>(−) Repasse de instalação (' + Math.round(REPASSE * 100) + '%)</dt><dd>' + A.money(pRepasse(p)) + '</dd><dt>(−) Frete (custo)</dt><dd>' + A.money(FRETE_CUSTO) + '</dd><dt>(−) Custos adicionais</dt><dd>' + A.money(adicionais(v)) + '</dd><dt class="tot">Margem de contribuição</dt><dd class="tot" style="color:' + (m < 0 ? 'var(--bad)' : 'var(--ok)') + '">' + A.money(m) + ' (' + A.pct(m, rec) + ')</dd></dl></div>';
  }

  /* ------------------------------------------------------------------
     Detalhe do pedido (cliente e mediador) e da OS (profissional)
     ------------------------------------------------------------------ */
  function actsFor(v) {
    const p = A.profile(), B = [], id = { id: v.id };
    if (p === 'cliente') {
      if (v.etapa === 'enviada') { B.push(A.b('Aprovar proposta', 'c4.aprovar', id, 'ok', 'check')); B.push(A.b('Solicitar revisão', 'c4.revisao', id, '', 'edit')); }
      if (v.etapa === 'aprovada') B.push(A.b('Pagar agora', 'c4.pagar', id, 'p', 'wallet'));
      if (v.etapa === 'agendada' && v.entrega && v.entrega.status === 'Entregue' && !v.entrega.confCli) B.push(A.b('Confirmar recebimento dos materiais', 'c4.cliEntrega', id, 'p', 'box'));
      if (v.etapa === 'concluido') B.push(A.b('Confirmar conclusão e avaliar', 'c4.cliConclui', id, 'ok', 'check'));
      if (v.etapa === 'posvenda') { B.push(A.b('Abrir chamado', 'c4.chamado', id, '', 'chat')); if (!v.pos.avaliacao) B.push(A.b('Avaliar', 'c4.cliConclui', id, 'p', 'star')); }
    } else if (p === 'mediador') {
      if (v.etapa === 'avaliacao') B.push(A.b(v.aval ? 'Reagendar avaliação técnica' : 'Agendar avaliação técnica', 'c4.agAval', id, v.aval ? '' : 'p', 'calendar'));
      if (v.etapa === 'avaliacao' && v.aval && v.aval.status === 'Agendada') B.push(A.b('Registrar avaliação recebida do parceiro', 'c4.regAval', id, 'p', 'clipboard'));
      if (v.etapa === 'proposta') B.push(A.b('Montar proposta', 'c4.montar', id, 'p', 'receipt'));
      if (v.etapa === 'alcada') { B.push(A.b('Aprovar desconto (' + v.prop.alcada.nivel + ')', 'c4.alcadaOk', id, 'ok', 'scale')); B.push(A.b('Recusar desconto', 'c4.alcadaNo', id, 'dg', 'x')); }
      if (v.etapa === 'enviada') { B.push(A.b('Revisar proposta', 'c4.montar', id, '', 'edit')); B.push(A.b('Registrar aprovação do cliente', 'c4.aprovarPor', id, 'ok', 'check')); }
      if (v.etapa === 'aprovada') B.push(A.b('Registrar pagamento recebido', 'c4.pagManual', id, 'p', 'money'));
      if (v.etapa === 'pago') B.push(A.b('Gerar pedido de compra', 'c4.gerarOC', id, 'p', 'cart'));
      if (v.etapa === 'compra' && v.compra.status === 'Solicitada') B.push(A.b('Confirmar pedido com fornecedor', 'c4.ocConf', id, 'p', 'check'));
      if (v.etapa === 'compra' && v.compra.status === 'Confirmada') B.push(A.b('Registrar recebimento dos materiais', 'c4.ocReceb', id, 'p', 'box'));
      if (v.etapa === 'entrega') B.push(A.b('Programar entrega e instalação', 'c4.programar', id, 'p', 'calendar'));
      if (v.etapa === 'agendada') { if (v.entrega.status !== 'Entregue') B.push(A.b('Registrar entrega no local', 'c4.entregar', id, 'p', 'truck')); B.push(A.b('Reagendar instalação', 'c4.programar', id, '', 'calendar')); }
      v.ocorrencias.filter((x) => x.status === 'Aberta').forEach((x) => B.push(A.b('Tratar ocorrência ' + x.id, 'c4.tratarOcr', { id: v.id, o: x.id }, 'dg', 'alert')));
      if (v.etapa === 'concluido') B.push(A.b('Confirmar conclusão com o cliente', 'c4.confMed', id, 'ok', 'phone'));
      if (v.inst && v.inst.repasse && v.inst.repasse.status === 'Liberado') B.push(A.b('Pagar repasse (simulado)', 'c4.pagarRepasse', id, 'p', 'wallet'));
      if (v.pos) v.pos.chamados.filter((c) => c.status !== 'Resolvido').forEach((c) => B.push(A.b('Responder chamado ' + c.id, 'c4.chResp', { id: v.id, c: c.id }, '', 'chat')));
      if (['avaliacao', 'proposta', 'alcada', 'enviada', 'aprovada'].indexOf(v.etapa) >= 0) B.push(A.b('Cancelar pedido', 'c4.cancelar', id, 'gh', 'x'));
      B.push(A.b('Registrar custo adicional', 'c4.custo', id, 'gh', 'receipt'));
    }
    return B;
  }
  function trackHTML(v) {
    const ev = [];
    if (v.m.proposta) ev.push({ ts: v.m.proposta, txt: 'Proposta emitida pela AiCalhas' });
    if (v.prop && v.prop.aprovadaEm) ev.push({ ts: v.prop.aprovadaEm, txt: 'Proposta aprovada' });
    if (v.pag && v.pag.status === 'Pago') ev.push({ ts: v.pag.ts, txt: 'Pagamento confirmado (' + v.pag.forma + (v.pag.parcelas > 1 ? ' ' + v.pag.parcelas + 'x' : '') + ') — ' + A.money(v.pag.valor), tone: 'ok' });
    if (v.compra) ev.push({ ts: v.compra.ts, txt: 'Materiais em compra — ' + v.compra.status.toLowerCase() + (v.compra.previsao && v.compra.status !== 'Recebida' ? ' (previsão ' + A.fd(v.compra.previsao) + ')' : '') });
    if (v.entrega) ev.push({ ts: v.entrega.data, txt: 'Entrega no local — ' + v.entrega.status.toLowerCase(), tone: v.entrega.status === 'Entregue' ? 'ok' : '' });
    if (v.inst && v.inst.data) ev.push({ ts: v.inst.data, txt: 'Instalação — ' + v.inst.status.toLowerCase() + (v.inst.status === 'Em execução' ? ' (' + instProg(v) + '%)' : ''), tone: v.inst.status === 'Concluída' ? 'ok' : '' });
    v.ocorrencias.forEach((o) => ev.push({ ts: o.ts, txt: 'Ocorrência: ' + o.desc + (o.status === 'Resolvida' ? ' — resolvida: ' + (o.solucao || '') : ''), tone: o.status === 'Resolvida' ? 'ok' : 'warn' }));
    if (v.confirmCli) ev.push({ ts: v.confirmCli, txt: 'Conclusão confirmada pelo cliente', tone: 'ok' });
    return A.timeline(ev.sort((a, b) => (a.ts < b.ts ? 1 : -1)));
  }
  const instProg = (v) => (v.inst ? Math.round((v.inst.etapas.filter((x) => x.ok).length / v.inst.etapas.length) * 100) : 0);
  function vPedido() {
    const v = ven(A.sel(A.profile() === 'cliente' ? 'pedido' : 'venda'));
    if (!v) return A.empty('Pedido não encontrado.');
    const p = A.profile(), med = p === 'mediador';
    const tab = A.tab('ven', 'resumo');
    const tabs = [{ id: 'resumo', l: 'Resumo' }, { id: 'proposta', l: 'Proposta' }, { id: 'acomp', l: 'Acompanhamento' }].concat(med ? [{ id: 'fin', l: 'Financeiro' }, { id: 'compra', l: 'Compra e entrega' }, { id: 'hist', l: 'Histórico' }] : [{ id: 'docs', l: 'Documentos' }]);
    let body = '';
    const pf = proDe(v) ? pro(proDe(v)) : null;
    if (tab === 'resumo') {
      body = '<div class="g2"><div>' + A.dl([['Serviço', e(srvName(v.srv))], ['Etapa', etBadge(v)], ['Cliente', e(nomeCli(v))], ['Cidade', e(cidadeOf(v))], ['Valor', v.prop ? A.money(pTotal(v.prop)) : 'Em elaboração'], ['Pagamento', v.pag ? A.badge(v.pag.status) + ' ' + e(v.pag.forma) : '—'], ['Parceiro de instalação', pf ? e(pf.empresa) : 'A definir'], ['Instalação', v.inst && v.inst.data ? A.fdt(v.inst.data) : 'A agendar']]) + '</div>' +
        '<div>' + (v.aval ? A.card('Avaliação técnica', A.dl([['Data', A.fdt(v.aval.data)], ['Situação', A.badge(v.aval.status === 'Realizada' ? 'Realizada' : 'Agendada')], ['Medidas', e(v.aval.medidas || '—')]]) + (v.aval.obs ? '<p class="mt">' + e(v.aval.obs) + '</p>' : '')) : A.empty('Avaliação técnica a agendar.', 'calendar')) + '</div></div>' +
        (v.ocorrencias.some((o) => o.status === 'Aberta') ? '<div class="mt"></div>' + v.ocorrencias.filter((o) => o.status === 'Aberta').map((o) => A.note('<b>Ocorrência ' + e(o.id) + ' (' + e(o.tipo) + '):</b> ' + e(o.desc), 'bad')).join('') : '') +
        (v.pos ? '<div class="mt"></div>' + A.note('Garantia até <b>' + A.fd(v.pos.garantiaAte) + '</b>.' + (v.pos.avaliacao ? ' Avaliação: ' + A.stars(v.pos.avaliacao.nota) : ''), '', 'shield') : '');
    } else if (tab === 'proposta') {
      if (!v.prop || (p === 'cliente' && ['Em elaboração', 'Aguardando alçada'].indexOf(v.prop.status) >= 0)) body = A.empty('A proposta está sendo preparada pela AiCalhas a partir da avaliação técnica.', 'receipt');
      else body = '<div class="row mb16">' + A.badge(v.prop.status) + '<span class="small muted">Versão ' + v.prop.versao + ' — emitida em ' + A.fdt(v.prop.emitida) + ' — válida até ' + A.fd(v.prop.validade) + '</span></div>' + propTable(v.prop, med) + '<div class="mt">' + A.dl([['Condições de pagamento', e(v.prop.condicoes)], ['Observações', e(v.prop.obs)]]) + '</div>' +
        (v.prop.alcada ? '<div class="mt"></div>' + A.note('<b>Alçada:</b> desconto de ' + A.num(v.prop.descPct, 1) + '% exige aprovação da ' + e(v.prop.alcada.nivel) + '. ' + (v.prop.alcada.aprovadoPor ? 'Aprovado por ' + e(v.prop.alcada.aprovadoPor) + ' em ' + A.fdt(v.prop.alcada.ts) + '.' : 'Motivo: ' + e(v.prop.alcada.motivo || '—')), v.prop.alcada.aprovadoPor ? '' : 'warn', 'scale') : '') +
        (v.prop.revisao ? '<div class="mt"></div>' + A.note('<b>Revisão solicitada pelo cliente:</b> ' + e(v.prop.revisao), 'warn') : '') +
        (med ? '<div class="mt"></div>' + A.card('Composição interna (não visível ao cliente)', finBox(v)) : '');
    } else if (tab === 'acomp') {
      body = (v.inst && v.inst.status === 'Em execução' ? '<div class="bar" style="grid-template-columns:auto 1fr auto;margin-bottom:14px"><span>Instalação</span><span class="tr"><span class="fl" style="width:' + instProg(v) + '%"></span></span><b>' + instProg(v) + '%</b></div>' : '') + trackHTML(v) +
        (p === 'cliente' ? '<div class="mt"></div>' + A.timeline(v.hist.filter((h) => h.vis === 'all').slice().reverse().slice(0, 8).map((h) => ({ ts: h.ts, txt: h.txt }))) : '');
    } else if (tab === 'fin') {
      body = '<div class="g2"><div>' + finBox(v) + '</div><div>' + A.dl([['Forma de pagamento', v.pag ? e(v.pag.forma + (v.pag.parcelas > 1 ? ' em ' + v.pag.parcelas + 'x' : '')) : '—'], ['Situação do pagamento', v.pag ? A.badge(v.pag.status) : A.badge('Aguardando pagamento', 'warn')], ['Repasse ao parceiro', v.inst && v.inst.repasse ? A.money(v.inst.repasse.valor) + ' ' + A.badge(v.inst.repasse.status) : '—'], ['Pedido de compra', v.compra ? e(v.compra.id) + ' — ' + A.money(v.compra.valor) : '—']], 'one') + '</div></div>' +
        '<h4 style="margin:16px 0 8px">Custos adicionais</h4>' + A.table([{ l: 'Data', f: (c) => A.fd(c.ts) }, { l: 'Descrição', f: (c) => e(c.desc) }, { l: 'Tipo', f: (c) => e(c.tipo) }, { l: 'Valor', cls: 'r', f: (c) => A.money(c.valor) }], v.custos, { empty: 'Nenhum custo adicional.' });
    } else if (tab === 'compra') {
      body = (v.compra ? A.card('Pedido de compra ' + v.compra.id, A.dl([['Fornecedor', e(forn(v.compra.forn).nome)], ['Situação', A.badge(v.compra.status)], ['Valor (custo)', A.money(v.compra.valor)], ['Previsão', A.fd(v.compra.previsao)]])) : A.empty('Pedido de compra ainda não gerado.', 'cart')) + '<div class="mt"></div>' +
        (v.entrega ? A.card('Entrega no local', A.dl([['Data', A.fdt(v.entrega.data)], ['Situação', A.badge(v.entrega.status)], ['Recebido por', e(v.entrega.recebidoPor || '—')]])) : '');
    } else if (tab === 'docs') {
      body = '<div class="stack" style="gap:8px">' + (v.prop && ['Enviada', 'Aprovada', 'Revisão solicitada'].indexOf(v.prop.status) >= 0 ? A.b('Proposta comercial', 'c4.doc', { id: v.id, t: 'proposta' }, '', 'file') : '') + (v.pag && v.pag.status === 'Pago' ? A.b('Recibo de pagamento', 'c4.doc', { id: v.id, t: 'recibo' }, '', 'receipt') : '') + (v.pos ? A.b('Termo de garantia', 'c4.doc', { id: v.id, t: 'garantia' }, '', 'shield') : '') + '</div>' + (!v.prop ? A.empty('Os documentos aparecem aqui conforme o pedido avança.', 'file') : '');
    } else {
      body = A.timeline(v.hist.slice().reverse().map((h) => ({ ts: h.ts, txt: (h.vis === 'interno' ? '[interno] ' : '') + h.txt, by: h.by })));
    }
    const acts = actsFor(v);
    const back = p === 'cliente' ? ['pedidos', 'Meus pedidos'] : ['vendas', 'Vendas e pedidos'];
    return A.ph(v.titulo, e(v.id) + ' — ' + e(nomeCli(v)) + ' — ' + e(cidadeOf(v)), etBadge(v), back) +
      A.card(null, A.stepper(STEPS, stepOf(v))) +
      (med && pendMed(v).length ? '<div class="mt"></div>' + A.note('<b>Próximas ações da AiCalhas:</b> ' + pendMed(v).map(e).join('; ') + '.', 'warn', 'flag') : '') +
      '<div class="g21 mt"><div>' + A.card(null, A.tabs('ven', tabs) + body) + '</div><div class="stack">' +
      (acts.length ? A.card(med ? 'Ações da AiCalhas' : 'O que fazer agora', '<div class="stack" style="gap:8px">' + acts.join('') + '</div>', { icon: med ? 'shield' : 'flag' }) : '') +
      (v.etapa === 'enviada' && p === 'cliente' ? A.card('Resumo da proposta', '<div class="calc" style="margin:0"><dl><dt>Materiais</dt><dd>' + A.money(pMat(v.prop)) + '</dd><dt>Instalação</dt><dd>' + A.money(v.prop.inst.valor) + '</dd><dt>Frete</dt><dd>' + A.money(v.prop.frete) + '</dd><dt class="tot">Total</dt><dd class="tot">' + A.money(pTotal(v.prop)) + '</dd></dl></div><p class="small muted mt">No Pix à vista: ' + A.money(pTotal(v.prop) * 0.95) + ' (5% de desconto).</p>', { icon: 'receipt' }) : '') +
      A.card('Responsável AiCalhas', '<div class="li">' + A.av('Juliana Rocha', A.USERS.mediador.cor) + '<div class="lt"><b>Juliana Rocha</b><small>Gestão do pedido de ponta a ponta</small></div></div><p class="small muted mt">' + (p === 'cliente' ? 'Você contrata a AiCalhas. Materiais, instalação e garantia são de responsabilidade da AiCalhas, executados com parceiros homologados.' : 'Contrato, pagamento, compras e repasse centralizados na AiCalhas.') + '</p>', { icon: 'shield' }) +
      (pf && p !== 'profissional' ? A.card('Parceiro de instalação', '<div class="li">' + A.av(pf.empresa, pf.cor) + '<div class="lt"><b>' + e(pf.empresa) + '</b><small>Parceiro homologado AiCalhas</small></div></div>', { icon: 'tool' }) : '') +
      '</div></div>';
  }
  function vOS() {
    const v = ven(A.sel('os'));
    if (!v) return A.empty('Ordem de serviço não encontrada.');
    const tab = A.tab('os', 'resumo');
    const c = v.clienteId ? cli(v.clienteId) : null;
    const B = [], id = { id: v.id };
    if (v.etapa === 'avaliacao' && v.aval && v.aval.status === 'Agendada') B.push(A.b('Registrar avaliação técnica', 'c4.regAval', id, 'p', 'clipboard'));
    if (v.etapa === 'agendada') { B.push(A.b('Conferir materiais', 'c4.conferirMat', id, '', 'box')); B.push(A.b('Iniciar instalação', 'c4.iniciar', id, 'p', 'play')); }
    if (v.etapa === 'execucao') { B.push(A.b('Atualizar andamento', 'c4.andamento', id, '', 'layers')); B.push(A.b('Registrar ocorrência', 'c4.ocorrencia', id, 'dg', 'alert')); B.push(A.b('Concluir instalação', 'c4.concluir', id, 'ok', 'check')); }
    if (v.pos) v.pos.chamados.filter((x) => x.status === 'Encaminhado ao parceiro').forEach((x) => B.push(A.b('Registrar atendimento do chamado ' + x.id, 'c4.chPro', { id: v.id, c: x.id }, 'p', 'tool')));
    let body = '';
    if (tab === 'resumo') body = A.dl([['Cliente', e(nomeCli(v))], ['Endereço', e(c ? c.endereco + ' — ' + c.bairro + ', ' + c.cidade : cidadeOf(v))], ['Telefone', e(c ? c.tel : '—')], ['Serviço', e(srvName(v.srv))], ['Escopo', v.prop ? e(v.prop.inst.desc) : 'Avaliação técnica'], ['Data', v.etapa === 'avaliacao' ? A.fdt(v.aval.data) + ' (avaliação)' : v.inst && v.inst.data ? A.fdt(v.inst.data) : 'A agendar'], ['Entrega de materiais', v.entrega ? A.fdt(v.entrega.data) + ' — ' + A.badge(v.entrega.status) : '—'], ['Repasse previsto', v.inst && v.inst.repasse ? A.money(v.inst.repasse.valor) : v.prop ? A.money(pRepasse(v.prop)) : 'Após proposta']]) + '<div class="mt"></div>' + A.note('Cliente contratou a AiCalhas. Dúvidas comerciais, alterações de escopo e custos extras devem ser tratadas com a AiCalhas.');
    else if (tab === 'mat') body = !v.prop ? A.empty('Materiais definidos após a proposta.', 'box') : A.table([{ l: 'Material', f: (x) => e(x.nome) }, { l: 'Quantidade', cls: 'r', f: (x) => A.num(x.qtd, x.qtd % 1 ? 1 : 0) + ' ' + e(x.un) }, { l: 'Situação', f: (x) => (v.inst && v.inst.conferidos && v.inst.conferidos.indexOf(x.id) >= 0 ? A.badge('Conferido', 'ok') : v.entrega && v.entrega.status === 'Entregue' ? A.badge('Entregue', 'ok') : v.compra ? A.badge(v.compra.status === 'Recebida' ? 'No depósito AiCalhas' : 'Em compra', 'info') : A.badge('A comprar', 'neutral')) }], v.prop.itens);
    else if (tab === 'exec') body = !v.inst || !v.inst.inicio ? A.empty('A execução ainda não começou.', 'layers') : '<div class="bar" style="grid-template-columns:auto 1fr auto;margin-bottom:14px"><span>Andamento</span><span class="tr"><span class="fl" style="width:' + instProg(v) + '%"></span></span><b>' + instProg(v) + '%</b></div><ul class="ul chk">' + v.inst.etapas.map((x) => '<li style="color:' + (x.ok ? 'inherit' : 'var(--muted)') + '">' + I(x.ok ? 'check' : 'clock', 15) + '<span>' + e(x.n) + '</span></li>').join('') + '</ul>';
    else if (tab === 'ocr') body = A.table([{ l: 'Data', f: (o) => A.fdtn(o.ts) }, { l: 'Tipo', f: (o) => e(o.tipo) }, { l: 'Descrição', f: (o) => e(o.desc) + (o.solucao ? '<small>Solução: ' + e(o.solucao) + '</small>' : '') }, { l: 'Situação', f: (o) => A.badge(o.status) }], v.ocorrencias, { empty: 'Nenhuma ocorrência.' });
    else body = v.inst && v.inst.repasse ? A.dl([['Valor do repasse', A.money(v.inst.repasse.valor)], ['Situação', A.badge(v.inst.repasse.status)], ['Regra', 'Liberado após a confirmação do cliente'], ['Data', v.inst.repasse.ts ? A.fdt(v.inst.repasse.ts) : '—']]) : A.empty('Repasse definido após a aprovação da proposta.', 'wallet');
    return A.ph(v.titulo, 'OS ' + e(v.id) + ' — ' + e(nomeCli(v)) + ' — ' + e(cidadeOf(v)), etBadge(v), ['servicos', 'Serviços atribuídos']) +
      A.card(null, A.stepper(STEPS, stepOf(v))) + '<div class="g21 mt"><div>' + A.card(null, A.tabs('os', [{ id: 'resumo', l: 'Resumo' }, { id: 'mat', l: 'Materiais previstos' }, { id: 'exec', l: 'Execução' }, { id: 'ocr', l: 'Ocorrências', n: v.ocorrencias.length }, { id: 'rep', l: 'Repasse' }]) + body) + '</div><div class="stack">' +
      (B.length ? A.card('O que fazer agora', '<div class="stack" style="gap:8px">' + B.join('') + '</div>', { icon: 'flag' }) : '') +
      A.card('Coordenação AiCalhas', '<div class="li">' + A.av('Juliana Rocha', A.USERS.mediador.cor) + '<div class="lt"><b>Juliana Rocha</b><small>Agenda, materiais e contato com o cliente</small></div></div>', { icon: 'shield' }) + '</div></div>';
  }

  /* ------------------------------------------------------------------
     Telas — Cliente
     ------------------------------------------------------------------ */
  function vCliPedidos() {
    const list = meus().sort((a, b) => (a.ts < b.ts ? 1 : -1));
    return A.ph('Meus pedidos', 'Você contrata a AiCalhas: proposta única com materiais e instalação, pagamento, entrega, execução e garantia.', A.nav('Solicitar orçamento', 'nova', null, 'p', 'plus')) +
      (list.length ? '<div class="stack">' + list.map((v) => '<section class="card"><div class="card-h">' + I('box', 18) + '<h3>' + e(v.titulo) + '</h3><div class="card-r">' + etBadge(v) + '</div></div><div class="card-b"><div class="small muted mb16">' + e(v.id) + ' — ' + (v.prop && v.prop.status !== 'Em elaboração' && v.prop.status !== 'Aguardando alçada' ? A.money(pTotal(v.prop)) : 'Proposta em elaboração') + '</div>' + A.stepper(STEPS, stepOf(v)) +
        '<div class="row mt">' + (v.etapa === 'enviada' ? '<span class="small">' + I('info', 15) + ' <b>Sua proposta está pronta para aprovação.</b></span>' : v.etapa === 'aprovada' ? '<span class="small">' + I('wallet', 15) + ' <b>Pagamento pendente.</b></span>' : '') + '<span class="spacer"></span>' + A.nav('Abrir pedido', 'pedido', v.id, 'sm p', 'eye') + '</div></div></section>').join('') + '</div>' : A.card(null, A.empty('Nenhum pedido ainda.', 'box')));
  }
  function vCliNova() {
    const c = cli(MYCLI);
    return A.ph('Solicitar orçamento', 'A AiCalhas agenda uma avaliação técnica gratuita e envia uma proposta completa com materiais e instalação.') +
      '<div class="g21"><div>' + A.card(null, '<form data-form="c4.novaSave" class="fg" autocomplete="off">' +
        '<div class="f"><label>Serviço <i class="req">*</i></label><select class="inp" name="srv" required>' + db().servicos.map((s) => '<option value="' + s.id + '"' + (s.id === 'SRV-01' ? ' selected' : '') + '>' + e(s.nome) + '</option>').join('') + '</select></div>' +
        '<div class="f"><label>Melhor período para a avaliação</label><select class="inp" name="periodo"><option>Manhã</option><option>Tarde</option></select></div>' +
        '<div class="f full"><label>Título <i class="req">*</i></label><input class="inp" name="titulo" required value="Calhas para a área de serviço"></div>' +
        '<div class="f full"><label>Descrição <i class="req">*</i></label><textarea class="inp" name="desc" rows="4" required>Quero instalar calhas na área de serviço (cerca de 6 m) e direcionar a água para o ralo do quintal.</textarea></div>' +
        '<div class="f full"><label>Endereço</label><input class="inp" name="endereco" value="' + e(c.endereco + ' — ' + c.bairro + ', ' + c.cidade) + '"></div>' +
        '<div class="f full"><label>Fotos</label><div class="pf"><label class="pf-up">' + I('camera', 22) + '<span><b>Escolher fotos do dispositivo</b><small>Simulação: as imagens ficam apenas neste navegador.</small></span><input type="file" name="fotos" accept="image/*" multiple data-preview="1"></label><div class="fprev"></div><div class="pf-or">Ou marque imagens ilustrativas:</div><div class="pf-pre" data-multi="fotos__preset">' + ['aluminio', 'calha-frontal', 'condutor'].map((k, i) => '<label class="pf-p"><input type="checkbox" name="fotos__preset" value="' + k + '"' + (i === 0 ? ' checked' : '') + '>' + A.photo(k) + '<small>' + e(A.ILL[k].l) + '</small></label>').join('') + '</div></div></div>' +
        '<div class="f full"><label class="ck single"><input type="checkbox" data-bool="1" name="consent" required checked><span>Autorizo a AiCalhas a usar meus dados para a avaliação técnica e a proposta. <i class="req">*</i></span></label></div>' +
        '<div class="f full"><div class="row"><span class="spacer"></span><button class="btn p" type="submit">' + I('send', 16) + ' Solicitar orçamento</button></div></div></form>') + '</div>' +
      '<div>' + A.card('Como funciona', '<ol class="ol"><li>Avaliação técnica no local, agendada pela AiCalhas.</li><li>Proposta única com materiais, instalação e frete discriminados.</li><li>Pagamento à AiCalhas (Pix, cartão ou boleto).</li><li>A AiCalhas compra os materiais, entrega e agenda a instalação com um parceiro homologado.</li><li>Garantia e pós-venda com a AiCalhas.</li></ol>', { icon: 'shield' }) + '</div></div>';
  }
  function vCliChamados() {
    const list = [];
    meus().forEach((v) => (v.pos ? v.pos.chamados : []).forEach((c) => list.push({ v: v, c: c, id: c.id })));
    return A.ph('Atendimento e garantia', 'Abra chamados de garantia, dúvidas ou reagendamentos. A AiCalhas responde e aciona o parceiro quando necessário.', meus().some((v) => v.pos) ? A.b('Abrir chamado', 'c4.chamado', { id: meus().filter((v) => v.pos)[0].id }, 'p', 'plus') : '') +
      A.card(null, A.table([{ l: 'Chamado', f: (x) => '<b>' + e(x.c.id) + '</b><small>' + e(x.v.titulo) + '</small>' }, { l: 'Aberto em', f: (x) => A.fdtn(x.c.ts) }, { l: 'Tipo', f: (x) => e(x.c.tipo) }, { l: 'Descrição', f: (x) => e(x.c.desc) }, { l: 'Situação', f: (x) => A.badge(x.c.status) }, { l: 'Última resposta', f: (x) => (x.c.resp.length ? e(x.c.resp[x.c.resp.length - 1].txt) : '—') }], list, { empty: 'Nenhum chamado aberto.' }), { flush: true });
  }
  function vCliDados() {
    const c = cli(MYCLI);
    return A.ph('Meus dados', 'Dados usados na proposta, na entrega e na nota fiscal.', A.b('Editar dados', 'c4.cliEdit', {}, 'p', 'edit')) + A.card('Cadastro', A.dl([['Nome', e(c.nome)], ['Telefone', e(c.tel)], ['E-mail', e(c.email)], ['Endereço de entrega', e(c.endereco + ' — ' + c.bairro + ', ' + c.cidade)], ['CPF', '***.***.***-** (oculto na demonstração)']]), { icon: 'user' });
  }

  /* ------------------------------------------------------------------
     Telas — Profissional (parceiro)
     ------------------------------------------------------------------ */
  function vProServicos() {
    const tab = A.tab('psrv', 'ativos');
    const all = meus().sort((a, b) => (a.ts < b.ts ? 1 : -1));
    const at = all.filter((v) => ['avaliacao', 'agendada', 'execucao', 'concluido', 'entrega', 'compra', 'pago', 'enviada', 'aprovada', 'proposta', 'alcada'].indexOf(v.etapa) >= 0);
    const list = tab === 'ativos' ? at : all.filter((v) => v.etapa === 'posvenda');
    const nextOf = (v) => ({ avaliacao: 'Avaliação técnica ' + (v.aval && v.aval.data ? A.when(v.aval.data) : ''), proposta: 'AiCalhas montando a proposta', alcada: 'Proposta em aprovação interna', enviada: 'Aguardando aprovação do cliente', aprovada: 'Aguardando pagamento do cliente', pago: 'AiCalhas comprando materiais', compra: 'Materiais em compra', entrega: 'AiCalhas programando a instalação', agendada: 'Instalação ' + (v.inst && v.inst.data ? A.when(v.inst.data) : ''), execucao: 'Execução: ' + instProg(v) + '%', concluido: 'Aguardando confirmação do cliente', posvenda: 'Encerrado' })[v.etapa];
    return A.ph('Serviços atribuídos', 'Ordens de serviço enviadas pela AiCalhas. Os materiais são comprados e entregues pela AiCalhas; você executa a instalação.') +
      '<div class="g4 mb16">' + A.kpi({ l: 'Avaliações técnicas', v: all.filter((v) => v.etapa === 'avaliacao').length, icon: 'clipboard' }) + A.kpi({ l: 'Instalações agendadas', v: all.filter((v) => v.etapa === 'agendada').length, icon: 'calendar' }) + A.kpi({ l: 'Em execução', v: all.filter((v) => v.etapa === 'execucao').length, icon: 'tool' }) + A.kpi({ l: 'Repasses a receber', v: A.kmoney(A.sum(all.filter((v) => v.inst && v.inst.repasse && v.inst.repasse.status !== 'Pago'), (v) => v.inst.repasse.valor)), icon: 'wallet', tone: 'ok' }) + '</div>' +
      A.tabs('psrv', [{ id: 'ativos', l: 'Em andamento', n: at.length }, { id: 'enc', l: 'Concluídos', n: all.filter((v) => v.etapa === 'posvenda').length }]) +
      (list.length ? '<div class="stack">' + list.slice(0, 20).map((v) => '<section class="card"><div class="card-h">' + I('tool', 18) + '<h3>' + e(v.titulo) + '</h3><div class="card-r">' + etBadge(v) + '</div></div><div class="card-b"><div class="row"><span class="small muted">OS ' + e(v.id) + ' — ' + e(nomeCli(v)) + ' — ' + e(cidadeOf(v)) + '</span><span class="spacer"></span>' + (v.inst && v.inst.repasse ? '<span class="small">Repasse: <b>' + A.money(v.inst.repasse.valor) + '</b> ' + A.badge(v.inst.repasse.status) + '</span>' : '') + '</div>' +
        '<div class="row mt"><span class="small">' + I('arrowR', 15) + ' <b>' + e(nextOf(v)) + '</b></span>' + (v.ocorrencias.some((o) => o.status === 'Aberta') ? A.badge('Ocorrência aberta', 'bad') : '') + '<span class="spacer"></span>' + A.nav('Abrir OS', 'os', v.id, 'sm p', 'eye') + '</div></div></section>').join('') + '</div>' : A.card(null, A.empty('Nenhum serviço nesta lista.', 'tool')));
  }
  function vProAgenda() {
    const ev = [];
    meus().forEach((v) => {
      if (v.aval && v.aval.status === 'Agendada') ev.push({ ts: v.aval.data, t: 'Avaliação técnica', v: v, ic: 'clipboard' });
      if (v.entrega && v.entrega.status !== 'Entregue') ev.push({ ts: v.entrega.data, t: 'Entrega de materiais pela AiCalhas', v: v, ic: 'truck' });
      if (v.inst && v.inst.data && ['Agendada', 'Em execução'].indexOf(v.inst.status) >= 0) ev.push({ ts: v.inst.data, t: v.inst.status === 'Em execução' ? 'Instalação em andamento' : 'Instalação', v: v, ic: 'tool' });
    });
    ev.sort((a, b) => (a.ts < b.ts ? -1 : 1));
    return A.ph('Agenda', 'Compromissos programados pela AiCalhas para você.') + A.card(null, ev.length ? ev.map((x) => '<div class="li clk" data-act="core.nav" data-view="os" data-id="' + x.v.id + '">' + I(x.ic, 18) + '<div class="lt"><b>' + A.when(x.ts) + ' — ' + e(x.t) + '</b><small>OS ' + e(x.v.id) + ' — ' + e(nomeCli(x.v)) + ' — ' + e(cidadeOf(x.v)) + '</small></div>' + etBadge(x.v) + '</div>').join('') : A.empty('Sem compromissos agendados.', 'calendar'), { icon: 'calendar' });
  }
  function vProMateriais() {
    const list = meus().filter((v) => v.prop && ['pago', 'compra', 'entrega', 'agendada', 'execucao'].indexOf(v.etapa) >= 0);
    return A.ph('Materiais previstos', 'Materiais comprados pela AiCalhas para cada OS. Confira ao receber e informe faltas como ocorrência.') +
      (list.length ? '<div class="stack">' + list.map((v) => A.card('OS ' + v.id + ' — ' + v.titulo, A.table([{ l: 'Material', f: (x) => e(x.nome) }, { l: 'Quantidade', cls: 'r', f: (x) => A.num(x.qtd, x.qtd % 1 ? 1 : 0) + ' ' + e(x.un) }, { l: 'Situação', f: (x) => (v.inst && v.inst.conferidos && v.inst.conferidos.indexOf(x.id) >= 0 ? A.badge('Conferido', 'ok') : v.entrega && v.entrega.status === 'Entregue' ? A.badge('Entregue no local', 'ok') : v.compra ? A.badge(v.compra.status === 'Recebida' ? 'No depósito AiCalhas' : 'Em compra', 'info') : A.badge('A comprar', 'neutral')) }], v.prop.itens) +
        '<div class="row mt"><span class="small muted">Entrega: ' + (v.entrega ? A.fdt(v.entrega.data) + ' — ' + e(v.entrega.status.toLowerCase()) : 'a programar') + '</span><span class="spacer"></span>' + (['agendada', 'execucao'].indexOf(v.etapa) >= 0 ? A.b('Conferir materiais', 'c4.conferirMat', { id: v.id }, 'sm', 'box') : '') + A.nav('Abrir OS', 'os', v.id, 'sm', 'eye') + '</div>', { icon: 'box', right: etBadge(v) })).join('') + '</div>' : A.card(null, A.empty('Nenhum material previsto no momento.', 'box')));
  }
  function vProRepasses() {
    const st = A.fv('rep', 'st'), per = A.fv('rep', 'per', 'all');
    let list = meus().filter((v) => v.inst && v.inst.repasse);
    if (st) list = list.filter((v) => v.inst.repasse.status === st);
    list = list.filter((v) => A.inPeriod(v.inst.data || v.ts, per));
    const all = meus().filter((v) => v.inst && v.inst.repasse);
    return A.ph('Repasses', 'Valores de instalação pagos pela AiCalhas após a confirmação do cliente (' + Math.round(REPASSE * 100) + '% do valor de instalação, conforme contrato de parceria).') +
      '<div class="g4 mb16">' + A.kpi({ l: 'Previsto', v: A.kmoney(A.sum(all.filter((v) => v.inst.repasse.status === 'Previsto'), (v) => v.inst.repasse.valor)), s: 'Serviços em andamento', icon: 'clock' }) + A.kpi({ l: 'Liberado para pagamento', v: A.kmoney(A.sum(all.filter((v) => v.inst.repasse.status === 'Liberado'), (v) => v.inst.repasse.valor)), icon: 'check', tone: 'warn' }) + A.kpi({ l: 'Pago (90 dias)', v: A.kmoney(A.sum(all.filter((v) => v.inst.repasse.status === 'Pago' && A.inPeriod(v.inst.repasse.ts, '90')), (v) => v.inst.repasse.valor)), icon: 'wallet', tone: 'ok' }) + A.kpi({ l: 'Serviços concluídos', v: all.filter((v) => v.inst.status === 'Concluída').length, icon: 'tool' }) + '</div>' +
      A.card(null, A.filters('rep', [{ k: 'st', l: 'Situação', o: A.opts(['Previsto', 'Liberado', 'Pago'], 'Todas') }, { k: 'per', l: 'Período', def: 'all', o: A.PERIODS }]) + A.table([{ l: 'OS', f: (v) => '<b>' + e(v.id) + '</b><small>' + e(v.titulo) + '</small>' }, { l: 'Cliente', f: (v) => e(nomeCli(v)) }, { l: 'Instalação', f: (v) => (v.inst.data ? A.fd(v.inst.data) : '—') }, { l: 'Valor', cls: 'r', f: (v) => A.money(v.inst.repasse.valor) }, { l: 'Situação', f: (v) => A.badge(v.inst.repasse.status) }, { l: 'Pago em', f: (v) => (v.inst.repasse.status === 'Pago' ? A.fd(v.inst.repasse.ts) : '—') }], list.sort((a, b) => ((a.inst.data || '') < (b.inst.data || '') ? 1 : -1)), { foot: ['Total', '', '', A.money(A.sum(list, (v) => v.inst.repasse.valor)), '', ''] }), { flush: true });
  }

  /* ------------------------------------------------------------------
     Telas — Mediador / Gestão
     ------------------------------------------------------------------ */
  function vMedPainel() {
    const d = db();
    const mes = d.vendas.filter((v) => v.pag && v.pag.status === 'Pago' && A.inPeriod(v.pag.ts, '30'));
    const abertas = d.vendas.filter((v) => ['proposta', 'alcada', 'enviada', 'aprovada'].indexOf(v.etapa) >= 0 && v.prop);
    const anda = d.vendas.filter((v) => ['pago', 'compra', 'entrega', 'agendada', 'execucao', 'concluido'].indexOf(v.etapa) >= 0);
    const repLib = d.vendas.filter((v) => v.inst && v.inst.repasse && v.inst.repasse.status === 'Liberado');
    const pend = []; d.vendas.forEach((v) => pendMed(v).forEach((t) => pend.push({ v: v, t: t })));
    const agenda = [];
    d.vendas.forEach((v) => {
      if (v.aval && v.aval.status === 'Agendada' && A.dayDiff(v.aval.data) >= 0 && A.dayDiff(v.aval.data) <= 7) agenda.push({ ts: v.aval.data, t: 'Avaliação técnica', v: v, ic: 'clipboard' });
      if (v.entrega && v.entrega.status !== 'Entregue' && A.dayDiff(v.entrega.data) <= 7) agenda.push({ ts: v.entrega.data, t: 'Entrega de materiais', v: v, ic: 'truck' });
      if (v.inst && v.inst.status === 'Agendada' && v.inst.data && A.dayDiff(v.inst.data) <= 7) agenda.push({ ts: v.inst.data, t: 'Instalação', v: v, ic: 'tool' });
      if (v.compra && v.compra.status === 'Confirmada' && A.dayDiff(v.compra.previsao) <= 7) agenda.push({ ts: v.compra.previsao, t: 'Chegada de materiais (' + v.compra.id + ')', v: v, ic: 'box' });
    });
    agenda.sort((a, b) => (a.ts < b.ts ? -1 : 1));
    const pipe = ['avaliacao', 'proposta', 'alcada', 'enviada', 'aprovada', 'pago', 'compra', 'entrega', 'agendada', 'execucao', 'concluido'].map((k) => ({ l: ET[k], v: d.vendas.filter((v) => v.etapa === k).length, val: A.sum(d.vendas.filter((v) => v.etapa === k && v.prop), (v) => pTotal(v.prop)) }));
    return A.ph('Painel da operação', 'Vendas, propostas, compras, entregas, agenda, pagamentos, repasses e atendimento em um só lugar.', A.nav('Visão financeira', 'financeiro', null, '', 'money') + A.b('Nova proposta', 'c4.medNova', {}, 'p', 'plus')) +
      '<div class="g4 mb16">' + A.kpi({ l: 'Vendas recebidas (30 dias)', v: A.kmoney(A.sum(mes, (v) => v.pag.valor)), s: mes.length + ' pedidos pagos', icon: 'money', tone: 'ok' }) + A.kpi({ l: 'Propostas em aberto', v: A.kmoney(A.sum(abertas, (v) => pTotal(v.prop))), s: abertas.length + ' propostas', icon: 'receipt' }) + A.kpi({ l: 'Pedidos em andamento', v: anda.length, s: d.vendas.filter((v) => v.ocorrencias.some((o) => o.status === 'Aberta')).length + ' com ocorrência', icon: 'tool', tone: 'warn' }) + A.kpi({ l: 'Repasses a pagar', v: A.kmoney(A.sum(repLib, (v) => v.inst.repasse.valor)), s: repLib.length + ' liberado(s)', icon: 'wallet' }) + '</div>' +
      '<div class="g21"><div class="stack">' + A.card('Ações pendentes (' + pend.length + ')', pend.length ? pend.map((x) => '<div class="li clk" data-act="core.nav" data-view="venda" data-id="' + x.v.id + '">' + I(/ocorrência|chamado/i.test(x.t) ? 'alert' : /alçada/.test(x.t) ? 'scale' : /compra|recebimento/.test(x.t) ? 'cart' : /repasse/.test(x.t) ? 'wallet' : 'flag', 18) + '<div class="lt"><b>' + e(x.t) + '</b><small>' + e(x.v.id) + ' — ' + e(x.v.titulo) + ' — ' + e(nomeCli(x.v)) + '</small></div>' + I('arrowR', 16) + '</div>').join('') : A.empty('Nenhuma ação pendente.', 'check'), { icon: 'bell' }) +
      A.card('Funil da operação', A.table([{ l: 'Etapa', f: (r) => e(r.l) }, { l: 'Pedidos', cls: 'r', f: (r) => r.v }, { l: 'Valor', cls: 'r', f: (r) => (r.val ? A.money(r.val) : '—') }], pipe.filter((r) => r.v), { cls: 'fit' }), { icon: 'layers', flush: true }) + '</div>' +
      '<div class="stack">' + A.card('Próximos 7 dias', agenda.length ? agenda.map((x) => '<div class="li clk" data-act="core.nav" data-view="venda" data-id="' + x.v.id + '">' + I(x.ic, 18) + '<div class="lt"><b>' + A.when(x.ts) + '</b><small>' + e(x.t) + ' — ' + e(x.v.id) + ' — ' + e(nomeCli(x.v)) + '</small></div></div>').join('') : A.empty('Sem compromissos.', 'calendar'), { icon: 'calendar' }) + '</div></div>';
  }
  function vMedPropostas() {
    const list = db().vendas.filter((v) => ['avaliacao', 'proposta', 'alcada', 'enviada', 'aprovada'].indexOf(v.etapa) >= 0).sort((a, b) => (a.ts < b.ts ? 1 : -1));
    return A.ph('Propostas', 'Da avaliação técnica à aprovação: monte a proposta com materiais e instalação discriminados e respeite as alçadas de desconto.', A.b('Nova proposta', 'c4.medNova', {}, 'p', 'plus')) +
      A.card(null, A.table([
        { l: 'Pedido', f: (v) => '<b>' + e(v.id) + '</b><small>' + e(v.titulo) + '</small>' }, { l: 'Cliente', f: (v) => e(nomeCli(v)) + '<small>' + e(cidadeOf(v)) + '</small>' },
        { l: 'Avaliação técnica', f: (v) => (v.aval ? A.badge(v.aval.status === 'Realizada' ? 'Realizada' : 'Agendada') + '<small>' + A.fdt(v.aval.data) + ' — ' + e(pro(v.aval.pro).empresa) + '</small>' : A.badge('A agendar', 'warn')) },
        { l: 'Valor', cls: 'r', f: (v) => (v.prop ? A.money(pTotal(v.prop)) + (+v.prop.descPct ? '<small>desc. ' + A.num(v.prop.descPct, 1) + '%</small>' : '') : '—') },
        { l: 'Margem est.', cls: 'r', f: (v) => (v.prop ? A.pct(margem(v), pTotal(v.prop)) : '—') }, { l: 'Etapa', f: (v) => etBadge(v) },
        { l: '', cls: 'r', f: (v) => '<div class="acts-row" style="justify-content:flex-end">' + (v.etapa === 'proposta' ? A.b('Montar', 'c4.montar', { id: v.id }, 'sm p', 'receipt') : v.etapa === 'alcada' ? A.b('Alçada', 'c4.alcadaOk', { id: v.id }, 'sm ok', 'scale') : v.etapa === 'avaliacao' && !v.aval ? A.b('Agendar', 'c4.agAval', { id: v.id }, 'sm p', 'calendar') : '') + A.nav('Abrir', 'venda', v.id, 'sm', 'eye') + '</div>' },
      ], list), { flush: true });
  }
  function vMedVendas() {
    const et = A.fv('ven', 'et'), cid = A.fv('ven', 'cid'), per = A.fv('ven', 'per', '90'), q = A.fv('ven', 'q').toLowerCase();
    let list = db().vendas.filter((v) => v.pag || ['aprovada'].indexOf(v.etapa) >= 0);
    if (et) list = list.filter((v) => v.etapa === et);
    if (cid) list = list.filter((v) => cidadeOf(v) === cid);
    list = list.filter((v) => A.inPeriod(v.ts, per));
    if (q) list = list.filter((v) => (v.id + ' ' + v.titulo + ' ' + nomeCli(v)).toLowerCase().indexOf(q) >= 0);
    list.sort((a, b) => (a.ts < b.ts ? 1 : -1));
    return A.ph('Vendas e pedidos', 'Pedidos aprovados: pagamento, compras, entrega, instalação e pós-venda.') +
      A.card(null, A.filters('ven', [{ k: 'et', l: 'Etapa', o: A.opts(['aprovada', 'pago', 'compra', 'entrega', 'agendada', 'execucao', 'concluido', 'posvenda'].map((k) => ({ v: k, l: ET[k] })), 'Todas') }, { k: 'cid', l: 'Cidade', o: A.opts(db().cidades, 'Todas') }, { k: 'per', l: 'Período', def: '90', o: A.PERIODS }, { k: 'q', type: 'search', l: 'Buscar pedido ou cliente' }]) + A.table([
        { l: 'Pedido', f: (v) => '<b>' + e(v.id) + '</b><small>' + e(v.titulo) + '</small>' }, { l: 'Cliente', f: (v) => e(nomeCli(v)) + '<small>' + e(cidadeOf(v)) + '</small>' }, { l: 'Valor', cls: 'r', f: (v) => A.money(v.pag ? v.pag.valor : pTotal(v.prop)) },
        { l: 'Pagamento', f: (v) => (v.pag ? A.badge(v.pag.status) + '<small>' + e(v.pag.forma) + '</small>' : A.badge('Aguardando pagamento', 'warn')) }, { l: 'Parceiro', f: (v) => (proDe(v) ? e(pro(proDe(v)).empresa) : '—') }, { l: 'Etapa', f: (v) => etBadge(v) + (v.ocorrencias.some((o) => o.status === 'Aberta') ? ' ' + A.badge('Ocorrência', 'bad') : '') },
        { l: '', cls: 'r', f: (v) => A.nav('Abrir', 'venda', v.id, 'sm', 'eye') },
      ], list), { flush: true });
  }
  function vMedCompras() {
    const d = db(), tab = A.tab('cmp', 'oc');
    const necessidades = d.vendas.filter((v) => v.etapa === 'pago');
    const ocs = d.vendas.filter((v) => v.compra).map((v) => Object.assign({ v: v }, v.compra)).concat((d.ocsAvulsas || []).map((o) => Object.assign({ v: ven(o.venda) }, o))).sort((a, b) => (a.ts < b.ts ? 1 : -1));
    return A.ph('Compras e materiais', 'Pedidos de compra aos fornecedores, recebimento no depósito e reposições.', A.nav('Cadastro de materiais', 'cadastros', null, '', 'box')) +
      '<div class="g4 mb16">' + A.kpi({ l: 'Pedidos a gerar', v: necessidades.length, icon: 'cart', tone: 'warn' }) + A.kpi({ l: 'Aguardando fornecedor', v: ocs.filter((o) => o.status !== 'Recebida').length, icon: 'truck' }) + A.kpi({ l: 'Compras (30 dias)', v: A.kmoney(A.sum(ocs.filter((o) => A.inPeriod(o.ts, '30')), 'valor')), icon: 'money' }) + A.kpi({ l: 'Itens abaixo do estoque mínimo', v: d.materiais.filter((m) => m.estoque < 20).length, icon: 'alert', tone: 'bad' }) + '</div>' +
      A.tabs('cmp', [{ id: 'oc', l: 'Pedidos de compra', n: ocs.length }, { id: 'nec', l: 'Necessidades de compra', n: necessidades.length }, { id: 'est', l: 'Estoque de materiais' }]) +
      (tab === 'oc' ? A.card(null, A.table([{ l: 'Pedido', f: (o) => '<b>' + e(o.id) + '</b><small>' + (o.v ? e(o.v.id) : '') + (o.reposicao ? ' — reposição' : '') + '</small>' }, { l: 'Fornecedor', f: (o) => e(forn(o.forn).nome) }, { l: 'Emitido', f: (o) => A.fd(o.ts) }, { l: 'Previsão', f: (o) => A.fd(o.previsao) }, { l: 'Valor', cls: 'r', f: (o) => A.money(o.valor) }, { l: 'Situação', f: (o) => A.badge(o.status) },
        { l: '', cls: 'r', f: (o) => '<div class="acts-row" style="justify-content:flex-end">' + (!o.reposicao && o.v && o.status === 'Solicitada' ? A.b('Confirmar', 'c4.ocConf', { id: o.v.id }, 'sm', 'check') : '') + (!o.reposicao && o.v && o.status === 'Confirmada' ? A.b('Receber', 'c4.ocReceb', { id: o.v.id }, 'sm p', 'box') : '') + (o.reposicao && o.status !== 'Recebida' ? A.b('Receber', 'c4.repReceb', { id: o.id }, 'sm p', 'box') : '') + (o.v ? A.nav('Pedido', 'venda', o.v.id, 'sm', 'eye') : '') + '</div>' }], ocs.slice(0, 40)), { flush: true })
        : tab === 'nec' ? A.card(null, necessidades.length ? necessidades.map((v) => '<div class="li">' + I('cart', 18) + '<div class="lt"><b>' + e(v.id) + ' — ' + e(v.titulo) + '</b><small>' + v.prop.itens.length + ' itens — custo estimado ' + A.money(pCusto(v.prop)) + ' — pago em ' + A.fd(v.pag.ts) + '</small></div>' + A.b('Gerar pedido de compra', 'c4.gerarOC', { id: v.id }, 'sm p', 'cart') + '</div>').join('') : A.empty('Nenhuma necessidade de compra.', 'check'))
          : A.card(null, A.table([{ l: 'Material', f: (m) => '<b>' + e(m.nome) + '</b><small>' + e(m.id) + '</small>' }, { l: 'Unidade', k: 'un' }, { l: 'Fornecedor', f: (m) => e(forn(m.forn).nome) }, { l: 'Custo', cls: 'r', f: (m) => A.money(m.custo) }, { l: 'Preço de venda', cls: 'r', f: (m) => A.money(m.preco) }, { l: 'Estoque', cls: 'r', f: (m) => A.num(m.estoque) }, { l: 'Situação', f: (m) => (m.estoque < 20 ? A.badge('Repor', 'bad') : A.badge('Ok', 'ok')) }], d.materiais), { flush: true }));
  }
  function vMedAgenda() {
    const d = db(), ev = [];
    d.vendas.forEach((v) => {
      if (v.aval && v.aval.status === 'Agendada') ev.push({ ts: v.aval.data, t: 'Avaliação técnica', v: v, p: v.aval.pro });
      if (v.entrega && v.entrega.status !== 'Entregue') ev.push({ ts: v.entrega.data, t: 'Entrega de materiais', v: v, p: null });
      if (v.inst && v.inst.data && ['Agendada', 'Em execução'].indexOf(v.inst.status) >= 0) ev.push({ ts: v.inst.data, t: v.inst.status === 'Em execução' ? 'Instalação em andamento' : 'Instalação', v: v, p: v.inst.pro });
    });
    ev.sort((a, b) => (a.ts < b.ts ? -1 : 1));
    return A.ph('Agenda e entregas', 'Avaliações técnicas, entregas de materiais e instalações com os parceiros.') +
      A.card(null, A.table([{ l: 'Data', f: (x) => A.fdtn(x.ts) + '<small>' + A.when(x.ts, false) + '</small>' }, { l: 'Compromisso', f: (x) => '<b>' + e(x.t) + '</b>' }, { l: 'Pedido', f: (x) => e(x.v.id) + '<small>' + e(x.v.titulo) + '</small>' }, { l: 'Cliente / local', f: (x) => e(nomeCli(x.v)) + '<small>' + e(cidadeOf(x.v)) + '</small>' }, { l: 'Parceiro', f: (x) => (x.p ? e(pro(x.p).empresa) : 'Logística AiCalhas') },
        { l: '', cls: 'r', f: (x) => '<div class="acts-row" style="justify-content:flex-end">' + (x.t === 'Entrega de materiais' ? A.b('Registrar entrega', 'c4.entregar', { id: x.v.id }, 'sm p', 'truck') : x.t === 'Instalação' ? A.b('Reagendar', 'c4.programar', { id: x.v.id }, 'sm', 'calendar') : x.t === 'Avaliação técnica' ? A.b('Reagendar', 'c4.agAval', { id: x.v.id }, 'sm', 'calendar') : '') + A.nav('Abrir', 'venda', x.v.id, 'sm', 'eye') + '</div>' }], ev), { flush: true, icon: 'calendar' });
  }
  function monthKey(iso) { const t = new Date(iso); return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0'); }
  function vMedFin() {
    const d = db(), tab = A.tab('fin', 'dre');
    const per = A.fv('fin', 'per', '90');
    const pagos = d.vendas.filter((v) => v.pag && v.pag.status === 'Pago' && A.inPeriod(v.pag.ts, per));
    const receita = A.sum(pagos, (v) => v.pag.valor);
    const custoMat = A.sum(pagos, (v) => pCusto(v.prop));
    const repasses = A.sum(pagos, (v) => pRepasse(v.prop));
    const frete = A.sum(pagos, (v) => A.sum(v.custos.filter((c) => c.tipo === 'Frete'), 'valor') || FRETE_CUSTO);
    const adic = A.sum(pagos, (v) => A.sum(v.custos.filter((c) => c.tipo !== 'Frete'), 'valor'));
    const mg = receita - custoMat - repasses - frete - adic;
    const aReceber = d.vendas.filter((v) => v.etapa === 'aprovada');
    const months = []; for (let i = 2; i >= 0; i--) { const t = new Date(); t.setDate(1); t.setMonth(t.getMonth() - i); months.push({ k: monthKey(t.toISOString()), l: t.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '') }); }
    const allPagos = d.vendas.filter((v) => v.pag && v.pag.status === 'Pago');
    const recM = months.map((m) => A.sum(allPagos.filter((v) => monthKey(v.pag.ts) === m.k), (v) => v.pag.valor));
    const cusM = months.map((m) => A.sum(allPagos.filter((v) => monthKey(v.pag.ts) === m.k), (v) => pCusto(v.prop) + pRepasse(v.prop) + FRETE_CUSTO + adicionais(v)));
    let body = '';
    if (tab === 'dre') {
      body = '<div class="g2"><div>' + A.card('Resultado simplificado do período', '<div class="calc" style="margin:0"><dl><dt>Receita bruta recebida</dt><dd>' + A.money(receita) + '</dd><dt>(−) Custo dos materiais</dt><dd>' + A.money(custoMat) + '</dd><dt>(−) Repasses de instalação</dt><dd>' + A.money(repasses) + '</dd><dt>(−) Frete e logística</dt><dd>' + A.money(frete) + '</dd><dt>(−) Custos adicionais de obra</dt><dd>' + A.money(adic) + '</dd><dt class="tot">Margem de contribuição</dt><dd class="tot">' + A.money(mg) + ' (' + A.pct(mg, receita) + ')</dd></dl></div><p class="small muted mt">Simulação gerencial antes de impostos, taxas de meios de pagamento e despesas fixas.</p>', { icon: 'chart' }) + '</div>' +
        '<div>' + A.card('Receita x custos por mês', A.cols(months.map((m) => m.l), [{ n: 'Receita', c: 'var(--acc)', v: recM }, { n: 'Custos diretos', c: '#c7b8f0', v: cusM }], { money: true }), { icon: 'chart' }) + '</div></div>';
    } else if (tab === 'rec') {
      const rows = d.vendas.filter((v) => v.pag || v.etapa === 'aprovada').filter((v) => !v.pag || A.inPeriod(v.pag.ts, per)).sort((a, b) => ((a.pag ? a.pag.ts : 'z') < (b.pag ? b.pag.ts : 'z') ? 1 : -1));
      body = A.card(null, A.table([{ l: 'Pedido', f: (v) => '<b>' + e(v.id) + '</b><small>' + e(nomeCli(v)) + '</small>' }, { l: 'Forma', f: (v) => (v.pag ? e(v.pag.forma + (v.pag.parcelas > 1 ? ' ' + v.pag.parcelas + 'x' : '')) : '—') }, { l: 'Data', f: (v) => (v.pag ? A.fd(v.pag.ts) : '—') }, { l: 'Valor', cls: 'r', f: (v) => A.money(v.pag ? v.pag.valor : pTotal(v.prop)) }, { l: 'Situação', f: (v) => (v.pag ? A.badge(v.pag.status) : A.badge('A receber', 'warn')) }, { l: '', cls: 'r', f: (v) => A.nav('Pedido', 'venda', v.id, 'sm', 'eye') }], rows, { foot: ['Total', '', '', A.money(A.sum(rows, (v) => (v.pag ? v.pag.valor : pTotal(v.prop)))), '', ''] }), { flush: true });
    } else if (tab === 'pag') {
      const ocs = d.vendas.filter((v) => v.compra && A.inPeriod(v.compra.ts, per)).map((v) => Object.assign({ v: v }, v.compra)).concat((d.ocsAvulsas || []).map((o) => Object.assign({ v: ven(o.venda) }, o)));
      body = A.card(null, A.table([{ l: 'Documento', f: (o) => '<b>' + e(o.id) + '</b><small>' + (o.v ? e(o.v.id) : '') + '</small>' }, { l: 'Fornecedor', f: (o) => e(forn(o.forn).nome) }, { l: 'Vencimento', f: (o) => { const t = new Date(o.ts); t.setDate(t.getDate() + 28); return A.fd(t.toISOString()); } }, { l: 'Valor', cls: 'r', f: (o) => A.money(o.valor) }, { l: 'Situação', f: (o) => { const t = new Date(o.ts); t.setDate(t.getDate() + 28); return t < new Date() ? A.badge('Pago', 'ok') : A.badge('A vencer', 'warn'); } }], ocs.sort((a, b) => (a.ts < b.ts ? 1 : -1)), { foot: ['Total', '', '', A.money(A.sum(ocs, 'valor')), ''] }), { flush: true });
    } else if (tab === 'rep') {
      const reps = d.vendas.filter((v) => v.inst && v.inst.repasse).filter((v) => A.inPeriod(v.inst.data || v.ts, per)).sort((a, b) => ((a.inst.data || '') < (b.inst.data || '') ? 1 : -1));
      body = A.note('Regra de liberação: o repasse é liberado após a confirmação da conclusão pelo cliente e pago pelo financeiro. Valor: ' + Math.round(REPASSE * 100) + '% da instalação.') + '<div class="mt"></div>' + A.card(null, A.table([{ l: 'Pedido', f: (v) => '<b>' + e(v.id) + '</b><small>' + e(v.titulo) + '</small>' }, { l: 'Parceiro', f: (v) => e(pro(v.inst.pro).empresa) }, { l: 'Instalação', f: (v) => (v.inst.data ? A.fd(v.inst.data) : '—') }, { l: 'Valor', cls: 'r', f: (v) => A.money(v.inst.repasse.valor) }, { l: 'Situação', f: (v) => A.badge(v.inst.repasse.status) },
        { l: '', cls: 'r', f: (v) => (v.inst.repasse.status === 'Liberado' ? A.b('Pagar (simulado)', 'c4.pagarRepasse', { id: v.id }, 'sm p', 'wallet') : v.inst.repasse.status === 'Pago' ? '<span class="small muted">' + A.fd(v.inst.repasse.ts) + '</span>' : '') }], reps, { foot: ['Total', '', '', A.money(A.sum(reps, (v) => v.inst.repasse.valor)), '', ''] }), { flush: true });
    } else {
      const cs = []; d.vendas.forEach((v) => v.custos.forEach((c) => { if (A.inPeriod(c.ts, per)) cs.push(Object.assign({ v: v, id: v.id + c.desc }, c)); }));
      body = A.card(null, A.table([{ l: 'Data', f: (c) => A.fd(c.ts) }, { l: 'Pedido', f: (c) => e(c.v.id) }, { l: 'Descrição', f: (c) => e(c.desc) }, { l: 'Tipo', f: (c) => A.badge(c.tipo, c.tipo === 'Frete' ? 'neutral' : 'warn') }, { l: 'Valor', cls: 'r', f: (c) => A.money(c.valor) }], cs.sort((a, b) => (a.ts < b.ts ? 1 : -1)), { foot: ['Total', '', '', '', A.money(A.sum(cs, 'valor'))] }), { flush: true });
    }
    return A.ph('Visão financeira (simulada)', 'Recebimentos de clientes, contas a pagar a fornecedores, repasses aos parceiros, custos e margem.') +
      '<div class="card mb16" style="padding:12px 14px 0">' + A.filters('fin', [{ k: 'per', l: 'Período', def: '90', o: A.PERIODS }]) + '</div>' +
      '<div class="g4 mb16">' + A.kpi({ l: 'Receita recebida', v: A.kmoney(receita), s: pagos.length + ' pedidos', icon: 'money', tone: 'ok' }) + A.kpi({ l: 'A receber', v: A.kmoney(A.sum(aReceber, (v) => pTotal(v.prop))), s: aReceber.length + ' aprovado(s) sem pagamento', icon: 'clock', tone: 'warn' }) + A.kpi({ l: 'Ticket médio', v: A.kmoney(pagos.length ? receita / pagos.length : 0), icon: 'receipt' }) + A.kpi({ l: 'Margem de contribuição', v: A.pct(mg, receita), s: A.money(mg), icon: 'chart', tone: mg >= 0 ? 'ok' : 'bad' }) + '</div>' +
      A.tabs('fin', [{ id: 'dre', l: 'Resultado' }, { id: 'rec', l: 'Recebimentos' }, { id: 'pag', l: 'Contas a pagar' }, { id: 'rep', l: 'Repasses' }, { id: 'cus', l: 'Custos adicionais' }]) + body;
  }
  function vMedAtend() {
    const d = db(), tab = A.tab('atd4', 'ch');
    const ch = []; d.vendas.forEach((v) => (v.pos ? v.pos.chamados : []).forEach((c) => ch.push({ v: v, c: c, id: c.id })));
    const oc = []; d.vendas.forEach((v) => v.ocorrencias.forEach((o) => oc.push({ v: v, o: o, id: o.id })));
    ch.sort((a, b) => (a.c.ts < b.c.ts ? 1 : -1)); oc.sort((a, b) => (a.o.ts < b.o.ts ? 1 : -1));
    return A.ph('Atendimento e pós-venda', 'Chamados de clientes (garantia, dúvidas, reclamações) e ocorrências de obra informadas pelos parceiros.') +
      A.tabs('atd4', [{ id: 'ch', l: 'Chamados de clientes', n: ch.filter((x) => x.c.status !== 'Resolvido').length }, { id: 'oc', l: 'Ocorrências de obra', n: oc.filter((x) => x.o.status === 'Aberta').length }]) +
      (tab === 'ch' ? A.card(null, A.table([{ l: 'Chamado', f: (x) => '<b>' + e(x.c.id) + '</b><small>' + e(x.v.id) + '</small>' }, { l: 'Cliente', f: (x) => e(nomeCli(x.v)) }, { l: 'Aberto', f: (x) => A.fdtn(x.c.ts) + '<small>' + A.ago(x.c.ts) + '</small>' }, { l: 'Tipo', f: (x) => e(x.c.tipo) + '<small>' + e(x.c.desc) + '</small>' }, { l: 'Situação', f: (x) => A.badge(x.c.status, x.c.status === 'Resolvido' ? 'ok' : x.c.status === 'Aberto' ? 'bad' : 'warn') },
        { l: '', cls: 'r', f: (x) => '<div class="acts-row" style="justify-content:flex-end">' + (x.c.status !== 'Resolvido' ? A.b('Responder', 'c4.chResp', { id: x.v.id, c: x.c.id }, 'sm p', 'chat') : '') + A.nav('Pedido', 'venda', x.v.id, 'sm', 'eye') + '</div>' }], ch, { empty: 'Nenhum chamado.' }), { flush: true })
        : A.card(null, A.table([{ l: 'Ocorrência', f: (x) => '<b>' + e(x.o.id) + '</b><small>' + e(x.v.id) + '</small>' }, { l: 'Data', f: (x) => A.fdtn(x.o.ts) }, { l: 'Tipo', f: (x) => e(x.o.tipo) + '<small>' + e(x.o.desc) + '</small>' }, { l: 'Parceiro', f: (x) => e(pro(x.v.inst.pro).empresa) }, { l: 'Custo', cls: 'r', f: (x) => (x.o.custo ? A.money(x.o.custo) : '—') }, { l: 'Situação', f: (x) => A.badge(x.o.status) },
          { l: '', cls: 'r', f: (x) => '<div class="acts-row" style="justify-content:flex-end">' + (x.o.status === 'Aberta' ? A.b('Tratar', 'c4.tratarOcr', { id: x.v.id, o: x.o.id }, 'sm dg', 'alert') : '') + A.nav('Pedido', 'venda', x.v.id, 'sm', 'eye') + '</div>' }], oc, { empty: 'Nenhuma ocorrência.' }), { flush: true }));
  }
  function vMedAlcadas() {
    const log = []; db().vendas.forEach((v) => { if (v.prop && v.prop.alcada) log.push({ v: v, a: v.prop.alcada, id: v.id }); v.ocorrencias.filter((o) => o.alcada).forEach((o) => log.push({ v: v, a: o.alcada, id: o.id, ocr: o })); });
    return A.ph('Alçadas e regras de aprovação', 'Neste modelo, a AiCalhas responde por preço, compras, prazos e garantia. Por isso é preciso definir quem aprova cada decisão.') +
      '<div class="g21"><div>' + A.card('Matriz de alçadas (proposta inicial para validação)', A.table([{ l: 'Tema', f: (r) => '<b>' + e(r.tema) + '</b>' }, { l: 'Regra / limite', f: (r) => e(r.regra) }, { l: 'Quem aprova', f: (r) => A.badge(r.quem, /Gerência/.test(r.quem) ? 'bad' : /Coordenação/.test(r.quem) ? 'warn' : 'info') }], ALCADAS.map((r, i) => Object.assign({ id: i }, r)), { cls: 'fit' }), { icon: 'scale', flush: true }) + '</div>' +
      '<div class="stack">' + A.card('Aprovações registradas', log.length ? log.map((x) => '<div class="li clk" data-act="core.nav" data-view="venda" data-id="' + x.v.id + '">' + I('scale', 18) + '<div class="lt"><b>' + e(x.v.id) + ' — ' + (x.ocr ? 'custo adicional ' + A.money(x.ocr.custo) : 'desconto ' + A.num(x.v.prop.descPct, 1) + '%') + '</b><small>Alçada: ' + e(x.a.nivel) + ' — ' + (x.a.aprovadoPor ? 'aprovado por ' + e(x.a.aprovadoPor) : x.a.recusado ? 'recusado' : 'aguardando') + '</small></div>' + A.badge(x.a.aprovadoPor ? 'Aprovada' : x.a.recusado ? 'Recusada' : 'Aguardando', x.a.aprovadoPor ? 'ok' : x.a.recusado ? 'bad' : 'warn') + '</div>').join('') : A.empty('Nenhuma aprovação por alçada.', 'scale'), { icon: 'history' }) +
      A.note('Na demonstração, o mediador simula a aprovação do gestor. Em um sistema real, cada nível teria login próprio e a aprovação ficaria registrada com usuário, data e justificativa.') + '</div></div>';
  }
  function vMedCad() {
    const d = db(), tab = A.tab('cad', 'cli');
    const T = {
      cli: () => A.table([{ l: 'Cliente', f: (c) => '<b>' + e(c.nome) + '</b><small>' + e(c.contato || c.email) + '</small>' }, { l: 'Tipo', k: 'tipo' }, { l: 'Cidade', f: (c) => e(c.bairro + ', ' + c.cidade) }, { l: 'Pedidos', cls: 'r', f: (c) => d.vendas.filter((v) => v.clienteId === c.id).length }, { l: 'Total comprado', cls: 'r', f: (c) => A.money(A.sum(d.vendas.filter((v) => v.clienteId === c.id && v.pag && v.pag.status === 'Pago'), (v) => v.pag.valor)) }], d.clientes),
      parc: () => A.table([{ l: 'Parceiro', f: (p) => '<b>' + e(p.empresa) + '</b><small>' + e(p.nome) + ' — ' + e(p.tel) + '</small>' }, { l: 'Regiões', f: (p) => e(p.regioes.join(', ')) }, { l: 'Contrato', f: (p) => e(p.contrato) }, { l: 'Instalações', cls: 'r', f: (p) => d.vendas.filter((v) => v.inst && v.inst.pro === p.id && v.inst.status === 'Concluída').length }, { l: 'Repasses pagos', cls: 'r', f: (p) => A.money(A.sum(d.vendas.filter((v) => v.inst && v.inst.pro === p.id && v.inst.repasse && v.inst.repasse.status === 'Pago'), (v) => v.inst.repasse.valor)) }, { l: 'Situação', f: (p) => A.badge(p.status, p.status === 'Ativo' ? 'ok' : 'warn') }], d.pros),
      mat: () => A.table([{ l: 'Material', f: (m) => '<b>' + e(m.nome) + '</b><small>' + e(m.id) + '</small>' }, { l: 'Unidade', k: 'un' }, { l: 'Custo', cls: 'r', f: (m) => A.money(m.custo) }, { l: 'Preço', cls: 'r', f: (m) => A.money(m.preco) }, { l: 'Markup', cls: 'r', f: (m) => A.pct(m.preco - m.custo, m.custo) }, { l: 'Estoque', cls: 'r', f: (m) => m.estoque }, { l: '', cls: 'r', f: (m) => A.b('Editar', 'c4.matEdit', { id: m.id }, 'sm', 'edit') }], d.materiais),
      forn: () => A.table([{ l: 'Fornecedor', f: (f) => '<b>' + e(f.nome) + '</b><small>' + e(f.doc) + '</small>' }, { l: 'Cidade', k: 'cidade' }, { l: 'Contato', k: 'contato' }, { l: 'Prazo de entrega', k: 'prazo' }, { l: 'Compras (90 dias)', cls: 'r', f: (f) => A.money(A.sum(d.vendas.filter((v) => v.compra && v.compra.forn === f.id && A.inPeriod(v.compra.ts, '90')), (v) => v.compra.valor)) }], d.fornecedores),
      srv: () => A.table([{ l: 'Código', k: 'id' }, { l: 'Serviço', f: (s) => '<b>' + e(s.nome) + '</b><small>' + e(s.desc) + '</small>' }, { l: 'Pedidos', cls: 'r', f: (s) => d.vendas.filter((v) => v.srv === s.id).length }, { l: 'Situação', f: (s) => A.badge(s.ativo ? 'Ativo' : 'Inativo', s.ativo ? 'ok' : 'neutral') }], d.servicos),
    };
    const btn = { cli: A.b('Cadastrar cliente', 'c4.cadCli', {}, 'p', 'plus'), parc: A.b('Cadastrar parceiro', 'c4.cadParc', {}, 'p', 'plus'), mat: A.b('Cadastrar material', 'c4.matEdit', {}, 'p', 'plus'), forn: A.b('Cadastrar fornecedor', 'c4.cadForn', {}, 'p', 'plus'), srv: A.b('Cadastrar serviço', 'c4.cadSrv', {}, 'p', 'plus') }[tab];
    return A.ph('Cadastros', 'Clientes, parceiros de instalação, materiais com custo e preço, fornecedores e serviços.', btn) +
      A.tabs('cad', [{ id: 'cli', l: 'Clientes', n: d.clientes.length }, { id: 'parc', l: 'Parceiros', n: d.pros.length }, { id: 'mat', l: 'Materiais', n: d.materiais.length }, { id: 'forn', l: 'Fornecedores', n: d.fornecedores.length }, { id: 'srv', l: 'Serviços', n: d.servicos.length }]) + A.card(null, T[tab](), { flush: true });
  }
  function vMedRel() {
    const d = db(), tab = A.tab('rel', 'ven');
    const per = A.fv('rel', 'per', '90'), cid = A.fv('rel', 'cid'), pf = A.fv('rel', 'pro');
    let list = d.vendas.filter((v) => v.pag && v.pag.status === 'Pago' && A.inPeriod(v.pag.ts, per));
    if (cid) list = list.filter((v) => cidadeOf(v) === cid);
    if (pf) list = list.filter((v) => proDe(v) === pf);
    const filt = A.filters('rel', [{ k: 'per', l: 'Período', def: '90', o: A.PERIODS }, { k: 'cid', l: 'Cidade', o: A.opts(d.cidades, 'Todas') }, { k: 'pro', l: 'Parceiro', o: A.opts(d.pros.filter((p) => p.status === 'Ativo').map((p) => ({ v: p.id, l: p.empresa })), 'Todos') }]);
    const sumBy = (fn, val) => Object.entries(list.reduce((m, v) => { const k = fn(v); m[k] = (m[k] || 0) + val(v); return m; }, {})).map((x) => ({ l: x[0], v: x[1] })).sort((a, b) => b.v - a.v);
    let body = '';
    if (tab === 'ven') {
      body = '<div class="g4 mb16">' + A.kpi({ l: 'Pedidos pagos', v: list.length, icon: 'receipt' }) + A.kpi({ l: 'Faturamento', v: A.kmoney(A.sum(list, (v) => v.pag.valor)), icon: 'money', tone: 'ok' }) + A.kpi({ l: 'Ticket médio', v: A.kmoney(list.length ? A.sum(list, (v) => v.pag.valor) / list.length : 0), icon: 'chart' }) + A.kpi({ l: 'Pagamentos via Pix', v: A.pct(list.filter((v) => v.pag.forma === 'Pix').length, list.length), icon: 'wallet' }) + '</div>' +
        '<div class="g3 mb16">' + A.card('Faturamento por cidade', A.bars(sumBy(cidadeOf, (v) => v.pag.valor), { money: true })) + A.card('Faturamento por serviço', A.bars(sumBy((v) => srvName(v.srv), (v) => v.pag.valor), { money: true })) + A.card('Forma de pagamento', A.bars(A.toBars(A.count(list, (v) => v.pag.forma)))) + '</div>' +
        A.card('Pedidos do período', A.table([{ l: 'Pedido', f: (v) => '<b>' + e(v.id) + '</b><small>' + e(v.titulo) + '</small>' }, { l: 'Pago em', f: (v) => A.fd(v.pag.ts) }, { l: 'Cliente', f: (v) => e(nomeCli(v)) }, { l: 'Cidade', f: (v) => e(cidadeOf(v)) }, { l: 'Valor', cls: 'r', f: (v) => A.money(v.pag.valor) }, { l: 'Margem', cls: 'r', f: (v) => A.pct(margem(v), v.pag.valor) }, { l: '', cls: 'r', f: (v) => A.b('Detalhes', 'c4.repDet', { id: v.id }, 'sm', 'eye') }], list.slice().sort((a, b) => (a.pag.ts < b.pag.ts ? 1 : -1))), { flush: true });
    } else if (tab === 'mat') {
      const q = {}; list.forEach((v) => v.prop.itens.forEach((x) => { q[x.nome] = q[x.nome] || { l: x.nome, qtd: 0, custo: 0, venda: 0, un: x.un }; q[x.nome].qtd += x.qtd; q[x.nome].custo += x.qtd * x.custo; q[x.nome].venda += x.qtd * x.preco; }));
      const rows = Object.values(q).sort((a, b) => b.venda - a.venda).map((r, i) => Object.assign({ id: i }, r));
      body = '<div class="g2 mb16">' + A.card('Materiais mais vendidos (valor)', A.bars(rows.slice(0, 8).map((r) => ({ l: r.l, v: r.venda })), { money: true })) + A.card('Compras por fornecedor', A.bars(sumBy((v) => (v.compra ? forn(v.compra.forn).nome : 'Sem compra'), (v) => (v.compra ? v.compra.valor : 0)), { money: true })) + '</div>' +
        A.card('Materiais no período', A.table([{ l: 'Material', f: (r) => e(r.l) }, { l: 'Quantidade', cls: 'r', f: (r) => A.num(r.qtd, 1) + ' ' + e(r.un) }, { l: 'Custo', cls: 'r', f: (r) => A.money(r.custo) }, { l: 'Venda', cls: 'r', f: (r) => A.money(r.venda) }, { l: 'Margem', cls: 'r', f: (r) => A.pct(r.venda - r.custo, r.venda) }], rows), { flush: true });
    } else if (tab === 'op') {
      const dd = (a, b) => (a && b ? (new Date(b) - new Date(a)) / 864e5 : null);
      const avgD = (k1, k2) => { const vs = list.map((v) => dd(v.m[k1], v.m[k2])).filter((x) => x != null && x >= 0); return vs.length ? A.num(A.avg(vs), 1) + ' dias' : '—'; };
      const ocs = []; list.forEach((v) => v.ocorrencias.forEach((o) => ocs.push(o)));
      body = '<div class="g4 mb16">' + A.kpi({ l: 'Pedido → proposta', v: avgD('criado', 'proposta'), icon: 'receipt' }) + A.kpi({ l: 'Pagamento → entrega', v: avgD('pago', 'entrega'), icon: 'truck' }) + A.kpi({ l: 'Pagamento → conclusão', v: avgD('pago', 'concluido'), icon: 'tool' }) + A.kpi({ l: 'Pedidos com ocorrência', v: A.pct(list.filter((v) => v.ocorrencias.length).length, list.length), icon: 'alert', tone: 'warn' }) + '</div>' +
        '<div class="g2">' + A.card('Instalações por parceiro', A.bars(A.toBars(A.count(list.filter((v) => v.inst), (v) => pro(v.inst.pro).empresa)))) + A.card('Avaliação média por parceiro', A.bars(Object.entries(list.filter((v) => v.pos && v.pos.avaliacao).reduce((m, v) => { const k = pro(v.inst.pro).empresa; m[k] = m[k] || []; m[k].push(v.pos.avaliacao.nota); return m; }, {})).map((x) => ({ l: x[0], v: A.avg(x[1]) })).sort((a, b) => b.v - a.v), { dec: 1, suffix: ' ★' })) + '</div>';
    } else {
      body = '<div class="g2 mb16">' + A.card('Repasses por parceiro', A.bars(sumBy((v) => pro(v.inst.pro).empresa, (v) => v.inst.repasse.valor), { money: true })) + A.card('Situação dos repasses', A.bars(A.toBars(A.count(list.filter((v) => v.inst && v.inst.repasse), (v) => v.inst.repasse.status)))) + '</div>' +
        A.card('Repasses do período', A.table([{ l: 'Pedido', f: (v) => e(v.id) }, { l: 'Parceiro', f: (v) => e(pro(v.inst.pro).empresa) }, { l: 'Instalação (cliente)', cls: 'r', f: (v) => A.money(v.prop.inst.valor) }, { l: 'Repasse', cls: 'r', f: (v) => A.money(v.inst.repasse.valor) }, { l: 'Situação', f: (v) => A.badge(v.inst.repasse.status) }], list.filter((v) => v.inst && v.inst.repasse)), { flush: true });
    }
    return A.ph('Relatórios', 'Indicadores do modelo centralizado: vendas, materiais, operação e repasses.') +
      A.tabs('rel', [{ id: 'ven', l: 'Vendas' }, { id: 'mat', l: 'Compras e materiais' }, { id: 'op', l: 'Operação' }, { id: 'rep', l: 'Repasses' }]) + '<div class="card mb16" style="padding:12px 14px 0">' + filt + '</div>' + body;
  }

  /* ------------------------------------------------------------------
     Ações
     ------------------------------------------------------------------ */
  const fin = (v, msg, acao, tone) => { A.log(acao, v.id); A.close(); A.refresh(); A.toast(msg, tone); };
  const dtl = (iso) => new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16);
  const actions = {
    'c4.novaSave': (v) => {
      const d = db(), id = A.nextId('VEN-', d.vendas);
      const x = { id: id, ts: A.now(), clienteId: MYCLI, srv: v.srv, titulo: v.titulo, desc: v.desc, fotos: v.fotos || [], etapa: 'avaliacao', aval: null, prop: null, pag: null, compra: null, entrega: null, inst: null, ocorrencias: [], custos: [], pos: null, m: { criado: A.now() }, hist: [] };
      hist(x, 'Pedido de orçamento recebido'); d.vendas.push(x);
      A.log('Pedido de orçamento registrado', id + ' · ' + v.titulo); A.go('pedido', id); A.toast('Pedido ' + id + ' registrado. A AiCalhas vai agendar a avaliação técnica.');
    },
    'c4.medNova': () => A.form({ title: 'Nova oportunidade de venda', sub: 'Registro de pedido recebido por telefone, site ou indicação.', submit: 'c4.medNovaSave', fields: [{ name: 'cliente', label: 'Cliente', type: 'select', options: db().clientes.map((c) => ({ v: c.id, l: c.nome })), required: true }, { name: 'srv', label: 'Serviço', type: 'select', options: db().servicos.map((s) => ({ v: s.id, l: s.nome })) }, { name: 'titulo', label: 'Título', full: true, required: true, value: 'Calhas novas para galpão' }, { name: 'desc', label: 'Descrição', type: 'textarea', full: true, value: 'Cliente pediu orçamento por telefone.' }] }),
    'c4.medNovaSave': (v) => { const d = db(), id = A.nextId('VEN-', d.vendas); const x = { id: id, ts: A.now(), clienteId: v.cliente, srv: v.srv, titulo: v.titulo, desc: v.desc, fotos: [], etapa: 'avaliacao', aval: null, prop: null, pag: null, compra: null, entrega: null, inst: null, ocorrencias: [], custos: [], pos: null, m: { criado: A.now() }, hist: [] }; hist(x, 'Pedido de orçamento registrado pela AiCalhas'); d.vendas.push(x); A.log('Oportunidade registrada', id); A.close(); A.go('venda', id); A.toast('Pedido ' + id + ' criado. Agende a avaliação técnica.'); },
    'c4.agAval': (ds) => { const v = ven(ds.id); const cid = cidadeOf(v); A.form({ title: 'Agendar avaliação técnica — ' + v.id, sub: srvName(v.srv) + ' em ' + cid, submit: 'c4.agAvalSave', extra: { id: v.id }, fields: [{ name: 'pro', label: 'Parceiro técnico', type: 'select', required: true, value: v.aval ? v.aval.pro : '', options: db().pros.filter((p) => p.status === 'Ativo').sort((a, b) => (b.regioes.indexOf(cid) >= 0) - (a.regioes.indexOf(cid) >= 0)).map((p) => ({ v: p.id, l: p.empresa + (p.regioes.indexOf(cid) >= 0 ? ' — atende ' + cid : ' — fora da região') })) }, { name: 'data', label: 'Data e horário', type: 'datetime-local', required: true, value: dtl(v.aval ? v.aval.data : A.d(1, '10:00')) }] }); },
    'c4.agAvalSave': (vals, x) => { const v = ven(x.id); v.aval = { pro: vals.pro, data: new Date(vals.data).toISOString(), status: 'Agendada' }; hist(v, 'Avaliação técnica agendada para ' + A.fdt(v.aval.data) + ' com ' + pro(vals.pro).empresa); fin(v, 'Avaliação técnica agendada para ' + A.when(v.aval.data) + '.', 'Avaliação técnica agendada'); },
    'c4.regAval': (ds) => { const v = ven(ds.id); A.form({ title: 'Registrar avaliação técnica — ' + v.id, sub: 'A AiCalhas usará este levantamento para montar a proposta ao cliente.', submit: 'c4.regAvalSave', extra: { id: v.id }, size: 'lg', fields: [
      { name: 'medidas', label: 'Levantamento / medidas', required: true, full: true, value: '18 m de rufo; 22 m de calha; 4 descidas' },
      { name: 'obs', label: 'Diagnóstico', type: 'textarea', full: true, required: true, value: 'Rufos do 2º andar com vedação ressecada; duas descidas com encaixe solto. Calhas em bom estado, precisam de limpeza.' },
      { name: 'sug', label: 'Materiais sugeridos (quantidades técnicas)', type: 'items', catalog: db().materiais, full: true, value: [{ id: 'MAT-04', qtd: 18, preco: 42 }, { id: 'MAT-10', qtd: 4, preco: 32 }, { id: 'MAT-11', qtd: 8, preco: 6.5 }] },
      { name: 'mo', label: 'Mão de obra estimada (R$)', type: 'number', min: 0, step: 10, value: 1500 },
      { name: 'fotos', label: 'Fotos', type: 'photos', full: true, presets: ['rufo', 'condutor', 'calha-frontal'], preselect: ['rufo'] },
    ] }); },
    'c4.regAvalSave': (vals, x) => { const v = ven(x.id); Object.assign(v.aval, { status: 'Realizada', medidas: vals.medidas, obs: vals.obs, sugestao: vals.sug.map((s) => ({ id: s.id, qtd: s.qtd })), maoObraSug: +vals.mo, fotos: vals.fotos || [], realizadaEm: A.now() }); v.etapa = 'proposta'; v.inst = { pro: v.aval.pro, data: null, status: 'A agendar', etapas: EXEC.map((n) => ({ n: n, ok: false, ts: null })), repasse: null }; hist(v, 'Avaliação técnica realizada'); fin(v, 'Avaliação registrada. A AiCalhas vai montar a proposta.', 'Avaliação técnica registrada'); },
    'c4.montar': (ds) => {
      const v = ven(ds.id), p = v.prop;
      const itens = p ? p.itens : (v.aval && v.aval.sugestao ? v.aval.sugestao.map((s) => { const m = mat(s.id); return { id: s.id, qtd: s.qtd, preco: m.preco }; }) : [{}]);
      A.form({ title: (p ? 'Revisar' : 'Montar') + ' proposta — ' + v.id, sub: nomeCli(v) + ' — ' + srvName(v.srv), submit: 'c4.montarSave', extra: { id: v.id }, size: 'lg', submitLabel: 'Emitir proposta', icon: 'send',
        intro: v.aval && v.aval.medidas ? '<b>Avaliação técnica:</b> ' + e(v.aval.medidas) + '. ' + e(v.aval.obs || '') + (p && p.revisao ? '<br><b>Revisão pedida pelo cliente:</b> ' + e(p.revisao) : '') : '',
        fields: [
          { name: 'itens', label: 'Materiais (preço de venda AiCalhas)', type: 'items', catalog: db().materiais, full: true, value: itens },
          { name: 'instDesc', label: 'Descrição da instalação', full: true, required: true, value: p ? p.inst.desc : 'Instalação completa com teste de escoamento e limpeza final.' },
          { name: 'instV', label: 'Valor da instalação (R$)', type: 'number', min: 0, step: 10, required: true, value: p ? p.inst.valor : (v.aval && v.aval.maoObraSug) || 900 },
          { name: 'frete', label: 'Frete e entrega (R$)', type: 'number', min: 0, step: 5, value: p ? p.frete : FRETE },
          { name: 'desc', label: 'Desconto (%)', type: 'number', min: 0, max: 30, step: 0.5, value: p ? p.descPct : 0, help: 'Até 5%: mediador. 5–10%: Coordenação. Acima de 10%: Gerência.' },
          { name: 'validade', label: 'Validade', type: 'date', required: true, value: A.d(10).slice(0, 10) },
          { name: 'motivo', label: 'Justificativa do desconto (se houver)', full: true, value: p && p.alcada ? p.alcada.motivo : '' },
          { type: 'html', html: '<div class="calc" id="c4calc"></div>' },
        ],
        calc: (f) => {
          const its = A.readItems(f.querySelector('.ied'));
          const pp = { itens: its, inst: { valor: +f.instV.value || 0 }, frete: +f.frete.value || 0, descPct: +f.desc.value || 0 };
          const tot = pTotal(pp), cus = pCusto(pp) + pRepasse(pp) + FRETE_CUSTO, mg = tot - cus;
          const box = document.getElementById('c4calc');
          if (box) box.innerHTML = '<dl><dt>Materiais</dt><dd>' + A.money(pMat(pp)) + '</dd><dt>Instalação</dt><dd>' + A.money(pp.inst.valor) + '</dd><dt>Frete</dt><dd>' + A.money(pp.frete) + '</dd><dt>Desconto</dt><dd>− ' + A.money(pDesc(pp)) + '</dd><dt class="tot">Total ao cliente</dt><dd class="tot">' + A.money(tot) + '</dd><dt>Custo estimado (materiais + repasse ' + Math.round(REPASSE * 100) + '% + frete)</dt><dd>' + A.money(cus) + '</dd><dt>Margem estimada</dt><dd style="color:' + (mg < 0 ? 'var(--bad)' : 'var(--ok)') + '">' + A.money(mg) + ' (' + A.pct(mg, tot) + ')</dd><dt>Alçada necessária</dt><dd>' + nivelDesc(pp.descPct) + '</dd></dl>';
        },
      });
    },
    'c4.montarSave': (vals, x) => {
      const v = ven(x.id), prev = v.prop;
      if (!vals.itens.length && !+vals.instV) { A.toast('Inclua materiais ou valor de instalação.', 'warn'); return; }
      const descPct = +vals.desc || 0, nivel = nivelDesc(descPct);
      v.prop = { versao: prev ? prev.versao + 1 : 1, itens: vals.itens, inst: { desc: vals.instDesc, valor: +vals.instV }, frete: +vals.frete || 0, descPct: descPct, validade: new Date(vals.validade + 'T12:00').toISOString(), condicoes: COND, emitida: A.now(), status: nivel === 'Mediador' ? 'Enviada' : 'Aguardando alçada', obs: 'Garantia de 12 meses para materiais e instalação.' };
      if (nivel !== 'Mediador') { v.prop.alcada = { nivel: nivel, motivo: vals.motivo || 'Não informado' }; v.etapa = 'alcada'; hist(v, 'Proposta com ' + descPct + '% de desconto enviada para aprovação da ' + nivel, 'interno'); fin(v, 'Desconto acima da sua alçada: proposta enviada para aprovação da ' + nivel + '.', 'Proposta enviada para aprovação de alçada (' + nivel + ')', 'warn'); return; }
      v.etapa = 'enviada'; v.m.proposta = A.now(); hist(v, 'Proposta AiCalhas ' + (prev ? 'revisada (versão ' + v.prop.versao + ')' : 'emitida') + ' e enviada ao cliente — ' + A.money(pTotal(v.prop)));
      fin(v, 'Proposta enviada ao cliente: ' + A.money(pTotal(v.prop)) + '.', 'Proposta enviada ao cliente');
    },
    'c4.alcadaOk': (ds) => { const v = ven(ds.id), al = v.prop.alcada; A.confirm({ title: 'Aprovar desconto — alçada ' + al.nivel, msg: 'Desconto de <b>' + A.num(v.prop.descPct, 1) + '%</b> (' + A.money(pDesc(v.prop)) + ') na proposta ' + e(v.id) + '. Margem estimada após desconto: <b>' + A.money(margem(v)) + '</b> (' + A.pct(margem(v), pTotal(v.prop)) + ').', note: 'Simulação: a aprovação será registrada em nome de ' + (al.nivel === 'Gerência' ? GESTOR.nome : COORD.nome) + '. Justificativa: ' + e(al.motivo), ok: 'Aprovar e enviar ao cliente', onOk: () => {
      const who = al.nivel === 'Gerência' ? GESTOR : COORD;
      al.aprovadoPor = who.nome; al.ts = A.now(); v.prop.status = 'Enviada'; v.etapa = 'enviada'; v.m.proposta = A.now();
      hist(v, 'Desconto aprovado pela ' + al.nivel + ' (' + who.nome + ')', 'interno', who.nome); hist(v, 'Proposta AiCalhas enviada ao cliente — ' + A.money(pTotal(v.prop)));
      A.log('Desconto de ' + A.num(v.prop.descPct, 1) + '% aprovado (alçada ' + al.nivel + ')', v.id, who); A.log('Proposta enviada ao cliente', v.id); A.refresh(); A.toast('Desconto aprovado pela ' + al.nivel + ' e proposta enviada ao cliente.'); } }); },
    'c4.alcadaNo': (ds) => A.form({ title: 'Recusar desconto', submit: 'c4.alcadaNoSave', extra: { id: ds.id }, one: true, submitLabel: 'Recusar e devolver', btnCls: 'dgs', icon: 'x', fields: [{ name: 'obs', label: 'Orientação', type: 'textarea', required: true, value: 'Desconto máximo autorizado de 8%; oferecer parcelamento em 3x.' }] }),
    'c4.alcadaNoSave': (vals, x) => { const v = ven(x.id); v.prop.alcada.recusado = true; v.prop.alcada.obs = vals.obs; v.prop.status = 'Em elaboração'; v.etapa = 'proposta'; hist(v, 'Desconto recusado pela alçada: ' + vals.obs, 'interno'); A.log('Desconto recusado (alçada ' + v.prop.alcada.nivel + ')', v.id, v.prop.alcada.nivel === 'Gerência' ? GESTOR : COORD); A.close(); A.refresh(); A.toast('Desconto recusado. Revise a proposta.', 'warn'); },
    'c4.aprovar': (ds) => { const v = ven(ds.id); A.confirm({ title: 'Aprovar proposta', msg: 'Aprovar a proposta da AiCalhas de <b>' + A.money(pTotal(v.prop)) + '</b> com materiais, instalação e frete incluídos?', note: 'Você contrata a AiCalhas. Em seguida, escolha a forma de pagamento (simulada).', ok: 'Aprovar proposta', onOk: () => { aprovar(v, A.me().nome); A.refresh(); A.toast('Proposta aprovada. Agora é só realizar o pagamento.'); actions['c4.pagar']({ id: v.id }); } }); },
    'c4.aprovarPor': (ds) => A.form({ title: 'Registrar aprovação do cliente', submit: 'c4.aprovarPorSave', extra: { id: ds.id }, one: true, fields: [{ name: 'canal', label: 'Canal', type: 'select', options: ['Telefone', 'WhatsApp', 'E-mail com aceite'] }, { name: 'obs', label: 'Registro', type: 'textarea', required: true, value: 'Cliente aprovou a proposta e vai pagar por boleto.' }] }),
    'c4.aprovarPorSave': (vals, x) => { const v = ven(x.id); hist(v, 'Aprovação registrada pela AiCalhas via ' + vals.canal.toLowerCase() + ': ' + vals.obs, 'interno'); aprovar(v, nomeCli(v) + ' (registrado via ' + vals.canal.toLowerCase() + ')'); A.close(); A.refresh(); A.toast('Aprovação registrada. Aguardando pagamento.'); },
    'c4.revisao': (ds) => A.form({ title: 'Solicitar revisão da proposta', submit: 'c4.revisaoSave', extra: { id: ds.id }, one: true, fields: [{ name: 'txt', label: 'O que deseja revisar?', type: 'textarea', required: true, value: 'Gostaria de incluir tela protetora contra folhas e ver o valor com calha de alumínio.' }] }),
    'c4.revisaoSave': (vals, x) => { const v = ven(x.id); v.prop.status = 'Revisão solicitada'; v.prop.revisao = vals.txt; v.etapa = 'proposta'; hist(v, 'Cliente solicitou revisão da proposta: ' + vals.txt); fin(v, 'Pedido de revisão enviado à AiCalhas.', 'Revisão de proposta solicitada pelo cliente'); },
    'c4.pagar': (ds) => { const v = ven(ds.id), t = pTotal(v.prop); A.form({ title: 'Pagamento — ' + v.id, sub: 'Simulação: nenhuma cobrança real é realizada.', submit: 'c4.pagarSave', extra: { id: v.id }, one: true, submitLabel: 'Continuar', icon: 'arrowR', fields: [{ name: 'forma', label: 'Forma de pagamento', type: 'radios', required: true, value: 'Pix', options: [{ v: 'Pix', l: 'Pix à vista — ' + A.money(t * 0.95) + ' (5% de desconto)' }, { v: 'Cartão', l: 'Cartão de crédito — até 3x de ' + A.money(t / 3) }, { v: 'Boleto', l: 'Boleto à vista — ' + A.money(t) }] }, { name: 'parcelas', label: 'Parcelas (cartão)', type: 'select', options: [{ v: 1, l: '1x' }, { v: 2, l: '2x' }, { v: 3, l: '3x' }], value: 3 }] }); },
    'c4.pagarSave': (vals, x) => {
      const v = ven(x.id), t = pTotal(v.prop), valor = vals.forma === 'Pix' ? Math.round(t * 95) / 100 : t, parc = vals.forma === 'Cartão' ? +vals.parcelas : 1;
      const data = { id: v.id, forma: vals.forma, parc: parc, valor: valor };
      let body = '';
      if (vals.forma === 'Pix') body = '<div style="display:grid;place-items:center;gap:10px;text-align:center">' + A.qr(v.id.length * 31) + '<b>' + A.money(valor) + '</b><span class="small muted">QR Code demonstrativo — não pode ser pago.</span></div>';
      else if (vals.forma === 'Cartão') body = A.note('Pagamento em ' + parc + 'x de ' + A.money(valor / parc) + ' no cartão. Na demonstração, nenhum dado de cartão é solicitado.', '', 'wallet');
      else body = '<div class="note neutral"><div><b>Linha digitável (demonstrativa):</b><br><code>00000.00000 00000.000000 00000.000000 0 00000000000000</code><br><small>Vencimento: ' + A.fd(A.d(2)) + ' — ' + A.money(valor) + '</small></div></div>';
      A.modal({ title: 'Pagamento via ' + vals.forma, sub: 'Ambiente demonstrativo — nenhuma transação real.', size: 'sm', body: body, foot: '<button class="btn" data-act="core.close">Pagar depois</button>' + A.b('Simular pagamento confirmado', 'c4.pagOk', data, 'ok', 'check') });
    },
    'c4.pagOk': (ds) => { const v = ven(ds.id); ensureInst(v); v.pag = { forma: ds.forma, parcelas: +ds.parc, valor: +ds.valor, status: 'Pago', ts: A.now() }; v.etapa = 'pago'; v.m.pago = A.now(); v.inst.repasse = { valor: pRepasse(v.prop), status: 'Previsto' }; hist(v, 'Pagamento confirmado (' + ds.forma + (+ds.parc > 1 ? ' ' + ds.parc + 'x' : '') + ') — ' + A.money(+ds.valor)); A.log('Pagamento simulado confirmado (' + ds.forma + ')', v.id + ' · ' + A.money(+ds.valor)); A.close(); A.refresh(); A.toast('Pagamento confirmado (simulação). A AiCalhas vai comprar os materiais.'); },
    'c4.pagManual': (ds) => { const v = ven(ds.id); A.form({ title: 'Registrar pagamento recebido', sub: 'Conciliação manual (simulação).', submit: 'c4.pagManualSave', extra: { id: v.id }, one: true, fields: [{ name: 'forma', label: 'Forma', type: 'select', options: ['Pix', 'Cartão', 'Boleto'], value: 'Boleto' }, { name: 'valor', label: 'Valor recebido', type: 'number', step: 0.01, value: pTotal(v.prop), required: true }] }); },
    'c4.pagManualSave': (vals, x) => actions['c4.pagOk']({ id: x.id, forma: vals.forma, parc: 1, valor: vals.valor }),
    'c4.gerarOC': (ds) => {
      const v = ven(ds.id), cnt = A.count(v.prop.itens, (x) => mat(x.id).forn); const sug = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
      const val = pCusto(v.prop);
      A.form({ title: 'Gerar pedido de compra — ' + v.id, sub: 'Materiais pelo preço de custo do fornecedor.', submit: 'c4.gerarOCSave', extra: { id: v.id }, size: 'lg', submitLabel: 'Enviar pedido ao fornecedor', icon: 'cart',
        after: '<div class="mt"></div>' + A.table([{ l: 'Material', f: (x) => e(x.nome) }, { l: 'Qtd.', cls: 'r', f: (x) => A.num(x.qtd, x.qtd % 1 ? 1 : 0) + ' ' + e(x.un) }, { l: 'Custo unit.', cls: 'r', f: (x) => A.money(x.custo) }, { l: 'Total', cls: 'r', f: (x) => A.money(x.qtd * x.custo) }], v.prop.itens, { foot: ['Total', '', '', A.money(val)] }) + (val > 5000 ? AiC.note('Compra acima de R$ 5.000: requer aprovação da Gerência.', 'warn') : ''),
        fields: [{ name: 'forn', label: 'Fornecedor', type: 'select', options: db().fornecedores.map((f) => ({ v: f.id, l: f.nome + ' — prazo ' + f.prazo })), value: sug, required: true }, { name: 'prev', label: 'Previsão de entrega no depósito', type: 'date', required: true, value: A.d(2).slice(0, 10) }, { name: 'obs', label: 'Observação ao fornecedor', full: true, value: 'Entregar no depósito AiCalhas, Campinas.' }] });
    },
    'c4.gerarOCSave': (vals, x) => { const v = ven(x.id), d = db(); const n = 312 + d.vendas.filter((k) => k.compra).length; v.compra = { id: 'OC-' + String(n).padStart(4, '0'), forn: vals.forn, valor: pCusto(v.prop), status: 'Solicitada', previsao: new Date(vals.prev + 'T10:00').toISOString(), ts: A.now() }; v.etapa = 'compra'; v.m.compra = A.now(); hist(v, 'Materiais em compra (' + v.compra.id + ')'); fin(v, 'Pedido de compra ' + v.compra.id + ' enviado a ' + forn(vals.forn).nome + ' (simulação).', 'Pedido de compra gerado ' + v.compra.id); },
    'c4.ocConf': (ds) => { const v = ven(ds.id); v.compra.status = 'Confirmada'; hist(v, 'Fornecedor confirmou o pedido ' + v.compra.id + ' para ' + A.fd(v.compra.previsao), 'interno'); fin(v, 'Pedido confirmado pelo fornecedor.', 'Pedido de compra confirmado pelo fornecedor'); },
    'c4.ocReceb': (ds) => { const v = ven(ds.id); A.confirm({ title: 'Registrar recebimento', msg: 'Confirmar o recebimento dos materiais do pedido <b>' + e(v.compra.id) + '</b> no depósito, conferidos contra a nota fiscal?', ok: 'Registrar recebimento', onOk: () => { v.compra.status = 'Recebida'; v.compra.recebido = A.now(); v.etapa = 'entrega'; v.prop.itens.forEach((it) => { const m = mat(it.id); if (m) m.estoque += 0; }); hist(v, 'Materiais recebidos no depósito AiCalhas'); fin(v, 'Materiais recebidos. Próximo passo: programar entrega e instalação.', 'Recebimento de materiais registrado'); } }); },
    'c4.programar': (ds) => { const v = ven(ds.id); A.form({ title: 'Programar entrega e instalação — ' + v.id, submit: 'c4.programarSave', extra: { id: v.id }, fields: [{ name: 'ent', label: 'Entrega dos materiais no local', type: 'datetime-local', required: true, value: dtl(v.entrega ? v.entrega.data : A.d(1, '07:30')) }, { name: 'inst', label: 'Início da instalação', type: 'datetime-local', required: true, value: dtl(v.inst && v.inst.data ? v.inst.data : A.d(1, '08:00')) }, { name: 'pro', label: 'Parceiro instalador', type: 'select', required: true, value: v.inst ? v.inst.pro : '', options: db().pros.filter((p) => p.status === 'Ativo').map((p) => ({ v: p.id, l: p.empresa + (p.regioes.indexOf(cidadeOf(v)) >= 0 ? '' : ' (fora da região)') })) }, { name: 'rep', label: 'Valor do repasse (R$)', type: 'number', step: 0.01, value: pRepasse(v.prop), help: 'Padrão: ' + Math.round(REPASSE * 100) + '% do valor de instalação.' }, { name: 'aviso', type: 'check', text: 'Cliente informado das datas (simulação de mensagem)', value: true }] }); },
    'c4.programarSave': (vals, x) => { const v = ven(x.id); ensureInst(v); const re = v.etapa === 'agendada'; v.entrega = Object.assign(v.entrega || {}, { data: new Date(vals.ent).toISOString(), status: v.entrega && v.entrega.status === 'Entregue' ? 'Entregue' : 'Programada' }); v.inst.pro = vals.pro; v.inst.data = new Date(vals.inst).toISOString(); v.inst.status = 'Agendada'; v.inst.fimPrev = A.d(Math.max(1, A.dayDiff(v.inst.data)), '17:00'); v.inst.repasse = { valor: +vals.rep, status: 'Previsto' }; v.inst.conferidos = v.inst.conferidos || []; v.etapa = 'agendada'; hist(v, (re ? 'Instalação reagendada para ' : 'Entrega em ' + A.fdt(v.entrega.data) + ' e instalação em ') + A.fdt(v.inst.data) + ' com ' + pro(vals.pro).empresa); fin(v, re ? 'Instalação reagendada.' : 'Entrega e instalação programadas.', re ? 'Instalação reagendada' : 'Entrega e instalação programadas'); },
    'c4.entregar': (ds) => { const v = ven(ds.id); A.form({ title: 'Registrar entrega no local', submit: 'c4.entregarSave', extra: { id: v.id }, one: true, fields: [{ name: 'quem', label: 'Recebido por', required: true, value: v.clienteId ? (cli(v.clienteId).contato || nomeCli(v)).replace(/ \(.*\)/, '') : nomeCli(v) }, { name: 'obs', label: 'Observação', value: 'Materiais conferidos com o cliente na entrega.' }] }); },
    'c4.entregarSave': (vals, x) => { const v = ven(x.id); v.entrega.status = 'Entregue'; v.entrega.recebidoPor = vals.quem; v.entrega.ts = A.now(); v.m.entrega = A.now(); v.custos.push({ desc: 'Frete de entrega', valor: FRETE_CUSTO, tipo: 'Frete', ts: A.now() }); hist(v, 'Materiais entregues no local (recebido por ' + vals.quem + ')'); fin(v, 'Entrega registrada.', 'Entrega de materiais registrada'); },
    'c4.cliEntrega': (ds) => { const v = ven(ds.id); v.entrega.confCli = A.now(); hist(v, 'Cliente confirmou o recebimento dos materiais'); fin(v, 'Recebimento confirmado.', 'Cliente confirmou recebimento dos materiais'); },
    'c4.conferirMat': (ds) => { const v = ven(ds.id); A.form({ title: 'Conferir materiais — OS ' + v.id, sub: 'Marque os itens conferidos. Itens faltantes devem ser informados como ocorrência.', submit: 'c4.conferirMatSave', extra: { id: v.id }, one: true, fields: [{ name: 'ok', label: 'Itens conferidos', type: 'checks', options: v.prop.itens.map((x) => ({ v: x.id, l: x.nome + ' — ' + A.num(x.qtd, x.qtd % 1 ? 1 : 0) + ' ' + x.un })), value: v.prop.itens.map((x) => x.id) }] }); },
    'c4.conferirMatSave': (vals, x) => { const v = ven(x.id); v.inst.conferidos = vals.ok; const falta = v.prop.itens.filter((k) => vals.ok.indexOf(k.id) < 0); hist(v, 'Parceiro conferiu os materiais (' + vals.ok.length + ' de ' + v.prop.itens.length + ')', 'interno'); if (falta.length) { v.ocorrencias.push({ id: 'OCR-' + String(8 + db().vendas.reduce((s, k) => s + k.ocorrencias.length, 0)).padStart(2, '0'), tipo: 'Falta de material', desc: 'Não conferido: ' + falta.map((k) => k.nome).join(', '), ts: A.now(), status: 'Aberta', por: A.me().nome }); fin(v, 'Conferência registrada com falta. A AiCalhas foi avisada.', 'Conferência de materiais com falta registrada', 'warn'); return; } fin(v, 'Todos os materiais conferidos.', 'Conferência de materiais registrada'); },
    'c4.iniciar': (ds) => { const v = ven(ds.id); const go = () => { v.inst.status = 'Em execução'; v.inst.inicio = A.now(); v.inst.etapas[0].ok = true; v.inst.etapas[0].ts = A.now(); v.etapa = 'execucao'; hist(v, 'Instalação iniciada'); fin(v, 'Instalação iniciada.', 'Instalação iniciada'); }; if (v.entrega.status !== 'Entregue') A.confirm({ title: 'Materiais ainda não entregues', msg: 'A entrega dos materiais não foi registrada. Iniciar mesmo assim?', ok: 'Iniciar', onOk: go }); else go(); },
    'c4.andamento': (ds) => { const v = ven(ds.id); A.form({ title: 'Atualizar andamento — OS ' + v.id, submit: 'c4.andamentoSave', extra: { id: v.id }, fields: [{ name: 'ok', label: 'Etapas concluídas', type: 'checks', full: true, options: v.inst.etapas.map((x) => x.n), value: v.inst.etapas.filter((x) => x.ok).map((x) => x.n).concat(v.inst.etapas.filter((x) => !x.ok).slice(0, 1).map((x) => x.n)) }, { name: 'fotos', label: 'Fotos', type: 'photos', full: true, presets: ['calha-frontal', 'condutor'] }] }); },
    'c4.andamentoSave': (vals, x) => { const v = ven(x.id); v.inst.etapas.forEach((s) => { const ok = vals.ok.indexOf(s.n) >= 0; if (ok && !s.ok) s.ts = A.now(); s.ok = ok; }); hist(v, 'Andamento da instalação: ' + instProg(v) + '%'); fin(v, 'Andamento atualizado: ' + instProg(v) + '%.', 'Andamento da instalação atualizado (' + instProg(v) + '%)'); },
    'c4.ocorrencia': (ds) => A.form({ title: 'Registrar ocorrência', sub: 'A AiCalhas trata a solução, custos e comunicação com o cliente.', submit: 'c4.ocorrenciaSave', extra: { id: ds.id }, one: true, submitLabel: 'Registrar ocorrência', btnCls: 'dgs', icon: 'alert', fields: [{ name: 'tipo', label: 'Tipo', type: 'select', options: ['Falta de material', 'Material com defeito', 'Alteração de escopo necessária', 'Condição do local / clima', 'Outro'], required: true }, { name: 'desc', label: 'Descrição', type: 'textarea', required: true, value: 'Faltou 1 curva PVC 88 mm 45° para a ligação da descida.' }, { name: 'fotos', label: 'Fotos', type: 'photos', presets: ['condutor', 'calha-frontal'] }] }),
    'c4.ocorrenciaSave': (vals, x) => { const v = ven(x.id); const n = db().vendas.reduce((s, k) => s + k.ocorrencias.length, 0) + 8; v.ocorrencias.push({ id: 'OCR-' + String(n).padStart(2, '0'), tipo: vals.tipo, desc: vals.desc, ts: A.now(), status: 'Aberta', por: A.me().nome, fotos: vals.fotos || [] }); hist(v, 'Ocorrência registrada: ' + vals.desc); fin(v, 'Ocorrência registrada. A AiCalhas foi avisada.', 'Ocorrência registrada: ' + vals.tipo.toLowerCase(), 'warn'); },
    'c4.tratarOcr': (ds) => { const v = ven(ds.id), o = v.ocorrencias.find((k) => k.id === ds.o); A.form({ title: 'Tratar ocorrência ' + o.id + ' — ' + v.id, sub: o.desc, submit: 'c4.tratarOcrSave', extra: { id: v.id, o: o.id }, fields: [
      { name: 'sol', label: 'Solução', type: 'select', required: true, options: ['Reposição de peça', 'Troca de material', 'Ajuste de cronograma', 'Alteração de escopo com aditivo'] },
      { name: 'custo', label: 'Custo adicional (R$)', type: 'number', min: 0, step: 0.5, value: o.tipo === 'Falta de material' ? 53.5 : 0, help: 'Ex.: peça R$ 18,50 + frete expresso R$ 35,00. Acima de R$ 300 exige Coordenação.' },
      { name: 'quem', label: 'Quem arca com o custo', type: 'select', options: ['AiCalhas', 'Cliente (aditivo aprovado)', 'Parceiro'] },
      { name: 'fim', label: 'Nova previsão de conclusão', type: 'datetime-local', value: dtl(A.d(1, '12:00')) },
      { name: 'msg', label: 'Mensagem ao cliente', type: 'textarea', full: true, required: true, value: 'Durante a instalação faltou uma peça. Já providenciamos a reposição e a conclusão fica para ' + A.when(A.d(1, '12:00')).toLowerCase() + '. Não há custo adicional para você.' },
      { name: 'alc', type: 'check', text: 'Custo acima de R$ 300 aprovado pela Coordenação (simulação)', value: false },
    ] }); },
    'c4.tratarOcrSave': (vals, x) => {
      const v = ven(x.id), o = v.ocorrencias.find((k) => k.id === x.o), custo = +vals.custo || 0;
      if (custo > 300 && !vals.alc) { A.toast('Custo acima de R$ 300: marque a aprovação da Coordenação para prosseguir.', 'warn'); return; }
      o.status = 'Resolvida'; o.solucao = vals.sol + ' — ' + vals.quem; o.custo = custo; o.resolvidaEm = A.now();
      if (custo > 300) o.alcada = { nivel: 'Coordenação', aprovadoPor: COORD.nome, ts: A.now() };
      if (custo) v.custos.push({ desc: vals.sol + ' (' + o.id + ')', valor: custo, tipo: vals.quem === 'AiCalhas' ? 'Adicional' : 'Adicional — ' + vals.quem, ts: A.now() });
      if (/Reposição|Troca/.test(vals.sol)) { const d = db(); d.ocsAvulsas = d.ocsAvulsas || []; d.ocsAvulsas.push({ id: 'OC-R' + String(d.ocsAvulsas.length + 1).padStart(3, '0'), venda: v.id, forn: 'FOR-1', valor: custo, status: 'Solicitada', previsao: A.d(1, '09:00'), ts: A.now(), reposicao: true }); }
      if (vals.fim && v.inst) v.inst.fimPrev = new Date(vals.fim).toISOString();
      hist(v, vals.msg); hist(v, 'Ocorrência ' + o.id + ' tratada: ' + o.solucao + (custo ? ' — custo ' + A.money(custo) : ''), 'interno');
      if (custo > 300) A.log('Custo adicional aprovado (alçada Coordenação)', v.id + ' · ' + A.money(custo), COORD);
      fin(v, 'Ocorrência tratada, reposição providenciada e cliente informado.', 'Ocorrência tratada — ' + vals.sol.toLowerCase());
    },
    'c4.repReceb': (ds) => { const o = (db().ocsAvulsas || []).find((k) => k.id === ds.id); o.status = 'Recebida'; A.log('Reposição recebida e enviada à obra', o.id + ' · ' + o.venda); A.refresh(); A.toast('Reposição recebida e enviada à obra.'); },
    'c4.concluir': (ds) => A.form({ title: 'Concluir instalação', submit: 'c4.concluirSave', extra: { id: ds.id }, fields: [{ name: 'obs', label: 'Relato final', type: 'textarea', full: true, required: true, value: 'Instalação concluída, teste de escoamento aprovado e área limpa.' }, { name: 'fotos', label: 'Fotos finais', type: 'photos', full: true, presets: ['calha-frontal', 'condutor', 'aluminio'], preselect: ['calha-frontal'] }, { name: 'ass', type: 'check', text: 'Cliente acompanhou a vistoria final (simulação de assinatura)', value: true }] }),
    'c4.concluirSave': (vals, x) => { const v = ven(x.id); v.inst.etapas.forEach((s) => { if (!s.ok) { s.ok = true; s.ts = A.now(); } }); v.inst.status = 'Concluída'; v.inst.fim = A.now(); v.inst.conclusao = { obs: vals.obs, fotos: vals.fotos || [] }; v.etapa = 'concluido'; v.m.concluido = A.now(); hist(v, 'Instalação concluída pelo parceiro'); fin(v, 'Instalação concluída. Aguardando confirmação do cliente para liberar o repasse.', 'Instalação concluída'); },
    'c4.cliConclui': (ds) => { const v = ven(ds.id); A.form({ title: v.etapa === 'concluido' ? 'Confirmar conclusão e avaliar' : 'Avaliar pedido', submit: 'c4.cliConcluiSave', extra: { id: v.id }, one: true, submitLabel: v.etapa === 'concluido' ? 'Confirmar conclusão' : 'Enviar avaliação', icon: 'check', fields: [{ name: 'nota', label: 'Como foi a experiência?', type: 'radios', options: [{ v: 5, l: '★★★★★' }, { v: 4, l: '★★★★' }, { v: 3, l: '★★★' }, { v: 2, l: '★★' }, { v: 1, l: '★' }], value: 5, required: true }, { name: 'txt', label: 'Comentário', type: 'textarea', value: 'Resolvi tudo com uma única empresa: material, instalação e garantia.' }] }); },
    'c4.cliConcluiSave': (vals, x) => { const v = ven(x.id); confirmar(v, A.me().nome); v.pos.avaliacao = { nota: +vals.nota, txt: vals.txt, ts: A.now() }; hist(v, 'Pedido avaliado: ' + vals.nota + ' estrelas'); fin(v, 'Obrigado! Garantia ativa até ' + A.fd(v.pos.garantiaAte) + '.', 'Conclusão confirmada e pedido avaliado (' + vals.nota + ' estrelas)'); },
    'c4.confMed': (ds) => A.confirm({ title: 'Confirmar conclusão com o cliente', msg: 'Registrar que o cliente confirmou a conclusão (por telefone)? O repasse ao parceiro será liberado.', ok: 'Confirmar conclusão', onOk: () => { const v = ven(ds.id); confirmar(v, nomeCli(v) + ' (registrado por ' + A.me().nome + ')'); fin(v, 'Conclusão confirmada. Repasse liberado para pagamento.', 'Conclusão confirmada com o cliente e repasse liberado'); } }),
    'c4.pagarRepasse': (ds) => { const v = ven(ds.id); A.confirm({ title: 'Pagar repasse (simulado)', msg: 'Pagar <b>' + A.money(v.inst.repasse.valor) + '</b> a <b>' + e(pro(v.inst.pro).empresa) + '</b> referente ao pedido ' + e(v.id) + '?', note: 'Simulação: nenhuma transferência real é realizada.', ok: 'Registrar pagamento', onOk: () => { v.inst.repasse.status = 'Pago'; v.inst.repasse.ts = A.now(); hist(v, 'Repasse pago ao parceiro: ' + A.money(v.inst.repasse.valor), 'interno'); fin(v, 'Repasse registrado como pago (simulação).', 'Repasse pago ao parceiro (simulado)'); } }); },
    'c4.chamado': (ds) => { const list = meus().filter((v) => v.pos); A.form({ title: 'Abrir chamado', submit: 'c4.chamadoSave', one: true, fields: [{ name: 'venda', label: 'Pedido', type: 'select', options: list.map((v) => ({ v: v.id, l: v.id + ' — ' + v.titulo })), value: ds.id, required: true }, { name: 'tipo', label: 'Tipo', type: 'select', options: ['Garantia', 'Dúvida', 'Reclamação', 'Reagendamento'] }, { name: 'desc', label: 'Descrição', type: 'textarea', required: true, value: 'Depois da chuva forte, a água transbordou em um ponto da calha. Podem verificar?' }] }); },
    'c4.chamadoSave': (vals) => { const v = ven(vals.venda); const n = db().vendas.reduce((s, k) => s + (k.pos ? k.pos.chamados.length : 0), 0) + 31; v.pos.chamados.push({ id: 'CH-' + String(n).padStart(3, '0'), tipo: vals.tipo, desc: vals.desc, ts: A.now(), status: 'Aberto', resp: [] }); hist(v, 'Chamado aberto: ' + vals.tipo.toLowerCase()); fin(v, 'Chamado aberto. A AiCalhas responde em até 1 dia útil.', 'Chamado de ' + vals.tipo.toLowerCase() + ' aberto'); },
    'c4.chResp': (ds) => { const v = ven(ds.id), c = v.pos.chamados.find((k) => k.id === ds.c); A.form({ title: 'Responder chamado ' + c.id, sub: c.tipo + ' — ' + c.desc, submit: 'c4.chRespSave', extra: { id: v.id, c: c.id }, one: true, fields: [{ name: 'acao', label: 'Ação', type: 'select', options: ['Encaminhar ao parceiro (garantia)', 'Responder e resolver', 'Agendar visita de garantia'], value: c.tipo === 'Garantia' ? 'Encaminhar ao parceiro (garantia)' : 'Responder e resolver' }, { name: 'txt', label: 'Resposta ao cliente', type: 'textarea', required: true, value: c.tipo === 'Garantia' ? 'Acionamos o parceiro para verificar a emenda dentro da garantia, sem custo. Visita prevista para ' + A.when(A.d(1, '09:00')).toLowerCase() + '.' : 'Segue a orientação solicitada. Qualquer dúvida, estamos à disposição.' }] }); },
    'c4.chRespSave': (vals, x) => { const v = ven(x.id), c = v.pos.chamados.find((k) => k.id === x.c); c.resp.push({ ts: A.now(), txt: vals.txt, por: A.me().nome }); c.status = /Responder e resolver/.test(vals.acao) ? 'Resolvido' : 'Encaminhado ao parceiro'; hist(v, 'Chamado ' + c.id + ': ' + vals.txt); fin(v, 'Chamado atualizado: ' + c.status.toLowerCase() + '.', 'Chamado respondido — ' + vals.acao.toLowerCase()); },
    'c4.chPro': (ds) => A.form({ title: 'Atendimento de garantia', submit: 'c4.chProSave', extra: { id: ds.id, c: ds.c }, one: true, fields: [{ name: 'txt', label: 'O que foi feito', type: 'textarea', required: true, value: 'Refeita a vedação da emenda junto à descida. Teste com mangueira aprovado.' }] }),
    'c4.chProSave': (vals, x) => { const v = ven(x.id), c = v.pos.chamados.find((k) => k.id === x.c); c.resp.push({ ts: A.now(), txt: 'Parceiro: ' + vals.txt, por: A.me().nome }); c.status = 'Resolvido'; hist(v, 'Garantia atendida pelo parceiro: ' + vals.txt); fin(v, 'Atendimento de garantia registrado.', 'Atendimento de garantia registrado'); },
    'c4.custo': (ds) => A.form({ title: 'Registrar custo adicional', submit: 'c4.custoSave', extra: { id: ds.id }, one: true, fields: [{ name: 'desc', label: 'Descrição', required: true, value: 'Aluguel de andaime por 1 dia' }, { name: 'valor', label: 'Valor (R$)', type: 'number', step: 0.01, required: true, value: 120 }, { name: 'tipo', label: 'Tipo', type: 'select', options: ['Adicional', 'Frete', 'Equipamento'] }] }),
    'c4.custoSave': (vals, x) => { const v = ven(x.id); v.custos.push({ desc: vals.desc, valor: +vals.valor, tipo: vals.tipo, ts: A.now() }); hist(v, 'Custo adicional registrado: ' + vals.desc + ' — ' + A.money(+vals.valor), 'interno'); fin(v, 'Custo registrado. A margem do pedido foi recalculada.', 'Custo adicional registrado'); },
    'c4.cancelar': (ds) => A.form({ title: 'Cancelar pedido', submit: 'c4.cancelarSave', extra: { id: ds.id }, one: true, submitLabel: 'Cancelar pedido', btnCls: 'dgs', icon: 'x', fields: [{ name: 'motivo', label: 'Motivo', type: 'select', options: ['Cliente desistiu', 'Preço acima do esperado', 'Fora da área atendida', 'Prazo incompatível'] }] }),
    'c4.cancelarSave': (vals, x) => { const v = ven(x.id); v.etapa = 'cancelada'; v.motivoCanc = vals.motivo; hist(v, 'Pedido cancelado: ' + vals.motivo.toLowerCase()); fin(v, 'Pedido cancelado.', 'Pedido cancelado — ' + vals.motivo.toLowerCase()); },
    'c4.doc': (ds) => {
      const v = ven(ds.id), c = v.clienteId ? cli(v.clienteId) : { nome: nomeCli(v), endereco: '', bairro: '', cidade: cidadeOf(v) };
      let body;
      if (ds.t === 'proposta') body = AiC.doc('Proposta comercial', e(v.id) + ' — versão ' + v.prop.versao, A.dl([['Cliente', e(c.nome)], ['Endereço', e(c.endereco + ' — ' + c.bairro + ', ' + c.cidade)], ['Emissão', A.fd(v.prop.emitida)], ['Validade', A.fd(v.prop.validade)]]) + '<h4 style="margin:14px 0 6px">Escopo</h4><p>' + e(v.prop.inst.desc) + '</p>' + propTable(v.prop) + '<p class="small mt">Condições: ' + e(v.prop.condicoes) + ' ' + e(v.prop.obs) + '</p>');
      else if (ds.t === 'recibo') body = AiC.doc('Recibo de pagamento', e(v.id), A.dl([['Recebemos de', e(c.nome)], ['Valor', A.money(v.pag.valor)], ['Forma', e(v.pag.forma + (v.pag.parcelas > 1 ? ' em ' + v.pag.parcelas + 'x' : ''))], ['Data', A.fdt(v.pag.ts)], ['Referente a', e(v.titulo)]]));
      else body = AiC.doc('Termo de garantia', e(v.id), '<p>A AiCalhas garante os materiais e a instalação descritos no pedido <b>' + e(v.id) + '</b> até <b>' + A.fd(v.pos.garantiaAte) + '</b>, executados pelo parceiro homologado ' + e(pro(v.inst.pro).empresa) + '.</p><ul class="ul"><li>Cobertura: vazamentos em emendas, fixação e vedação.</li><li>Exclusões: danos por obstrução de folhas sem limpeza periódica e intervenções de terceiros.</li><li>Acionamento: menu “Atendimento e garantia”.</li></ul>');
      A.log('Documento visualizado: ' + ({ proposta: 'proposta comercial', recibo: 'recibo de pagamento', garantia: 'termo de garantia' })[ds.t], v.id);
      A.modal({ title: ({ proposta: 'Proposta comercial', recibo: 'Recibo de pagamento', garantia: 'Termo de garantia' })[ds.t], sub: 'Documento demonstrativo', size: 'lg', body: body, foot: '<button class="btn" data-act="core.close">Fechar</button>' + A.b('Baixar PDF (simulação)', 'c4.docPdf', {}, 'p', 'download') });
    },
    'c4.docPdf': () => A.toast('Em um sistema real, o PDF seria gerado aqui. Nesta demonstração nenhum arquivo é criado.', 'warn'),
    'c4.cliEdit': () => { const c = cli(MYCLI); A.form({ title: 'Editar meus dados', submit: 'c4.cliEditSave', fields: [{ name: 'tel', label: 'Telefone', type: 'tel', value: c.tel, required: true }, { name: 'email', label: 'E-mail', type: 'email', value: c.email, required: true }, { name: 'endereco', label: 'Endereço de entrega', value: c.endereco, full: true }] }); },
    'c4.cliEditSave': (vals) => { Object.assign(cli(MYCLI), vals); A.done('Dados atualizados.', 'Cadastro de cliente atualizado', MYCLI); },
    'c4.matEdit': (ds) => { const m = ds.id ? mat(ds.id) : null; A.form({ title: m ? 'Editar material ' + m.id : 'Cadastrar material', submit: 'c4.matSave', extra: { id: ds.id || '' }, fields: [{ name: 'nome', label: 'Material', required: true, full: true, value: m ? m.nome : 'Ponteira de condutor 88 mm' }, { name: 'un', label: 'Unidade', required: true, value: m ? m.un : 'un' }, { name: 'forn', label: 'Fornecedor principal', type: 'select', options: db().fornecedores.map((f) => ({ v: f.id, l: f.nome })), value: m ? m.forn : 'FOR-3' }, { name: 'custo', label: 'Custo (R$)', type: 'number', step: 0.01, required: true, value: m ? m.custo : 6 }, { name: 'preco', label: 'Preço de venda (R$)', type: 'number', step: 0.01, required: true, value: m ? m.preco : 10.9 }, { name: 'estoque', label: 'Estoque', type: 'number', value: m ? m.estoque : 40 }] }); },
    'c4.matSave': (vals, x) => { const d = db(); if (+vals.preco < +vals.custo) { A.toast('O preço de venda está abaixo do custo.', 'warn'); return; } if (x.id) { Object.assign(mat(x.id), { nome: vals.nome, un: vals.un, forn: vals.forn, custo: +vals.custo, preco: +vals.preco, estoque: +vals.estoque }); A.done('Material atualizado.', 'Material atualizado (custo/preço)', x.id + ' · ' + vals.nome); return; } const id = 'MAT-' + String(d.materiais.length + 1).padStart(2, '0'); d.materiais.push({ id: id, nome: vals.nome, un: vals.un, forn: vals.forn, custo: +vals.custo, preco: +vals.preco, estoque: +vals.estoque }); A.done('Material cadastrado.', 'Material cadastrado', id + ' · ' + vals.nome); },
    'c4.cadCli': () => A.form({ title: 'Cadastrar cliente', submit: 'c4.cadCliSave', fields: [{ name: 'nome', label: 'Nome / razão social', required: true, value: 'Otávio Mendes' }, { name: 'tipo', label: 'Tipo', type: 'select', options: ['Residencial', 'Comercial', 'Condomínio'] }, { name: 'tel', label: 'Telefone', type: 'tel', required: true, value: '(19) 98111-2233' }, { name: 'email', label: 'E-mail', type: 'email', required: true, value: 'otavio.mendes@email.demo' }, { name: 'cidade', label: 'Cidade', type: 'select', options: db().cidades }, { name: 'bairro', label: 'Bairro', value: 'Centro' }, { name: 'endereco', label: 'Endereço', value: 'Rua Barão de Jaguara, 400', full: true }] }),
    'c4.cadCliSave': (vals) => { const d = db(), id = A.nextId('CLI-', d.clientes); d.clientes.push(Object.assign({ id: id, desde: A.now() }, vals)); A.done('Cliente cadastrado.', 'Cliente cadastrado', id + ' · ' + vals.nome); },
    'c4.cadParc': () => A.form({ title: 'Cadastrar parceiro instalador', submit: 'c4.cadParcSave', fields: [{ name: 'empresa', label: 'Empresa', required: true, value: 'Silva Calhas Express' }, { name: 'nome', label: 'Responsável', required: true, value: 'Diego Silva' }, { name: 'tel', label: 'Telefone', type: 'tel', required: true, value: '(19) 99000-1717' }, { name: 'email', label: 'E-mail', type: 'email', required: true, value: 'diego@silvacalhas.demo' }, { name: 'regioes', label: 'Cidades', type: 'checks', full: true, options: db().cidades, value: ['Paulínia', 'Campinas'] }, { name: 'nr35', type: 'check', text: 'NR-35 e seguro de responsabilidade civil conferidos', value: true }, { name: 'contrato', type: 'check', text: 'Contrato de parceria e tabela de repasse assinados', value: false }] }),
    'c4.cadParcSave': (vals) => { const d = db(), id = A.nextId('PRF-', d.pros); d.pros.push({ id: id, nome: vals.nome, empresa: vals.empresa, cidade: vals.regioes[0] || 'Campinas', regioes: vals.regioes, servicos: ['SRV-01', 'SRV-02'], nota: 0, avals: 0, tel: vals.tel, email: vals.email, status: vals.contrato ? 'Ativo' : 'Em homologação', contrato: vals.contrato ? 'Contrato de parceria vigente' : 'Pendente', cor: A.colorFor(vals.empresa) }); A.done('Parceiro cadastrado.', 'Parceiro instalador cadastrado', id + ' · ' + vals.empresa); },
    'c4.cadForn': () => A.form({ title: 'Cadastrar fornecedor', submit: 'c4.cadFornSave', fields: [{ name: 'nome', label: 'Fornecedor', required: true, value: 'Metalúrgica Vale Calhas' }, { name: 'doc', label: 'CNPJ', value: 'CNPJ 74.000.444/0001-04' }, { name: 'cidade', label: 'Cidade', type: 'select', options: db().cidades }, { name: 'contato', label: 'Contato', value: 'Vendas — (19) 3300-0404' }, { name: 'prazo', label: 'Prazo de entrega', value: '2 dias úteis' }] }),
    'c4.cadFornSave': (vals) => { const d = db(), id = 'FOR-' + (d.fornecedores.length + 1); d.fornecedores.push(Object.assign({ id: id }, vals)); A.done('Fornecedor cadastrado.', 'Fornecedor cadastrado', id + ' · ' + vals.nome); },
    'c4.cadSrv': () => A.form({ title: 'Cadastrar serviço', submit: 'c4.cadSrvSave', one: true, fields: [{ name: 'nome', label: 'Serviço', required: true, value: 'Sistema de captação de água da chuva' }, { name: 'desc', label: 'Descrição', type: 'textarea', required: true, value: 'Calhas, filtro e ligação a reservatório.' }] }),
    'c4.cadSrvSave': (vals) => { const d = db(), id = 'SRV-' + String(d.servicos.length + 1).padStart(2, '0'); d.servicos.push({ id: id, nome: vals.nome, desc: vals.desc, ativo: true }); A.done('Serviço cadastrado.', 'Serviço cadastrado', id + ' · ' + vals.nome); },
    'c4.repDet': (ds) => { const v = ven(ds.id); A.modal({ title: v.id + ' — ' + v.titulo, sub: nomeCli(v) + ' — ' + cidadeOf(v), size: 'lg', body: '<div class="g2"><div>' + A.dl([['Pago em', A.fdt(v.pag.ts)], ['Forma', e(v.pag.forma)], ['Parceiro', e(pro(v.inst.pro).empresa)], ['Fornecedor', v.compra ? e(forn(v.compra.forn).nome) : '—'], ['Ocorrências', v.ocorrencias.length], ['Avaliação', v.pos && v.pos.avaliacao ? A.stars(v.pos.avaliacao.nota) : '—']], 'one') + '</div><div>' + finBox(v) + '</div></div>', foot: '<button class="btn" data-act="core.close">Fechar</button>' + A.nav('Abrir pedido', 'venda', v.id, 'p') }); },
  };
  function aprovar(v, por) {
    v.prop.status = 'Aprovada'; v.prop.aprovadaEm = A.now(); v.prop.aprovadaPor = por; v.etapa = 'aprovada'; v.m.aprovado = A.now();
    hist(v, 'Proposta aprovada por ' + por + ' — ' + A.money(pTotal(v.prop)));
    A.log('Proposta aprovada', v.id + ' · ' + A.money(pTotal(v.prop)));
  }
  function confirmar(v, por) {
    if (v.etapa !== 'concluido' && v.etapa !== 'posvenda') return;
    if (v.etapa === 'concluido') {
      v.etapa = 'posvenda'; v.confirmCli = A.now();
      if (v.inst.repasse) { v.inst.repasse.status = 'Liberado'; v.inst.repasse.ts = A.now(); }
      const g = new Date(); g.setFullYear(g.getFullYear() + 1);
      v.pos = v.pos || { garantiaAte: g.toISOString(), chamados: [], avaliacao: null };
      hist(v, 'Conclusão confirmada por ' + por + '. Garantia ativa até ' + A.fd(v.pos.garantiaAte) + '.');
      hist(v, 'Repasse liberado ao parceiro: ' + A.money(v.inst.repasse ? v.inst.repasse.valor : 0), 'interno');
    }
  }

  /* ------------------------------------------------------------------
     Configuração
     ------------------------------------------------------------------ */
  A.start({
    id: 'c4', num: 4, title: 'Contratação centralizada',
    seed: seed, seedLogs: seedLogs, actions: actions,
    about: {
      level: 4,
      resumo: 'O cliente contrata a AiCalhas, que entrega a solução completa: avaliação técnica, proposta com materiais e instalação, pagamento, compra e entrega dos materiais, agenda e execução com parceiros, repasses e pós-venda com garantia.',
      como: ['O cliente pede orçamento e a AiCalhas agenda uma avaliação técnica com um parceiro.', 'Com o levantamento, a AiCalhas monta uma proposta única com materiais, instalação e frete discriminados.', 'Descontos acima do limite passam pela alçada de aprovação.', 'O cliente aprova e paga à AiCalhas (Pix, cartão ou boleto).', 'A AiCalhas compra os materiais, recebe, entrega e agenda a instalação com o parceiro.', 'O parceiro executa; ocorrências como falta de peça são resolvidas pela AiCalhas.', 'Com a confirmação do cliente, o repasse ao parceiro é liberado e a garantia começa.'],
      mediador: ['Organiza a avaliação técnica', 'Consolida a proposta comercial', 'Coordena pagamento e repasses', 'Garante a compra e entrega dos materiais', 'Agenda a instalação', 'Acompanha execução, mudanças e custos adicionais', 'Registra a entrega e a confirmação do cliente', 'Coordena os atendimentos posteriores'],
      limite: 'a AiCalhas é a responsável pela venda perante o cliente: responde por preço, prazo, materiais, execução e garantia. Por isso, este modelo exige definir com clareza quem pode aprovar preços, descontos, compras, alterações e soluções para reclamações.',
      exemplo: 'Faltou uma peça durante a instalação na padaria. O parceiro registra a ocorrência, o mediador providencia a reposição, ajusta o cronograma, registra o custo adicional e informa o cliente.',
      painel: 'Propostas, vendas, compras, materiais, entregas, agenda, pagamentos, repasses, custos, margem e atendimento ao cliente.',
      perfil: {
        cliente: { t: 'Você contrata a AiCalhas e recebe a solução completa.', d: 'Proposta única com materiais e instalação, pagamento à AiCalhas, entrega, execução por parceiro homologado e garantia.' },
        profissional: { t: 'Você instala; a AiCalhas cuida da venda, dos materiais e do pagamento.', d: 'Receba as ordens de serviço, confira os materiais, atualize a execução, registre ocorrências e acompanhe seus repasses.' },
        mediador: { t: 'Você conduz toda a operação.', d: 'Monte propostas respeitando as alçadas, acompanhe pagamentos, compre materiais, programe entregas e instalações, trate ocorrências e libere repasses.' },
      },
    },
    profiles: {
      cliente: {
        home: 'pedidos',
        menu: [{ sec: 'Compras' }, { id: 'pedidos', label: 'Meus pedidos', icon: 'box', render: vCliPedidos, badge: () => meus().filter((v) => ['enviada', 'aprovada', 'concluido'].indexOf(v.etapa) >= 0).length }, { id: 'nova', label: 'Solicitar orçamento', icon: 'plus', render: vCliNova }, { id: 'chamados', label: 'Atendimento e garantia', icon: 'chat', render: vCliChamados }, { sec: 'Cadastro' }, { id: 'dados', label: 'Meus dados', icon: 'user', render: vCliDados }],
        hidden: { pedido: { title: 'Pedido', parent: 'pedidos', render: vPedido } },
      },
      profissional: {
        home: 'servicos',
        menu: [{ sec: 'Ordens de serviço' }, { id: 'servicos', label: 'Serviços atribuídos', icon: 'tool', render: vProServicos, badge: () => meus().filter((v) => ['avaliacao', 'agendada', 'execucao'].indexOf(v.etapa) >= 0).length }, { id: 'agenda', label: 'Agenda', icon: 'calendar', render: vProAgenda }, { id: 'materiais', label: 'Materiais previstos', icon: 'box', render: vProMateriais }, { sec: 'Financeiro' }, { id: 'repasses', label: 'Repasses', icon: 'wallet', render: vProRepasses }],
        hidden: { os: { title: 'Ordem de serviço', parent: 'servicos', render: vOS } },
      },
      mediador: {
        home: 'painel',
        menu: [{ sec: 'Operação' }, { id: 'painel', label: 'Painel da operação', icon: 'home', render: vMedPainel }, { id: 'propostas', label: 'Propostas', icon: 'receipt', render: vMedPropostas, badge: () => db().vendas.filter((v) => ['proposta', 'alcada'].indexOf(v.etapa) >= 0 || (v.etapa === 'avaliacao' && !v.aval)).length }, { id: 'vendas', label: 'Vendas e pedidos', icon: 'briefcase', render: vMedVendas }, { id: 'compras', label: 'Compras e materiais', icon: 'cart', render: vMedCompras, badge: () => db().vendas.filter((v) => v.etapa === 'pago').length }, { id: 'agenda', label: 'Agenda e entregas', icon: 'calendar', render: vMedAgenda }, { id: 'atendimento', label: 'Atendimento e pós-venda', icon: 'chat', render: vMedAtend, badge: () => db().vendas.reduce((s, v) => s + v.ocorrencias.filter((o) => o.status === 'Aberta').length + (v.pos ? v.pos.chamados.filter((c) => c.status !== 'Resolvido').length : 0), 0) },
          { sec: 'Gestão' }, { id: 'financeiro', label: 'Financeiro', icon: 'money', render: vMedFin }, { id: 'alcadas', label: 'Alçadas e regras', icon: 'scale', render: vMedAlcadas }, { id: 'relatorios', label: 'Relatórios', icon: 'chart', render: vMedRel }, { id: 'cadastros', label: 'Cadastros', icon: 'layers', render: vMedCad }],
        hidden: { venda: { title: 'Pedido', parent: 'vendas', render: vPedido } },
      },
    },
  });
})();
