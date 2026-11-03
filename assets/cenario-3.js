/* =====================================================================
   AppCalhas — Cenário 3 (versão 2): Atendimento acompanhado
   com compra e entrega de materiais conduzidas pelo AppCalhas.

   - O AppCalhas designa o profissional e acompanha o atendimento da
     solicitação ao pós-venda.
   - O profissional define a mão de obra e a LISTA TÉCNICA de materiais
     (quantidades e especificação). Ele não vende nem cobra materiais.
   - O AppCalhas precifica os materiais (tabela AppCalhas, fábrica própria),
     libera a proposta consolidada, recebe o pagamento dos materiais,
     emite a ordem de fabricação, separa, fatura e entrega na obra na
     véspera do início do serviço. O profissional confere o recebimento;
     só então o serviço é liberado. Faltas e avarias viram ocorrência
     com reposição pelo AppCalhas. Complementos são pedidos pelo app.
   - A mão de obra é contratada e paga diretamente ao profissional.
   ===================================================================== */
(function () {
  'use strict';
  const A = AppC, e = A.esc, I = A.icon;
  const db = () => A.db();
  const MYPRO = 'PRF-101', MYCLI = 'CLI-201';
  const pro = (id) => db().pros.find((p) => p.id === id);
  const cli = (id) => db().clientes.find((c) => c.id === id);
  const atd = (id) => db().atendimentos.find((a) => a.id === id);
  const mat = (id) => db().materiais.find((m) => m.id === id);
  const forn = (id) => db().fornecedores.find((f) => f.id === id) || { nome: '—' };
  const srvName = (id) => (db().servicos.find((s) => s.id === id) || { nome: id }).nome;
  const inArr = (v, arr) => arr.indexOf(v) >= 0;

  /* Etapas do atendimento */
  const ET = {
    solicitado: 'Solicitação recebida', triagem: 'Em triagem', designado: 'Profissional designado', visita_agendada: 'Visita agendada', visita_realizada: 'Aguardando orçamento',
    orcamento_enviado: 'Proposta em conferência', orcamento_liberado: 'Aguardando aprovação do cliente',
    aprovado: 'Aprovado — pagamento dos materiais', preparo: 'Materiais em preparo', pronto: 'Pronto para execução',
    execucao: 'Em execução', concluido: 'Concluído — aguardando confirmação', encerrado: 'Encerrado',
  };
  const ETK = Object.keys(ET);
  const STEPS = ['Solicitação', 'Visita', 'Orçamento', 'Aprovação', 'Materiais', 'Execução', 'Conclusão', 'Avaliação'];
  const stepOf = (a) => ({ solicitado: 0, triagem: 0, designado: 1, visita_agendada: 1, visita_realizada: 2, orcamento_enviado: 2, orcamento_liberado: 3, aprovado: 4, preparo: 4, pronto: 5, execucao: 5, concluido: 6, encerrado: a.avaliacao ? 8 : 7 })[a.etapa];
  const TONE = { solicitado: 'info', triagem: 'warn', designado: 'warn', visita_agendada: 'info', visita_realizada: 'warn', orcamento_enviado: 'warn', orcamento_liberado: 'warn', aprovado: 'warn', preparo: 'info', pronto: 'ok', execucao: 'info', concluido: 'warn', encerrado: 'ok' };
  const etBadge = (a) => A.badge(ET[a.etapa], TONE[a.etapa]);
  const EXEC = ['Materiais conferidos na obra', 'Remoção da calha antiga', 'Instalação da nova calha', 'Condutores e vedação', 'Teste de escoamento', 'Limpeza final'];
  const CONF = [['escopo', 'Escopo do serviço descrito'], ['materiais', 'Lista técnica de materiais com quantidades'], ['instalacao', 'Mão de obra / instalação informada'], ['prazo', 'Prazo de execução informado'], ['condicoes', 'Validade e condições da mão de obra']];
  const COND = ['Mão de obra — direto ao profissional: 50% no início e 50% na conclusão', 'Mão de obra — direto ao profissional: à vista na conclusão', 'Mão de obra — direto ao profissional: cartão em até 3x'];
  const nomeCli = (a) => (a.clienteId ? cli(a.clienteId).nome : a.clienteNome);
  const cidadeOf = (a) => (a.clienteId ? cli(a.clienteId).cidade : a.cidadeAvulsa);
  const endOf = (a) => { const c = a.clienteId ? cli(a.clienteId) : null; return c ? c.endereco + ' — ' + c.bairro + ', ' + c.cidade : cidadeOf(a); };

  /* Pedido de materiais (PM) */
  const PMS = { aguardando_pagamento: ['Aguardando pagamento', 'warn'], pago: ['Pagamento confirmado', 'ok'], producao: ['Em fabricação', 'info'], separado: ['Separado e faturado', 'info'], programada: ['Entrega programada', 'info'], rota: ['Em rota de entrega', 'info'], entregue: ['Entregue — conferência pendente', 'warn'], conferido: ['Recebido e conferido', 'ok'], ocorrencia: ['Ocorrência na entrega', 'bad'] };
  const PMK = Object.keys(PMS);
  const PM_ATIVO = ['aguardando_pagamento', 'pago', 'producao', 'separado', 'programada', 'rota', 'entregue', 'ocorrencia'];
  const pmBadge = (pm) => A.badge(PMS[pm.status][0], PMS[pm.status][1]);
  const PMSTEPS = ['Pagamento', 'Fabricação', 'Separação e NF', 'Entrega programada', 'Em rota', 'Entregue na obra', 'Conferência'];
  const pmStep = (pm) => ({ aguardando_pagamento: 0, pago: 1, producao: 1, separado: 3, programada: 4, rota: 5, entregue: 6, ocorrencia: 6, conferido: 7 })[pm.status];
  const CMS = { solicitado: ['Aguardando precificação', 'warn'], aguardando_cliente: ['Aguardando aprovação do cliente', 'warn'], pago: ['Pago — em entrega', 'info'], entregue: ['Entregue', 'ok'] };
  const cmBadge = (c) => A.badge(CMS[c.status][0], CMS[c.status][1]);
  const openOc = (a) => (a.pm ? a.pm.ocorrencias.find((o) => o.status !== 'Resolvida') : null);

  /* Cálculos da proposta */
  const r2 = (n) => Math.round((+n || 0) * 100) / 100;
  const orcMat = (o) => r2(A.sum(o ? o.itens : [], (x) => x.qtd * x.preco));
  const orcDesc = (o) => (o ? Math.round(orcMat(o) * (+o.descPct || 0)) / 100 : 0);
  const orcFrete = (o) => (o ? +o.frete || 0 : 0);
  const orcMatTot = (o) => (o ? r2(orcMat(o) - orcDesc(o) + orcFrete(o)) : 0);
  const orcTotal = (o) => (o ? r2(orcMatTot(o) + (+o.maoObra || 0)) : 0);
  const custoMat = (itens) => r2(A.sum(itens || [], (x) => x.qtd * (x.custo || 0)));
  const capital = (cid) => /^São Paulo/.test(cid || '');
  const freteSug = (cid, valor) => (valor >= 1500 ? 0 : capital(cid) ? 69 : 99);
  const prog = (a) => (a.exec ? Math.round((a.exec.etapas.filter((x) => x.ok).length / a.exec.etapas.length) * 100) : 0);
  const origem = (x) => (x.fab ? 'Fabricação sob medida — fábrica própria' : x.forn === 'FOR-1' ? 'Estoque próprio' : 'Fornecedor parceiro');
  /** Normaliza itens com a tabela de preços AppCalhas (fonte única de preço). */
  const norm = (itens) => (itens || []).map((x) => { const m = mat(x.id) || {}; return { id: x.id, nome: m.nome || x.nome, un: m.un || x.un, qtd: +x.qtd, preco: m.preco || 0, custo: m.custo || 0, fab: !!m.fab, forn: m.forn || '' }; });
  const qtdTxt = (x) => A.num(x.qtd, x.qtd % 1 ? 1 : 0) + ' ' + x.un;

  /* ------------------------------------------------------------------
     Dados fictícios — região da Grande São Paulo
     ------------------------------------------------------------------ */
  function seed() {
    const b = A.base(), d = A.d;
    const CITY = { Campinas: 'São Paulo – Zona Sul', Valinhos: 'São Paulo – Zona Oeste', Vinhedo: 'Taboão da Serra', Sumaré: 'Diadema', Hortolândia: 'Embu das Artes', Paulínia: 'Itapecerica da Serra', Indaiatuba: 'São Bernardo do Campo', Jundiaí: 'Santo André', Americana: 'São Paulo – Centro' };
    const cty = (c) => CITY[c] || c;
    const tel = (t) => String(t || '').replace('(19)', '(11)');
    b.cidades = ['São Paulo – Zona Sul', 'São Paulo – Zona Oeste', 'São Paulo – Centro', 'Itapecerica da Serra', 'Embu das Artes', 'Taboão da Serra', 'Diadema', 'São Bernardo do Campo', 'Santo André'];
    b.pros.forEach((p) => { p.status = p.status === 'Publicado' ? 'Ativo' : 'Em homologação'; p.cidade = cty(p.cidade); p.regioes = p.regioes.map(cty); p.tel = tel(p.tel); });
    const BAIRRO = { 'CLI-201': 'Interlagos', 'CLI-202': 'Butantã', 'CLI-203': 'Centro', 'CLI-204': 'Vila Assunção', 'CLI-205': 'Jardim Santa Tereza', 'CLI-206': 'Socorro', 'CLI-207': 'Rudge Ramos', 'CLI-208': 'Santo Amaro' };
    b.clientes.forEach((c) => { c.cidade = cty(c.cidade); c.bairro = BAIRRO[c.id] || c.bairro; c.tel = tel(c.tel); });
    b.clientes.push(
      { id: 'CLI-210', nome: 'Tiago Moreira', tipo: 'Residencial', cidade: 'São Paulo – Zona Sul', bairro: 'Campo Grande', endereco: 'Rua dos Jacarandás, 210', tel: '(11) 98222-6611', email: 'tiago.moreira@email.demo', desde: d(-5) },
      { id: 'CLI-211', nome: 'Cond. Recanto das Águas', tipo: 'Condomínio', cidade: 'Itapecerica da Serra', bairro: 'Parque Paraíso', endereco: 'Estrada das Hortênsias, 1400', tel: '(11) 4666-1020', email: 'sindico.recanto@email.demo', desde: d(-20), contato: 'Sérgio Alves (síndico)' },
      { id: 'CLI-212', nome: 'Fernanda Lopes', tipo: 'Residencial', cidade: 'São Paulo – Zona Sul', bairro: 'Cidade Dutra', endereco: 'Rua das Acácias, 58', tel: '(11) 98100-4471', email: 'fernanda.lopes@email.demo', desde: d(-9) },
      { id: 'CLI-213', nome: 'Restaurante Varanda do Lago', tipo: 'Comercial', cidade: 'São Paulo – Zona Sul', bairro: 'Riviera Paulista', endereco: 'Av. das Garças, 1220', tel: '(11) 5520-7788', email: 'gerencia@varandadolago.demo', desde: d(-15), contato: 'Paulo Moura (gerente)' });

    /* Catálogo AppCalhas — fabricação própria + complementares (preços ilustrativos) */
    const CAT = [
      ['MAT-01', 'Calha galvalume corte 33 — sob medida', 'm', 41, 68, true, 'FOR-1', 120],
      ['MAT-02', 'Calha galvalume pintada corte 33 — sob medida', 'm', 52, 89, true, 'FOR-1', 60],
      ['MAT-03', 'Calha galvalume corte 50 — uso comercial', 'm', 61, 98, true, 'FOR-1', 40],
      ['MAT-04', 'Rufo de encosto galvalume corte 25', 'm', 24, 42, true, 'FOR-1', 90],
      ['MAT-05', 'Condutor PVC pluvial 88 mm', 'barra 3 m', 39, 54.9, false, 'FOR-2', 24],
      ['MAT-06', 'Bocal de saída 88 mm', 'un', 9.5, 18.5, true, 'FOR-1', 30],
      ['MAT-07', 'Cabeceira de calha', 'un', 6.5, 14, true, 'FOR-1', 40],
      ['MAT-08', 'Suporte de calha (mão-francesa)', 'un', 5.6, 9.8, false, 'FOR-3', 160],
      ['MAT-09', 'Curva PVC 88 mm 45°', 'un', 7.4, 12.4, false, 'FOR-2', 50],
      ['MAT-10', 'Vedante PU 400 g', 'tubo', 21, 32, false, 'FOR-3', 28],
      ['MAT-11', 'Abraçadeira para condutor 88 mm', 'un', 3.9, 6.5, false, 'FOR-3', 90],
      ['MAT-12', 'Tela protetora contra folhas', 'm', 9, 15.9, false, 'FOR-3', 60],
      ['MAT-13', 'Rufo de capa (chapéu de muro) corte 40', 'm', 33, 58, true, 'FOR-1', 50],
      ['MAT-14', 'Pingadeira galvalume', 'm', 18, 32, true, 'FOR-1', 70],
      ['MAT-15', 'Telha termoacústica 30 mm (sanduíche)', 'm²', 98, 149, false, 'FOR-1', 80],
    ];
    b.materiais = CAT.map((r) => ({ id: r[0], nome: r[1], un: r[2], custo: r[3], preco: r[4], fab: r[5], forn: r[6], estoque: r[7], prazo: r[5] ? '1 dia útil (dobra sob medida)' : 'Pronta entrega' }));
    b.fornecedores = [
      { id: 'FOR-1', nome: 'Fábrica própria — calhas e rufos sob medida', tipo: 'Fabricante principal (calhas, rufos, pingadeiras, telhas)', cidade: 'São Paulo – Zona Sul', contato: 'PCP e expedição (contato interno)', prazo: '1 dia útil para peças sob medida' },
      { id: 'FOR-2', nome: 'Distribuidora parceira de PVC', tipo: 'Revenda — condutores e conexões', cidade: 'São Paulo – Zona Sul', contato: 'Pedidos — (11) 3000-0202', prazo: '1 dia útil' },
      { id: 'FOR-3', nome: 'Fornecedor de fixação e vedação', tipo: 'Revenda — suportes, vedantes e telas', cidade: 'Diadema', contato: 'Comercial — (11) 3000-0303', prazo: '2 dias úteis' },
    ];

    const M = (de, nome, txt, ts) => ({ de: de, nome: nome, txt: txt, ts: ts });
    const H = (ts, txt, by, vis) => ({ ts: ts, txt: txt, by: by || '', vis: vis || 'all' });
    const I1 = (id, qtd) => { const m = b.materiais.find((x) => x.id === id); return { id: id, nome: m.nome, un: m.un, qtd: qtd, preco: m.preco, custo: m.custo, fab: m.fab, forn: m.forn }; };
    const exec = (done, ini, fim) => ({ inicioPrev: ini, fimPrev: fim, inicio: done > 0 ? ini : null, etapas: EXEC.map((n, i) => ({ n: n, ok: i < done, ts: i < done ? ini : null })) });
    const EV = (ts, txt, by) => ({ ts: ts, txt: txt, by: by });
    const mkPM = (a, st, extra) => {
      const o = a.orc;
      return Object.assign({ id: 'PM-' + a.id.split('-')[1], criado: o.aprovadoEm, itens: o.itens.map((x) => Object.assign({}, x)), subtotal: orcMat(o), desconto: orcDesc(o), frete: orcFrete(o), total: orcMatTot(o), custo: custoMat(o.itens), status: st, pag: null, nf: '', fab: null, entrega: null, conf: null, ocorrencias: [], complementos: [], ev: [] }, extra || {});
    };
    /** PM concluído (conferido) a partir de datas-base, para histórico. */
    const pmOk = (a, dPag, dEnt, recebedor, nf) => mkPM(a, 'conferido', {
      pag: { forma: 'Pix', status: 'Confirmado', ts: dPag }, nf: nf, fab: { ts: dPag, prev: dPag, op: 'OP-' + a.id.split('-')[1], obs: '' },
      entrega: { data: dEnt, janela: '08h–12h', veiculo: 'Utilitário AppCalhas 01', recebedor: recebedor, ts: dEnt, recebidoPor: recebedor },
      conf: { ts: dEnt, por: recebedor, obs: 'Itens conferidos sem divergência.' },
      ev: [EV(dPag, 'Pagamento confirmado (Pix)', 'Sistema'), EV(dPag, 'Ordem de fabricação emitida', 'Juliana Rocha'), EV(dEnt, 'Materiais entregues na obra', 'Expedição AppCalhas'), EV(dEnt, 'Materiais conferidos na obra', recebedor)],
    });

    const L = [];
    /* 1) Fluxo principal da demonstração — cliente Mariana */
    L.push({ id: 'ATD-3015', ts: d(-3, '08:40'), clienteId: 'CLI-201', srv: 'SRV-02', titulo: 'Troca da calha frontal com vazamento', desc: 'A calha da frente está vazando na emenda perto da garagem; quando chove forte, a água escorre pela parede.', fotos: ['vazamento', 'calha-frontal'], prioridade: 'Alta', etapa: 'orcamento_liberado', pro: 'PRF-101',
      visita: { data: d(-1, '10:00'), confirmadaPro: true, confirmadaCli: true, realizada: { ts: d(-1, '10:50'), medidas: '9,5 m de calha frontal; 1 descida de 3 m', diagnostico: 'Emenda corroída e suportes soltos. Recomendada a troca de toda a calha frontal; condutor existente aproveitável com nova curva.', fotos: ['vazamento'] } },
      orc: { versao: 1, itens: [I1('MAT-01', 9.5), I1('MAT-07', 2), I1('MAT-06', 1), I1('MAT-08', 12), I1('MAT-09', 2), I1('MAT-10', 2)], maoObra: 950, prazo: '1 dia de execução', validade: d(10), condicoes: COND[0], escopo: 'Remoção da calha frontal existente (9,5 m), instalação de calha galvalume corte 33 com suportes a cada 80 cm, novo bocal e ligação ao condutor existente, vedação e teste de escoamento.', obs: 'Garantia de 12 meses para a mão de obra.', enviado: d(-1, '17:30'), status: 'Liberado ao cliente', frete: 69, descPct: 0, prazoPreparo: '1 dia útil', conferencia: { por: 'Juliana Rocha', ts: d(0, '10:15'), checks: ['escopo', 'materiais', 'instalacao', 'prazo', 'condicoes'], obs: 'Proposta completa. Materiais precificados pela tabela AppCalhas.' }, liberado: d(0, '10:20') },
      exec: null, pm: null, conclusao: null, avaliacao: null, reclamacao: null, pendencias: [],
      m: { criado: d(-3, '08:40'), visita: d(-1, '10:50'), orcamento: d(-1, '17:30') },
      msgs: [M('mediador', 'Juliana Rocha', 'Olá, Mariana! Recebemos sua solicitação. A Mendes Calhas & Coberturas vai fazer a visita técnica e eu acompanho todo o atendimento por aqui.', d(-3, '09:10')), M('cliente', 'Mariana Costa', 'Ótimo! A visita pode ser de manhã?', d(-3, '09:22')), M('mediador', 'Juliana Rocha', 'Visita agendada para ' + A.fdt(d(-1, '10:00')) + '. Carlos confirmou o horário.', d(-3, '10:05')), M('profissional', 'Carlos Mendes', 'Visita feita. A emenda está corroída; recomendo trocar os 9,5 m da frente. Envio a mão de obra e a lista de materiais ainda hoje.', d(-1, '11:30')), M('mediador', 'Juliana Rocha', 'Proposta conferida e materiais precificados. Você aprova tudo em um só lugar: os materiais são pagos e entregues pelo AppCalhas, e a mão de obra é paga ao Carlos.', d(0, '10:20')), M('cliente', 'Mariana Costa', 'Obrigada! Vou analisar ainda hoje.', d(0, '10:45'))],
      decisoes: [{ ts: d(0, '10:30'), por: 'Juliana Rocha', txt: 'Cliente perguntou sobre calha pintada; o profissional manteve galvalume natural por compatibilidade com o condutor existente (decisão técnica do profissional).' }],
      hist: [H(d(-3, '08:40'), 'Solicitação recebida', 'Mariana Costa'), H(d(-3, '09:00'), 'Profissional designado: Mendes Calhas & Coberturas', 'Juliana Rocha'), H(d(-3, '10:05'), 'Visita agendada para ' + A.fdt(d(-1, '10:00')), 'Juliana Rocha'), H(d(-1, '10:50'), 'Visita técnica realizada', 'Carlos Mendes'), H(d(-1, '17:30'), 'Mão de obra e lista técnica de materiais enviadas', 'Carlos Mendes'), H(d(0, '10:15'), 'Proposta conferida e materiais precificados pelo AppCalhas', 'Juliana Rocha'), H(d(0, '10:20'), 'Proposta consolidada liberada ao cliente', 'Juliana Rocha')] });

    L.push({ id: 'ATD-3016', ts: d(-2, '14:00'), clienteId: 'CLI-208', srv: 'SRV-07', titulo: 'Revisão de calhas e rufos do prédio', desc: 'Prédio de dois andares. Revisão preventiva antes do período de chuvas e correção de pontos de infiltração no 2º andar.', fotos: ['rufo'], prioridade: 'Normal', etapa: 'visita_agendada', pro: 'PRF-101',
      visita: { data: d(0, '15:30'), confirmadaPro: true, confirmadaCli: true, realizada: null }, orc: null, exec: null, pm: null, conclusao: null, avaliacao: null, reclamacao: null, pendencias: [], m: { criado: d(-2, '14:00') },
      msgs: [M('mediador', 'Juliana Rocha', 'Renata, a visita técnica ficou para ' + A.when(d(0, '15:30')).toLowerCase() + ' com a Mendes Calhas. Por favor, deixe a portaria avisada.', d(-1, '09:00')), M('cliente', 'Clínica Vida Plena', 'Combinado, vamos liberar o acesso à laje.', d(-1, '09:40'))],
      decisoes: [], hist: [H(d(-2, '14:00'), 'Solicitação recebida', 'Clínica Vida Plena'), H(d(-2, '16:00'), 'Profissional designado: Mendes Calhas & Coberturas', 'Juliana Rocha'), H(d(-1, '09:00'), 'Visita agendada', 'Juliana Rocha')] });

    L.push({ id: 'ATD-3012', ts: d(-6, '10:00'), clienteId: 'CLI-202', srv: 'SRV-03', titulo: 'Vazamento no rufo da edícula', desc: 'Infiltração na parede da edícula, junto ao rufo, em dias de chuva.', fotos: ['rufo'], prioridade: 'Normal', etapa: 'orcamento_enviado', pro: 'PRF-103',
      visita: { data: d(-3, '14:00'), confirmadaPro: true, confirmadaCli: true, realizada: { ts: d(-3, '14:40'), medidas: '6 m de rufo; 2 m de calha', diagnostico: 'Rufo com vedação ressecada e um trecho solto.', fotos: ['rufo'] } },
      orc: { versao: 1, itens: [I1('MAT-04', 6), I1('MAT-10', 2)], maoObra: 480, prazo: '', validade: d(12), condicoes: COND[1], escopo: 'Troca de 6 m de rufo de encosto galvalume e nova vedação com PU.', obs: '', enviado: d(0, '09:10'), status: 'Em conferência' },
      exec: null, pm: null, conclusao: null, avaliacao: null, reclamacao: null, pendencias: [], m: { criado: d(-6, '10:00'), visita: d(-3, '14:40'), orcamento: d(0, '09:10') },
      msgs: [M('profissional', 'Ana Beatriz Souza', 'Mão de obra e lista de materiais enviadas para conferência.', d(0, '09:10'))], decisoes: [],
      hist: [H(d(-6, '10:00'), 'Solicitação recebida', 'Roberto Nunes'), H(d(-5, '09:00'), 'Profissional designado: Telhado Seguro Manutenção', 'Juliana Rocha'), H(d(-3, '14:40'), 'Visita técnica realizada', 'Ana Beatriz Souza'), H(d(0, '09:10'), 'Mão de obra e lista técnica enviadas', 'Ana Beatriz Souza')] });

    L.push({ id: 'ATD-3010', ts: d(-7, '09:00'), clienteId: 'CLI-203', srv: 'SRV-07', titulo: 'Revisão geral de calhas e condutores — 3 blocos', desc: 'Infiltração na garagem do bloco B quando chove. Revisão geral dos três blocos.', fotos: ['condutor'], prioridade: 'Normal', etapa: 'visita_realizada', pro: 'PRF-104',
      visita: { data: d(-3, '09:00'), confirmadaPro: true, confirmadaCli: true, realizada: { ts: d(-3, '11:30'), medidas: '48 m de calha; 9 descidas', diagnostico: 'Condutores do bloco B entupidos e duas emendas com vazamento.', fotos: ['condutor'] } },
      orc: null, exec: null, pm: null, conclusao: null, avaliacao: null, reclamacao: null, pendencias: [], m: { criado: d(-7, '09:00'), visita: d(-3, '11:30') },
      msgs: [M('cliente', 'Cond. Jardim das Palmeiras', 'Bom dia! Ainda não recebemos o orçamento. Precisamos levar para a assembleia.', d(-1, '10:00'))], decisoes: [],
      hist: [H(d(-7, '09:00'), 'Solicitação recebida', 'Cond. Jardim das Palmeiras'), H(d(-6, '10:00'), 'Profissional designado: Pereira Funilaria de Obra', 'Juliana Rocha'), H(d(-3, '11:30'), 'Visita técnica realizada', 'João Pereira')] });

    /* 2) Materiais em cada etapa da operação AppCalhas */
    const a3007 = { id: 'ATD-3007', ts: d(-6, '09:30'), clienteId: 'CLI-213', srv: 'SRV-02', titulo: 'Troca das calhas do salão e da cozinha', desc: 'Calhas antigas transbordando sobre a área de mesas externas.', fotos: ['calha-frontal'], prioridade: 'Alta', etapa: 'aprovado', pro: 'PRF-102',
      visita: { data: d(-4, '15:00'), confirmadaPro: true, confirmadaCli: true, realizada: { ts: d(-4, '15:50'), medidas: '18 m de calha corte 50; 3 descidas', diagnostico: 'Calha subdimensionada para a área do telhado; recomendada calha corte 50.', fotos: ['calha-frontal'] } },
      orc: { versao: 1, itens: [I1('MAT-03', 18), I1('MAT-07', 2), I1('MAT-06', 3), I1('MAT-08', 24), I1('MAT-10', 3)], maoObra: 2100, prazo: '2 dias de execução', validade: d(8), condicoes: COND[0], escopo: 'Troca de 18 m de calha por calha galvalume corte 50, 3 bocais novos, vedação e teste de escoamento.', obs: '', enviado: d(-3, '18:00'), status: 'Aprovado', frete: 0, descPct: 5, prazoPreparo: '2 dias úteis', conferencia: { por: 'Juliana Rocha', ts: d(-2, '09:00'), checks: CONF.map((c) => c[0]) }, liberado: d(-2, '09:10'), aprovadoEm: d(-2, '11:00'), aprovadoPor: 'Restaurante Varanda do Lago' },
      exec: { inicioPrev: d(3, '07:30'), fimPrev: d(4, '17:00'), inicio: null, etapas: EXEC.map((n) => ({ n: n, ok: false, ts: null })) }, conclusao: null, avaliacao: null, reclamacao: null, pendencias: [],
      m: { criado: d(-6, '09:30'), visita: d(-4, '15:50'), orcamento: d(-3, '18:00'), aprovado: d(-2, '11:00') },
      msgs: [M('cliente', 'Restaurante Varanda do Lago', 'Aprovado. Pode emitir o boleto dos materiais em nome do restaurante?', d(-2, '11:02')), M('mediador', 'Juliana Rocha', 'Boleto emitido com vencimento em 2 dias. Assim que compensar, a fábrica inicia a produção.', d(-2, '11:05'))], decisoes: [{ ts: d(-2, '09:00'), por: 'Juliana Rocha', txt: 'Desconto de 5% nos materiais concedido dentro da alçada da mediação (pedido acima de R$ 2.000).' }],
      hist: [H(d(-6, '09:30'), 'Solicitação recebida', 'Restaurante Varanda do Lago'), H(d(-2, '09:10'), 'Proposta consolidada liberada ao cliente', 'Juliana Rocha'), H(d(-2, '11:00'), 'Proposta aprovada pelo cliente', 'Restaurante Varanda do Lago')] };
    a3007.pm = mkPM(a3007, 'aguardando_pagamento', { pag: { forma: 'Boleto', status: 'Boleto emitido', ts: d(-2, '11:05') }, ev: [EV(d(-2, '11:00'), 'Pedido de materiais gerado na aprovação', 'Sistema'), EV(d(-2, '11:05'), 'Boleto emitido (vencimento em 2 dias)', 'Juliana Rocha')] });
    L.push(a3007);

    const a3014 = { id: 'ATD-3014', ts: d(-5, '10:00'), clienteId: 'CLI-211', srv: 'SRV-05', titulo: 'Rufos de capa e pingadeiras dos muros', desc: 'Muros do condomínio com manchas de umidade; rufos de capa antigos soltando.', fotos: ['rufo'], prioridade: 'Normal', etapa: 'preparo', pro: 'PRF-102',
      visita: { data: d(-3, '09:00'), confirmadaPro: true, confirmadaCli: true, realizada: { ts: d(-3, '10:10'), medidas: '24 m de rufo de capa; 18 m de pingadeira', diagnostico: 'Rufos de capa com fixação comprometida; ausência de pingadeira nas janelas do bloco 2.', fotos: ['rufo'] } },
      orc: { versao: 1, itens: [I1('MAT-13', 24), I1('MAT-14', 18), I1('MAT-10', 4)], maoObra: 1650, prazo: '2 dias de execução', validade: d(9), condicoes: COND[0], escopo: 'Substituição de 24 m de rufo de capa e instalação de 18 m de pingadeira galvalume, com vedação.', obs: '', enviado: d(-2, '17:00'), status: 'Aprovado', frete: 0, descPct: 3, prazoPreparo: '1 dia útil', conferencia: { por: 'Juliana Rocha', ts: d(-1, '09:00'), checks: CONF.map((c) => c[0]) }, liberado: d(-1, '09:10'), aprovadoEm: d(-1, '16:00'), aprovadoPor: 'Cond. Recanto das Águas' },
      exec: { inicioPrev: d(2, '08:00'), fimPrev: d(3, '17:00'), inicio: null, etapas: EXEC.map((n) => ({ n: n, ok: false, ts: null })) }, conclusao: null, avaliacao: null, reclamacao: null, pendencias: [],
      m: { criado: d(-5, '10:00'), visita: d(-3, '10:10'), orcamento: d(-2, '17:00'), aprovado: d(-1, '16:00'), pago: d(-1, '16:20') },
      msgs: [M('mediador', 'Juliana Rocha', 'Pagamento dos materiais confirmado. As peças estão em fabricação; a entrega será programada para a véspera do serviço.', d(0, '08:40'))], decisoes: [],
      hist: [H(d(-5, '10:00'), 'Solicitação recebida', 'Cond. Recanto das Águas'), H(d(-1, '16:00'), 'Proposta aprovada pelo cliente', 'Cond. Recanto das Águas'), H(d(-1, '16:20'), 'Pagamento dos materiais confirmado (Pix)', 'Sistema'), H(d(0, '08:30'), 'Materiais em fabricação', 'Juliana Rocha')] };
    a3014.pm = mkPM(a3014, 'producao', { pag: { forma: 'Pix', status: 'Confirmado', ts: d(-1, '16:20') }, fab: { ts: d(0, '08:30'), prev: d(1, '12:00'), op: 'OP-3014', obs: '24 m de rufo de capa corte 40 em 8 peças de 3 m; pingadeiras em peças de 1,5 m.' }, ev: [EV(d(-1, '16:00'), 'Pedido de materiais gerado na aprovação', 'Sistema'), EV(d(-1, '16:20'), 'Pagamento confirmado (Pix)', 'Sistema'), EV(d(0, '08:30'), 'Ordem de fabricação OP-3014 emitida para a fábrica', 'Juliana Rocha')] });
    L.push(a3014);

    const a3009 = { id: 'ATD-3009', ts: d(-8, '14:00'), clienteId: 'CLI-212', srv: 'SRV-01', titulo: 'Calhas pintadas para a casa nova', desc: 'Casa nova sem calhas; queremos calha na cor da fachada.', fotos: ['aluminio'], prioridade: 'Normal', etapa: 'preparo', pro: 'PRF-101',
      visita: { data: d(-6, '09:00'), confirmadaPro: true, confirmadaCli: true, realizada: { ts: d(-6, '09:50'), medidas: '12 m de calha; 2 descidas de 3 m', diagnostico: 'Beiral regular; calha pintada corte 33 atende a área de captação.', fotos: ['aluminio'] } },
      orc: { versao: 1, itens: [I1('MAT-02', 12), I1('MAT-07', 2), I1('MAT-06', 2), I1('MAT-08', 15), I1('MAT-05', 2), I1('MAT-09', 2), I1('MAT-11', 4)], maoObra: 1200, prazo: '1 dia de execução', validade: d(4), condicoes: COND[0], escopo: 'Instalação de 12 m de calha galvalume pintada (cor grafite), 2 descidas em PVC, suportes a cada 80 cm e teste de escoamento.', obs: '', enviado: d(-5, '18:00'), status: 'Aprovado', frete: 69, descPct: 0, prazoPreparo: '2 dias úteis', conferencia: { por: 'Juliana Rocha', ts: d(-4, '09:00'), checks: CONF.map((c) => c[0]) }, liberado: d(-4, '09:10'), aprovadoEm: d(-4, '12:00'), aprovadoPor: 'Fernanda Lopes' },
      exec: { inicioPrev: d(1, '08:00'), fimPrev: d(1, '17:00'), inicio: null, etapas: EXEC.map((n) => ({ n: n, ok: false, ts: null })) }, conclusao: null, avaliacao: null, reclamacao: null, pendencias: [],
      m: { criado: d(-8, '14:00'), visita: d(-6, '09:50'), orcamento: d(-5, '18:00'), aprovado: d(-4, '12:00'), pago: d(-4, '12:10'), entregue: d(0, '09:10') },
      msgs: [M('mediador', 'Juliana Rocha', 'Fernanda, os materiais foram entregues hoje de manhã. O Carlos confere tudo e começa amanhã às 8h.', d(0, '09:20')), M('cliente', 'Fernanda Lopes', 'Recebi! Deixei tudo na garagem.', d(0, '09:35'))], decisoes: [],
      hist: [H(d(-8, '14:00'), 'Solicitação recebida', 'Fernanda Lopes'), H(d(-4, '12:00'), 'Proposta aprovada pelo cliente', 'Fernanda Lopes'), H(d(-4, '12:10'), 'Pagamento dos materiais confirmado (cartão)', 'Sistema'), H(d(0, '09:10'), 'Materiais entregues na obra', 'Expedição AppCalhas')] };
    a3009.pm = mkPM(a3009, 'entregue', { pag: { forma: 'Cartão em 3x', status: 'Confirmado', ts: d(-4, '12:10') }, nf: 'NF-e 18.204', fab: { ts: d(-3, '08:00'), prev: d(-2, '17:00'), op: 'OP-3009', obs: 'Cor grafite.' },
      entrega: { data: d(0, '08:00'), janela: '08h–12h', veiculo: 'Utilitário AppCalhas 01', recebedor: 'Fernanda Lopes (cliente)', ts: d(0, '09:10'), recebidoPor: 'Fernanda Lopes (cliente)' },
      ev: [EV(d(-4, '12:00'), 'Pedido de materiais gerado na aprovação', 'Sistema'), EV(d(-4, '12:10'), 'Pagamento confirmado (cartão em 3x)', 'Sistema'), EV(d(-3, '08:00'), 'Ordem de fabricação OP-3009 emitida para a fábrica', 'Juliana Rocha'), EV(d(-1, '15:00'), 'Separado e faturado — NF-e 18.204', 'Expedição AppCalhas'), EV(d(-1, '16:00'), 'Entrega programada para ' + A.fd(d(0)) + ' (08h–12h)', 'Juliana Rocha'), EV(d(0, '08:05'), 'Saiu para entrega', 'Expedição AppCalhas'), EV(d(0, '09:10'), 'Entregue na obra — recebido por Fernanda Lopes', 'Expedição AppCalhas')] });
    L.push(a3009);

    const a3006 = { id: 'ATD-3006', ts: d(-9, '10:00'), clienteId: 'CLI-204', srv: 'SRV-06', titulo: 'Troca das descidas da fachada', desc: 'Condutores da fachada rachados e com vazamento no encaixe.', fotos: ['condutor'], prioridade: 'Normal', etapa: 'preparo', pro: 'PRF-105',
      visita: { data: d(-7, '14:00'), confirmadaPro: true, confirmadaCli: true, realizada: { ts: d(-7, '14:40'), medidas: '4 descidas de 3 m', diagnostico: 'Condutores ressecados; bocais com encaixe frouxo.', fotos: ['condutor'] } },
      orc: { versao: 1, itens: [I1('MAT-05', 4), I1('MAT-06', 2), I1('MAT-09', 4), I1('MAT-11', 8)], maoObra: 680, prazo: '1 dia de execução', validade: d(5), condicoes: COND[1], escopo: 'Troca de 4 descidas em PVC 88 mm, 2 bocais novos e abraçadeiras.', obs: '', enviado: d(-6, '17:00'), status: 'Aprovado', frete: 99, descPct: 0, prazoPreparo: '1 dia útil', conferencia: { por: 'Juliana Rocha', ts: d(-5, '09:00'), checks: CONF.map((c) => c[0]) }, liberado: d(-5, '09:10'), aprovadoEm: d(-4, '10:00'), aprovadoPor: 'Helena Martins' },
      exec: { inicioPrev: d(1, '08:00'), fimPrev: d(1, '17:00'), inicio: null, etapas: EXEC.map((n) => ({ n: n, ok: false, ts: null })) }, conclusao: null, avaliacao: null, reclamacao: null, pendencias: [],
      m: { criado: d(-9, '10:00'), visita: d(-7, '14:40'), orcamento: d(-6, '17:00'), aprovado: d(-4, '10:00'), pago: d(-4, '10:05'), entregue: d(-1, '10:00') },
      msgs: [M('profissional', 'Marcos Teixeira', 'Conferi o material: um dos bocais chegou amassado. Registrei a ocorrência com foto.', d(-1, '10:40'))], decisoes: [],
      hist: [H(d(-9, '10:00'), 'Solicitação recebida', 'Helena Martins'), H(d(-4, '10:00'), 'Proposta aprovada pelo cliente', 'Helena Martins'), H(d(-1, '10:00'), 'Materiais entregues na obra', 'Expedição AppCalhas'), H(d(-1, '10:40'), 'Ocorrência de material registrada: avaria no transporte', 'Marcos Teixeira')] };
    a3006.pm = mkPM(a3006, 'ocorrencia', { pag: { forma: 'Pix', status: 'Confirmado', ts: d(-4, '10:05') }, nf: 'NF-e 18.197', fab: { ts: d(-3, '08:00'), prev: d(-2, '12:00'), op: 'OP-3006', obs: '' },
      entrega: { data: d(-1, '08:00'), janela: '08h–12h', veiculo: 'Utilitário AppCalhas 01', recebedor: 'Marcos Teixeira (profissional)', ts: d(-1, '10:00'), recebidoPor: 'Marcos Teixeira (profissional)' },
      ocorrencias: [{ id: 'OC-01', ts: d(-1, '10:40'), tipo: 'Avaria no transporte', itens: ['Bocal de saída 88 mm'], desc: '1 bocal de saída chegou amassado na borda.', fotos: ['condutor'], status: 'Aberta', acoes: [] }],
      ev: [EV(d(-4, '10:05'), 'Pagamento confirmado (Pix)', 'Sistema'), EV(d(-3, '08:00'), 'Ordem de fabricação OP-3006 emitida', 'Juliana Rocha'), EV(d(-2, '15:00'), 'Separado e faturado — NF-e 18.197', 'Expedição AppCalhas'), EV(d(-1, '10:00'), 'Entregue na obra — recebido por Marcos Teixeira', 'Expedição AppCalhas'), EV(d(-1, '10:40'), 'Ocorrência OC-01: avaria no transporte (1 bocal)', 'Marcos Teixeira')] });
    L.push(a3006);

    const a3008 = { id: 'ATD-3008', ts: d(-12, '15:00'), clienteId: 'CLI-205', srv: 'SRV-02', titulo: 'Troca de calha sobre a área do forno', desc: 'Calha antiga com furos sobre a área de produção.', fotos: ['vazamento'], prioridade: 'Alta', etapa: 'execucao', pro: 'PRF-101',
      visita: { data: d(-10, '08:00'), confirmadaPro: true, confirmadaCli: true, realizada: { ts: d(-10, '08:40'), medidas: '14 m de calha; 2 descidas', diagnostico: 'Calha com corrosão generalizada.', fotos: [] } },
      orc: { versao: 1, itens: [I1('MAT-01', 14), I1('MAT-08', 18), I1('MAT-06', 2), I1('MAT-05', 2), I1('MAT-10', 3)], maoObra: 1400, prazo: '2 dias de execução', validade: d(5), condicoes: COND[0], escopo: 'Troca de 14 m de calha e duas descidas.', obs: '', enviado: d(-9, '18:00'), status: 'Aprovado', frete: 99, descPct: 0, prazoPreparo: '1 dia útil', conferencia: { por: 'Juliana Rocha', ts: d(-8, '09:00'), checks: CONF.map((c) => c[0]) }, liberado: d(-8, '09:05'), aprovadoEm: d(-7, '11:00'), aprovadoPor: 'Padaria Pão Dourado' },
      exec: exec(3, d(-2, '07:30'), d(0, '17:00')), conclusao: null, avaliacao: null, reclamacao: null, pendencias: [], m: { criado: d(-12, '15:00'), visita: d(-10, '08:40'), orcamento: d(-9, '18:00'), aprovado: d(-7, '11:00'), pago: d(-7, '11:10'), entregue: d(-3, '14:00') },
      msgs: [M('profissional', 'Carlos Mendes', 'Choveu ontem à tarde e paramos na instalação. Retomo hoje cedo.', d(-1, '16:20')), M('cliente', 'Padaria Pão Dourado', 'Precisamos que termine antes do fim de semana, por favor.', d(-1, '16:45')), M('profissional', 'Carlos Mendes', 'O beiral é maior do que o previsto no trecho dos fundos. Pedi pelo app 6 suportes extras e 1 vedante.', d(0, '10:40'))], decisoes: [],
      hist: [H(d(-12, '15:00'), 'Solicitação recebida', 'Padaria Pão Dourado'), H(d(-7, '11:00'), 'Proposta aprovada pelo cliente', 'Padaria Pão Dourado'), H(d(-3, '14:00'), 'Materiais entregues e conferidos na obra', 'Carlos Mendes'), H(d(-2, '07:30'), 'Serviço iniciado', 'Carlos Mendes'), H(d(-1, '16:20'), 'Andamento atualizado: 50%', 'Carlos Mendes'), H(d(0, '10:40'), 'Material complementar solicitado (CMP-1)', 'Carlos Mendes')] };
    a3008.pm = pmOk(a3008, d(-7, '11:10'), d(-3, '14:00'), 'Carlos Mendes (profissional)', 'NF-e 18.150');
    a3008.pm.complementos.push({ id: 'CMP-1', ts: d(0, '10:40'), por: 'Carlos Mendes', itens: [I1('MAT-08', 6), I1('MAT-10', 1)], motivo: 'Beiral maior que o previsto no trecho dos fundos.', status: 'solicitado', frete: 0, total: 0 });
    a3008.pm.ev.push(EV(d(0, '10:40'), 'Complemento CMP-1 solicitado pelo profissional (6 suportes e 1 vedante)', 'Carlos Mendes'));
    L.push(a3008);

    L.push({ id: 'ATD-3013', ts: d(-1, '11:00'), clienteId: 'CLI-210', srv: 'SRV-01', titulo: 'Calhas para a área gourmet', desc: 'Área gourmet nova, cerca de 8 m de beiral sem calha.', fotos: ['aluminio'], prioridade: 'Normal', etapa: 'designado', pro: 'PRF-102', visita: null, orc: null, exec: null, pm: null, conclusao: null, avaliacao: null, reclamacao: null, pendencias: [], m: { criado: d(-1, '11:00') },
      msgs: [M('mediador', 'Juliana Rocha', 'Tiago, a RL Calhas Sob Medida vai atender você. Vou combinar o melhor horário para a visita.', d(0, '09:00'))], decisoes: [], hist: [H(d(-1, '11:00'), 'Solicitação recebida', 'Tiago Moreira'), H(d(0, '09:00'), 'Profissional designado: RL Calhas Sob Medida', 'Juliana Rocha')] });
    L.push({ id: 'ATD-3017', ts: d(0, '11:40'), clienteId: 'CLI-207', srv: 'SRV-06', titulo: 'Condutor transbordando na lateral', desc: 'O condutor lateral transborda e molha o muro do vizinho.', fotos: ['condutor'], prioridade: 'Normal', etapa: 'solicitado', pro: null, visita: null, orc: null, exec: null, pm: null, conclusao: null, avaliacao: null, reclamacao: null, pendencias: [], m: { criado: d(0, '11:40') }, msgs: [], decisoes: [], hist: [H(d(0, '11:40'), 'Solicitação recebida', 'Gustavo Ramos')] });

    const a3005 = { id: 'ATD-3005', ts: d(-15, '09:00'), clienteId: 'CLI-204', srv: 'SRV-04', titulo: 'Limpeza e tela protetora nas calhas', desc: 'Calhas entupidas por folhas.', fotos: ['limpeza'], prioridade: 'Normal', etapa: 'concluido', pro: 'PRF-105',
      visita: { data: d(-12, '14:00'), confirmadaPro: true, confirmadaCli: true, realizada: { ts: d(-12, '14:30'), medidas: '22 m de calha', diagnostico: 'Calhas íntegras, apenas entupidas.', fotos: [] } },
      orc: { versao: 1, itens: [I1('MAT-12', 22)], maoObra: 520, prazo: '1 dia', validade: d(-2), condicoes: COND[1], escopo: 'Limpeza completa e instalação de tela protetora.', obs: '', enviado: d(-11, '10:00'), status: 'Aprovado', frete: 99, descPct: 0, conferencia: { por: 'Juliana Rocha', ts: d(-11, '11:00'), checks: CONF.map((c) => c[0]) }, aprovadoEm: d(-10, '09:00'), aprovadoPor: 'Helena Martins' },
      exec: exec(6, d(-2, '08:00'), d(-2, '17:00')), conclusao: { ts: d(-1, '16:00'), obs: 'Serviço concluído e teste de escoamento realizado.', fotos: ['limpeza'], garantia: '6 meses', sobras: 'Sem sobras' }, avaliacao: null, reclamacao: null, pendencias: [],
      m: { criado: d(-15, '09:00'), visita: d(-12, '14:30'), orcamento: d(-11, '10:00'), aprovado: d(-10, '09:00'), pago: d(-10, '09:10'), entregue: d(-3, '10:00'), concluido: d(-1, '16:00') }, msgs: [M('profissional', 'Marcos Teixeira', 'Serviço concluído. Pode conferir as fotos no atendimento.', d(-1, '16:05'))], decisoes: [],
      hist: [H(d(-15, '09:00'), 'Solicitação recebida', 'Helena Martins'), H(d(-1, '16:00'), 'Serviço concluído pelo profissional', 'Marcos Teixeira')] };
    a3005.pm = pmOk(a3005, d(-10, '09:10'), d(-3, '10:00'), 'Marcos Teixeira (profissional)', 'NF-e 18.120');
    L.push(a3005);

    const a3003 = { id: 'ATD-3003', ts: d(-30, '10:00'), clienteId: 'CLI-206', srv: 'SRV-02', titulo: 'Troca de calhas da quadra coberta', desc: 'Calhas da quadra com vazamentos.', fotos: ['calha-frontal'], prioridade: 'Normal', etapa: 'encerrado', pro: 'PRF-101',
      visita: { data: d(-28, '09:00'), confirmadaPro: true, confirmadaCli: true, realizada: { ts: d(-28, '09:40'), medidas: '26 m de calha; 4 descidas', diagnostico: 'Troca total recomendada.', fotos: [] } },
      orc: { versao: 1, itens: [I1('MAT-01', 26), I1('MAT-08', 32), I1('MAT-05', 4), I1('MAT-06', 4)], maoObra: 2300, prazo: '3 dias', validade: d(-15), condicoes: COND[0], escopo: 'Troca completa das calhas da quadra.', obs: '', enviado: d(-27, '10:00'), status: 'Aprovado', frete: 0, descPct: 0, conferencia: { por: 'Juliana Rocha', ts: d(-27, '14:00'), checks: CONF.map((c) => c[0]) }, aprovadoEm: d(-25, '10:00'), aprovadoPor: 'Escola Pequeno Saber' },
      exec: exec(6, d(-22, '07:30'), d(-20, '17:00')), conclusao: { ts: d(-20, '16:30'), obs: 'Concluído.', fotos: [], garantia: '12 meses', sobras: 'Sem sobras' }, confirmado: d(-19, '10:00'), avaliacao: { nota: 5, txt: 'Equipe organizada, material chegou na véspera e o AppCalhas informou cada etapa.', ts: d(-19, '10:05') },
      reclamacao: { id: 'REC-01', tipo: 'Infiltração após o serviço (garantia)', desc: 'Depois da chuva forte de ontem, apareceu uma goteira no vestiário, próximo a uma das descidas.', ts: d(-1, '08:30'), status: 'Aberta', acoes: [] }, pendencias: [],
      m: { criado: d(-30, '10:00'), visita: d(-28, '09:40'), orcamento: d(-27, '10:00'), aprovado: d(-25, '10:00'), pago: d(-25, '10:10'), entregue: d(-23, '09:00'), concluido: d(-20, '16:30') },
      msgs: [M('cliente', 'Escola Pequeno Saber', 'Apareceu uma goteira no vestiário depois da chuva de ontem. O serviço tem garantia?', d(-1, '08:35'))], decisoes: [],
      hist: [H(d(-30, '10:00'), 'Solicitação recebida', 'Escola Pequeno Saber'), H(d(-20, '16:30'), 'Serviço concluído', 'Carlos Mendes'), H(d(-19, '10:05'), 'Atendimento avaliado pelo cliente: 5 estrelas', 'Escola Pequeno Saber'), H(d(-1, '08:30'), 'Reclamação registrada: infiltração após o serviço', 'Escola Pequeno Saber')] };
    a3003.pm = pmOk(a3003, d(-25, '10:10'), d(-23, '09:00'), 'Carlos Mendes (profissional)', 'NF-e 17.988');
    L.push(a3003);

    L.push({ id: 'ATD-2990', ts: d(-80, '10:00'), clienteId: 'CLI-201', srv: 'SRV-04', titulo: 'Limpeza de calhas', desc: 'Limpeza geral antes das chuvas.', fotos: ['limpeza'], prioridade: 'Normal', etapa: 'encerrado', pro: 'PRF-103',
      visita: { data: d(-78, '09:00'), confirmadaPro: true, confirmadaCli: true, realizada: { ts: d(-78, '09:30'), medidas: '18 m de calha', diagnostico: 'Calhas entupidas.', fotos: [] } },
      orc: { versao: 1, itens: [], maoObra: 280, prazo: '1 dia', validade: d(-70), condicoes: COND[1], escopo: 'Limpeza e teste de escoamento (sem materiais).', obs: '', enviado: d(-78, '12:00'), status: 'Aprovado', frete: 0, descPct: 0, conferencia: { por: 'Juliana Rocha', ts: d(-78, '14:00'), checks: CONF.map((c) => c[0]) }, aprovadoEm: d(-77, '09:00'), aprovadoPor: 'Mariana Costa' },
      exec: exec(6, d(-75, '08:00'), d(-75, '12:00')), pm: null, conclusao: { ts: d(-75, '12:00'), obs: 'Concluído.', fotos: [], garantia: '3 meses' }, confirmado: d(-74, '09:00'), avaliacao: { nota: 5, txt: 'Muito bom! Recebi fotos do antes e depois.', ts: d(-74, '09:05') }, reclamacao: null, pendencias: [],
      m: { criado: d(-80, '10:00'), visita: d(-78, '09:30'), orcamento: d(-78, '12:00'), aprovado: d(-77, '09:00'), concluido: d(-75, '12:00') }, msgs: [], decisoes: [], hist: [H(d(-80, '10:00'), 'Solicitação recebida', 'Mariana Costa'), H(d(-74, '09:05'), 'Atendimento avaliado: 5 estrelas', 'Mariana Costa')] });

    /* 3) Histórico encerrado para relatórios */
    const rnd = A.rng(23);
    const nomes = [['Luciana Prado', 'Valinhos'], ['Ricardo Sato', 'Campinas'], ['Daniela Vieira', 'Paulínia'], ['Rogério Campos', 'Jundiaí'], ['Patrícia Lemos', 'Indaiatuba'], ['André Luiz', 'Americana'], ['Fábio Nogueira', 'Campinas'], ['Marta Ribeiro', 'Valinhos'], ['Vinícius Rocha', 'Sumaré'], ['Vanessa Dias', 'Hortolândia'], ['Caio Mendonça', 'Campinas'], ['Sílvia Torres', 'Vinhedo'], ['Otávio Brandão', 'Jundiaí'], ['Lígia Paiva', 'Campinas']].map((n) => [n[0], cty(n[1])]);
    const ativos = b.pros.filter((p) => p.status === 'Ativo');
    nomes.forEach((n, i) => {
      const cand = ativos.filter((p) => p.regioes.indexOf(n[1]) >= 0);
      const p = cand.length ? cand[Math.floor(rnd() * cand.length)] : ativos[0];
      const srv = p.servicos[Math.floor(rnd() * p.servicos.length)];
      const c0 = -(10 + i * 6), v = c0 + 1 + Math.floor(rnd() * 2), o = v + 1 + Math.floor(rnd() * 3), ap = o + 1 + Math.floor(rnd() * 2), co = Math.min(-1, ap + 3 + Math.floor(rnd() * 4));
      const its = [['MAT-01', 6 + Math.floor(rnd() * 14)], ['MAT-08', 8 + Math.floor(rnd() * 12)], ['MAT-06', 1 + Math.floor(rnd() * 2)], ['MAT-10', 1 + Math.floor(rnd() * 2)]].slice(0, 2 + Math.floor(rnd() * 3)).map((x) => I1(x[0], x[1]));
      const nota = rnd() < 0.15 ? 3 : rnd() < 0.45 ? 4 : 5;
      const atrasou = rnd() < 0.25, devolvido = rnd() < 0.3, rec = rnd() < 0.18, ocor = rnd() < 0.14;
      const ent = Math.max(ap + 1, rnd() < 0.88 ? co - 2 : co - 1), vespera = ent < co - 1;
      const a = { id: 'ATD-' + (2960 + i), ts: d(c0, '09:00'), clienteId: '', clienteNome: n[0], cidadeAvulsa: n[1], srv: srv, titulo: b.servicos.find((s) => s.id === srv).nome, desc: '', fotos: [], prioridade: 'Normal', etapa: 'encerrado', pro: p.id,
        visita: { data: d(v, '09:00'), confirmadaPro: true, confirmadaCli: true, realizada: { ts: d(v, '10:00'), medidas: '', diagnostico: '', fotos: [] } },
        orc: { versao: devolvido ? 2 : 1, itens: its, maoObra: 400 + Math.round(rnd() * 11) * 100, prazo: '1 a 2 dias', validade: d(o + 10), condicoes: COND[i % 3], escopo: 'Serviço de ' + b.servicos.find((s) => s.id === srv).nome.toLowerCase() + '.', obs: '', enviado: d(o, '17:00'), status: 'Aprovado', devolucoes: devolvido ? 1 : 0, frete: 0, descPct: rnd() < 0.3 ? 3 : 0, conferencia: { por: 'Juliana Rocha', ts: d(o + 1, '09:00'), checks: CONF.map((c) => c[0]) }, aprovadoEm: d(ap, '10:00'), aprovadoPor: n[0] },
        exec: exec(6, d(co - 1, '08:00'), d(atrasou ? co - 2 : co, '17:00')), conclusao: { ts: d(co, '16:00'), obs: '', fotos: [], garantia: '12 meses' }, confirmado: d(Math.min(0, co + 1), '09:00'), atrasou: atrasou,
        avaliacao: { nota: nota, txt: '', ts: d(Math.min(0, co + 1), '09:10') }, reclamacao: rec ? { id: 'REC-H' + i, tipo: ['Acabamento', 'Atraso na execução', 'Infiltração após o serviço (garantia)'][i % 3], desc: '', ts: d(Math.min(0, co + 2), '10:00'), status: 'Resolvida', acoes: [{ ts: d(Math.min(0, co + 3), '10:00'), txt: 'Retorno do profissional e ajuste realizado.', por: 'Juliana Rocha' }] } : null, pendencias: [],
        m: { criado: d(c0, '09:00'), visita: d(v, '10:00'), orcamento: d(o, '17:00'), aprovado: d(ap, '10:00'), pago: d(ap, '10:30'), entregue: d(ent, '10:00'), concluido: d(co, '16:00') }, msgs: [], decisoes: [], hist: [H(d(c0, '09:00'), 'Solicitação recebida', n[0]), H(d(co, '16:00'), 'Serviço concluído', p.nome)] };
      a.orc.frete = freteSug(n[1], orcMat(a.orc));
      a.pm = pmOk(a, d(ap, '10:30'), d(ent, '10:00'), p.nome + ' (profissional)', 'NF-e ' + (17800 + i * 7));
      a.pm.vespera = vespera;
      if (ocor) a.pm.ocorrencias.push({ id: 'OC-H' + i, ts: a.m.entregue, tipo: ['Avaria no transporte', 'Falta de item', 'Medida divergente'][i % 3], itens: [its[0].nome], desc: '', fotos: [], status: 'Resolvida', acoes: [{ ts: a.m.entregue, txt: 'Reposição sem custo entregue no mesmo dia.', por: 'Juliana Rocha' }] });
      L.push(a);
    });
    b.atendimentos = L;
    return b;
  }
  function seedLogs() {
    return A.L([
      [-4, '12:10', 'Fernanda Lopes', 'cliente', 'Pagamento de materiais confirmado (cartão)', 'PM-3009 · ' + A.money(1509.6)],
      [-3, '08:00', 'Juliana Rocha', 'mediador', 'Ordem de fabricação emitida', 'PM-3009 · OP-3009'],
      [-3, '08:40', 'Mariana Costa', 'cliente', 'Solicitação registrada', 'ATD-3015'],
      [-3, '09:00', 'Juliana Rocha', 'mediador', 'Profissional designado', 'ATD-3015 · Mendes Calhas & Coberturas'],
      [-3, '10:05', 'Juliana Rocha', 'mediador', 'Visita agendada', 'ATD-3015'],
      [-2, '07:30', 'Carlos Mendes', 'profissional', 'Serviço iniciado', 'ATD-3008'],
      [-2, '11:05', 'Juliana Rocha', 'mediador', 'Boleto de materiais emitido', 'PM-3007'],
      [-1, '08:30', 'Escola Pequeno Saber', 'cliente', 'Reclamação registrada', 'ATD-3003 · REC-01'],
      [-1, '10:40', 'Marcos Teixeira', 'profissional', 'Ocorrência de material registrada', 'PM-3006 · OC-01'],
      [-1, '10:50', 'Carlos Mendes', 'profissional', 'Visita técnica registrada', 'ATD-3015'],
      [-1, '15:00', 'Juliana Rocha', 'mediador', 'Materiais separados e faturados', 'PM-3009 · NF-e 18.204'],
      [-1, '16:20', 'Cond. Recanto das Águas', 'cliente', 'Pagamento de materiais confirmado (Pix)', 'PM-3014'],
      [-1, '17:30', 'Carlos Mendes', 'profissional', 'Mão de obra e lista técnica enviadas para conferência', 'ATD-3015 · mão de obra ' + A.money(950)],
      [0, '08:30', 'Juliana Rocha', 'mediador', 'Ordem de fabricação emitida', 'PM-3014 · OP-3014'],
      [0, '09:00', 'Juliana Rocha', 'mediador', 'Profissional designado', 'ATD-3013 · RL Calhas Sob Medida'],
      [0, '09:10', 'Juliana Rocha', 'mediador', 'Entrega registrada na obra', 'PM-3009'],
      [0, '09:10', 'Ana Beatriz Souza', 'profissional', 'Mão de obra e lista técnica enviadas para conferência', 'ATD-3012'],
      [0, '10:15', 'Juliana Rocha', 'mediador', 'Proposta conferida e materiais precificados', 'ATD-3015 · materiais ' + A.money(967.9)],
      [0, '10:20', 'Juliana Rocha', 'mediador', 'Proposta consolidada liberada ao cliente', 'ATD-3015'],
      [0, '10:40', 'Carlos Mendes', 'profissional', 'Material complementar solicitado', 'ATD-3008 · CMP-1'],
      [0, '11:40', 'Gustavo Ramos', 'cliente', 'Solicitação registrada', 'ATD-3017'],
    ]);
  }

  /* ------------------------------------------------------------------
     Regras e alertas
     ------------------------------------------------------------------ */
  function alertas(a) {
    const out = [];
    if (a.etapa === 'visita_realizada' && a.visita && a.visita.realizada && A.hoursSince(a.visita.realizada.ts) > 48) out.push({ t: 'Orçamento atrasado', d: 'Visita feita ' + A.ago(a.visita.realizada.ts) + ' e a proposta não foi enviada', tone: 'bad' });
    if (a.etapa === 'visita_agendada' && a.visita && A.hoursSince(a.visita.data) > 2) out.push({ t: 'Registro de visita pendente', d: 'Visita prevista para ' + A.fdt(a.visita.data), tone: 'warn' });
    if (a.etapa === 'orcamento_enviado' && a.orc && A.hoursSince(a.orc.enviado) > 8) out.push({ t: 'Conferência de proposta pendente', d: 'Enviada ' + A.ago(a.orc.enviado), tone: 'warn' });
    if (a.etapa === 'orcamento_liberado' && a.orc && a.orc.liberado && A.hoursSince(a.orc.liberado) > 72) out.push({ t: 'Cliente sem resposta à proposta', d: 'Liberada ' + A.ago(a.orc.liberado), tone: 'warn' });
    const pm = a.pm;
    if (pm) {
      if (pm.status === 'aguardando_pagamento' && a.orc.aprovadoEm && A.hoursSince(a.orc.aprovadoEm) > 24) out.push({ t: 'Pagamento dos materiais pendente', d: 'Proposta aprovada ' + A.ago(a.orc.aprovadoEm) + (pm.pag ? ' — ' + pm.pag.status.toLowerCase() : ''), tone: 'warn' });
      if (pm.status === 'pago' && pm.pag && A.hoursSince(pm.pag.ts) > 8) out.push({ t: 'Ordem de fabricação não emitida', d: 'Pagamento confirmado ' + A.ago(pm.pag.ts), tone: 'warn' });
      if (a.exec && !a.exec.inicio && inArr(pm.status, ['pago', 'producao', 'separado']) && A.dayDiff(a.exec.inicioPrev) <= 1) out.push({ t: 'Entrega ainda não programada', d: 'Início do serviço ' + A.when(a.exec.inicioPrev).toLowerCase(), tone: 'bad' });
      if (a.exec && !a.exec.inicio && pm.entrega && inArr(pm.status, ['programada', 'rota']) && A.dayDiff(pm.entrega.data) >= A.dayDiff(a.exec.inicioPrev)) out.push({ t: 'Entrega no dia do início ou depois', d: 'Entrega ' + A.when(pm.entrega.data, false).toLowerCase() + ', início ' + A.when(a.exec.inicioPrev, false).toLowerCase(), tone: 'bad' });
      if (pm.status === 'entregue' && pm.entrega && pm.entrega.ts && A.hoursSince(pm.entrega.ts) > 6) out.push({ t: 'Conferência de recebimento pendente', d: 'Entregue ' + A.ago(pm.entrega.ts), tone: 'warn' });
      pm.ocorrencias.filter((o) => o.status !== 'Resolvida').forEach((o) => out.push({ t: 'Ocorrência de material', d: o.tipo + ' — ' + o.desc, tone: 'bad' }));
      pm.complementos.filter((c) => c.status === 'solicitado').forEach((c) => out.push({ t: 'Complemento aguardando precificação', d: c.id + ' — ' + c.motivo, tone: 'warn' }));
    }
    if (a.etapa === 'execucao' && a.exec && new Date(a.exec.fimPrev) < new Date()) out.push({ t: 'Execução atrasada', d: 'Previsão era ' + A.fdt(a.exec.fimPrev) + ' — ' + prog(a) + '% concluído', tone: 'bad' });
    if (a.etapa === 'concluido' && a.conclusao && A.hoursSince(a.conclusao.ts) > 12) out.push({ t: 'Confirmação de conclusão pendente', d: 'Concluído ' + A.ago(a.conclusao.ts), tone: 'warn' });
    if (a.reclamacao && a.reclamacao.status !== 'Resolvida') out.push({ t: 'Reclamação ' + a.reclamacao.status.toLowerCase(), d: a.reclamacao.tipo, tone: 'bad' });
    (a.pendencias || []).filter((p) => p.status === 'Aberta').forEach((p) => out.push({ t: p.tipo, d: p.desc, tone: 'warn', manual: p.id }));
    return out;
  }
  const meus = () => {
    const p = A.profile();
    return db().atendimentos.filter((a) => (p === 'cliente' ? a.clienteId === MYCLI : p === 'profissional' ? a.pro === MYPRO : true));
  };
  const hist = (a, txt, vis) => a.hist.push({ ts: A.now(), txt: txt, by: A.me().nome, vis: vis || 'all' });
  const say = (a, txt, de) => a.msgs.push({ de: de || A.profile(), nome: A.me().nome, txt: txt, ts: A.now() });
  const sys = (a, txt) => a.msgs.push({ de: 'sistema', nome: '', txt: txt, ts: A.now() });
  const pev = (a, txt, by) => a.pm.ev.push({ ts: A.now(), txt: txt, by: by || A.me().nome });
  const pmsAll = () => db().atendimentos.filter((a) => a.pm);
  /** Pedidos que dependem de ação do AppCalhas */
  const pmAcaoMed = (a) => a.pm && (inArr(a.pm.status, ['pago', 'producao', 'separado', 'programada', 'rota']) || (a.pm.status === 'aguardando_pagamento' && a.pm.pag && a.pm.pag.forma === 'Boleto') || (openOc(a) || null) || a.pm.complementos.some((c) => inArr(c.status, ['solicitado', 'pago'])));
  const sincronia = (a) => {
    const pm = a.pm;
    if (!pm || !a.exec) return '';
    if (!pm.entrega) return A.badge('A programar', 'warn');
    const dd = A.dayDiff(pm.entrega.data) - A.dayDiff(a.exec.inicioPrev);
    return dd < 0 ? A.badge('Véspera ou antes', 'ok') : dd === 0 ? A.badge('Mesmo dia do início', 'warn') : A.badge('Após o início', 'bad');
  };
  const isoLocal = (iso) => new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16);

  /* ------------------------------------------------------------------
     Detalhe do atendimento (compartilhado pelos três perfis)
     ------------------------------------------------------------------ */
  function actionBar(a) {
    const p = A.profile(), B = [];
    const id = { id: a.id };
    const pm = a.pm, oc = openOc(a);
    if (p === 'mediador') {
      if (a.etapa === 'solicitado') B.push(A.b('Iniciar triagem', 'c3.triar', id, 'p', 'search'));
      if (a.etapa === 'triagem' || a.etapa === 'solicitado') B.push(A.b('Designar profissional', 'c3.designar', id, a.etapa === 'triagem' ? 'p' : '', 'user'));
      if (a.etapa === 'designado') B.push(A.b('Agendar visita', 'c3.agendar', id, 'p', 'calendar'));
      if (a.etapa === 'visita_agendada') B.push(A.b('Reagendar visita', 'c3.agendar', id, '', 'calendar'));
      if (a.etapa === 'visita_realizada') B.push(A.b('Cobrar proposta do profissional', 'c3.cobrar', id, 'p', 'bell'));
      if (a.etapa === 'orcamento_enviado') B.push(A.b('Conferir e precificar proposta', 'c3.conferir', id, 'p', 'clipboard'));
      if (a.etapa === 'orcamento_liberado') { B.push(A.b('Registrar aprovação do cliente', 'c3.aprovarPor', id, 'p', 'check')); B.push(A.b('Lembrar cliente', 'c3.lembrar', id, '', 'bell')); }
      if (pm) {
        const s = pm.status;
        if (s === 'aguardando_pagamento') { B.push(A.b('Registrar pagamento recebido', 'c3.pmPagoMed', id, 'p', 'money')); B.push(A.b('Lembrar pagamento', 'c3.pmLembrar', id, '', 'bell')); }
        if (s === 'pago') B.push(A.b('Emitir ordem de fabricação', 'c3.pmFabricar', id, 'p', 'tool'));
        if (s === 'producao') B.push(A.b('Concluir fabricação, separar e faturar', 'c3.pmSeparar', id, 'p', 'box'));
        if (s === 'separado') B.push(A.b('Programar entrega', 'c3.pmProgramar', id, 'p', 'calendar'));
        if (s === 'programada') { B.push(A.b('Despachar para entrega', 'c3.pmDespachar', id, 'p', 'truck')); B.push(A.b('Reprogramar entrega', 'c3.pmProgramar', id, '', 'calendar')); }
        if (s === 'rota') B.push(A.b('Registrar entrega na obra', 'c3.pmEntregue', id, 'p', 'check'));
        if (oc && oc.status === 'Aberta') B.push(A.b('Tratar ocorrência de material', 'c3.pmOcorr', id, 'dg', 'flag'));
        if (oc && oc.status === 'Em reposição') B.push(A.b('Registrar reposição entregue', 'c3.pmRepOk', id, 'ok', 'check'));
        pm.complementos.forEach((c) => {
          if (c.status === 'solicitado') B.push(A.b('Precificar complemento ' + c.id, 'c3.cmpPrecificar', { id: a.id, c: c.id }, 'p', 'receipt'));
          if (c.status === 'aguardando_cliente') B.push(A.b('Registrar aprovação do ' + c.id, 'c3.cmpPagarMed', { id: a.id, c: c.id }, '', 'check'));
          if (c.status === 'pago') B.push(A.b('Registrar entrega do ' + c.id, 'c3.cmpEntregue', { id: a.id, c: c.id }, 'ok', 'truck'));
        });
      }
      if (inArr(a.etapa, ['aprovado', 'preparo', 'pronto', 'execucao'])) B.push(A.b('Replanejar prazo', 'c3.replanejar', id, '', 'calendar'));
      if (a.etapa === 'concluido') B.push(A.b('Confirmar conclusão com o cliente', 'c3.confirmarMed', id, 'ok', 'phone'));
      if (a.etapa === 'encerrado' && !a.avaliacao) B.push(A.b('Solicitar avaliação', 'c3.solAval', id, '', 'star'));
      if (a.reclamacao && a.reclamacao.status !== 'Resolvida') B.push(A.b('Tratar reclamação', 'c3.tratarRec', id, 'dg', 'flag'));
      B.push(A.b('Registrar decisão', 'c3.decisao', id, 'gh', 'scale'));
      B.push(A.b('Registrar pendência', 'c3.pend', id, 'gh', 'alert'));
    } else if (p === 'profissional') {
      if (a.etapa === 'designado') B.push(A.b('Sugerir horários de visita', 'c3.sugerir', id, 'p', 'calendar'));
      if (a.etapa === 'visita_agendada') { if (!a.visita.confirmadaPro) B.push(A.b('Confirmar visita', 'c3.confVisPro', id, '', 'check')); B.push(A.b('Registrar visita', 'c3.regVisita', id, 'p', 'clipboard')); }
      if (a.etapa === 'visita_realizada') B.push(A.b(a.orc ? 'Revisar proposta' : 'Enviar mão de obra e lista de materiais', 'c3.orcamento', id, 'p', 'receipt'));
      if (pm && pm.status === 'entregue') B.push(A.b('Conferir materiais na obra', 'c3.pmConferir', id, 'p', 'clipboard'));
      if (a.etapa === 'pronto') B.push(A.b('Iniciar serviço', 'c3.iniciar', id, 'p', 'play'));
      if (a.etapa === 'execucao') { B.push(A.b('Atualizar etapas', 'c3.etapas', id, '', 'layers')); B.push(A.b('Concluir serviço', 'c3.concluir', id, 'ok', 'check')); }
      if (inArr(a.etapa, ['pronto', 'execucao'])) B.push(A.b('Solicitar material complementar', 'c3.cmpSolicitar', id, 'gh', 'cart'));
      if (a.reclamacao && a.reclamacao.encaminhada && a.reclamacao.status !== 'Resolvida') B.push(A.b('Registrar atendimento de garantia', 'c3.garantia', id, 'p', 'tool'));
    } else {
      if (a.etapa === 'visita_agendada') { if (!a.visita.confirmadaCli) B.push(A.b('Confirmar visita', 'c3.confVisCli', id, 'p', 'check')); B.push(A.b('Pedir outro horário', 'c3.outroHorario', id, '', 'calendar')); }
      if (a.etapa === 'orcamento_liberado') { B.push(A.b('Aprovar proposta', 'c3.aprovar', id, 'ok', 'check')); B.push(A.b('Solicitar ajuste', 'c3.ajuste', id, '', 'edit')); }
      if (pm && pm.status === 'aguardando_pagamento') B.push(pm.pag && pm.pag.forma === 'Boleto' ? A.b('Boleto emitido — aguardando compensação', 'c3.pagar', id, '', 'clock') : A.b('Pagar materiais — ' + A.money(pm.total), 'c3.pagar', id, 'ok', 'money'));
      if (pm) pm.complementos.forEach((c) => { if (c.status === 'aguardando_cliente') B.push(A.b('Aprovar e pagar complemento — ' + A.money(c.total), 'c3.cmpPagar', { id: a.id, c: c.id }, 'p', 'check')); });
      if (a.etapa === 'concluido') B.push(A.b('Confirmar conclusão e avaliar', 'c3.cliConfirma', id, 'ok', 'check'));
      if (a.etapa === 'encerrado' && !a.avaliacao) B.push(A.b('Avaliar atendimento', 'c3.avaliar', id, 'p', 'star'));
      if (inArr(a.etapa, ['aprovado', 'preparo', 'pronto', 'execucao', 'concluido', 'encerrado']) && !(a.reclamacao && a.reclamacao.status !== 'Resolvida')) B.push(A.b('Relatar problema', 'c3.reclamar', id, 'gh', 'flag'));
    }
    if (pm && pm.nf) B.push(A.b('Nota fiscal dos materiais', 'c3.nf', id, 'gh', 'file'));
    return B;
  }

  /** Tabela de materiais com origem e preço AppCalhas */
  function itensTable(itens, o) {
    o = o || {};
    return A.table([
      { l: 'Material', f: (x) => e(x.nome) + '<small>' + e(origem(x)) + '</small>' },
      { l: 'Qtd.', cls: 'r', f: (x) => e(qtdTxt(x)) },
      { l: 'Preço AppCalhas', cls: 'r', f: (x) => A.money(x.preco) },
      { l: 'Subtotal', cls: 'r', f: (x) => A.money(x.qtd * x.preco) },
    ].concat(o.conf ? [{ l: 'Conferência', f: (x) => (o.conf(x)) }] : []), itens, { empty: 'Sem materiais (somente mão de obra).', foot: o.noFoot ? null : ['Materiais (tabela)', '', '', A.money(A.sum(itens, (x) => x.qtd * x.preco))].concat(o.conf ? [''] : []) });
  }
  function matCalc(o, priced) {
    if (!priced) return '<div class="calc"><dl><dt>Materiais (tabela AppCalhas)</dt><dd>' + A.money(orcMat(o)) + '</dd><dt>Frete e condições</dt><dd>Definidos na conferência</dd></dl></div>';
    return '<div class="calc"><dl><dt>Materiais (tabela AppCalhas)</dt><dd>' + A.money(orcMat(o)) + '</dd>' + (orcDesc(o) ? '<dt>Desconto (' + A.num(o.descPct) + '%)</dt><dd>− ' + A.money(orcDesc(o)) + '</dd>' : '') + '<dt>Entrega na obra</dt><dd>' + (orcFrete(o) ? A.money(orcFrete(o)) : 'Grátis') + '</dd><dt class="tot">Total de materiais — pago ao AppCalhas</dt><dd class="tot">' + A.money(orcMatTot(o)) + '</dd></dl></div>';
  }
  function orcView(a) {
    const o = a.orc, p = A.profile();
    if (!o) return A.empty(a.etapa === 'visita_realizada' ? 'O profissional está preparando a mão de obra e a lista de materiais.' : 'A proposta é elaborada após a visita técnica.', 'receipt');
    if (p === 'cliente' && inArr(o.status, ['Em conferência', 'Devolvido'])) return A.empty('A proposta está sendo conferida e os materiais precificados pelo AppCalhas. Ela ficará disponível em breve.', 'clipboard');
    const priced = !inArr(o.status, ['Em conferência', 'Devolvido']) || o.frete != null;
    return '<div class="row mb16">' + A.badge(o.status) + '<span class="small muted">Versão ' + o.versao + ' — enviada em ' + A.fdt(o.enviado) + '</span></div>' +
      '<h4 style="margin:0 0 6px">Escopo</h4><p>' + e(o.escopo || '—') + '</p>' +
      '<div class="c3-blk"><div class="c3-blk-h">' + I('truck', 17) + '<b>1. Materiais — vendidos, faturados e entregues pelo AppCalhas</b></div>' +
      '<p class="small muted" style="margin:0 0 8px">Lista técnica definida pelo profissional (quantidades e especificação). Preços da tabela AppCalhas, com fabricação sob medida na fábrica própria.</p>' +
      itensTable(o.itens) + matCalc(o, priced) + (o.prazoPreparo ? '<p class="small muted" style="margin:8px 0 0">Prazo de preparo: ' + e(o.prazoPreparo) + ' após o pagamento. Entrega programada para a véspera do início do serviço.</p>' : '') + '</div>' +
      '<div class="c3-blk"><div class="c3-blk-h">' + I('tool', 17) + '<b>2. Mão de obra — executada e recebida pelo profissional</b></div>' +
      A.dl([['Valor da mão de obra', A.money(o.maoObra)], ['Condições de pagamento', e(o.condicoes)], ['Prazo de execução', o.prazo ? e(o.prazo) : A.badge('Não informado', 'bad')], ['Validade da proposta', A.fd(o.validade)], ['Observações', e(o.obs || '—')]]) + '</div>' +
      '<div class="calc c3-tot"><dl><dt>Materiais (AppCalhas)</dt><dd>' + (priced ? A.money(orcMatTot(o)) : A.money(orcMat(o)) + '*') + '</dd><dt>Mão de obra (profissional)</dt><dd>' + A.money(o.maoObra) + '</dd><dt class="tot">Investimento total do cliente</dt><dd class="tot">' + A.money(priced ? orcTotal(o) : orcMat(o) + (+o.maoObra || 0)) + '</dd></dl></div>' +
      (o.conferencia ? '<div class="mt"></div>' + A.note('Conferido e precificado pelo AppCalhas em ' + A.fdt(o.conferencia.ts) + ' (' + o.conferencia.checks.length + ' de ' + CONF.length + ' itens). O AppCalhas confere se a proposta está completa e define preço, frete e prazo dos materiais; medidas e dimensionamento são de responsabilidade do profissional.') : '') +
      (o.devolucao ? '<div class="mt"></div>' + A.note('<b>Devolvida para ajuste:</b> ' + e(o.devolucao), 'warn') : '') +
      (o.ajusteCliente ? '<div class="mt"></div>' + A.note('<b>Ajuste solicitado pelo cliente:</b> ' + e(o.ajusteCliente), 'warn') : '') +
      (o.aprovadoEm ? '<div class="mt"></div>' + A.note('Aprovada por ' + e(o.aprovadoPor) + ' em ' + A.fdt(o.aprovadoEm) + '. Materiais pagos ao AppCalhas; mão de obra paga ao profissional.', '', 'check') : '');
  }
  function mtView(a) {
    const o = a.orc, pm = a.pm, p = A.profile();
    if (!o) return A.empty('A lista técnica de materiais é definida pelo profissional após a visita e precificada pelo AppCalhas.', 'box');
    if (!o.itens.length) return A.empty('Este atendimento não utiliza materiais.', 'box');
    if (!pm) {
      if (p === 'cliente' && inArr(o.status, ['Em conferência', 'Devolvido'])) return A.empty('O AppCalhas está precificando os materiais.', 'clipboard');
      return A.note('Ao aprovar a proposta, o AppCalhas gera o pedido de materiais, recebe o pagamento, fabrica as peças sob medida, separa, emite a nota fiscal e entrega na obra na véspera do início do serviço.', '', 'truck') + '<div class="mt"></div>' + itensTable(o.itens) + matCalc(o, o.frete != null);
    }
    const oc = pm.ocorrencias;
    const confCol = pm.conf || oc.length ? (x) => { const bad = oc.some((k) => k.status !== 'Resolvida' && k.itens.indexOf(x.nome) >= 0); return bad ? A.badge('Divergência', 'bad') : pm.conf || pm.status === 'conferido' ? A.badge('Conferido', 'ok') : A.badge('Conferido', 'ok'); } : null;
    const ent = pm.entrega;
    return '<div class="row mb16"><b style="font-family:var(--font-d);font-size:17px">' + e(pm.id) + '</b>' + pmBadge(pm) + (pm.nf ? '<span class="small muted">' + e(pm.nf) + '</span>' : '') + '<span class="spacer"></span>' + (pm.entrega && pm.entrega.ts ? A.b('Comprovante de entrega', 'c3.comprovante', { id: a.id }, 'sm', 'file') : '') + '</div>' +
      A.stepper(PMSTEPS, pmStep(pm)) + '<div class="mt"></div>' +
      '<div class="g2"><div>' + A.dl([['Materiais (tabela)', A.money(pm.subtotal)], pm.desconto ? ['Desconto', '− ' + A.money(pm.desconto)] : null, ['Entrega na obra', pm.frete ? A.money(pm.frete) : 'Grátis'], ['Total pago ao AppCalhas', '<b>' + A.money(pm.total) + '</b>'], ['Pagamento', pm.pag ? e(pm.pag.forma) + ' — ' + A.badge(pm.pag.status === 'Confirmado' ? 'Confirmado' : pm.pag.status, pm.pag.status === 'Confirmado' ? 'ok' : 'warn') + (pm.pag.status === 'Confirmado' ? ' <small>' + A.fdt(pm.pag.ts) + '</small>' : '') : A.badge('Aguardando pagamento', 'warn')]]) + '</div>' +
      '<div>' + A.dl([['Ordem de fabricação', pm.fab ? e(pm.fab.op) + ' — previsão ' + A.fdt(pm.fab.prev) : '—'], ['Entrega', ent ? (ent.ts ? 'Entregue ' + A.when(ent.ts).toLowerCase() : A.when(ent.data, false) + ' — ' + e(ent.janela)) : 'A programar'], ['Endereço', e(endOf(a))], ['Recebedor', ent ? e(ent.recebidoPor || ent.recebedor) : '—'], ['Início do serviço', a.exec ? A.fdt(a.exec.inicioPrev) + ' ' + sincronia(a) : '—']]) + '</div></div>' +
      (p !== 'cliente' && pm.fab && pm.fab.obs ? '<div class="mt"></div>' + A.note('<b>Especificação para a fábrica:</b> ' + e(pm.fab.obs), '', 'tool') : '') +
      '<h4 style="margin:18px 0 8px">Itens do pedido</h4>' + itensTable(pm.itens, { conf: confCol, noFoot: true }) +
      (oc.length ? '<h4 style="margin:18px 0 8px">Ocorrências</h4>' + oc.map((k) => A.note('<b>' + e(k.id) + ' — ' + e(k.tipo) + ' (' + e(k.status) + '):</b> ' + e(k.desc) + ' <small>Itens: ' + e(k.itens.join(', ')) + '</small>' + (k.acoes.length ? '<br><small>' + k.acoes.map((x) => A.fdt(x.ts) + ' — ' + e(x.txt)).join('<br>') + '</small>' : ''), k.status === 'Resolvida' ? '' : 'bad')).join('<div style="height:8px"></div>') : '') +
      (pm.complementos.length ? '<h4 style="margin:18px 0 8px">Complementos de material</h4>' + A.table([{ l: 'Pedido', f: (c) => '<b>' + e(c.id) + '</b><small>' + A.fdt(c.ts) + ' — ' + e(c.por) + '</small>' }, { l: 'Itens', f: (c) => c.itens.map((x) => e(qtdTxt(x) + ' — ' + x.nome)).join('<br>') + '<small>' + e(c.motivo) + '</small>' }, { l: 'Valor', cls: 'r', f: (c) => (c.total ? A.money(c.total) : '—') }, { l: 'Situação', f: cmBadge }], pm.complementos) : '') +
      (p !== 'cliente' && pm.conf ? '<div class="mt"></div>' + A.note('Conferido na obra por ' + e(pm.conf.por) + ' em ' + A.fdt(pm.conf.ts) + '. ' + e(pm.conf.obs || ''), '', 'check') : '') +
      '<h4 style="margin:18px 0 8px">Rastreio do pedido</h4>' + A.timeline(pm.ev.slice().reverse().map((x) => ({ ts: x.ts, txt: x.txt, by: x.by })));
  }
  function vDetalhe() {
    const a = atd(A.sel('atendimento'));
    if (!a) return A.empty('Atendimento não encontrado.');
    const p = A.profile(), pf = a.pro ? pro(a.pro) : null, c = a.clienteId ? cli(a.clienteId) : null;
    const tab = A.tab('atd', 'resumo');
    const al = alertas(a);
    const showVal = a.orc && (p !== 'cliente' || !inArr(a.orc.status, ['Em conferência', 'Devolvido']));
    const tabs = [{ id: 'resumo', l: 'Resumo' }, { id: 'conversa', l: 'Conversa', n: a.msgs.filter((m) => m.de !== 'sistema').length }, { id: 'visita', l: 'Visita' }, { id: 'orcamento', l: 'Proposta' }, { id: 'materiais', l: 'Materiais e entrega' }, { id: 'execucao', l: 'Execução' }, { id: 'historico', l: 'Histórico' }];
    let body = '';
    if (tab === 'resumo') {
      body = '<div class="g2"><div>' + A.dl([['Serviço', e(srvName(a.srv))], ['Etapa atual', etBadge(a)], ['Cliente', e(nomeCli(a)) + (c && c.contato ? '<small> — ' + e(c.contato) + '</small>' : '')], ['Local', e(c ? c.bairro + ', ' + c.cidade : cidadeOf(a))], ['Profissional', pf ? e(pf.empresa) : 'A definir'], ['Materiais (AppCalhas)', showVal && a.orc.itens.length ? A.money(a.pm ? a.pm.total : orcMatTot(a.orc)) + (a.pm ? ' ' + pmBadge(a.pm) : '') : '—'], ['Mão de obra (profissional)', showVal ? A.money(a.orc.maoObra) : '—']]) + '<h4 style="margin:16px 0 6px">Descrição do cliente</h4><p>' + e(a.desc || '—') + '</p></div>' +
        '<div>' + (a.fotos.length ? '<div class="gal">' + a.fotos.map((f) => A.zoomable(f, 'Foto da solicitação')).join('') + '</div>' : A.empty('Sem fotos na solicitação.', 'image')) + '</div></div>' +
        (a.visita && a.etapa === 'visita_agendada' ? '<div class="mt"></div>' + A.note('Visita agendada para <b>' + A.when(a.visita.data) + '</b>. Profissional ' + (a.visita.confirmadaPro ? 'confirmou' : 'ainda não confirmou') + '; cliente ' + (a.visita.confirmadaCli ? 'confirmou' : 'ainda não confirmou') + '.', '', 'calendar') : '') +
        (a.pm && a.etapa !== 'encerrado' && a.etapa !== 'concluido' ? '<div class="mt"></div>' + A.note('<b>Materiais ' + e(a.pm.id) + ':</b> ' + e(PMS[a.pm.status][0]) + (a.pm.entrega ? ' — entrega ' + A.when(a.pm.entrega.data, false).toLowerCase() + ' (' + e(a.pm.entrega.janela) + ')' : '') + (a.exec && !a.exec.inicio ? '. Início do serviço previsto para ' + A.when(a.exec.inicioPrev).toLowerCase() + '.' : '.'), PMS[a.pm.status][1] === 'bad' ? 'bad' : '', 'truck') : '') +
        (a.exec && a.etapa === 'execucao' ? '<div class="mt"></div>' + A.note('Execução em andamento: <b>' + prog(a) + '%</b>. Previsão de término: ' + A.fdt(a.exec.fimPrev) + '.', '', 'layers') : '') +
        (a.reclamacao ? '<div class="mt"></div>' + A.note('<b>Reclamação ' + e(a.reclamacao.status.toLowerCase()) + ':</b> ' + e(a.reclamacao.tipo) + ' — ' + e(a.reclamacao.desc) + (a.reclamacao.acoes.length ? '<br><small>Última ação: ' + e(a.reclamacao.acoes[a.reclamacao.acoes.length - 1].txt) + '</small>' : ''), a.reclamacao.status === 'Resolvida' ? '' : 'bad') : '') +
        (a.avaliacao ? '<div class="mt"></div>' + A.note('Avaliação do cliente: ' + A.stars(a.avaliacao.nota) + ' ' + e(a.avaliacao.txt || ''), '', 'star') : '');
    } else if (tab === 'conversa') {
      body = A.note(p === 'mediador' ? 'Conversa entre cliente, profissional e AppCalhas. Tudo fica registrado no atendimento.' : 'O AppCalhas acompanha esta conversa e cuida de tudo o que envolve os materiais.') + '<div class="mt"></div>' + A.chat(a.msgs, 'c3.msg', a.id);
    } else if (tab === 'visita') {
      const v = a.visita;
      body = !v ? A.empty('A visita ainda não foi agendada.', 'calendar') : A.dl([['Data agendada', A.fdt(v.data)], ['Confirmação do profissional', v.confirmadaPro ? A.badge('Confirmado', 'ok') : A.badge('Pendente', 'warn')], ['Confirmação do cliente', v.confirmadaCli ? A.badge('Confirmado', 'ok') : A.badge('Pendente', 'warn')], ['Situação', v.realizada ? A.badge('Realizada') : A.badge('Agendada')]]) +
        (v.realizada ? '<h4 style="margin:16px 0 6px">Registro da visita</h4>' + A.dl([['Realizada em', A.fdt(v.realizada.ts)], ['Levantamento / medidas', e(v.realizada.medidas || '—')]], '') + '<p class="mt">' + e(v.realizada.diagnostico || '') + '</p>' + (v.realizada.fotos && v.realizada.fotos.length ? '<div class="gal">' + v.realizada.fotos.map((f) => A.zoomable(f, 'Foto da visita')).join('') + '</div>' : '') + '<div class="mt"></div>' + A.note('Medidas e dimensionamento são definidos pelo profissional responsável e viram a especificação de fabricação dos materiais.') : '');
    } else if (tab === 'orcamento') {
      body = orcView(a);
    } else if (tab === 'materiais') {
      body = mtView(a);
    } else if (tab === 'execucao') {
      body = !a.exec ? A.empty('A execução é planejada após a aprovação da proposta.', 'layers') : '<div class="bar" style="grid-template-columns:auto 1fr auto;margin-bottom:14px"><span>Andamento</span><span class="tr"><span class="fl" style="width:' + prog(a) + '%"></span></span><b>' + prog(a) + '%</b></div>' +
        A.dl([['Início previsto', A.fdt(a.exec.inicioPrev)], ['Término previsto', A.fdt(a.exec.fimPrev)], ['Início real', a.exec.inicio ? A.fdt(a.exec.inicio) : '—'], ['Conclusão', a.conclusao ? A.fdt(a.conclusao.ts) : '—']]) +
        (!a.exec.inicio && a.etapa !== 'pronto' ? '<div class="mt"></div>' + A.note('O início só é liberado depois que o profissional confere os materiais entregues pelo AppCalhas.', 'warn', 'truck') : '') +
        '<ul class="ul chk mt">' + a.exec.etapas.map((x) => '<li style="color:' + (x.ok ? 'inherit' : 'var(--muted)') + '">' + I(x.ok ? 'check' : 'clock', 15) + '<span>' + e(x.n) + (x.ok && x.ts ? ' <small class="muted">— ' + A.fdt(x.ts) + '</small>' : '') + '</span></li>').join('') + '</ul>' +
        (a.conclusao ? '<h4 style="margin:16px 0 6px">Conclusão</h4><p>' + e(a.conclusao.obs) + ' Garantia da mão de obra: ' + e(a.conclusao.garantia) + '.' + (a.conclusao.sobras ? ' Sobras de material: ' + e(a.conclusao.sobras.toLowerCase()) + '.' : '') + '</p>' + (a.conclusao.fotos.length ? '<div class="gal">' + a.conclusao.fotos.map((f) => A.zoomable(f, 'Foto da conclusão')).join('') + '</div>' : '') : '');
    } else {
      const ev = a.hist.filter((h) => p === 'mediador' || h.vis === 'all').map((h) => ({ ts: h.ts, txt: (h.vis === 'interno' ? '[interno] ' : '') + h.txt, by: h.by }));
      body = (p === 'mediador' ? '<h4 style="margin:0 0 8px">Decisões registradas</h4>' + (a.decisoes.length ? A.timeline(a.decisoes.slice().reverse().map((x) => ({ ts: x.ts, txt: x.txt, by: x.por, tone: 'ok' }))) : A.empty('Nenhuma decisão registrada.', 'scale')) + '<h4 style="margin:18px 0 8px">Linha do tempo</h4>' : '') + A.timeline(ev.reverse());
    }
    const acts = actionBar(a);
    const back = ['atendimentos', p === 'mediador' ? 'Atendimentos' : 'Meus atendimentos'];
    return A.ph(a.titulo, e(a.id) + ' — ' + e(nomeCli(a)) + ' — aberto em ' + A.fdt(a.ts), etBadge(a), back) +
      A.card(null, A.stepper(STEPS, stepOf(a))) +
      (al.length && p !== 'cliente' ? '<div class="mt"></div>' + al.map((x) => A.note('<b>' + e(x.t) + ':</b> ' + e(x.d), x.tone === 'bad' ? 'bad' : 'warn')).join('<div style="height:8px"></div>') : '') +
      '<div class="g21 mt"><div>' + A.card(null, A.tabs('atd', tabs) + body) + '</div><div class="stack">' +
      (acts.length ? A.card(p === 'mediador' ? 'Ações do AppCalhas' : 'O que fazer agora', '<div class="stack" style="gap:8px">' + acts.join('') + '</div>', { icon: p === 'mediador' ? 'shield' : 'flag' }) : '') +
      (a.pm ? A.card('Materiais AppCalhas', '<div class="row" style="gap:8px">' + pmBadge(a.pm) + '<b>' + A.money(a.pm.total) + '</b></div>' + A.stepper(PMSTEPS, pmStep(a.pm)).replace('class="stp"', 'class="stp c3-mini"') + '<div class="row mt"><span class="small muted">' + (a.pm.entrega ? 'Entrega ' + A.when(a.pm.entrega.data, false).toLowerCase() + ' — ' + e(a.pm.entrega.janela) : 'Entrega a programar') + '</span><span class="spacer"></span>' + A.b('Detalhes', 'core.tab', { scope: 'atd', id: 'materiais' }, 'sm', 'eye') + '</div>', { icon: 'truck' }) : '') +
      (pf ? A.card('Profissional responsável', '<div class="li">' + A.av(pf.empresa, pf.cor) + '<div class="lt"><b>' + e(pf.empresa) + '</b><small>' + e(pf.nome) + ' — ' + A.num(pf.nota, 1) + ' ★</small></div></div>' + (p !== 'profissional' ? A.dl([['Telefone', e(pf.tel)]], 'one') : ''), { icon: 'tool' }) : '') +
      (p !== 'cliente' && c ? A.card('Cliente', A.dl([['Nome', e(c.nome)], ['Telefone', e(c.tel)], ['Endereço', e(c.endereco + ' — ' + c.bairro + ', ' + c.cidade)]], 'one'), { icon: 'user' }) : '') +
      A.card('Acompanhamento AppCalhas', '<div class="li">' + A.av('Juliana Rocha', A.USERS.mediador.cor) + '<div class="lt"><b>Juliana Rocha</b><small>Mediadora responsável</small></div></div><p class="small muted mt">' + (p === 'cliente' ? 'Fale com o AppCalhas pela conversa do atendimento sempre que precisar.' : 'Acompanha prazos, conduz os materiais da precificação à entrega e registra decisões.') + '</p>', { icon: 'shield' }) +
      '</div></div>';
  }

  /* ------------------------------------------------------------------
     Listas por perfil
     ------------------------------------------------------------------ */
  function atdCard(a) {
    const pf = a.pro ? pro(a.pro) : null;
    const next = { solicitado: 'O AppCalhas vai analisar o pedido', triagem: 'Seleção do profissional', designado: 'Agendamento da visita', visita_agendada: 'Visita ' + (a.visita ? A.when(a.visita.data) : ''), visita_realizada: 'Profissional preparando a proposta', orcamento_enviado: 'AppCalhas conferindo e precificando', orcamento_liberado: 'Aprovação da proposta', aprovado: 'Pagamento dos materiais', preparo: 'Materiais: ' + (a.pm ? PMS[a.pm.status][0].toLowerCase() : ''), pronto: 'Início do serviço ' + (a.exec ? A.when(a.exec.inicioPrev).toLowerCase() : ''), execucao: 'Execução: ' + prog(a) + '%', concluido: 'Confirmação da conclusão', encerrado: a.avaliacao ? 'Atendimento avaliado' : 'Avaliação do atendimento' }[a.etapa];
    return '<section class="card"><div class="card-h">' + I('clipboard', 18) + '<h3>' + e(a.titulo) + '</h3><div class="card-r">' + etBadge(a) + '</div></div><div class="card-b"><div class="small muted mb16">' + e(a.id) + ' — ' + e(nomeCli(a)) + ' — ' + e(cidadeOf(a)) + (pf ? ' — ' + e(pf.empresa) : '') + '</div>' + A.stepper(STEPS, stepOf(a)) +
      '<div class="row mt"><span class="small">' + I('arrowR', 15) + ' Próximo passo: <b>' + e(next) + '</b></span><span class="spacer"></span>' + A.b('Conversa', 'c3.openChat', { id: a.id }, 'sm', 'chat') + A.nav('Abrir atendimento', 'atendimento', a.id, 'sm p', 'eye') + '</div></div></section>';
  }
  function vCliLista() {
    const list = meus().sort((a, b) => (a.ts < b.ts ? 1 : -1));
    return A.ph('Meus atendimentos', 'O AppCalhas acompanha cada etapa — visita, proposta, materiais, execução e pós-venda — e entrega os materiais na sua obra.', A.nav('Nova solicitação', 'nova', null, 'p', 'plus')) + (list.length ? '<div class="stack">' + list.map(atdCard).join('') + '</div>' : A.card(null, A.empty('Nenhum atendimento ainda.', 'inbox')));
  }
  function vCliNova() {
    const c = cli(MYCLI);
    return A.ph('Nova solicitação', 'Descreva a necessidade. O AppCalhas designa um profissional homologado, agenda a visita, cuida dos materiais e acompanha o atendimento até o fim.') +
      '<div class="g21"><div>' + A.card(null, '<form data-form="c3.novaSave" class="fg" autocomplete="off">' +
        '<div class="f"><label>Serviço <i class="req">*</i></label><select class="inp" name="srv" required>' + db().servicos.map((s) => '<option value="' + s.id + '"' + (s.id === 'SRV-05' ? ' selected' : '') + '>' + e(s.nome) + '</option>').join('') + '</select></div>' +
        '<div class="f"><label>Prioridade</label><select class="inp" name="prioridade"><option>Normal</option><option>Alta</option></select></div>' +
        '<div class="f full"><label>Título <i class="req">*</i></label><input class="inp" name="titulo" required value="Rufo do muro dos fundos soltando"></div>' +
        '<div class="f full"><label>Descrição <i class="req">*</i></label><textarea class="inp" name="desc" rows="4" required>O rufo do muro dos fundos está solto em dois pontos e a água escorre pela parede do vizinho.</textarea></div>' +
        '<div class="f full"><label>Endereço</label><input class="inp" name="endereco" value="' + e(c.endereco + ' — ' + c.bairro + ', ' + c.cidade) + '"></div>' +
        '<div class="f full"><label>Fotos</label><div class="pf"><label class="pf-up">' + I('camera', 22) + '<span><b>Escolher fotos do dispositivo</b><small>Simulação: as imagens ficam apenas neste navegador.</small></span><input type="file" name="fotos" accept="image/*" multiple data-preview="1"></label><div class="fprev"></div><div class="pf-or">Ou marque imagens ilustrativas:</div><div class="pf-pre" data-multi="fotos__preset">' + ['rufo', 'vazamento', 'calha-frontal', 'condutor'].map((k, i) => '<label class="pf-p"><input type="checkbox" name="fotos__preset" value="' + k + '"' + (i === 0 ? ' checked' : '') + '>' + A.photo(k) + '<small>' + e(A.ILL[k].l) + '</small></label>').join('') + '</div></div></div>' +
        '<div class="f full"><label class="ck single"><input type="checkbox" data-bool="1" name="consent" required checked><span>Autorizo o AppCalhas a compartilhar meus dados com o profissional designado para este atendimento, conforme a política de privacidade. <i class="req">*</i></span></label></div>' +
        '<div class="f full"><div class="row"><span class="spacer"></span><button class="btn p" type="submit">' + I('send', 16) + ' Enviar solicitação</button></div></div></form>') + '</div>' +
      '<div>' + A.card('Como funciona', '<ol class="ol"><li>Triagem e designação de um profissional homologado.</li><li>Visita técnica agendada e confirmada.</li><li>Proposta única: mão de obra do profissional + materiais do AppCalhas.</li><li>Você paga os materiais ao AppCalhas; a mão de obra, ao profissional.</li><li>O AppCalhas fabrica, separa e entrega os materiais na véspera do serviço.</li><li>Execução acompanhada, confirmação da conclusão e pós-venda.</li></ol>' + A.note('O profissional não vende materiais. Preço, nota fiscal, entrega, trocas e reposições de materiais são responsabilidade do AppCalhas.'), { icon: 'shield' }) + '</div></div>';
  }
  function vCliPedidos() {
    const list = meus().filter((a) => a.pm).sort((a, b) => (a.pm.criado < b.pm.criado ? 1 : -1));
    const pend = list.filter((a) => a.pm.status === 'aguardando_pagamento' || a.pm.complementos.some((c) => c.status === 'aguardando_cliente'));
    return A.ph('Materiais e pagamentos', 'Pedidos de materiais vendidos e entregues pelo AppCalhas: pagamento, fabricação, nota fiscal e entrega na obra.') +
      (pend.length ? A.note('Você tem ' + pend.length + ' pagamento(s) de materiais pendente(s).', 'warn', 'money') + '<div class="mt"></div>' : '') +
      (list.length ? '<div class="stack">' + list.map((a) => A.card(a.pm.id + ' — ' + a.titulo, A.stepper(PMSTEPS, pmStep(a.pm)) + '<div class="mt"></div>' + A.dl([['Total dos materiais', '<b>' + A.money(a.pm.total) + '</b>'], ['Pagamento', a.pm.pag ? e(a.pm.pag.forma) + ' — ' + e(a.pm.pag.status) : 'Pendente'], ['Entrega', a.pm.entrega ? A.when(a.pm.entrega.data, false) + ' — ' + e(a.pm.entrega.janela) : 'A programar (véspera do serviço)'], ['Nota fiscal', a.pm.nf ? e(a.pm.nf) : 'Emitida na separação']]) +
        '<div class="row mt"><span class="spacer"></span>' + (a.pm.status === 'aguardando_pagamento' && !(a.pm.pag && a.pm.pag.forma === 'Boleto') ? A.b('Pagar materiais', 'c3.pagar', { id: a.id }, 'sm ok', 'money') : '') + (a.pm.nf ? A.b('Nota fiscal', 'c3.nf', { id: a.id }, 'sm', 'file') : '') + A.nav('Abrir atendimento', 'atendimento', a.id, 'sm p', 'eye') + '</div>', { icon: 'truck', right: pmBadge(a.pm) })).join('') + '</div>' :
        A.card(null, A.empty('Os pedidos de materiais aparecem aqui quando você aprova uma proposta.', 'box')));
  }
  function vConversas() {
    const list = meus().filter((a) => a.msgs.length).sort((a, b) => (a.msgs[a.msgs.length - 1].ts < b.msgs[b.msgs.length - 1].ts ? 1 : -1));
    return A.ph('Conversas', A.profile() === 'mediador' ? 'Conversas de todos os atendimentos acompanhados, com cliente, profissional e AppCalhas.' : 'Conversas dos seus atendimentos. O AppCalhas participa de todas.') +
      A.card(null, list.length ? list.map((a) => { const m = a.msgs[a.msgs.length - 1]; return '<div class="li clk" data-act="c3.openChat" data-id="' + a.id + '">' + A.av(m.nome || 'AppCalhas') + '<div class="lt"><b>' + e(a.id) + ' — ' + e(a.titulo) + '</b><small>' + e(m.nome ? m.nome + ': ' : '') + e(m.txt.length > 110 ? m.txt.slice(0, 110) + '…' : m.txt) + '</small></div><span class="small muted nowrap">' + A.ago(m.ts) + '</span></div>'; }).join('') : A.empty('Nenhuma conversa.', 'chat'));
  }
  function vCliDados() {
    const c = cli(MYCLI);
    return A.ph('Meus dados', 'Usados pelo AppCalhas, pelo profissional designado e para a entrega dos materiais.', A.b('Editar dados', 'c3.cliEdit', {}, 'p', 'edit')) + A.card('Cadastro', A.dl([['Nome', e(c.nome)], ['Telefone', e(c.tel)], ['E-mail', e(c.email)], ['Endereço de entrega e serviço', e(c.endereco + ' — ' + c.bairro + ', ' + c.cidade)]]), { icon: 'user' });
  }
  /* Profissional */
  function vProAgenda() {
    const list = meus();
    const ev = [];
    list.forEach((a) => {
      if (a.visita && !a.visita.realizada) ev.push({ ts: a.visita.data, t: 'Visita técnica', a: a, ic: 'clipboard' });
      if (a.pm && a.pm.entrega && inArr(a.pm.status, ['programada', 'rota', 'entregue'])) ev.push({ ts: a.pm.entrega.data, t: a.pm.status === 'entregue' ? 'Materiais entregues — conferir' : 'Entrega de materiais AppCalhas (' + a.pm.entrega.janela + ')', a: a, ic: 'truck' });
      if (a.exec && inArr(a.etapa, ['aprovado', 'preparo', 'pronto', 'execucao'])) ev.push({ ts: a.exec.inicioPrev, t: a.etapa === 'execucao' ? 'Execução em andamento' : 'Início do serviço' + (a.etapa === 'pronto' ? ' (materiais conferidos)' : ' (aguardando materiais)'), a: a, ic: 'tool' });
      if (a.reclamacao && a.reclamacao.visitaGarantia && a.reclamacao.status !== 'Resolvida') ev.push({ ts: a.reclamacao.visitaGarantia, t: 'Visita de garantia', a: a, ic: 'shield' });
    });
    ev.sort((x, y) => (x.ts < y.ts ? -1 : 1));
    const days = [];
    for (let i = -1; i < 7; i++) days.push(i);
    const pend = list.filter((a) => actionBar(a).filter((b) => b.indexOf('c3.nf') < 0).length);
    return A.ph('Minha agenda', 'Visitas, entregas de materiais, execuções e retornos de garantia dos atendimentos acompanhados pelo AppCalhas.') +
      '<div class="g4 mb16">' + A.kpi({ l: 'Visitas agendadas', v: list.filter((a) => a.etapa === 'visita_agendada').length, icon: 'calendar' }) + A.kpi({ l: 'Propostas a enviar', v: list.filter((a) => a.etapa === 'visita_realizada').length, icon: 'receipt', tone: 'warn' }) + A.kpi({ l: 'Materiais a conferir', v: list.filter((a) => a.pm && a.pm.status === 'entregue').length, icon: 'truck', tone: 'warn' }) + A.kpi({ l: 'Serviços em execução', v: list.filter((a) => a.etapa === 'execucao').length, icon: 'tool' }) + '</div>' +
      '<div class="g21"><div>' + A.card('Próximos dias', days.map((dd) => {
        const dayEv = ev.filter((x) => A.dayDiff(x.ts) === dd || (dd === -1 && A.dayDiff(x.ts) < -1));
        if (!dayEv.length && dd !== 0) return '';
        const lbl = dd === -1 ? 'Atrasados / anteriores' : A.when(A.d(dd), false);
        return '<div style="margin-bottom:14px"><div class="small" style="font-weight:700;color:' + (dd === 0 ? 'var(--acc-ink)' : 'var(--ink-2)') + ';margin-bottom:4px">' + e(lbl) + (dd === 0 ? ' — hoje' : '') + '</div>' + (dayEv.length ? dayEv.map((x) => '<div class="li clk" data-act="core.nav" data-view="atendimento" data-id="' + x.a.id + '">' + I(x.ic, 18) + '<div class="lt"><b>' + A.ft(x.ts) + ' — ' + e(x.t) + '</b><small>' + e(x.a.id) + ' — ' + e(nomeCli(x.a)) + ' — ' + e(cidadeOf(x.a)) + '</small></div>' + etBadge(x.a) + '</div>').join('') : '<div class="small muted">Sem compromissos.</div>') + '</div>';
      }).join(''), { icon: 'calendar' }) + '</div>' +
      '<div>' + A.card('Ações pendentes', pend.length ? pend.map((a) => '<div class="li clk" data-act="core.nav" data-view="atendimento" data-id="' + a.id + '">' + I('flag', 18) + '<div class="lt"><b>' + e(a.id) + ' — ' + e(ET[a.etapa]) + '</b><small>' + e(a.titulo) + '</small></div>' + I('arrowR', 16) + '</div>').join('') : A.empty('Nada pendente.', 'check'), { icon: 'bell' }) + '</div></div>';
  }
  function vProLista() {
    const tab = A.tab('plist', 'ativos');
    const all = meus().sort((a, b) => (a.ts < b.ts ? 1 : -1));
    const ativo = (a) => a.etapa !== 'encerrado' || (a.reclamacao && a.reclamacao.status !== 'Resolvida');
    const list = all.filter((a) => (tab === 'ativos' ? ativo(a) : a.etapa === 'encerrado'));
    return A.ph('Meus atendimentos', 'Pedidos designados pelo AppCalhas para você.') + A.tabs('plist', [{ id: 'ativos', l: 'Em andamento', n: all.filter(ativo).length }, { id: 'enc', l: 'Encerrados', n: all.filter((a) => a.etapa === 'encerrado').length }]) +
      (list.length ? '<div class="stack">' + list.map(atdCard).join('') + '</div>' : A.card(null, A.empty('Nenhum atendimento nesta lista.')));
  }
  function vProMat() {
    const list = meus().filter((a) => a.pm && a.etapa !== 'encerrado');
    const conferir = list.filter((a) => a.pm.status === 'entregue');
    const proximas = list.filter((a) => inArr(a.pm.status, ['aguardando_pagamento', 'pago', 'producao', 'separado', 'programada', 'rota']));
    const ocorr = list.filter((a) => openOc(a) || a.pm.complementos.some((c) => c.status !== 'entregue'));
    const ok = list.filter((a) => a.pm.status === 'conferido' && inArr(a.etapa, ['pronto', 'execucao']));
    return A.ph('Materiais das obras', 'Você define a lista técnica e confere o recebimento. O AppCalhas vende, cobra, fabrica, entrega e repõe os materiais.') +
      A.note('Não cobre nem receba valores de materiais do cliente. Faltas, avarias ou medidas divergentes devem ser registradas na conferência para reposição pelo AppCalhas.', '', 'info') + '<div class="mt"></div>' +
      A.card('Conferir agora (' + conferir.length + ')', conferir.length ? conferir.map((a) => '<div class="li">' + I('truck', 18) + '<div class="lt"><b>' + e(a.pm.id) + ' — ' + e(a.titulo) + '</b><small>Entregue ' + A.ago(a.pm.entrega.ts) + ' — ' + e(endOf(a)) + ' — início ' + A.when(a.exec.inicioPrev).toLowerCase() + '</small></div>' + A.b('Conferir materiais', 'c3.pmConferir', { id: a.id }, 'sm p', 'clipboard') + '</div>').join('') : A.empty('Nenhuma entrega aguardando conferência.', 'check'), { icon: 'clipboard' }) + '<div class="mt"></div>' +
      A.card('Próximas entregas', A.table([{ l: 'Pedido', f: (a) => '<b>' + e(a.pm.id) + '</b><small>' + e(a.titulo) + '</small>' }, { l: 'Situação', f: (a) => pmBadge(a.pm) }, { l: 'Entrega', f: (a) => (a.pm.entrega ? A.when(a.pm.entrega.data, false) + '<small>' + e(a.pm.entrega.janela) + '</small>' : 'A programar') }, { l: 'Início do serviço', f: (a) => (a.exec ? A.fdtn(a.exec.inicioPrev) : '—') }, { l: '', cls: 'r', f: (a) => A.nav('Abrir', 'atendimento', a.id, 'sm', 'eye') }], proximas, { empty: 'Nenhuma entrega prevista.' }), { flush: true, icon: 'calendar' }) + '<div class="mt"></div>' +
      '<div class="g2">' + A.card('Ocorrências e complementos', ocorr.length ? ocorr.map((a) => { const oc = openOc(a); return '<div class="li clk" data-act="core.nav" data-view="atendimento" data-id="' + a.id + '">' + I(oc ? 'flag' : 'cart', 18) + '<div class="lt"><b>' + e(a.pm.id) + ' — ' + e(oc ? oc.tipo : 'Complemento') + '</b><small>' + e(oc ? oc.desc + ' (' + oc.status + ')' : a.pm.complementos.filter((c) => c.status !== 'entregue').map((c) => c.id + ': ' + CMS[c.status][0]).join('; ')) + '</small></div>' + I('arrowR', 16) + '</div>'; }).join('') : A.empty('Nada em aberto.', 'check'), { icon: 'alert' }) +
      A.card('Material conferido — pronto ou em obra', ok.length ? ok.map((a) => '<div class="li clk" data-act="core.nav" data-view="atendimento" data-id="' + a.id + '">' + I('check', 18) + '<div class="lt"><b>' + e(a.pm.id) + ' — ' + e(a.titulo) + '</b><small>' + e(ET[a.etapa]) + ' — ' + a.pm.itens.length + ' itens</small></div>' + I('arrowR', 16) + '</div>').join('') : A.empty('Nenhuma obra com material conferido.', 'box'), { icon: 'box' }) + '</div>';
  }
  /* Mediador */
  function vMedFila() {
    const d = db();
    const ativos = d.atendimentos.filter((a) => a.etapa !== 'encerrado' || (a.reclamacao && a.reclamacao.status !== 'Resolvida'));
    const cols = [
      { t: 'Pedidos novos', ic: 'inbox', f: (a) => inArr(a.etapa, ['solicitado', 'triagem']) },
      { t: 'Visitas', ic: 'calendar', f: (a) => a.etapa === 'designado' || (a.etapa === 'visita_agendada' && A.dayDiff(a.visita.data) <= 0) },
      { t: 'Propostas', ic: 'receipt', f: (a) => inArr(a.etapa, ['visita_realizada', 'orcamento_enviado', 'orcamento_liberado']) },
      { t: 'Materiais e entregas', ic: 'truck', f: (a) => inArr(a.etapa, ['aprovado', 'preparo']) || (a.pm && a.pm.complementos.some((c) => c.status !== 'entregue')) },
      { t: 'Serviços em andamento', ic: 'tool', f: (a) => inArr(a.etapa, ['pronto', 'execucao']) },
      { t: 'Precisam de solução', ic: 'alert', f: (a) => alertas(a).some((x) => x.tone === 'bad') || a.etapa === 'concluido' || (a.reclamacao && a.reclamacao.status !== 'Resolvida') },
    ];
    const all = d.atendimentos.filter((a) => A.inPeriod(a.ts, '30'));
    return A.ph('Fila do dia', 'Pedidos novos, visitas, propostas, materiais e entregas, serviços em andamento e situações que precisam de solução.', A.nav('Ver todos os atendimentos', 'atendimentos', null, '', 'clipboard')) +
      '<div class="g4 mb16">' + A.kpi({ l: 'Atendimentos ativos', v: ativos.length, icon: 'clipboard' }) + A.kpi({ l: 'Pedidos de materiais em curso', v: pmsAll().filter((a) => inArr(a.pm.status, PM_ATIVO)).length, s: A.kmoney(A.sum(pmsAll().filter((a) => inArr(a.pm.status, PM_ATIVO)), (a) => a.pm.total)) + ' em materiais', icon: 'truck' }) + A.kpi({ l: 'Alertas de prazo', v: ativos.filter((a) => alertas(a).length).length, icon: 'clock', tone: 'warn' }) + A.kpi({ l: 'Avaliação média (30 dias)', v: A.num(A.avg(all.filter((a) => a.avaliacao), (a) => a.avaliacao.nota) || A.avg(d.atendimentos.filter((a) => a.avaliacao), (a) => a.avaliacao.nota), 1), icon: 'star', tone: 'ok' }) + '</div>' +
      '<div class="kb">' + cols.map((c) => { const items = ativos.filter(c.f); return '<div class="kb-col"><div class="kb-h">' + I(c.ic, 16) + e(c.t) + '<span class="n">' + items.length + '</span></div>' + (items.length ? items.map((a) => { const al = alertas(a); return '<button type="button" class="kb-c ' + (al.some((x) => x.tone === 'bad') ? 'alert' : al.length ? 'warnb' : '') + '" data-act="core.nav" data-view="atendimento" data-id="' + a.id + '"><b>' + e(a.titulo) + '</b><small>' + e(a.id) + ' — ' + e(nomeCli(a)) + '</small>' + (a.pm && inArr(a.etapa, ['aprovado', 'preparo']) ? pmBadge(a.pm) : etBadge(a)) + (al.length ? '<small style="color:var(--bad)">' + e(al[0].t) + '</small>' : '') + (a.pro ? '<small>' + e(pro(a.pro).empresa) + '</small>' : '') + '</button>'; }).join('') : '<div class="small muted" style="padding:6px">Nada aqui.</div>') + '</div>'; }).join('') + '</div>';
  }
  function vMedLista() {
    const et = A.fv('mlist', 'et'), pf = A.fv('mlist', 'pro'), q = A.fv('mlist', 'q').toLowerCase(), al = A.fv('mlist', 'al');
    let list = db().atendimentos.slice();
    if (et) list = list.filter((a) => a.etapa === et);
    if (pf) list = list.filter((a) => a.pro === pf);
    if (al) list = list.filter((a) => alertas(a).length);
    if (q) list = list.filter((a) => (a.id + ' ' + a.titulo + ' ' + nomeCli(a) + ' ' + cidadeOf(a)).toLowerCase().indexOf(q) >= 0);
    list.sort((a, b) => (a.ts < b.ts ? 1 : -1));
    return A.ph('Atendimentos', 'Todos os atendimentos acompanhados, com etapa, materiais, prazos e responsáveis.', A.b('Registrar solicitação', 'c3.medNova', {}, 'p', 'plus')) +
      A.card(null, A.filters('mlist', [{ k: 'et', l: 'Etapa', o: A.opts(ETK.map((k) => ({ v: k, l: ET[k] })), 'Todas') }, { k: 'pro', l: 'Profissional', o: A.opts(db().pros.filter((p) => p.status === 'Ativo').map((p) => ({ v: p.id, l: p.empresa })), 'Todos') }, { k: 'al', l: 'Alertas', o: [{ v: '', l: 'Todos' }, { v: '1', l: 'Somente com alerta' }] }, { k: 'q', type: 'search', l: 'Buscar por código, cliente ou cidade' }]) + A.table([
        { l: 'Atendimento', f: (a) => '<b>' + e(a.id) + '</b><small>' + e(a.titulo) + '</small>' },
        { l: 'Cliente', f: (a) => e(nomeCli(a)) + '<small>' + e(cidadeOf(a)) + '</small>' },
        { l: 'Profissional', f: (a) => (a.pro ? e(pro(a.pro).empresa) : '—') },
        { l: 'Etapa', f: (a) => etBadge(a) },
        { l: 'Materiais', f: (a) => (a.pm ? pmBadge(a.pm) + '<small>' + A.money(a.pm.total) + '</small>' : '<span class="muted small">—</span>') },
        { l: 'Alertas', f: (a) => { const x = alertas(a); return x.length ? A.badge(x[0].t, x[0].tone === 'bad' ? 'bad' : 'warn') + (x.length > 1 ? '<small>+' + (x.length - 1) + '</small>' : '') : '<span class="muted small">—</span>'; } },
        { l: 'Total', cls: 'r', f: (a) => (a.orc ? A.money(orcTotal(a.orc)) : '—') },
        { l: '', cls: 'r', f: (a) => A.nav('Abrir', 'atendimento', a.id, 'sm', 'eye') },
      ], list.slice(0, 80)), { flush: true });
  }
  function vMedVisitas() {
    const list = db().atendimentos.filter((a) => a.visita && A.dayDiff(a.visita.data) >= -10).sort((a, b) => (a.visita.data < b.visita.data ? 1 : -1));
    const agendar = db().atendimentos.filter((a) => a.etapa === 'designado');
    return A.ph('Agenda de visitas', 'Combine visitas entre cliente e profissional e acompanhe as confirmações.') +
      (agendar.length ? A.card('Visitas a agendar (' + agendar.length + ')', agendar.map((a) => '<div class="li">' + I('calendar', 18) + '<div class="lt"><b>' + e(a.id) + ' — ' + e(a.titulo) + '</b><small>' + e(nomeCli(a)) + ' — ' + e(pro(a.pro).empresa) + '</small></div>' + A.b('Agendar visita', 'c3.agendar', { id: a.id }, 'sm p', 'calendar') + '</div>').join(''), { icon: 'inbox' }) + '<div class="mt"></div>' : '') +
      A.card('Visitas recentes e próximas', A.table([
        { l: 'Data', f: (a) => A.fdtn(a.visita.data) + '<small>' + A.when(a.visita.data, false) + '</small>' }, { l: 'Atendimento', f: (a) => '<b>' + e(a.id) + '</b><small>' + e(a.titulo) + '</small>' }, { l: 'Cliente', f: (a) => e(nomeCli(a)) }, { l: 'Profissional', f: (a) => e(pro(a.pro).empresa) },
        { l: 'Confirmações', f: (a) => (a.visita.confirmadaPro ? A.badge('Profissional', 'ok') : A.badge('Profissional', 'warn')) + ' ' + (a.visita.confirmadaCli ? A.badge('Cliente', 'ok') : A.badge('Cliente', 'warn')) },
        { l: 'Situação', f: (a) => (a.visita.realizada ? A.badge('Realizada') : A.hoursSince(a.visita.data) > 2 ? A.badge('Registro pendente', 'bad') : A.badge('Agendada')) },
        { l: '', cls: 'r', f: (a) => '<div class="acts-row" style="justify-content:flex-end">' + (!a.visita.realizada ? A.b('Reagendar', 'c3.agendar', { id: a.id }, 'sm', 'calendar') : '') + A.nav('Abrir', 'atendimento', a.id, 'sm', 'eye') + '</div>' },
      ], list), { flush: true, icon: 'calendar' });
  }
  function vMedPropostas() {
    const st = A.fv('prop', 'st');
    let list = db().atendimentos.filter((a) => a.orc && A.inPeriod(a.orc.enviado, '90'));
    if (st) list = list.filter((a) => a.orc.status === st);
    list.sort((a, b) => (a.orc.enviado < b.orc.enviado ? 1 : -1));
    return A.ph('Propostas', 'Confira escopo, mão de obra e prazos, precifique os materiais pela tabela AppCalhas e libere a proposta consolidada ao cliente.') +
      A.card(null, A.filters('prop', [{ k: 'st', l: 'Situação', o: A.opts(['Em conferência', 'Devolvido', 'Liberado ao cliente', 'Ajuste solicitado', 'Aprovado'], 'Todas') }]) + A.table([
        { l: 'Atendimento', f: (a) => '<b>' + e(a.id) + '</b><small>' + e(a.titulo) + '</small>' }, { l: 'Profissional', f: (a) => e(pro(a.pro).empresa) }, { l: 'Enviada', f: (a) => A.fdtn(a.orc.enviado) }, { l: 'Versão', cls: 'r', f: (a) => a.orc.versao },
        { l: 'Materiais', cls: 'r', f: (a) => A.money(a.orc.frete != null ? orcMatTot(a.orc) : orcMat(a.orc)) }, { l: 'Mão de obra', cls: 'r', f: (a) => A.money(a.orc.maoObra) }, { l: 'Conferência', f: (a) => (a.orc.conferencia ? a.orc.conferencia.checks.length + '/' + CONF.length : '—') }, { l: 'Situação', f: (a) => A.badge(a.orc.status) },
        { l: '', cls: 'r', f: (a) => '<div class="acts-row" style="justify-content:flex-end">' + (a.etapa === 'orcamento_enviado' ? A.b('Conferir', 'c3.conferir', { id: a.id }, 'sm p', 'clipboard') : '') + A.b('Ver', 'c3.verOrc', { id: a.id }, 'sm', 'eye') + '</div>' },
      ], list), { flush: true });
  }
  function vMedSup() {
    const ps = pmsAll();
    const ativos = ps.filter((a) => inArr(a.pm.status, PM_ATIVO) || a.pm.complementos.some((c) => c.status !== 'entregue'));
    const mes = ps.filter((a) => a.pm.pag && a.pm.pag.status === 'Confirmado' && A.inPeriod(a.pm.pag.ts, '30'));
    const rec = A.sum(mes, (a) => a.pm.subtotal - a.pm.desconto), cus = A.sum(mes, (a) => a.pm.custo);
    const cols = [
      { t: 'Aguardando pagamento', ic: 'money', f: (a) => a.pm.status === 'aguardando_pagamento' },
      { t: 'Fabricação', ic: 'tool', f: (a) => inArr(a.pm.status, ['pago', 'producao']) },
      { t: 'Separação e entrega', ic: 'calendar', f: (a) => inArr(a.pm.status, ['separado', 'programada', 'rota']) },
      { t: 'Conferência na obra', ic: 'clipboard', f: (a) => a.pm.status === 'entregue' },
      { t: 'Ocorrências e complementos', ic: 'alert', f: (a) => !!openOc(a) || a.pm.complementos.some((c) => c.status !== 'entregue') },
    ];
    const entHoje = ps.filter((a) => a.pm.entrega && inArr(a.pm.status, ['programada', 'rota']) && A.dayDiff(a.pm.entrega.data) <= 1);
    return A.ph('Materiais e entregas', 'Operação de materiais conduzida pelo AppCalhas: pagamento, ordem de fabricação para a fábrica, separação e nota fiscal, entrega na véspera do serviço, conferência na obra, ocorrências e complementos.', A.nav('Agenda de entregas', 'entregas', null, '', 'calendar')) +
      '<div class="g4 mb16">' + A.kpi({ l: 'Pedidos em andamento', v: ativos.length, s: A.kmoney(A.sum(ativos, (a) => a.pm.total)) + ' em materiais', icon: 'box' }) + A.kpi({ l: 'Entregas hoje e amanhã', v: entHoje.length, icon: 'truck' }) + A.kpi({ l: 'Ocorrências abertas', v: ps.filter((a) => openOc(a)).length, icon: 'flag', tone: 'bad' }) + A.kpi({ l: 'Margem bruta de materiais (30 dias)', v: A.pct(rec - cus, rec), s: A.kmoney(rec - cus) + ' sobre ' + A.kmoney(rec), icon: 'chart', tone: 'ok' }) + '</div>' +
      '<div class="kb c3-kb5">' + cols.map((c) => { const items = ativos.filter(c.f); return '<div class="kb-col"><div class="kb-h">' + I(c.ic, 16) + e(c.t) + '<span class="n">' + items.length + '</span></div>' + (items.length ? items.map((a) => { const oc = openOc(a); const cp = a.pm.complementos.find((k) => k.status !== 'entregue'); return '<button type="button" class="kb-c ' + (oc ? 'alert' : alertas(a).some((x) => /Pagamento|Entrega|Conferência|Ordem/.test(x.t)) ? 'warnb' : '') + '" data-act="c3.openMat" data-id="' + a.id + '"><b>' + e(a.pm.id) + ' — ' + A.money(a.pm.total) + '</b><small>' + e(a.titulo) + '</small><small>' + e(nomeCli(a)) + ' — ' + e(cidadeOf(a)) + '</small>' + (c.t.indexOf('Ocorr') === 0 ? (oc ? A.badge(oc.tipo, 'bad') : A.badge(cp.id + ': ' + CMS[cp.status][0], CMS[cp.status][1])) : pmBadge(a.pm)) + '<small>' + (a.pm.entrega ? 'Entrega ' + A.when(a.pm.entrega.data, false).toLowerCase() + ' (' + e(a.pm.entrega.janela) + ')' : 'Entrega a programar') + (a.exec ? ' · início ' + A.when(a.exec.inicioPrev, false).toLowerCase() : '') + '</small></button>'; }).join('') : '<div class="small muted" style="padding:6px">Nada aqui.</div>') + '</div>'; }).join('') + '</div>';
  }
  function vMedEntregas() {
    const list = pmsAll().filter((a) => inArr(a.pm.status, ['pago', 'producao', 'separado', 'programada', 'rota', 'entregue', 'ocorrencia']) || (a.pm.entrega && A.dayDiff(a.pm.entrega.data) >= -2 && a.etapa !== 'encerrado'))
      .sort((a, b) => ((a.pm.entrega ? a.pm.entrega.data : a.exec.inicioPrev) < (b.pm.entrega ? b.pm.entrega.data : b.exec.inicioPrev) ? -1 : 1));
    return A.ph('Agenda de entregas', 'Regra AppCalhas: o material chega na obra na véspera do início do serviço (ou antes) e é conferido pelo profissional antes da execução.') +
      A.card(null, A.table([
        { l: 'Entrega', f: (a) => (a.pm.entrega ? '<b>' + A.when(a.pm.entrega.data, false) + '</b><small>' + e(a.pm.entrega.janela) + '</small>' : A.badge('A programar', 'warn')) },
        { l: 'Pedido', f: (a) => '<b>' + e(a.pm.id) + '</b><small>' + e(a.id) + ' — ' + a.pm.itens.length + ' itens</small>' },
        { l: 'Cliente / endereço', f: (a) => e(nomeCli(a)) + '<small>' + e(endOf(a)) + '</small>' },
        { l: 'Veículo', f: (a) => (a.pm.entrega ? e(a.pm.entrega.veiculo) : '—') },
        { l: 'Início do serviço', f: (a) => (a.exec ? A.fdtn(a.exec.inicioPrev) : '—') },
        { l: 'Sincronia', f: (a) => sincronia(a) },
        { l: 'Situação', f: (a) => pmBadge(a.pm) },
        { l: '', cls: 'r', f: (a) => '<div class="acts-row" style="justify-content:flex-end">' + (a.pm.status === 'separado' ? A.b('Programar', 'c3.pmProgramar', { id: a.id }, 'sm p', 'calendar') : '') + (a.pm.status === 'programada' ? A.b('Despachar', 'c3.pmDespachar', { id: a.id }, 'sm p', 'truck') : '') + (a.pm.status === 'rota' ? A.b('Entregue', 'c3.pmEntregue', { id: a.id }, 'sm p', 'check') : '') + A.b('Abrir', 'c3.openMat', { id: a.id }, 'sm', 'eye') + '</div>' },
      ], list, { empty: 'Nenhuma entrega prevista.' }), { flush: true });
  }
  function vMedCat() {
    const list = db().materiais;
    return A.ph('Catálogo e preços', 'Tabela AppCalhas usada para precificar a lista técnica dos profissionais. Itens sob medida são produzidos na fábrica própria.', A.b('Ajustar preço', 'c3.catPreco', {}, 'p', 'edit')) +
      A.note('Preços e custos ilustrativos para a demonstração. A tabela real será definida com base nos custos de fabricação, frete e política comercial.', 'warn') + '<div class="mt"></div>' +
      A.card(null, A.table([
        { l: 'Código', k: 'id' }, { l: 'Item', f: (m) => '<b>' + e(m.nome) + '</b><small>' + e(m.un) + '</small>' }, { l: 'Origem', f: (m) => (m.fab ? A.badge('Fabricação própria', 'info') : A.badge(m.forn === 'FOR-1' ? 'Revenda própria' : 'Fornecedor parceiro', 'neutral')) + '<small>' + e(forn(m.forn).nome) + '</small>' },
        { l: 'Custo', cls: 'r', f: (m) => A.money(m.custo) }, { l: 'Preço AppCalhas', cls: 'r', f: (m) => '<b>' + A.money(m.preco) + '</b>' }, { l: 'Margem', cls: 'r', f: (m) => A.pct(m.preco - m.custo, m.preco) }, { l: 'Estoque', cls: 'r', f: (m) => A.num(m.estoque) }, { l: 'Prazo', f: (m) => e(m.prazo) },
      ], list), { flush: true });
  }
  function vMedForn() {
    const ps = pmsAll().filter((a) => A.inPeriod(a.pm.criado, '30'));
    return A.ph('Fornecedores', 'Fábrica própria como fornecedora principal e parceiros para itens de revenda.') +
      A.card(null, A.table([
        { l: 'Fornecedor', f: (f) => '<b>' + e(f.nome) + '</b><small>' + e(f.tipo) + '</small>' }, { l: 'Região', k: 'cidade' }, { l: 'Itens no catálogo', cls: 'r', f: (f) => db().materiais.filter((m) => m.forn === f.id).length },
        { l: 'Valor em pedidos (30 dias)', cls: 'r', f: (f) => A.money(A.sum(ps, (a) => A.sum(a.pm.itens.filter((x) => x.forn === f.id), (x) => x.qtd * x.preco))) }, { l: 'Prazo', k: 'prazo' }, { l: 'Contato', k: 'contato' },
      ], db().fornecedores), { flush: true });
  }
  function vMedPend() {
    const tab = A.tab('pend', 'pend');
    const rows = [];
    db().atendimentos.forEach((a) => alertas(a).filter((x) => !/^Reclamação/.test(x.t)).forEach((x) => rows.push(Object.assign({ a: a, id: a.id + x.t }, x))));
    const recs = db().atendimentos.filter((a) => a.reclamacao && (tab === 'rec' ? true : a.reclamacao.status !== 'Resolvida')).sort((a, b) => (a.reclamacao.ts < b.reclamacao.ts ? 1 : -1));
    const BT = { 'Orçamento atrasado': ['Cobrar', 'c3.cobrar', 'bell'], 'Execução atrasada': ['Replanejar', 'c3.replanejar', 'calendar'], 'Pagamento dos materiais pendente': ['Lembrar', 'c3.pmLembrar', 'bell'], 'Ordem de fabricação não emitida': ['Emitir OF', 'c3.pmFabricar', 'tool'], 'Ocorrência de material': ['Tratar', 'c3.pmOcorr', 'flag'], 'Complemento aguardando precificação': ['Abrir', 'c3.openMat', 'eye'], 'Conferência de recebimento pendente': ['Abrir', 'c3.openMat', 'eye'] };
    return A.ph('Pendências e reclamações', 'Atrasos, pagamentos, entregas, ocorrências de material e reclamações que precisam de acompanhamento até a solução.') +
      A.tabs('pend', [{ id: 'pend', l: 'Pendências e atrasos', n: rows.length }, { id: 'rec', l: 'Reclamações', n: db().atendimentos.filter((a) => a.reclamacao && a.reclamacao.status !== 'Resolvida').length }]) +
      (tab === 'pend' ? A.card(null, A.table([
        { l: 'Pendência', f: (r) => A.badge(r.t, r.tone === 'bad' ? 'bad' : 'warn') + '<small>' + e(r.d) + '</small>' }, { l: 'Atendimento', f: (r) => '<b>' + e(r.a.id) + '</b><small>' + e(r.a.titulo) + '</small>' }, { l: 'Profissional', f: (r) => (r.a.pro ? e(pro(r.a.pro).empresa) : '—') }, { l: 'Etapa', f: (r) => etBadge(r.a) },
        { l: '', cls: 'r', f: (r) => { const bt = r.manual ? null : BT[r.t]; return '<div class="acts-row" style="justify-content:flex-end">' + (r.manual ? A.b('Resolver', 'c3.pendOk', { id: r.a.id, p: r.manual }, 'sm ok', 'check') : bt && !(r.t === 'Ocorrência de material' && openOc(r.a) && openOc(r.a).status !== 'Aberta') ? A.b(bt[0], bt[1], { id: r.a.id }, 'sm p', bt[2]) : '') + A.nav('Abrir', 'atendimento', r.a.id, 'sm', 'eye') + '</div>'; } },
      ], rows, { empty: 'Nenhuma pendência em aberto.' }), { flush: true }) :
        A.card(null, A.table([
          { l: 'Registrada', f: (a) => A.fdtn(a.reclamacao.ts) }, { l: 'Atendimento', f: (a) => '<b>' + e(a.id) + '</b><small>' + e(nomeCli(a)) + '</small>' }, { l: 'Tipo', f: (a) => e(a.reclamacao.tipo) + '<small>' + e(a.reclamacao.desc) + '</small>' }, { l: 'Profissional', f: (a) => e(pro(a.pro).empresa) }, { l: 'Situação', f: (a) => A.badge(a.reclamacao.status) },
          { l: '', cls: 'r', f: (a) => '<div class="acts-row" style="justify-content:flex-end">' + (a.reclamacao.status !== 'Resolvida' ? A.b('Tratar', 'c3.tratarRec', { id: a.id }, 'sm dg', 'flag') : '') + A.nav('Abrir', 'atendimento', a.id, 'sm', 'eye') + '</div>' },
        ], recs, { empty: 'Nenhuma reclamação registrada.' }), { flush: true }));
  }
  function vMedPos() {
    const list = db().atendimentos.filter((a) => (a.etapa === 'concluido' || a.etapa === 'encerrado') && A.inPeriod(a.conclusao.ts, '90')).sort((a, b) => (a.conclusao.ts < b.conclusao.ts ? 1 : -1));
    const av = list.filter((a) => a.avaliacao);
    return A.ph('Pós-venda', 'Confirmação da conclusão com o cliente, avaliações e garantias (materiais e mão de obra).') +
      '<div class="g4 mb16">' + A.kpi({ l: 'Concluídos (90 dias)', v: list.length, icon: 'check' }) + A.kpi({ l: 'Aguardando confirmação', v: list.filter((a) => a.etapa === 'concluido').length, icon: 'clock', tone: 'warn' }) + A.kpi({ l: 'Avaliação média', v: A.num(A.avg(av, (a) => a.avaliacao.nota), 1), s: av.length + ' avaliações', icon: 'star', tone: 'ok' }) + A.kpi({ l: 'Sem avaliação', v: list.filter((a) => a.etapa === 'encerrado' && !a.avaliacao).length, icon: 'bell' }) + '</div>' +
      A.card(null, A.table([
        { l: 'Atendimento', f: (a) => '<b>' + e(a.id) + '</b><small>' + e(a.titulo) + '</small>' }, { l: 'Cliente', f: (a) => e(nomeCli(a)) }, { l: 'Concluído', f: (a) => A.fdtn(a.conclusao.ts) },
        { l: 'Garantia da mão de obra até', f: (a) => { const g = parseInt(a.conclusao.garantia, 10) || 12; const dt = new Date(a.conclusao.ts); dt.setMonth(dt.getMonth() + g); return A.fd(dt.toISOString()); } },
        { l: 'Confirmação', f: (a) => (a.etapa === 'concluido' ? A.badge('Pendente', 'warn') : A.badge('Confirmada', 'ok')) }, { l: 'Avaliação', f: (a) => (a.avaliacao ? A.stars(a.avaliacao.nota) : '—') },
        { l: '', cls: 'r', f: (a) => '<div class="acts-row" style="justify-content:flex-end">' + (a.etapa === 'concluido' ? A.b('Confirmar', 'c3.confirmarMed', { id: a.id }, 'sm ok', 'phone') : !a.avaliacao ? A.b('Solicitar avaliação', 'c3.solAval', { id: a.id }, 'sm', 'star') : '') + A.nav('Abrir', 'atendimento', a.id, 'sm', 'eye') + '</div>' },
      ], list), { flush: true });
  }
  function vMedPros() {
    const d = db();
    return A.ph('Profissionais', 'Parceiros homologados que executam a mão de obra dos atendimentos acompanhados.', A.b('Cadastrar profissional', 'c3.proNovo', {}, 'p', 'plus')) +
      A.card(null, A.table([
        { l: 'Profissional', f: (p) => '<div class="row" style="flex-wrap:nowrap">' + A.av(p.empresa, p.cor) + '<div><b>' + e(p.empresa) + '</b><small>' + e(p.nome) + ' — ' + e(p.tel) + '</small></div></div>' },
        { l: 'Regiões', f: (p) => e(p.regioes.join(', ')) },
        { l: 'Ativos', cls: 'r', f: (p) => d.atendimentos.filter((a) => a.pro === p.id && a.etapa !== 'encerrado').length },
        { l: 'Com alerta', cls: 'r', f: (p) => d.atendimentos.filter((a) => a.pro === p.id && alertas(a).length).length },
        { l: 'Materiais gerados (90 dias)', cls: 'r', f: (p) => A.kmoney(A.sum(d.atendimentos.filter((a) => a.pro === p.id && a.pm && A.inPeriod(a.pm.criado, '90')), (a) => a.pm.total)) },
        { l: 'Avaliação', cls: 'r', f: (p) => { const av = d.atendimentos.filter((a) => a.pro === p.id && a.avaliacao); return av.length ? A.num(A.avg(av, (a) => a.avaliacao.nota), 1) + ' ★' : '—'; } },
        { l: 'Situação', f: (p) => A.badge(p.status, p.status === 'Ativo' ? 'ok' : 'warn') },
      ], d.pros), { flush: true });
  }
  function vMedClientes() {
    return A.ph('Clientes', 'Clientes com atendimentos acompanhados.', A.b('Cadastrar cliente', 'c3.cliNovo', {}, 'p', 'plus')) +
      A.card(null, A.table([{ l: 'Cliente', f: (c) => '<b>' + e(c.nome) + '</b><small>' + e(c.contato || c.email) + '</small>' }, { l: 'Tipo', k: 'tipo' }, { l: 'Cidade', f: (c) => e(c.bairro + ', ' + c.cidade) }, { l: 'Telefone', k: 'tel' }, { l: 'Atendimentos', cls: 'r', f: (c) => db().atendimentos.filter((a) => a.clienteId === c.id).length }, { l: 'Materiais comprados', cls: 'r', f: (c) => A.money(A.sum(db().atendimentos.filter((a) => a.clienteId === c.id && a.pm && a.pm.pag && a.pm.pag.status === 'Confirmado'), (a) => a.pm.total)) }], db().clientes), { flush: true });
  }
  const days = (a, b) => (a && b ? (new Date(b) - new Date(a)) / 864e5 : null);
  function vMedRel() {
    const d = db(), tab = A.tab('rep', 'et');
    const per = A.fv('rep', 'per', '90'), pf = A.fv('rep', 'pro'), cid = A.fv('rep', 'cid');
    let list = d.atendimentos.filter((a) => A.inPeriod(a.ts, per));
    if (pf) list = list.filter((a) => a.pro === pf);
    if (cid) list = list.filter((a) => cidadeOf(a) === cid);
    const filt = A.filters('rep', [{ k: 'per', l: 'Período', def: '90', o: A.PERIODS }, { k: 'pro', l: 'Profissional', o: A.opts(d.pros.filter((p) => p.status === 'Ativo').map((p) => ({ v: p.id, l: p.empresa })), 'Todos') }, { k: 'cid', l: 'Cidade', o: A.opts(d.cidades, 'Todas') }]);
    const avgD = (k1, k2) => { const v = list.map((a) => days(a.m[k1], a.m[k2])).filter((x) => x != null && x >= 0); return v.length ? A.num(A.avg(v), 1) + ' dias' : '—'; };
    let body = '';
    if (tab === 'et') {
      body = '<div class="g4 mb16">' + A.kpi({ l: 'Solicitação → visita', v: avgD('criado', 'visita'), icon: 'calendar' }) + A.kpi({ l: 'Visita → proposta', v: avgD('visita', 'orcamento'), icon: 'receipt' }) + A.kpi({ l: 'Aprovação → materiais na obra', v: avgD('aprovado', 'entregue'), icon: 'truck' }) + A.kpi({ l: 'Aprovação → conclusão', v: avgD('aprovado', 'concluido'), icon: 'tool' }) + '</div>' +
        '<div class="g2 mb16">' + A.card('Atendimentos por etapa', A.bars(ETK.map((k) => ({ l: ET[k], v: list.filter((a) => a.etapa === k).length })).filter((x) => x.v))) + A.card('Alertas atuais por tipo', A.bars(A.toBars(A.count([].concat.apply([], d.atendimentos.map((a) => alertas(a))), (x) => x.t)))) + '</div>' +
        A.card('Atendimentos no período (' + list.length + ')', A.table([
          { l: 'Atendimento', f: (a) => '<b>' + e(a.id) + '</b><small>' + e(a.titulo) + '</small>' }, { l: 'Aberto', f: (a) => A.fdtn(a.ts) }, { l: 'Profissional', f: (a) => (a.pro ? e(pro(a.pro).empresa) : '—') }, { l: 'Etapa', f: (a) => etBadge(a) },
          { l: 'Dias até a proposta', cls: 'r', f: (a) => { const x = days(a.m.visita, a.m.orcamento); return x != null ? A.num(x, 1) : '—'; } }, { l: 'Total', cls: 'r', f: (a) => (a.orc ? A.money(orcTotal(a.orc)) : '—') },
          { l: '', cls: 'r', f: (a) => A.b('Detalhes', 'c3.repDet', { id: a.id }, 'sm', 'eye') },
        ], list.slice().sort((a, b) => (a.ts < b.ts ? 1 : -1))), { flush: true });
    } else if (tab === 'mat') {
      const ps = list.filter((a) => a.pm && a.pm.pag && a.pm.pag.status === 'Confirmado');
      const receita = A.sum(ps, (a) => a.pm.subtotal - a.pm.desconto), custo = A.sum(ps, (a) => a.pm.custo), frete = A.sum(ps, (a) => a.pm.frete);
      const ent = ps.filter((a) => a.pm.entrega && a.pm.entrega.ts && a.exec);
      const vesp = ent.filter((a) => (a.pm.vespera != null ? a.pm.vespera : A.dayDiff(a.pm.entrega.ts) < A.dayDiff(a.exec.inicio || a.exec.inicioPrev)));
      const oc = ps.filter((a) => a.pm.ocorrencias.length);
      const comMat = list.filter((a) => a.orc && a.orc.aprovadoEm && a.orc.itens.length);
      const byForn = {};
      ps.forEach((a) => a.pm.itens.forEach((x) => { const k = forn(x.forn).nome; byForn[k] = (byForn[k] || 0) + x.qtd * x.preco; }));
      const byItem = {};
      ps.forEach((a) => a.pm.itens.forEach((x) => { byItem[x.nome] = (byItem[x.nome] || 0) + x.qtd * x.preco; }));
      body = '<div class="g4 mb16">' + A.kpi({ l: 'Receita de materiais', v: A.kmoney(receita), s: ps.length + ' pedidos pagos + ' + A.kmoney(frete) + ' de frete', icon: 'money' }) + A.kpi({ l: 'Margem bruta de materiais', v: A.pct(receita - custo, receita), s: A.kmoney(receita - custo), icon: 'chart', tone: 'ok' }) + A.kpi({ l: 'Ticket médio de materiais', v: A.kmoney(A.avg(ps, (a) => a.pm.total)), icon: 'receipt' }) + A.kpi({ l: 'Entregas na véspera ou antes', v: A.pct(vesp.length, ent.length), s: 'Ocorrências em ' + A.pct(oc.length, ps.length) + ' dos pedidos', icon: 'truck', tone: vesp.length / Math.max(1, ent.length) >= 0.9 ? 'ok' : 'warn' }) + '</div>' +
        '<div class="g2 mb16">' + A.card('Receita de materiais por origem', A.bars(Object.keys(byForn).map((k) => ({ l: k, v: byForn[k] })).sort((a, b) => b.v - a.v), { money: true })) + A.card('Itens mais vendidos (R$)', A.bars(Object.keys(byItem).map((k) => ({ l: k, v: byItem[k] })).sort((a, b) => b.v - a.v).slice(0, 6), { money: true })) + '</div>' +
        A.note('Captura de materiais: ' + A.pct(comMat.filter((a) => a.pm).length, comMat.length) + ' das propostas aprovadas com materiais geraram pedido AppCalhas — por regra do modelo, o material sempre é vendido pelo AppCalhas. Prazo médio da aprovação à entrega na obra: ' + avgD('aprovado', 'entregue') + '.', '', 'info');
    } else if (tab === 'prop') {
      const pr = list.filter((a) => a.orc);
      const ap = pr.filter((a) => a.orc.aprovadoEm);
      const dev = pr.filter((a) => a.orc.devolucoes || a.orc.devolucao);
      body = '<div class="g4 mb16">' + A.kpi({ l: 'Propostas enviadas', v: pr.length, icon: 'receipt' }) + A.kpi({ l: 'Devolvidas na conferência', v: dev.length, s: A.pct(dev.length, pr.length) + ' das propostas', icon: 'swap', tone: 'warn' }) + A.kpi({ l: 'Taxa de aprovação', v: A.pct(ap.length, pr.filter((a) => a.orc.status !== 'Em conferência' && a.orc.status !== 'Devolvido').length), icon: 'check', tone: 'ok' }) + A.kpi({ l: 'Ticket médio aprovado', v: A.kmoney(A.avg(ap, (a) => orcTotal(a.orc))), s: 'Materiais ' + A.kmoney(A.avg(ap, (a) => orcMatTot(a.orc))) + ' + mão de obra ' + A.kmoney(A.avg(ap, (a) => a.orc.maoObra)), icon: 'money' }) + '</div>' +
        '<div class="g2">' + A.card('Valor aprovado por serviço', A.bars(Object.entries(ap.reduce((m, a) => { const k = srvName(a.srv); m[k] = (m[k] || 0) + orcTotal(a.orc); return m; }, {})).map((x) => ({ l: x[0], v: x[1] })).sort((a, b) => b.v - a.v), { money: true })) +
        A.card('Situação das propostas', A.bars(A.toBars(A.count(pr, (a) => a.orc.status)))) + '</div>';
    } else if (tab === 'pros') {
      const rows = d.pros.filter((p) => p.status === 'Ativo').map((p) => { const l = list.filter((a) => a.pro === p.id); const tor = l.map((a) => days(a.m.visita, a.m.orcamento)).filter((x) => x != null); const av = l.filter((a) => a.avaliacao); return { id: p.id, p: p, n: l.length, at: l.filter((a) => a.atrasou || alertas(a).some((x) => x.tone === 'bad')).length, tor: tor.length ? A.avg(tor) : null, nota: av.length ? A.avg(av, (a) => a.avaliacao.nota) : null, rec: l.filter((a) => a.reclamacao).length, mat: A.sum(l.filter((a) => a.pm), (a) => a.pm.total), val: A.sum(l.filter((a) => a.orc && a.orc.aprovadoEm), (a) => a.orc.maoObra) }; });
      body = '<div class="g2 mb16">' + A.card('Materiais gerados por profissional', A.bars(rows.map((r) => ({ l: r.p.empresa, v: r.mat })).sort((a, b) => b.v - a.v), { money: true })) + A.card('Dias médios entre visita e proposta', A.bars(rows.filter((r) => r.tor != null).map((r) => ({ l: r.p.empresa, v: r.tor, c: r.tor > 2 ? 'var(--bad)' : null })).sort((a, b) => b.v - a.v), { dec: 1, suffix: ' d' })) + '</div>' +
        A.card('Desempenho dos profissionais', A.table([{ l: 'Profissional', f: (r) => '<b>' + e(r.p.empresa) + '</b>' }, { l: 'Atendimentos', cls: 'r', k: 'n' }, { l: 'Com atraso', cls: 'r', k: 'at' }, { l: 'Visita → proposta', cls: 'r', f: (r) => (r.tor != null ? A.num(r.tor, 1) + ' d' : '—') }, { l: 'Avaliação', cls: 'r', f: (r) => (r.nota ? A.num(r.nota, 1) + ' ★' : '—') }, { l: 'Reclamações', cls: 'r', k: 'rec' }, { l: 'Materiais gerados', cls: 'r', f: (r) => A.money(r.mat) }, { l: 'Mão de obra aprovada', cls: 'r', f: (r) => A.money(r.val) }], rows), { flush: true });
    } else {
      const rec = list.filter((a) => a.reclamacao), av = list.filter((a) => a.avaliacao);
      body = '<div class="g4 mb16">' + A.kpi({ l: 'Avaliação média', v: A.num(A.avg(av, (a) => a.avaliacao.nota), 1), s: av.length + ' avaliações', icon: 'star', tone: 'ok' }) + A.kpi({ l: 'Reclamações', v: rec.length, icon: 'flag', tone: 'bad' }) + A.kpi({ l: 'Reclamações resolvidas', v: A.pct(rec.filter((a) => a.reclamacao.status === 'Resolvida').length, rec.length), icon: 'check' }) + A.kpi({ l: 'Atendimentos encerrados', v: list.filter((a) => a.etapa === 'encerrado').length, icon: 'clipboard' }) + '</div>' +
        '<div class="g2">' + A.card('Distribuição das notas', A.bars([5, 4, 3, 2, 1].map((n) => ({ l: n + ' estrelas', v: av.filter((a) => a.avaliacao.nota === n).length })))) + A.card('Reclamações por tipo', A.bars(A.toBars(A.count(rec, (a) => a.reclamacao.tipo)))) + '</div>';
    }
    return A.ph('Relatórios', 'Indicadores do modelo: prazos por etapa, materiais (receita, margem e entregas), propostas, desempenho dos profissionais e pós-venda.') +
      A.tabs('rep', [{ id: 'et', l: 'Etapas e prazos' }, { id: 'mat', l: 'Materiais e entregas' }, { id: 'prop', l: 'Propostas' }, { id: 'pros', l: 'Profissionais' }, { id: 'pos', l: 'Pós-venda' }]) + '<div class="card mb16" style="padding:12px 14px 0">' + filt + '</div>' + body;
  }

  /* ------------------------------------------------------------------
     Ações
     ------------------------------------------------------------------ */
  const go = (id, tab) => { if (tab) A.setTab('atd', tab); A.go('atendimento', id); };
  const fin = (a, msg, acao, tab, tone) => { A.log(acao, a.id); A.close(); if (tab) A.setTab('atd', tab); A.refresh(); A.toast(msg, tone); };
  /** Libera a execução quando os materiais estão conferidos. */
  const liberarExecucao = (a) => { if (inArr(a.etapa, ['aprovado', 'preparo'])) { a.etapa = 'pronto'; hist(a, 'Materiais conferidos — serviço liberado para início'); sys(a, 'Materiais conferidos na obra. Serviço liberado para início em ' + A.fdt(a.exec.inicioPrev) + '.'); } };
  function confirmarPagamento(a, forma, via) {
    const pm = a.pm;
    pm.pag = { forma: forma, status: 'Confirmado', ts: A.now() };
    pm.status = 'pago'; a.m.pago = A.now();
    if (a.etapa === 'aprovado') a.etapa = 'preparo';
    pev(a, 'Pagamento confirmado (' + forma.toLowerCase() + ')' + (via ? ' — ' + via : ''));
    hist(a, 'Pagamento dos materiais confirmado (' + forma.toLowerCase() + ')');
    sys(a, 'Pagamento dos materiais confirmado. O AppCalhas vai emitir a ordem de fabricação e programar a entrega para a véspera do serviço.');
    A.log('Pagamento de materiais confirmado (' + forma.toLowerCase() + ')', pm.id + ' · ' + A.money(pm.total));
  }
  const actions = {
    'c3.openChat': (ds) => go(ds.id, 'conversa'),
    'c3.openMat': (ds) => go(ds.id, 'materiais'),
    'c3.msg': (v) => { const a = atd(v.ref); say(a, v.txt); A.log('Mensagem enviada na conversa do atendimento', a.id); A.refresh(); },
    'c3.novaSave': (v) => {
      const d = db(), id = A.nextId('ATD-', d.atendimentos);
      const a = { id: id, ts: A.now(), clienteId: MYCLI, srv: v.srv, titulo: v.titulo, desc: v.desc, fotos: v.fotos || [], prioridade: v.prioridade, etapa: 'solicitado', pro: null, visita: null, orc: null, exec: null, pm: null, conclusao: null, avaliacao: null, reclamacao: null, pendencias: [], m: { criado: A.now() }, msgs: [], decisoes: [], hist: [] };
      hist(a, 'Solicitação recebida'); sys(a, 'Solicitação registrada. O AppCalhas vai acompanhar este atendimento.');
      d.atendimentos.push(a); A.log('Solicitação registrada', id + ' · ' + v.titulo); go(id, 'resumo'); A.toast('Solicitação ' + id + ' registrada. O AppCalhas vai designar o profissional.');
    },
    'c3.medNova': () => A.form({ title: 'Registrar solicitação (telefone ou WhatsApp)', submit: 'c3.medNovaSave', fields: [{ name: 'cliente', label: 'Cliente', type: 'select', options: db().clientes.map((c) => ({ v: c.id, l: c.nome })), required: true }, { name: 'srv', label: 'Serviço', type: 'select', options: db().servicos.map((s) => ({ v: s.id, l: s.nome })) }, { name: 'titulo', label: 'Título', required: true, value: 'Vazamento na calha da garagem', full: true }, { name: 'desc', label: 'Descrição', type: 'textarea', full: true, required: true, value: 'Cliente ligou relatando vazamento na calha da garagem.' }] }),
    'c3.medNovaSave': (v) => { const d = db(), id = A.nextId('ATD-', d.atendimentos); const a = { id: id, ts: A.now(), clienteId: v.cliente, srv: v.srv, titulo: v.titulo, desc: v.desc, fotos: [], prioridade: 'Normal', etapa: 'triagem', pro: null, visita: null, orc: null, exec: null, pm: null, conclusao: null, avaliacao: null, reclamacao: null, pendencias: [], m: { criado: A.now() }, msgs: [], decisoes: [], hist: [] }; hist(a, 'Solicitação registrada pelo AppCalhas (atendimento telefônico)'); d.atendimentos.push(a); A.log('Solicitação registrada pelo mediador', id); A.close(); go(id, 'resumo'); A.toast('Atendimento ' + id + ' criado em triagem.'); },
    'c3.triar': (ds) => { const a = atd(ds.id); a.etapa = 'triagem'; hist(a, 'Triagem iniciada pelo AppCalhas'); fin(a, 'Triagem iniciada.', 'Triagem iniciada'); },
    'c3.designar': (ds) => {
      const a = atd(ds.id), cid = cidadeOf(a);
      const opts = db().pros.filter((p) => p.status === 'Ativo').map((p) => ({ p: p, s: (p.regioes.indexOf(cid) >= 0 ? 2 : 0) + (p.servicos.indexOf(a.srv) >= 0 ? 1 : 0) })).sort((x, y) => y.s - x.s);
      A.form({ title: 'Designar profissional — ' + a.id, sub: srvName(a.srv) + ' em ' + cid, submit: 'c3.designarSave', extra: { id: a.id }, one: true, fields: [
        { name: 'pro', label: 'Profissional', type: 'radios', required: true, value: opts[0].p.id, options: opts.map((o) => ({ v: o.p.id, l: o.p.empresa + ' — ' + (o.p.regioes.indexOf(cid) >= 0 ? 'atende ' + cid : 'fora da região') + (o.p.servicos.indexOf(a.srv) >= 0 ? ', especialidade ok' : ', sem a especialidade') + ' — ' + A.num(o.p.nota, 1) + ' ★' })) },
        { name: 'msg', label: 'Mensagem de apresentação (conversa)', type: 'textarea', value: 'Olá! Vou acompanhar este atendimento. Já designei o profissional e em seguida combinamos a visita.' },
      ] });
    },
    'c3.designarSave': (v, x) => { const a = atd(x.id), p = pro(v.pro); a.pro = p.id; a.etapa = 'designado'; hist(a, 'Profissional designado: ' + p.empresa); if (v.msg) say(a, v.msg); A.log('Profissional designado', a.id + ' · ' + p.empresa); A.close(); A.refresh(); A.toast(p.empresa + ' designado. Próximo passo: agendar a visita.'); },
    'c3.agendar': (ds) => { const a = atd(ds.id); const dflt = a.visita ? a.visita.data : A.d(1, '09:00'); A.form({ title: (a.visita ? 'Reagendar' : 'Agendar') + ' visita — ' + a.id, submit: 'c3.agendarSave', extra: { id: a.id }, fields: [{ name: 'data', label: 'Data e horário', type: 'datetime-local', required: true, value: isoLocal(dflt) }, { name: 'motivo', label: a.visita ? 'Motivo do reagendamento' : 'Observação', value: a.visita ? 'Cliente pediu outro horário' : 'Horário combinado por telefone com as duas partes' }, { name: 'conf', type: 'check', text: 'Horário confirmado com cliente e profissional', value: true }] }); },
    'c3.agendarSave': (v, x) => { const a = atd(x.id); const re = !!a.visita; a.visita = { data: new Date(v.data).toISOString(), confirmadaPro: v.conf, confirmadaCli: v.conf, realizada: null }; a.etapa = 'visita_agendada'; hist(a, (re ? 'Visita reagendada para ' : 'Visita agendada para ') + A.fdt(a.visita.data)); say(a, (re ? 'Visita reagendada para ' : 'Visita agendada para ') + A.fdt(a.visita.data) + '.'); A.log(re ? 'Visita reagendada' : 'Visita agendada', a.id + ' · ' + A.fdt(a.visita.data)); A.close(); A.refresh(); A.toast('Visita ' + (re ? 'reagendada' : 'agendada') + ' para ' + A.when(a.visita.data) + '.'); },
    'c3.sugerir': (ds) => A.form({ title: 'Sugerir horários de visita', submit: 'c3.sugerirSave', extra: { id: ds.id }, one: true, fields: [{ name: 'txt', label: 'Mensagem para o AppCalhas e o cliente', type: 'textarea', required: true, value: 'Posso visitar amanhã às 9h ou às 14h. Qual fica melhor?' }] }),
    'c3.sugerirSave': (v, x) => { const a = atd(x.id); say(a, v.txt); fin(a, 'Sugestão enviada na conversa do atendimento.', 'Horários de visita sugeridos pelo profissional', 'conversa'); },
    'c3.confVisPro': (ds) => { const a = atd(ds.id); a.visita.confirmadaPro = true; hist(a, 'Profissional confirmou a visita'); fin(a, 'Visita confirmada.', 'Visita confirmada pelo profissional'); },
    'c3.confVisCli': (ds) => { const a = atd(ds.id); a.visita.confirmadaCli = true; hist(a, 'Cliente confirmou a visita'); fin(a, 'Visita confirmada.', 'Visita confirmada pelo cliente'); },
    'c3.outroHorario': (ds) => A.form({ title: 'Pedir outro horário', submit: 'c3.outroHorarioSave', extra: { id: ds.id }, one: true, fields: [{ name: 'txt', label: 'Sugestão de horário', type: 'textarea', required: true, value: 'Não estarei em casa nesse horário. Pode ser depois das 14h?' }] }),
    'c3.outroHorarioSave': (v, x) => { const a = atd(x.id); say(a, v.txt); a.pendencias.push({ id: 'PD' + Date.now(), tipo: 'Reagendar visita', desc: 'Cliente pediu outro horário', ts: A.now(), status: 'Aberta' }); fin(a, 'Pedido enviado. O AppCalhas vai reagendar com o profissional.', 'Cliente pediu outro horário de visita', 'conversa'); },
    'c3.regVisita': (ds) => A.form({ title: 'Registrar visita técnica', sub: 'Medidas e dimensionamento são de responsabilidade do profissional e viram a especificação de fabricação.', submit: 'c3.regVisitaSave', extra: { id: ds.id }, size: 'lg', fields: [
      { name: 'ts', label: 'Realizada em', type: 'datetime-local', required: true, value: isoLocal(A.now()) },
      { name: 'medidas', label: 'Levantamento / medidas', required: true, value: '32 m de calha; 4 descidas; 12 m de rufo' },
      { name: 'diag', label: 'Diagnóstico', type: 'textarea', full: true, required: true, value: 'Rufos com vedação ressecada no 2º andar e duas descidas com encaixe solto. Calhas em bom estado.' },
      { name: 'fotos', label: 'Fotos da visita', type: 'photos', full: true, presets: ['rufo', 'condutor', 'calha-frontal', 'vazamento'], preselect: ['rufo'] },
    ] }),
    'c3.regVisitaSave': (v, x) => { const a = atd(x.id); a.visita.realizada = { ts: new Date(v.ts).toISOString(), medidas: v.medidas, diagnostico: v.diag, fotos: v.fotos || [] }; a.etapa = 'visita_realizada'; a.m.visita = a.visita.realizada.ts; hist(a, 'Visita técnica realizada e registrada'); sys(a, 'Visita técnica registrada pelo profissional.'); fin(a, 'Visita registrada. Próximo passo: enviar mão de obra e lista de materiais.', 'Visita técnica registrada', 'visita'); },
    'c3.orcamento': (ds) => {
      const a = atd(ds.id), o = a.orc || {};
      A.form({ title: (a.orc ? 'Revisar' : 'Enviar') + ' proposta — ' + a.id, sub: 'Você informa a mão de obra e a lista técnica. Preço, frete e venda dos materiais são do AppCalhas.', submit: 'c3.orcSave', extra: { id: a.id }, size: 'lg', submitLabel: 'Enviar para conferência', icon: 'send',
        intro: a.orc && (a.orc.devolucao || a.orc.ajusteCliente) ? '<b>Ajuste solicitado:</b> ' + e(a.orc.devolucao || a.orc.ajusteCliente) : '',
        fields: [
          { name: 'escopo', label: 'Escopo do serviço', type: 'textarea', full: true, required: true, value: o.escopo || 'Revisão de calhas e rufos: troca de 12 m de rufo de encosto galvalume, reaperto e vedação das descidas, limpeza e teste de escoamento.' },
          { type: 'section', label: 'Lista técnica de materiais (quantidades e especificação)' },
          { name: 'itens', label: 'Materiais — preço da tabela AppCalhas, somente leitura', type: 'items', catalog: db().materiais, full: true, value: o.itens || [{ id: 'MAT-04', qtd: 12, preco: 42 }, { id: 'MAT-10', qtd: 3, preco: 32 }, { id: 'MAT-11', qtd: 6, preco: 6.5 }] },
          { type: 'section', label: 'Mão de obra (paga diretamente a você)' },
          { name: 'maoObra', label: 'Mão de obra / instalação (R$)', type: 'number', min: 0, step: 10, required: true, value: o.maoObra || 1100 },
          { name: 'prazo', label: 'Prazo de execução', value: o.prazo || '1 dia de execução', placeholder: 'Ex.: 2 dias de execução' },
          { name: 'validade', label: 'Validade da proposta', type: 'date', required: true, value: (o.validade || A.d(10)).slice(0, 10) },
          { name: 'condicoes', label: 'Condições de pagamento da mão de obra', type: 'select', options: COND, value: o.condicoes || COND[0] },
          { name: 'obs', label: 'Observações', full: true, value: o.obs || 'Garantia de 12 meses para a mão de obra.' },
          { type: 'html', html: '<div class="calc" id="c3calc"></div>' },
        ],
        calc: (f) => {
          f.querySelectorAll('.ied-p').forEach((inp) => { inp.readOnly = true; inp.tabIndex = -1; const tr = inp.closest('tr'); const sel = tr && tr.querySelector('.ied-m'); const m = sel && mat(sel.value); if (m) inp.value = m.preco; });
          const th = f.querySelectorAll('.ied-t thead th'); if (th[2]) th[2].textContent = 'Preço AppCalhas';
          const its = A.readItems(f.querySelector('.ied')); const m = A.sum(its, (x) => x.qtd * x.preco), mo = +f.maoObra.value || 0; const box = document.getElementById('c3calc');
          if (box) box.innerHTML = '<dl><dt>Materiais (tabela AppCalhas, sem frete)</dt><dd>' + A.money(m) + '</dd><dt>Mão de obra</dt><dd>' + A.money(mo) + '</dd><dt class="tot">Estimativa para o cliente</dt><dd class="tot">' + A.money(m + mo) + '</dd></dl><p class="small muted" style="margin:8px 0 0">Frete, condições e eventuais descontos dos materiais são definidos pelo AppCalhas na conferência.</p>';
        },
      });
    },
    'c3.orcSave': (v, x) => {
      const a = atd(x.id), prev = a.orc;
      a.orc = { versao: prev ? prev.versao + 1 : 1, itens: norm(v.itens), maoObra: +v.maoObra, prazo: v.prazo, validade: new Date(v.validade + 'T12:00').toISOString(), condicoes: v.condicoes, escopo: v.escopo, obs: v.obs, enviado: A.now(), status: 'Em conferência', devolucoes: prev ? (prev.devolucoes || 0) + (prev.devolucao ? 1 : 0) : 0 };
      a.etapa = 'orcamento_enviado'; a.m.orcamento = A.now();
      hist(a, 'Mão de obra e lista técnica ' + (prev ? 'revisadas (versão ' + a.orc.versao + ')' : 'enviadas') + ' para conferência do AppCalhas'); sys(a, 'Proposta enviada para conferência e precificação dos materiais pelo AppCalhas.');
      A.log('Mão de obra e lista técnica enviadas para conferência', a.id + ' · mão de obra ' + A.money(a.orc.maoObra)); A.close(); A.setTab('atd', 'orcamento'); A.refresh(); A.toast('Proposta enviada. O AppCalhas vai conferir e precificar os materiais.');
    },
    'c3.conferir': (ds) => {
      const a = atd(ds.id), o = a.orc;
      o.itens = norm(o.itens);
      const auto = { escopo: !!(o.escopo && o.escopo.length > 15), materiais: o.itens.length > 0, instalacao: +o.maoObra > 0, prazo: !!(o.prazo && o.prazo.trim()), condicoes: !!(o.validade && o.condicoes) };
      const falta = CONF.filter((c) => !auto[c[0]]).map((c) => c[1]);
      const fs = freteSug(cidadeOf(a), orcMat(o));
      A.form({ title: 'Conferir e precificar — ' + a.id, sub: pro(a.pro).empresa + ' — mão de obra ' + A.money(o.maoObra), submit: 'c3.conferirSave', extra: { id: a.id }, size: 'lg', submitLabel: 'Registrar conferência', icon: 'clipboard',
        intro: 'O AppCalhas confere se a proposta está completa e define o preço dos materiais pela tabela AppCalhas, o frete e o prazo de preparo. Medidas e dimensionamento são decisões técnicas do profissional.',
        fields: [
          { type: 'section', label: 'Conferência da proposta' },
          { name: 'checks', label: 'Itens conferidos', type: 'checks', options: CONF.map((c) => ({ v: c[0], l: c[1] })), value: CONF.filter((c) => auto[c[0]]).map((c) => c[0]), full: true },
          { type: 'section', label: 'Precificação dos materiais (AppCalhas)' },
          { type: 'html', html: itensTable(o.itens) },
          { name: 'frete', label: 'Entrega na obra (R$)', type: 'number', min: 0, step: 1, value: o.frete != null ? o.frete : fs, help: 'Regra: grátis acima de R$ 1.500; R$ 69 na capital; R$ 99 na Grande SP.' },
          { name: 'descPct', label: 'Desconto nos materiais', type: 'select', options: [{ v: 0, l: 'Sem desconto' }, { v: 3, l: '3% (alçada da mediação)' }, { v: 5, l: '5% (alçada da mediação, pedidos acima de R$ 2.000)' }, { v: 8, l: '8% (exige aprovação da gerência)' }], value: o.descPct || 0 },
          { name: 'prazoPreparo', label: 'Prazo de preparo após o pagamento', type: 'select', options: ['1 dia útil', '2 dias úteis', '3 dias úteis'], value: o.prazoPreparo || (o.itens.some((x) => x.fab) ? '1 dia útil' : '1 dia útil') },
          { type: 'html', html: '<div class="calc" id="c3conf"></div>' },
          { type: 'section', label: 'Decisão' },
          { name: 'decisao', label: 'Decisão', type: 'radios', required: true, full: true, value: falta.length ? 'devolver' : 'liberar', options: [{ v: 'liberar', l: 'Liberar proposta consolidada ao cliente' }, { v: 'devolver', l: 'Devolver ao profissional para ajuste' }] },
          { name: 'obs', label: 'Observação', type: 'textarea', full: true, value: falta.length ? 'Faltou informar: ' + falta.join(', ').toLowerCase() + '.' : 'Proposta completa. Materiais precificados pela tabela AppCalhas.' },
        ],
        calc: (f) => { const fr = +f.frete.value || 0, dp = +f.descPct.value || 0; const tmp = { itens: o.itens, frete: fr, descPct: dp, maoObra: o.maoObra }; const box = document.getElementById('c3conf'); if (box) box.innerHTML = '<dl><dt>Materiais (tabela)</dt><dd>' + A.money(orcMat(tmp)) + '</dd><dt>Desconto</dt><dd>− ' + A.money(orcDesc(tmp)) + '</dd><dt>Entrega na obra</dt><dd>' + A.money(fr) + '</dd><dt>Total de materiais (AppCalhas)</dt><dd>' + A.money(orcMatTot(tmp)) + '</dd><dt>Mão de obra (profissional)</dt><dd>' + A.money(o.maoObra) + '</dd><dt class="tot">Total para o cliente</dt><dd class="tot">' + A.money(orcTotal(tmp)) + '</dd><dt>Margem bruta estimada dos materiais</dt><dd>' + A.pct(orcMat(tmp) - orcDesc(tmp) - custoMat(o.itens), orcMat(tmp) - orcDesc(tmp)) + '</dd></dl>'; },
      });
    },
    'c3.conferirSave': (v, x) => {
      const a = atd(x.id), o = a.orc;
      if (v.decisao === 'liberar' && v.checks.length < CONF.length) { A.toast('Para liberar, todos os itens precisam estar conferidos. Devolva a proposta ao profissional para ajuste.', 'warn'); return; }
      if (v.decisao === 'liberar' && +v.descPct > 5) { A.toast('Desconto acima de 5% exige aprovação da gerência. Registre a decisão antes de liberar.', 'warn'); return; }
      o.conferencia = { por: A.me().nome, ts: A.now(), checks: v.checks, obs: v.obs };
      o.frete = +v.frete || 0; o.descPct = +v.descPct || 0; o.prazoPreparo = v.prazoPreparo;
      if (v.decisao === 'liberar') { o.status = 'Liberado ao cliente'; o.liberado = A.now(); o.devolucao = ''; a.etapa = 'orcamento_liberado'; hist(a, 'Proposta conferida, materiais precificados e proposta consolidada liberada ao cliente'); say(a, 'Proposta conferida. Materiais: ' + A.money(orcMatTot(o)) + ' (pagos e entregues pelo AppCalhas). Mão de obra: ' + A.money(o.maoObra) + ' (paga ao profissional). Já está disponível para aprovação.'); fin(a, 'Proposta consolidada liberada ao cliente.', 'Proposta conferida, precificada e liberada ao cliente', 'orcamento'); }
      else { o.status = 'Devolvido'; o.devolucao = v.obs; a.etapa = 'visita_realizada'; hist(a, 'Proposta devolvida ao profissional para ajuste', 'interno'); say(a, 'Proposta devolvida para ajuste: ' + v.obs); fin(a, 'Proposta devolvida ao profissional para ajuste.', 'Proposta devolvida ao profissional para ajuste', 'orcamento'); }
    },
    'c3.verOrc': (ds) => { const a = atd(ds.id); A.modal({ title: 'Proposta — ' + a.id, sub: a.titulo + ' — ' + pro(a.pro).empresa, size: 'lg', body: orcView(a), foot: '<button class="btn" data-act="core.close">Fechar</button>' + A.nav('Abrir atendimento', 'atendimento', a.id, 'p') }); },
    'c3.cobrar': (ds) => { const a = atd(ds.id), p = pro(a.pro); say(a, A.first(p.nome) + ', ainda não recebemos a proposta da visita de ' + A.fd(a.visita.realizada.ts) + '. Consegue enviar a mão de obra e a lista de materiais até amanhã? O cliente está aguardando.', 'mediador'); hist(a, 'AppCalhas cobrou o envio da proposta', 'interno'); a.decisoes.push({ ts: A.now(), por: A.me().nome, txt: 'Cobrança de proposta enviada a ' + p.empresa + '; cliente informado do novo prazo.' }); say(a, 'Cobramos a proposta do profissional e avisamos assim que chegar.'); fin(a, 'Cobrança enviada ao profissional e cliente atualizado (simulação).', 'Cobrança de proposta enviada ao profissional', 'conversa'); },
    'c3.lembrar': (ds) => { const a = atd(ds.id); say(a, 'Olá! A proposta está disponível para aprovação até ' + A.fd(a.orc.validade) + '. Posso ajudar com alguma dúvida?'); fin(a, 'Lembrete enviado ao cliente (simulação).', 'Lembrete de aprovação enviado ao cliente', 'conversa'); },
    'c3.aprovar': (ds) => { const a = atd(ds.id), o = a.orc; A.confirm({ title: 'Aprovar proposta', msg: 'Aprovar a proposta de <b>' + A.money(orcTotal(o)) + '</b>?<br><br>' + A.dl([['Materiais — pagos ao AppCalhas', A.money(orcMatTot(o))], ['Mão de obra — paga a ' + e(pro(a.pro).empresa), A.money(o.maoObra)]], 'one'), note: 'Depois de aprovar, você paga os materiais pelo app (Pix, cartão ou boleto). O AppCalhas fabrica, emite a nota fiscal e entrega na véspera do serviço. A mão de obra é paga ao profissional nas condições da proposta.', ok: 'Aprovar proposta', onOk: () => aprovar(a, A.me().nome, 'pela plataforma') }); },
    'c3.aprovarPor': (ds) => A.form({ title: 'Registrar aprovação do cliente', sub: 'Use quando o cliente aprovar por telefone ou mensagem.', submit: 'c3.aprovarPorSave', extra: { id: ds.id }, one: true, fields: [{ name: 'canal', label: 'Canal da aprovação', type: 'select', options: ['Telefone', 'WhatsApp', 'E-mail'] }, { name: 'obs', label: 'Registro', type: 'textarea', required: true, value: 'Cliente aprovou por telefone às ' + A.ft(A.now()) + ', sem alterações. Link de pagamento dos materiais enviado.' }] }),
    'c3.aprovarPorSave': (v, x) => { const a = atd(x.id); a.decisoes.push({ ts: A.now(), por: A.me().nome, txt: 'Aprovação do cliente registrada via ' + v.canal.toLowerCase() + ': ' + v.obs }); aprovar(a, nomeCli(a) + ' (registrado por ' + A.me().nome + ')', 'via ' + v.canal.toLowerCase()); },
    'c3.ajuste': (ds) => A.form({ title: 'Solicitar ajuste na proposta', submit: 'c3.ajusteSave', extra: { id: ds.id }, one: true, fields: [{ name: 'txt', label: 'O que precisa ser ajustado?', type: 'textarea', required: true, value: 'É possível incluir tela protetora contra folhas na calha nova?' }] }),
    'c3.ajusteSave': (v, x) => { const a = atd(x.id); a.orc.status = 'Ajuste solicitado'; a.orc.ajusteCliente = v.txt; a.etapa = 'visita_realizada'; hist(a, 'Cliente solicitou ajuste na proposta'); say(a, 'Gostaria de um ajuste na proposta: ' + v.txt); fin(a, 'Ajuste solicitado. O profissional vai revisar a proposta.', 'Ajuste na proposta solicitado pelo cliente', 'conversa'); },

    /* ---------- Materiais: pagamento ---------- */
    'c3.pagar': (ds) => {
      const a = atd(ds.id), pm = a.pm;
      if (pm.pag && pm.pag.forma === 'Boleto' && pm.status === 'aguardando_pagamento') { A.modal({ title: 'Boleto dos materiais — ' + pm.id, size: 'sm', body: A.note('Boleto de <b>' + A.money(pm.total) + '</b> emitido em ' + A.fdt(pm.pag.ts) + '. O AppCalhas confirma assim que o banco compensar (até 2 dias úteis).', '', 'clock') }); return; }
      A.form({ title: 'Pagar materiais — ' + pm.id, sub: 'Valor: ' + A.money(pm.total) + ' — recebido pelo AppCalhas', submit: 'c3.pagarSave', extra: { id: a.id }, one: true, submitLabel: 'Confirmar pagamento (simulação)', icon: 'money',
        fields: [
          { name: 'forma', label: 'Forma de pagamento', type: 'radios', required: true, value: 'Pix', options: [{ v: 'Pix', l: 'Pix — confirmação imediata' }, { v: 'Cartão em 3x', l: 'Cartão de crédito em até 3x sem juros' }, { v: 'Boleto', l: 'Boleto — compensação em até 2 dias úteis' }] },
          { type: 'html', html: '<div class="row" style="gap:16px;align-items:center"><div style="width:120px">' + A.qr(7) + '</div><div class="small muted">Pix demonstrativo. No produto real, o pagamento é processado por uma instituição de pagamento autorizada, com split e conciliação automáticos.<br><br>Itens: ' + pm.itens.length + ' — entrega ' + (pm.frete ? A.money(pm.frete) : 'grátis') + (pm.desconto ? ' — desconto ' + A.money(pm.desconto) : '') + '</div></div>' },
        ] });
    },
    'c3.pagarSave': (v, x) => {
      const a = atd(x.id), pm = a.pm;
      if (v.forma === 'Boleto') { pm.pag = { forma: 'Boleto', status: 'Boleto emitido', ts: A.now() }; pev(a, 'Boleto emitido'); sys(a, 'Boleto dos materiais emitido. O AppCalhas confirma após a compensação.'); fin(a, 'Boleto emitido (simulação). O AppCalhas confirma após a compensação.', 'Boleto de materiais emitido', 'materiais'); return; }
      confirmarPagamento(a, v.forma);
      A.close(); A.setTab('atd', 'materiais'); A.refresh(); A.toast('Pagamento confirmado. O AppCalhas já pode emitir a ordem de fabricação.');
    },
    'c3.pmPagoMed': (ds) => { const a = atd(ds.id); A.form({ title: 'Registrar pagamento recebido — ' + a.pm.id, sub: A.money(a.pm.total), submit: 'c3.pmPagoMedSave', extra: { id: a.id }, one: true, fields: [{ name: 'forma', label: 'Forma', type: 'select', options: ['Boleto', 'Pix', 'Cartão em 3x', 'Transferência'], value: a.pm.pag ? a.pm.pag.forma : 'Pix' }, { name: 'obs', label: 'Registro', type: 'textarea', value: 'Compensação confirmada no extrato da conta de recebimento.' }] }); },
    'c3.pmPagoMedSave': (v, x) => { const a = atd(x.id); confirmarPagamento(a, v.forma, 'registrado por ' + A.me().nome); a.decisoes.push({ ts: A.now(), por: A.me().nome, txt: 'Pagamento de materiais registrado: ' + v.obs }); A.close(); A.setTab('atd', 'materiais'); A.refresh(); A.toast('Pagamento registrado. Próximo passo: emitir a ordem de fabricação.'); },
    'c3.pmLembrar': (ds) => { const a = atd(ds.id); say(a, 'Olá! Para garantirmos a entrega dos materiais na véspera do serviço (' + A.fd(a.exec.inicioPrev) + '), o pagamento de ' + A.money(a.pm.total) + ' precisa ser confirmado até amanhã. Posso reenviar o link?', 'mediador'); pev(a, 'Lembrete de pagamento enviado ao cliente'); fin(a, 'Lembrete de pagamento enviado (simulação).', 'Lembrete de pagamento de materiais enviado', 'conversa'); },

    /* ---------- Materiais: fabricação, separação e entrega ---------- */
    'c3.pmFabricar': (ds) => {
      const a = atd(ds.id), pm = a.pm;
      const fab = pm.itens.filter((x) => x.fab), est = pm.itens.filter((x) => !x.fab);
      A.form({ title: 'Emitir ordem de fabricação — ' + pm.id, sub: 'Fábrica própria — fabricação sob medida', submit: 'c3.pmFabricarSave', extra: { id: a.id }, size: 'lg', submitLabel: 'Emitir ordem', icon: 'tool',
        intro: '<b>Fabricação sob medida (fábrica própria):</b> ' + (fab.length ? fab.map((x) => e(qtdTxt(x) + ' — ' + x.nome)).join('; ') : 'nenhum item') + '<br><b>Separação de estoque / fornecedor parceiro:</b> ' + (est.length ? est.map((x) => e(qtdTxt(x) + ' — ' + x.nome)).join('; ') : 'nenhum item'),
        fields: [{ name: 'prev', label: 'Previsão de conclusão', type: 'datetime-local', required: true, value: isoLocal(A.d(1, '12:00')) }, { name: 'obs', label: 'Especificação para a fábrica', type: 'textarea', full: true, required: true, value: a.visita && a.visita.realizada ? 'Conforme levantamento da visita: ' + a.visita.realizada.medidas + '. Cor natural (galvalume).' : 'Cor natural (galvalume).' }] });
    },
    'c3.pmFabricarSave': (v, x) => { const a = atd(x.id), pm = a.pm; pm.fab = { ts: A.now(), prev: new Date(v.prev).toISOString(), op: 'OP-' + a.id.split('-')[1], obs: v.obs }; pm.status = 'producao'; pev(a, 'Ordem de fabricação ' + pm.fab.op + ' emitida para a fábrica'); hist(a, 'Materiais em fabricação'); sys(a, 'Materiais em fabricação. Previsão de conclusão: ' + A.fdt(pm.fab.prev) + '.'); fin(a, 'Ordem de fabricação emitida.', 'Ordem de fabricação emitida', 'materiais'); },
    'c3.pmSeparar': (ds) => {
      const a = atd(ds.id), pm = a.pm;
      A.form({ title: 'Concluir fabricação, separar e faturar — ' + pm.id, submit: 'c3.pmSepararSave', extra: { id: a.id }, one: true, submitLabel: 'Confirmar separação', icon: 'box',
        fields: [{ name: 'itens', label: 'Itens conferidos na expedição', type: 'checks', full: true, options: pm.itens.map((x) => qtdTxt(x) + ' — ' + x.nome), value: pm.itens.map((x) => qtdTxt(x) + ' — ' + x.nome) }, { name: 'nf', type: 'check', text: 'Nota fiscal de venda dos materiais emitida', value: true }] });
    },
    'c3.pmSepararSave': (v, x) => { const a = atd(x.id), pm = a.pm; if (v.itens.length < pm.itens.length) { A.toast('Todos os itens precisam ser conferidos na expedição antes de faturar.', 'warn'); return; } if (!v.nf) { A.toast('Emita a nota fiscal antes de liberar para entrega.', 'warn'); return; } pm.nf = 'NF-e ' + (18200 + Math.floor(Math.random() * 90)).toLocaleString('pt-BR'); pm.status = 'separado'; pev(a, 'Separado e faturado — ' + pm.nf, 'Expedição AppCalhas'); hist(a, 'Materiais separados e faturados (' + pm.nf + ')'); fin(a, 'Materiais separados e faturados. Próximo passo: programar a entrega.', 'Materiais separados e faturados', 'materiais'); },
    'c3.pmProgramar': (ds) => {
      const a = atd(ds.id), pm = a.pm;
      const ini = a.exec ? new Date(a.exec.inicioPrev) : new Date(A.d(2));
      const vesp = new Date(ini); vesp.setDate(vesp.getDate() - 1);
      const sug = A.dayDiff(vesp.toISOString()) < 0 ? new Date(A.d(0)) : vesp;
      A.form({ title: (pm.entrega ? 'Reprogramar' : 'Programar') + ' entrega — ' + pm.id, sub: 'Início do serviço: ' + A.fdt(a.exec.inicioPrev) + ' — regra: entrega na véspera', submit: 'c3.pmProgramarSave', extra: { id: a.id }, fields: [
        { name: 'data', label: 'Data da entrega', type: 'date', required: true, value: (pm.entrega ? pm.entrega.data : sug.toISOString()).slice(0, 10) },
        { name: 'janela', label: 'Janela', type: 'select', options: ['08h–12h', '13h–17h'], value: pm.entrega ? pm.entrega.janela : '08h–12h' },
        { name: 'veiculo', label: 'Veículo', type: 'select', options: ['Utilitário AppCalhas 01', 'Caminhão 3/4 AppCalhas', 'Parceiro logístico'], value: pm.itens.some((x) => x.qtd >= 18 && x.un === 'm') ? 'Caminhão 3/4 AppCalhas' : 'Utilitário AppCalhas 01' },
        { name: 'recebedor', label: 'Quem recebe', value: pm.entrega ? pm.entrega.recebedor : nomeCli(a) + ' (cliente) ou ' + pro(a.pro).nome + ' (profissional)', full: true },
        { name: 'aviso', type: 'check', text: 'Cliente e profissional avisados da janela de entrega', value: true },
      ] });
    },
    'c3.pmProgramarSave': (v, x) => {
      const a = atd(x.id), pm = a.pm;
      const dt = new Date(v.data + (v.janela === '08h–12h' ? 'T08:00' : 'T13:00')).toISOString();
      pm.entrega = Object.assign(pm.entrega || {}, { data: dt, janela: v.janela, veiculo: v.veiculo, recebedor: v.recebedor });
      pm.status = 'programada';
      pev(a, 'Entrega programada para ' + A.fd(dt) + ' (' + v.janela + ') — ' + v.veiculo);
      say(a, 'Entrega dos materiais programada para ' + A.when(dt, false).toLowerCase() + ', ' + v.janela + '. O início do serviço segue previsto para ' + A.fdt(a.exec.inicioPrev) + '.', 'mediador');
      const late = A.dayDiff(dt) >= A.dayDiff(a.exec.inicioPrev);
      if (late) a.decisoes.push({ ts: A.now(), por: A.me().nome, txt: 'Entrega programada no dia do início ou depois — avaliar replanejamento do início com o profissional.' });
      fin(a, late ? 'Entrega programada, mas não fica na véspera do início. Considere replanejar o início.' : 'Entrega programada para a véspera do serviço.', 'Entrega de materiais programada', 'materiais', late ? 'warn' : undefined);
    },
    'c3.pmDespachar': (ds) => { const a = atd(ds.id), pm = a.pm; A.confirm({ title: 'Despachar para entrega', msg: 'Confirmar a saída de <b>' + e(pm.id) + '</b> (' + pm.itens.length + ' itens, ' + e(pm.nf) + ') no ' + e(pm.entrega.veiculo) + '?', ok: 'Despachar', onOk: () => { pm.status = 'rota'; pm.entrega.saida = A.now(); pev(a, 'Saiu para entrega', 'Expedição AppCalhas'); sys(a, 'Materiais em rota de entrega — janela ' + pm.entrega.janela + '.'); A.log('Materiais despachados para entrega', pm.id); A.setTab('atd', 'materiais'); A.refresh(); A.toast('Materiais em rota de entrega.'); } }); },
    'c3.pmEntregue': (ds) => { const a = atd(ds.id), pm = a.pm; A.form({ title: 'Registrar entrega na obra — ' + pm.id, submit: 'c3.pmEntregueSave', extra: { id: a.id }, fields: [{ name: 'ts', label: 'Entregue em', type: 'datetime-local', required: true, value: isoLocal(A.now()) }, { name: 'por', label: 'Recebido por', required: true, value: pm.entrega.recebedor.split(' ou ')[0] }, { name: 'fotos', label: 'Comprovante (foto do material no local)', type: 'photos', full: true, presets: ['calha-frontal', 'condutor'], preselect: ['calha-frontal'] }] }); },
    'c3.pmEntregueSave': (v, x) => { const a = atd(x.id), pm = a.pm; pm.entrega.ts = new Date(v.ts).toISOString(); pm.entrega.recebidoPor = v.por; pm.entrega.fotos = v.fotos || []; pm.status = 'entregue'; a.m.entregue = pm.entrega.ts; pev(a, 'Entregue na obra — recebido por ' + v.por, 'Expedição AppCalhas'); hist(a, 'Materiais entregues na obra'); sys(a, 'Materiais entregues na obra. O profissional confere os itens antes de iniciar o serviço.'); fin(a, 'Entrega registrada. Aguardando conferência do profissional.', 'Entrega de materiais registrada na obra', 'materiais'); },

    /* ---------- Materiais: conferência na obra e ocorrências ---------- */
    'c3.pmConferir': (ds) => {
      const a = atd(ds.id), pm = a.pm;
      A.form({ title: 'Conferir materiais na obra — ' + pm.id, sub: 'Confira quantidade, medida, cor e estado de cada item antes de iniciar o serviço.', submit: 'c3.pmConferirSave', extra: { id: a.id }, size: 'lg', submitLabel: 'Registrar conferência', icon: 'clipboard',
        fields: [
          { name: 'ok', label: 'Itens conferidos e em perfeito estado', type: 'checks', full: true, options: pm.itens.map((x) => ({ v: x.nome, l: qtdTxt(x) + ' — ' + x.nome })), value: pm.itens.map((x) => x.nome) },
          { name: 'res', label: 'Resultado', type: 'radios', full: true, required: true, value: 'conforme', options: [{ v: 'conforme', l: 'Tudo conforme — liberar o serviço' }, { v: 'divergencia', l: 'Há falta, avaria ou divergência — abrir ocorrência' }] },
          { name: 'tipo', label: 'Tipo de ocorrência (se houver)', type: 'select', options: ['Falta de item', 'Avaria no transporte', 'Medida divergente', 'Cor ou acabamento divergente'] },
          { name: 'desc', label: 'Descrição (se houver)', type: 'textarea', full: true, value: '' },
          { name: 'fotos', label: 'Fotos', type: 'photos', full: true, presets: ['calha-frontal', 'condutor', 'aluminio'] },
        ] });
    },
    'c3.pmConferirSave': (v, x) => {
      const a = atd(x.id), pm = a.pm;
      const falt = pm.itens.filter((i) => v.ok.indexOf(i.nome) < 0).map((i) => i.nome);
      if (v.res === 'conforme' && falt.length) { A.toast('Há itens não marcados. Marque todos ou registre a divergência.', 'warn'); return; }
      if (v.res === 'conforme') {
        pm.conf = { ts: A.now(), por: A.me().nome, obs: 'Itens conferidos sem divergência.', fotos: v.fotos || [] }; pm.status = 'conferido';
        pev(a, 'Materiais conferidos na obra sem divergência'); liberarExecucao(a);
        fin(a, 'Materiais conferidos. Serviço liberado para início.', 'Materiais conferidos na obra', 'materiais'); return;
      }
      if (!falt.length && !v.desc) { A.toast('Descreva a divergência ou desmarque os itens afetados.', 'warn'); return; }
      const oc = { id: 'OC-' + String(pm.ocorrencias.length + 1).padStart(2, '0'), ts: A.now(), tipo: v.tipo, itens: falt.length ? falt : [pm.itens[0].nome], desc: v.desc || 'Divergência identificada na conferência.', fotos: v.fotos || [], status: 'Aberta', acoes: [] };
      pm.ocorrencias.push(oc); pm.status = 'ocorrencia';
      pev(a, 'Ocorrência ' + oc.id + ': ' + oc.tipo.toLowerCase()); hist(a, 'Ocorrência de material registrada: ' + oc.tipo.toLowerCase()); say(a, 'Registrei uma ocorrência nos materiais: ' + oc.desc);
      fin(a, 'Ocorrência registrada. O AppCalhas vai providenciar a reposição.', 'Ocorrência de material registrada', 'materiais', 'warn');
    },
    'c3.pmOcorr': (ds) => { const a = atd(ds.id), oc = openOc(a); A.form({ title: 'Tratar ocorrência ' + oc.id + ' — ' + a.pm.id, sub: oc.tipo + ' — ' + oc.itens.join(', '), submit: 'c3.pmOcorrSave', extra: { id: a.id }, fields: [{ name: 'acao', label: 'Ação', type: 'select', full: true, required: true, options: ['Reposição sem custo (entrega expressa)', 'Ajuste de medida na fábrica e reposição', 'Crédito ao cliente (item não será reposto)'] }, { name: 'data', label: 'Reposição prevista para', type: 'datetime-local', value: isoLocal(A.d(0, '16:00')) }, { name: 'obs', label: 'Registro', type: 'textarea', full: true, required: true, value: 'Reposição sem custo separada na fábrica; entrega expressa hoje, antes do início do serviço.' }] }); },
    'c3.pmOcorrSave': (v, x) => {
      const a = atd(x.id), pm = a.pm, oc = openOc(a);
      oc.acoes.push({ ts: A.now(), txt: v.acao + ': ' + v.obs, por: A.me().nome });
      if (/Crédito/.test(v.acao)) { oc.status = 'Resolvida'; pm.status = 'conferido'; pm.conf = pm.conf || { ts: A.now(), por: A.me().nome, obs: 'Conferência concluída com crédito ao cliente.' }; pev(a, 'Ocorrência ' + oc.id + ' resolvida com crédito ao cliente'); liberarExecucao(a); fin(a, 'Ocorrência resolvida com crédito ao cliente.', 'Ocorrência de material resolvida (crédito)', 'materiais'); return; }
      oc.status = 'Em reposição'; oc.reposicao = v.data ? new Date(v.data).toISOString() : A.now();
      pev(a, 'Reposição programada para ' + A.fdt(oc.reposicao) + ' (' + oc.id + ')'); say(a, 'Ocorrência ' + oc.id + ' em tratamento: ' + v.obs, 'mediador'); a.decisoes.push({ ts: A.now(), por: A.me().nome, txt: 'Ocorrência ' + oc.id + ': ' + v.acao + '.' });
      fin(a, 'Reposição programada.', 'Reposição de material programada', 'materiais');
    },
    'c3.pmRepOk': (ds) => { const a = atd(ds.id), pm = a.pm, oc = openOc(a); A.confirm({ title: 'Registrar reposição entregue', msg: 'Confirmar que a reposição da ocorrência <b>' + e(oc.id) + '</b> foi entregue e conferida com o profissional?', ok: 'Confirmar', onOk: () => { oc.status = 'Resolvida'; oc.acoes.push({ ts: A.now(), txt: 'Reposição entregue e conferida na obra.', por: A.me().nome }); pm.status = 'conferido'; pm.conf = { ts: A.now(), por: pro(a.pro).nome + ' (com o AppCalhas)', obs: 'Conferência concluída após reposição.' }; pev(a, 'Reposição entregue — ocorrência ' + oc.id + ' resolvida'); liberarExecucao(a); A.log('Reposição de material entregue', pm.id + ' · ' + oc.id); A.setTab('atd', 'materiais'); A.refresh(); A.toast('Ocorrência resolvida. Serviço liberado para início.'); } }); },

    /* ---------- Materiais: complementos durante a obra ---------- */
    'c3.cmpSolicitar': (ds) => A.form({ title: 'Solicitar material complementar', sub: 'O AppCalhas precifica, o cliente aprova e paga, e o AppCalhas entrega na obra.', submit: 'c3.cmpSolicitarSave', extra: { id: ds.id }, size: 'lg', submitLabel: 'Enviar ao AppCalhas', icon: 'send',
      fields: [{ name: 'itens', label: 'Itens (preço da tabela AppCalhas, somente leitura)', type: 'items', catalog: db().materiais, full: true, value: [{ id: 'MAT-08', qtd: 4, preco: 9.8 }] }, { name: 'motivo', label: 'Motivo', full: true, required: true, value: 'Trecho do beiral maior do que o medido na visita.' }],
      calc: (f) => { f.querySelectorAll('.ied-p').forEach((inp) => { inp.readOnly = true; inp.tabIndex = -1; const sel = inp.closest('tr').querySelector('.ied-m'); const m = sel && mat(sel.value); if (m) inp.value = m.preco; }); const th = f.querySelectorAll('.ied-t thead th'); if (th[2]) th[2].textContent = 'Preço AppCalhas'; } }),
    'c3.cmpSolicitarSave': (v, x) => { const a = atd(x.id), pm = a.pm; if (!v.itens.length) { A.toast('Inclua ao menos um item.', 'warn'); return; } const c = { id: 'CMP-' + (pm.complementos.length + 1), ts: A.now(), por: A.me().nome, itens: norm(v.itens), motivo: v.motivo, status: 'solicitado', frete: 0, total: 0 }; pm.complementos.push(c); pev(a, 'Complemento ' + c.id + ' solicitado pelo profissional'); hist(a, 'Material complementar solicitado (' + c.id + ')'); say(a, 'Solicitei material complementar (' + c.id + '): ' + v.motivo); fin(a, 'Complemento enviado ao AppCalhas.', 'Material complementar solicitado', 'materiais'); },
    'c3.cmpPrecificar': (ds) => { const a = atd(ds.id), c = a.pm.complementos.find((k) => k.id === ds.c); c.itens = norm(c.itens); A.form({ title: 'Precificar complemento ' + c.id, sub: c.motivo, submit: 'c3.cmpPrecificarSave', extra: { id: a.id, c: c.id }, fields: [{ type: 'html', html: itensTable(c.itens) }, { name: 'frete', label: 'Entrega (R$)', type: 'number', min: 0, value: 0, help: 'Complementos seguem na próxima rota do dia sem custo.' }, { name: 'prazo', label: 'Entrega', type: 'select', options: ['Rota de hoje (até 17h)', 'Amanhã, 08h–12h'] }] }); },
    'c3.cmpPrecificarSave': (v, x) => { const a = atd(x.id), c = a.pm.complementos.find((k) => k.id === x.c); c.frete = +v.frete || 0; c.total = r2(A.sum(c.itens, (i) => i.qtd * i.preco) + c.frete); c.prazo = v.prazo; c.status = 'aguardando_cliente'; pev(a, 'Complemento ' + c.id + ' precificado: ' + A.money(c.total)); say(a, 'Complemento ' + c.id + ' (' + c.motivo.toLowerCase() + '): ' + A.money(c.total) + '. Após a aprovação, entregamos na ' + c.prazo.toLowerCase() + '.', 'mediador'); fin(a, 'Complemento enviado ao cliente para aprovação.', 'Complemento de material precificado', 'materiais'); },
    'c3.cmpPagar': (ds) => { const a = atd(ds.id), c = a.pm.complementos.find((k) => k.id === ds.c); A.confirm({ title: 'Aprovar e pagar complemento', msg: 'Aprovar <b>' + e(c.id) + '</b> no valor de <b>' + A.money(c.total) + '</b> e pagar via Pix?<br><small>' + c.itens.map((i) => e(qtdTxt(i) + ' — ' + i.nome)).join('<br>') + '</small>', note: 'O complemento é vendido e entregue pelo AppCalhas.', ok: 'Aprovar e pagar', onOk: () => cmpPago(a, c, 'Pix', 'pelo cliente') }); },
    'c3.cmpPagarMed': (ds) => { const a = atd(ds.id), c = a.pm.complementos.find((k) => k.id === ds.c); A.confirm({ title: 'Registrar aprovação do complemento', msg: 'Registrar que o cliente aprovou e pagou <b>' + e(c.id) + '</b> (' + A.money(c.total) + ') pelo link de pagamento?', ok: 'Registrar', onOk: () => cmpPago(a, c, 'Link de pagamento', 'registrado por ' + A.me().nome) }); },
    'c3.cmpEntregue': (ds) => { const a = atd(ds.id), c = a.pm.complementos.find((k) => k.id === ds.c); c.status = 'entregue'; c.entregueEm = A.now(); pev(a, 'Complemento ' + c.id + ' entregue na obra', 'Expedição AppCalhas'); sys(a, 'Complemento ' + c.id + ' entregue na obra.'); A.log('Complemento de material entregue', a.pm.id + ' · ' + c.id); A.setTab('atd', 'materiais'); A.refresh(); A.toast('Complemento entregue.'); },

    /* ---------- Execução ---------- */
    'c3.iniciar': (ds) => { const a = atd(ds.id); A.form({ title: 'Iniciar serviço', sub: 'Materiais conferidos em ' + A.fdt(a.pm ? a.pm.conf.ts : A.now()), submit: 'c3.iniciarSave', extra: { id: ds.id }, fields: [{ name: 'ini', label: 'Início', type: 'datetime-local', required: true, value: isoLocal(A.now()) }, { name: 'fim', label: 'Término previsto', type: 'date', required: true, value: (a.exec ? a.exec.fimPrev : A.d(1)).slice(0, 10) }] }); },
    'c3.iniciarSave': (v, x) => { const a = atd(x.id); a.exec.inicio = new Date(v.ini).toISOString(); a.exec.fimPrev = new Date(v.fim + 'T17:00').toISOString(); const s0 = a.exec.etapas[0]; if (s0 && !s0.ok) { s0.ok = true; s0.ts = a.pm && a.pm.conf ? a.pm.conf.ts : A.now(); } a.etapa = 'execucao'; hist(a, 'Serviço iniciado'); sys(a, 'Serviço iniciado pelo profissional. Previsão de término: ' + A.fd(a.exec.fimPrev) + '.'); fin(a, 'Serviço iniciado.', 'Serviço iniciado', 'execucao'); },
    'c3.etapas': (ds) => { const a = atd(ds.id); A.form({ title: 'Atualizar etapas da execução', submit: 'c3.etapasSave', extra: { id: a.id }, fields: [{ name: 'ok', label: 'Etapas concluídas', type: 'checks', full: true, options: a.exec.etapas.map((x) => x.n), value: a.exec.etapas.filter((x) => x.ok).map((x) => x.n).concat(a.exec.etapas.filter((x) => !x.ok).slice(0, 1).map((x) => x.n)) }, { name: 'obs', label: 'Comentário para o cliente e o AppCalhas', type: 'textarea', full: true, value: 'Calha instalada; amanhã cedo faço a vedação e o teste de escoamento.' }, { name: 'fotos', label: 'Fotos do andamento', type: 'photos', full: true, presets: ['calha-frontal', 'condutor', 'aluminio'] }] }); },
    'c3.etapasSave': (v, x) => { const a = atd(x.id); a.exec.etapas.forEach((s) => { const ok = v.ok.indexOf(s.n) >= 0; if (ok && !s.ok) s.ts = A.now(); s.ok = ok; }); if (v.obs) say(a, v.obs); sys(a, 'Andamento atualizado: ' + prog(a) + '%.'); hist(a, 'Andamento atualizado: ' + prog(a) + '%'); fin(a, 'Andamento atualizado: ' + prog(a) + '%.', 'Andamento da execução atualizado (' + prog(a) + '%)', 'execucao'); },
    'c3.concluir': (ds) => A.form({ title: 'Concluir serviço', sub: 'Todas as etapas serão marcadas como concluídas.', submit: 'c3.concluirSave', extra: { id: ds.id }, fields: [{ name: 'obs', label: 'Relato da conclusão', type: 'textarea', full: true, required: true, value: 'Serviço concluído, teste de escoamento aprovado e área limpa.' }, { name: 'garantia', label: 'Garantia da mão de obra', type: 'select', options: ['12 meses', '6 meses', '3 meses'] }, { name: 'sobras', label: 'Sobras de material', type: 'select', options: ['Sem sobras', 'Sobras deixadas com o cliente', 'Sobras recolhidas pelo AppCalhas (crédito)'] }, { name: 'fotos', label: 'Fotos finais', type: 'photos', full: true, presets: ['calha-frontal', 'condutor', 'aluminio'], preselect: ['calha-frontal'] }] }),
    'c3.concluirSave': (v, x) => { const a = atd(x.id); a.exec.etapas.forEach((s) => { if (!s.ok) { s.ok = true; s.ts = A.now(); } }); a.conclusao = { ts: A.now(), obs: v.obs, fotos: v.fotos || [], garantia: v.garantia, sobras: v.sobras }; a.etapa = 'concluido'; a.m.concluido = A.now(); if (/recolhidas/.test(v.sobras)) a.pendencias.push({ id: 'PD' + Date.now(), tipo: 'Recolher sobras de material', desc: 'Profissional indicou sobras para crédito ao cliente.', ts: A.now(), status: 'Aberta' }); hist(a, 'Serviço concluído pelo profissional'); sys(a, 'Serviço concluído. O AppCalhas vai confirmar com o cliente.'); fin(a, 'Serviço concluído. O AppCalhas vai confirmar com o cliente.', 'Serviço concluído', 'execucao'); },
    'c3.confirmarMed': (ds) => A.form({ title: 'Confirmar conclusão com o cliente', submit: 'c3.confirmarMedSave', extra: { id: ds.id }, one: true, fields: [{ name: 'res', label: 'Resultado do contato', type: 'radios', options: ['Cliente confirmou que está tudo certo', 'Cliente apontou pendência'], value: 'Cliente confirmou que está tudo certo', required: true }, { name: 'obs', label: 'Registro', type: 'textarea', value: 'Cliente confirmou por telefone; avaliação solicitada.' }] }),
    'c3.confirmarMedSave': (v, x) => { const a = atd(x.id); if (/pendência/.test(v.res)) { a.pendencias.push({ id: 'PD' + Date.now(), tipo: 'Pendência apontada na conclusão', desc: v.obs, ts: A.now(), status: 'Aberta' }); fin(a, 'Pendência registrada. Acompanhe até a solução.', 'Cliente apontou pendência na conclusão'); return; } a.etapa = 'encerrado'; a.confirmado = A.now(); hist(a, 'Conclusão confirmada com o cliente'); say(a, 'Conclusão confirmada. Obrigado! Você pode avaliar o atendimento quando quiser.'); fin(a, 'Conclusão confirmada. Avaliação solicitada ao cliente.', 'Conclusão confirmada com o cliente'); },
    'c3.cliConfirma': (ds) => A.form({ title: 'Confirmar conclusão e avaliar', submit: 'c3.avaliarSave', extra: { id: ds.id, confirma: true }, one: true, submitLabel: 'Confirmar e avaliar', icon: 'star', fields: [{ name: 'nota', label: 'Como foi o atendimento?', type: 'radios', options: [{ v: 5, l: '★★★★★' }, { v: 4, l: '★★★★' }, { v: 3, l: '★★★' }, { v: 2, l: '★★' }, { v: 1, l: '★' }], value: 5, required: true }, { name: 'txt', label: 'Comentário', type: 'textarea', value: 'Material chegou na véspera, serviço caprichado e o AppCalhas me manteve informada em todas as etapas.' }] }),
    'c3.avaliar': (ds) => actions['c3.cliConfirma'](ds),
    'c3.avaliarSave': (v, x) => { const a = atd(x.id); if (a.etapa === 'concluido') { a.etapa = 'encerrado'; a.confirmado = A.now(); hist(a, 'Cliente confirmou a conclusão'); } a.avaliacao = { nota: +v.nota, txt: v.txt, ts: A.now() }; hist(a, 'Atendimento avaliado pelo cliente: ' + v.nota + ' estrelas'); fin(a, 'Obrigado pela avaliação!', 'Atendimento avaliado (' + v.nota + ' estrelas)'); },
    'c3.solAval': (ds) => { const a = atd(ds.id); say(a, 'Como foi o atendimento? Sua avaliação nos ajuda a manter a qualidade dos profissionais e dos materiais.'); fin(a, 'Pedido de avaliação enviado (simulação).', 'Avaliação solicitada ao cliente', 'conversa'); },
    'c3.reclamar': (ds) => A.form({ title: 'Relatar problema', sub: 'O AppCalhas acompanha a solução com o profissional e responde pelos materiais.', submit: 'c3.reclamarSave', extra: { id: ds.id }, one: true, submitLabel: 'Enviar relato', icon: 'flag', fields: [{ name: 'tipo', label: 'Tipo', type: 'select', options: ['Infiltração após o serviço (garantia)', 'Atraso na execução', 'Atraso na entrega dos materiais', 'Defeito no material', 'Acabamento', 'Cobrança diferente da proposta', 'Outro'], required: true }, { name: 'desc', label: 'Descrição', type: 'textarea', required: true, value: 'Notei uma goteira perto da descida depois da chuva.' }] }),
    'c3.reclamarSave': (v, x) => { const a = atd(x.id); a.reclamacao = { id: 'REC-' + Date.now().toString().slice(-4), tipo: v.tipo, desc: v.desc, ts: A.now(), status: 'Aberta', acoes: [] }; hist(a, 'Reclamação registrada: ' + v.tipo); say(a, 'Registrei um problema: ' + v.desc); fin(a, 'Relato enviado. O AppCalhas vai acompanhar a solução.', 'Reclamação registrada'); },
    'c3.tratarRec': (ds) => { const a = atd(ds.id); A.form({ title: 'Tratar reclamação — ' + a.id, sub: a.reclamacao.tipo, submit: 'c3.tratarRecSave', extra: { id: a.id }, fields: [{ name: 'acao', label: 'Ação', type: 'select', full: true, required: true, options: ['Encaminhar ao profissional para garantia', 'Agendar visita de garantia', 'Acionar garantia do material (AppCalhas)', 'Contato com o cliente', 'Encerrar como resolvida'], value: a.reclamacao.encaminhada ? 'Agendar visita de garantia' : 'Encaminhar ao profissional para garantia' }, { name: 'data', label: 'Data da visita (se aplicável)', type: 'datetime-local', value: isoLocal(A.d(1, '08:30')) }, { name: 'obs', label: 'Registro', type: 'textarea', full: true, required: true, value: 'Profissional acionado para avaliar a infiltração dentro da garantia, sem custo ao cliente.' }] }); },
    'c3.tratarRecSave': (v, x) => {
      const a = atd(x.id), r = a.reclamacao;
      r.acoes.push({ ts: A.now(), txt: v.acao + ': ' + v.obs, por: A.me().nome });
      if (/Encerrar/.test(v.acao)) { r.status = 'Resolvida'; hist(a, 'Reclamação encerrada como resolvida'); say(a, 'Reclamação encerrada como resolvida. Obrigado pela paciência!'); }
      else { r.status = 'Em tratamento'; if (/Encaminhar|Agendar/.test(v.acao)) r.encaminhada = true; if (/Agendar/.test(v.acao) && v.data) r.visitaGarantia = new Date(v.data).toISOString(); hist(a, 'Reclamação em tratamento: ' + v.acao.toLowerCase()); say(a, v.obs); }
      a.decisoes.push({ ts: A.now(), por: A.me().nome, txt: 'Reclamação: ' + v.acao + '. ' + v.obs });
      fin(a, 'Reclamação atualizada: ' + r.status.toLowerCase() + '.', 'Reclamação tratada — ' + v.acao.toLowerCase());
    },
    'c3.garantia': (ds) => A.form({ title: 'Registrar atendimento de garantia', submit: 'c3.garantiaSave', extra: { id: ds.id }, one: true, fields: [{ name: 'obs', label: 'O que foi feito', type: 'textarea', required: true, value: 'Refeita a vedação do bocal da descida 3 e teste de escoamento aprovado. Sem custo ao cliente.' }, { name: 'fotos', label: 'Fotos', type: 'photos', presets: ['condutor', 'calha-frontal'] }] }),
    'c3.garantiaSave': (v, x) => { const a = atd(x.id); a.reclamacao.acoes.push({ ts: A.now(), txt: 'Atendimento de garantia: ' + v.obs, por: A.me().nome }); a.reclamacao.garantiaFeita = true; say(a, 'Atendimento de garantia realizado: ' + v.obs); hist(a, 'Profissional registrou atendimento de garantia'); fin(a, 'Atendimento de garantia registrado. O AppCalhas vai confirmar com o cliente.', 'Atendimento de garantia registrado'); },
    'c3.replanejar': (ds) => { const a = atd(ds.id); const pre = a.etapa !== 'execucao'; A.form({ title: 'Replanejar prazo — ' + a.id, submit: 'c3.replanejarSave', extra: { id: a.id }, fields: (pre ? [{ name: 'ini', label: 'Novo início previsto', type: 'date', required: true, value: A.d(2).slice(0, 10) }] : []).concat([{ name: 'fim', label: 'Nova previsão de término', type: 'date', required: true, value: A.d(pre ? 3 : 2).slice(0, 10) }, { name: 'motivo', label: 'Motivo', type: 'select', options: ['Chuva', 'Atraso no pagamento dos materiais', 'Ocorrência de material', 'Imprevisto na obra', 'Pedido do cliente'] }, { name: 'obs', label: 'Mensagem ao cliente', type: 'textarea', full: true, required: true, value: pre ? 'Ajustamos o início do serviço para manter a entrega dos materiais na véspera.' : 'Por causa da chuva, a conclusão ficou para a nova data. O profissional confirmou a equipe.' }, { name: 'ciente', type: 'check', text: 'Cliente e profissional cientes do novo prazo', value: true }]) }); },
    'c3.replanejarSave': (v, x) => { const a = atd(x.id); const antes = a.exec.fimPrev; if (v.ini) a.exec.inicioPrev = new Date(v.ini + 'T08:00').toISOString(); a.exec.fimPrev = new Date(v.fim + 'T17:00').toISOString(); a.decisoes.push({ ts: A.now(), por: A.me().nome, txt: 'Prazo replanejado' + (v.ini ? ': início em ' + A.fd(a.exec.inicioPrev) + ',' : ' de ' + A.fd(antes) + ' para') + ' término em ' + A.fd(a.exec.fimPrev) + ' (' + v.motivo.toLowerCase() + ').' }); say(a, v.obs); hist(a, 'Prazo replanejado' + (v.ini ? ' — início ' + A.fd(a.exec.inicioPrev) : '') + ' — término ' + A.fd(a.exec.fimPrev)); fin(a, 'Prazo replanejado e cliente informado.', 'Prazo replanejado'); },
    'c3.decisao': (ds) => A.form({ title: 'Registrar decisão', sub: 'Registro de aprovações, alterações e combinados do atendimento.', submit: 'c3.decisaoSave', extra: { id: ds.id }, one: true, fields: [{ name: 'tipo', label: 'Tipo', type: 'select', options: ['Aprovação', 'Alteração de escopo', 'Prazo', 'Desconto / alçada', 'Combinado com o cliente', 'Outro'] }, { name: 'txt', label: 'Decisão', type: 'textarea', required: true, value: 'Cliente aceitou incluir tela contra folhas; profissional enviará a versão 2 da lista técnica.' }] }),
    'c3.decisaoSave': (v, x) => { const a = atd(x.id); a.decisoes.push({ ts: A.now(), por: A.me().nome, txt: v.tipo + ': ' + v.txt }); hist(a, 'Decisão registrada (' + v.tipo.toLowerCase() + ')', 'interno'); fin(a, 'Decisão registrada no atendimento.', 'Decisão registrada (' + v.tipo.toLowerCase() + ')', 'historico'); },
    'c3.pend': (ds) => A.form({ title: 'Registrar pendência', submit: 'c3.pendSave', extra: { id: ds.id }, one: true, fields: [{ name: 'tipo', label: 'Pendência', required: true, value: 'Aguardar retorno do cliente sobre a cor da calha' }, { name: 'desc', label: 'Detalhe', type: 'textarea', value: 'Cliente vai decidir até amanhã.' }] }),
    'c3.pendSave': (v, x) => { const a = atd(x.id); a.pendencias.push({ id: 'PD' + Date.now(), tipo: v.tipo, desc: v.desc, ts: A.now(), status: 'Aberta' }); fin(a, 'Pendência registrada.', 'Pendência registrada'); },
    'c3.pendOk': (ds) => { const a = atd(ds.id); const p = a.pendencias.find((k) => k.id === ds.p); p.status = 'Resolvida'; p.resolvida = A.now(); hist(a, 'Pendência resolvida: ' + p.tipo, 'interno'); fin(a, 'Pendência resolvida.', 'Pendência resolvida'); },

    /* ---------- Documentos ---------- */
    'c3.nf': (ds) => { const a = atd(ds.id), pm = a.pm; A.modal({ title: 'Nota fiscal dos materiais', sub: pm.nf + ' — ' + pm.id, size: 'lg', body: A.doc('Nota fiscal de venda — materiais', e(pm.nf) + ' — emitida na separação', A.dl([['Emitente', 'AppCalhas — venda de materiais'], ['Destinatário', e(nomeCli(a))], ['Endereço de entrega', e(endOf(a))], ['Pedido', e(pm.id) + ' — ' + e(a.id)]]) + '<div class="mt"></div>' + itensTable(pm.itens) + '<div class="calc"><dl><dt>Desconto</dt><dd>− ' + A.money(pm.desconto) + '</dd><dt>Frete</dt><dd>' + A.money(pm.frete) + '</dd><dt class="tot">Total da nota</dt><dd class="tot">' + A.money(pm.total) + '</dd></dl></div><p class="small muted mt">A mão de obra não consta desta nota: é faturada diretamente pelo profissional ao cliente.</p>') }); },
    'c3.comprovante': (ds) => { const a = atd(ds.id), pm = a.pm, en = pm.entrega; A.modal({ title: 'Comprovante de entrega', sub: pm.id, size: 'lg', body: A.doc('Comprovante de entrega de materiais', e(pm.id) + ' — ' + e(pm.nf || ''), A.dl([['Entregue em', A.fdt(en.ts)], ['Recebido por', e(en.recebidoPor || en.recebedor)], ['Endereço', e(endOf(a))], ['Veículo', e(en.veiculo)], ['Início do serviço', a.exec ? A.fdt(a.exec.inicioPrev) : '—']]) + '<div class="mt"></div>' + A.table([{ l: 'Item', f: (x) => e(x.nome) }, { l: 'Qtd.', cls: 'r', f: (x) => e(qtdTxt(x)) }], pm.itens) + '<p class="small muted mt">Conferência técnica dos itens: feita pelo profissional na obra antes do início do serviço.</p>') }); },

    /* ---------- Cadastros ---------- */
    'c3.catPreco': () => A.form({ title: 'Ajustar preço da tabela AppCalhas', sub: 'Vale para as próximas propostas. Propostas já liberadas mantêm o preço.', submit: 'c3.catPrecoSave', fields: [{ name: 'id', label: 'Item', type: 'select', full: true, options: db().materiais.map((m) => ({ v: m.id, l: m.nome + ' — ' + A.money(m.preco) })) }, { name: 'preco', label: 'Novo preço (R$)', type: 'number', min: 0, step: 0.1, required: true, value: 70 }, { name: 'motivo', label: 'Motivo', value: 'Reajuste de custo da bobina galvalume', full: true }] }),
    'c3.catPrecoSave': (v) => { const m = mat(v.id); const antes = m.preco; m.preco = +v.preco; A.done('Preço atualizado: ' + m.nome + ' de ' + A.money(antes) + ' para ' + A.money(m.preco) + '.', 'Preço da tabela AppCalhas ajustado', m.id + ' · ' + v.motivo); },
    'c3.cliEdit': () => { const c = cli(MYCLI); A.form({ title: 'Editar meus dados', submit: 'c3.cliEditSave', fields: [{ name: 'tel', label: 'Telefone', type: 'tel', value: c.tel, required: true }, { name: 'email', label: 'E-mail', type: 'email', value: c.email, required: true }, { name: 'endereco', label: 'Endereço', value: c.endereco, full: true }] }); },
    'c3.cliEditSave': (v) => { Object.assign(cli(MYCLI), v); A.done('Dados atualizados.', 'Cadastro de cliente atualizado', MYCLI); },
    'c3.cliNovo': () => A.form({ title: 'Cadastrar cliente', submit: 'c3.cliNovoSave', fields: [{ name: 'nome', label: 'Nome', required: true, value: 'Otávio Mendes' }, { name: 'tipo', label: 'Tipo', type: 'select', options: ['Residencial', 'Comercial', 'Condomínio'] }, { name: 'tel', label: 'Telefone', type: 'tel', required: true, value: '(11) 98111-2233' }, { name: 'email', label: 'E-mail', type: 'email', required: true, value: 'otavio.mendes@email.demo' }, { name: 'cidade', label: 'Cidade / região', type: 'select', options: db().cidades }, { name: 'bairro', label: 'Bairro', value: 'Jardim Marajoara' }, { name: 'endereco', label: 'Endereço', value: 'Rua das Magnólias, 400', full: true }] }),
    'c3.cliNovoSave': (v) => { const d = db(), id = A.nextId('CLI-', d.clientes); d.clientes.push(Object.assign({ id: id, desde: A.now() }, v)); A.done('Cliente cadastrado.', 'Cliente cadastrado', id + ' · ' + v.nome); },
    'c3.proNovo': () => A.form({ title: 'Cadastrar profissional', sub: 'Entra em homologação: documentos, comprovação de capacitação para trabalho em altura e seguro.', submit: 'c3.proNovoSave', fields: [{ name: 'empresa', label: 'Empresa', required: true, value: 'Silva Calhas Express' }, { name: 'nome', label: 'Responsável', required: true, value: 'Diego Silva' }, { name: 'tel', label: 'Telefone', type: 'tel', required: true, value: '(11) 99000-1717' }, { name: 'email', label: 'E-mail', type: 'email', required: true, value: 'diego@silvacalhas.demo' }, { name: 'servicos', label: 'Especialidades', type: 'checks', full: true, options: db().servicos.map((s) => ({ v: s.id, l: s.nome })), value: ['SRV-01', 'SRV-02'] }, { name: 'regioes', label: 'Regiões', type: 'checks', full: true, options: db().cidades, value: ['São Paulo – Zona Sul', 'Itapecerica da Serra'] }] }),
    'c3.proNovoSave': (v) => { const d = db(), id = A.nextId('PRF-', d.pros); d.pros.push({ id: id, nome: v.nome, empresa: v.empresa, cidade: v.regioes[0] || 'São Paulo – Zona Sul', regioes: v.regioes, servicos: v.servicos, nota: 0, avals: 0, tel: v.tel, email: v.email, status: 'Em homologação', cor: A.colorFor(v.empresa) }); A.done('Profissional cadastrado em homologação.', 'Profissional cadastrado', id + ' · ' + v.empresa); },
    'c3.repDet': (ds) => { const a = atd(ds.id); A.modal({ title: a.id + ' — ' + a.titulo, sub: nomeCli(a) + ' — ' + cidadeOf(a), size: 'lg', body: A.stepper(STEPS, stepOf(a)) + '<div class="mt"></div>' + A.dl([['Profissional', a.pro ? e(pro(a.pro).empresa) : '—'], ['Etapa', etBadge(a)], ['Materiais (AppCalhas)', a.pm ? A.money(a.pm.total) + ' ' + pmBadge(a.pm) : '—'], ['Mão de obra', a.orc ? A.money(a.orc.maoObra) : '—'], ['Avaliação', a.avaliacao ? A.stars(a.avaliacao.nota) : '—'], ['Aberto', A.fdt(a.m.criado)], ['Visita', a.m.visita ? A.fdt(a.m.visita) : '—'], ['Proposta', a.m.orcamento ? A.fdt(a.m.orcamento) : '—'], ['Aprovação', a.m.aprovado ? A.fdt(a.m.aprovado) : '—'], ['Materiais na obra', a.m.entregue ? A.fdt(a.m.entregue) : '—'], ['Conclusão', a.m.concluido ? A.fdt(a.m.concluido) : '—'], ['Reclamação', a.reclamacao ? e(a.reclamacao.tipo + ' — ' + a.reclamacao.status) : 'Nenhuma']]), foot: '<button class="btn" data-act="core.close">Fechar</button>' + A.nav('Abrir atendimento', 'atendimento', a.id, 'p') }); },
  };
  function aprovar(a, por, via) {
    const o = a.orc;
    o.status = 'Aprovado'; o.aprovadoEm = A.now(); o.aprovadoPor = por; a.etapa = 'aprovado'; a.m.aprovado = A.now();
    a.exec = { inicioPrev: A.d(3, '08:00'), fimPrev: A.d(3, '17:00'), inicio: null, etapas: EXEC.map((n) => ({ n: n, ok: false, ts: null })) };
    if (o.itens.length) {
      a.pm = { id: 'PM-' + a.id.split('-')[1], criado: A.now(), itens: norm(o.itens), subtotal: orcMat(o), desconto: orcDesc(o), frete: orcFrete(o), total: orcMatTot(o), custo: custoMat(norm(o.itens)), status: 'aguardando_pagamento', pag: null, nf: '', fab: null, entrega: null, conf: null, ocorrencias: [], complementos: [], ev: [{ ts: A.now(), txt: 'Pedido de materiais gerado na aprovação da proposta', by: 'Sistema' }] };
    } else { a.etapa = 'pronto'; }
    hist(a, 'Proposta aprovada ' + via + ' — materiais ' + A.money(orcMatTot(o)) + ' + mão de obra ' + A.money(o.maoObra));
    sys(a, a.pm ? 'Proposta aprovada. Pedido de materiais ' + a.pm.id + ' gerado: pague ' + A.money(a.pm.total) + ' ao AppCalhas para liberar a fabricação. Início previsto do serviço: ' + A.fd(a.exec.inicioPrev) + '.' : 'Proposta aprovada (sem materiais). Início previsto: ' + A.fd(a.exec.inicioPrev) + '.');
    a.decisoes.push({ ts: A.now(), por: A.me().nome, txt: 'Aprovação registrada ' + via + ': materiais ' + A.money(orcMatTot(o)) + ' (AppCalhas) + mão de obra ' + A.money(o.maoObra) + ' — ' + o.condicoes + '.' });
    A.log('Proposta aprovada ' + via, a.id + ' · ' + A.money(orcTotal(o)));
    A.close(); A.setTab('atd', a.pm ? 'materiais' : 'resumo'); A.refresh();
    A.toast(a.pm ? 'Proposta aprovada. Próximo passo: pagar os materiais ao AppCalhas.' : 'Proposta aprovada.');
  }
  function cmpPago(a, c, forma, via) {
    c.status = 'pago'; c.pagoEm = A.now(); c.forma = forma;
    pev(a, 'Complemento ' + c.id + ' aprovado e pago (' + forma.toLowerCase() + ') — ' + via);
    sys(a, 'Complemento ' + c.id + ' aprovado e pago. Entrega: ' + (c.prazo || 'próxima rota') + '.');
    A.log('Complemento de material aprovado e pago', a.pm.id + ' · ' + c.id + ' · ' + A.money(c.total));
    A.setTab('atd', 'materiais'); A.refresh(); A.toast('Complemento aprovado e pago.');
  }

  /* ------------------------------------------------------------------
     Configuração
     ------------------------------------------------------------------ */
  const alertCount = () => db().atendimentos.filter((a) => alertas(a).some((x) => x.tone === 'bad')).length;
  const users = Object.assign({}, A.USERS, { cliente: Object.assign({}, A.USERS.cliente, { sub: 'Proprietária de residência em Interlagos — São Paulo/SP' }) });
  A.start({
    id: 'c3v2', num: 3, title: 'Atendimento acompanhado + materiais AppCalhas', ownMaterials: true, users: users,
    guide: { href: 'passo-a-passo.html', label: 'Veja o passo a passo' },
    seed: seed, seedLogs: seedLogs, actions: actions,
    about: {
      level: 3,
      resumo: 'O AppCalhas designa o profissional, acompanha o atendimento do pedido ao pós-venda e conduz toda a operação de materiais: precifica a lista técnica do profissional, recebe o pagamento, emite a ordem de fabricação para a fábrica, separa, fatura, entrega na obra na véspera do serviço e trata ocorrências e complementos. A mão de obra continua contratada e paga diretamente ao profissional.',
      como: ['O cliente registra a solicitação; o AppCalhas faz a triagem e designa um profissional homologado.', 'O AppCalhas combina a visita técnica; o profissional registra medidas e diagnóstico.', 'O profissional envia a mão de obra e a lista técnica de materiais (quantidades e especificação, sem preço).', 'O AppCalhas confere a proposta, precifica os materiais pela tabela AppCalhas, define frete e prazo e libera a proposta consolidada.', 'O cliente aprova e paga os materiais ao AppCalhas (Pix, cartão ou boleto); a mão de obra é paga ao profissional.', 'O AppCalhas emite a ordem de fabricação para a fábrica, separa, emite a nota fiscal e entrega na véspera do início.', 'O profissional confere o material na obra; só então o serviço é liberado. Faltas e avarias viram ocorrência com reposição pelo AppCalhas.', 'O profissional executa e atualiza as etapas; complementos de material são pedidos pelo app e entregues pelo AppCalhas.', 'O AppCalhas confirma a conclusão, solicita avaliação e acompanha garantias.'],
      mediador: ['Faz a triagem e designa o parceiro', 'Combina a visita técnica', 'Confere a proposta e precifica os materiais', 'Recebe o pagamento e emite a ordem de fabricação', 'Separa, fatura e programa a entrega na véspera', 'Trata ocorrências e complementos de material', 'Acompanha execução, atrasos e reclamações', 'Confirma a conclusão e solicita avaliação'],
      limite: 'o AppCalhas vende, cobra, fatura e entrega os materiais e acompanha a mão de obra, mas não a executa nem a cobra. O profissional responde pelas medidas, pela especificação técnica e pela execução; o cliente paga a mão de obra diretamente a ele.',
      exemplo: 'O instalador conferiu o material na obra e encontrou um bocal amassado. Ele registra a ocorrência com foto, o AppCalhas programa a reposição sem custo no mesmo dia e o serviço começa na data combinada.',
      painel: 'Atendimentos, visitas e propostas; pedidos de materiais (pagamento, fabricação, separação e nota fiscal, entregas, conferência na obra); ocorrências e complementos; catálogo, preços e margem; pós-venda e relatórios.',
      perfil: {
        cliente: { t: 'Uma proposta, um acompanhamento e o material entregue na sua obra.', d: 'Aprove a proposta consolidada, pague os materiais ao AppCalhas pelo app e acompanhe fabricação, entrega e execução. A mão de obra é paga ao profissional.' },
        profissional: { t: 'Você executa a mão de obra; o AppCalhas cuida do material.', d: 'Registre a visita, envie a mão de obra e a lista técnica, confira o material entregue na obra antes de começar e peça complementos pelo app. Decisões técnicas são suas.' },
        mediador: { t: 'Você coordena o atendimento e a operação de materiais.', d: 'Confira e precifique propostas, acompanhe pagamentos, emita ordens de fabricação, programe entregas na véspera e trate ocorrências, complementos e reclamações.' },
      },
    },
    profiles: {
      cliente: {
        home: 'atendimentos',
        menu: [{ sec: 'Atendimento' }, { id: 'atendimentos', label: 'Meus atendimentos', icon: 'clipboard', render: vCliLista, badge: () => meus().filter((a) => inArr(a.etapa, ['orcamento_liberado', 'concluido']) || (a.etapa === 'visita_agendada' && !a.visita.confirmadaCli)).length }, { id: 'nova', label: 'Nova solicitação', icon: 'plus', render: vCliNova }, { id: 'pedidos', label: 'Materiais e pagamentos', icon: 'truck', render: vCliPedidos, badge: () => meus().filter((a) => a.pm && ((a.pm.status === 'aguardando_pagamento' && !(a.pm.pag && a.pm.pag.forma === 'Boleto')) || a.pm.complementos.some((c) => c.status === 'aguardando_cliente'))).length }, { id: 'conversas', label: 'Conversas', icon: 'chat', render: vConversas }, { sec: 'Cadastro' }, { id: 'dados', label: 'Meus dados', icon: 'user', render: vCliDados }],
        hidden: { atendimento: { title: 'Atendimento', parent: 'atendimentos', render: vDetalhe } },
      },
      profissional: {
        home: 'agenda',
        menu: [{ sec: 'Trabalho' }, { id: 'agenda', label: 'Agenda', icon: 'calendar', render: vProAgenda }, { id: 'atendimentos', label: 'Meus atendimentos', icon: 'briefcase', render: vProLista, badge: () => meus().filter((a) => actionBar(a).filter((b) => b.indexOf('c3.nf') < 0).length).length }, { id: 'materiais', label: 'Materiais das obras', icon: 'box', render: vProMat, badge: () => meus().filter((a) => a.pm && a.pm.status === 'entregue').length }, { id: 'conversas', label: 'Conversas', icon: 'chat', render: vConversas }],
        hidden: { atendimento: { title: 'Atendimento', parent: 'atendimentos', render: vDetalhe } },
      },
      mediador: {
        home: 'fila',
        menu: [{ sec: 'Operação' }, { id: 'fila', label: 'Fila do dia', icon: 'home', render: vMedFila }, { id: 'atendimentos', label: 'Atendimentos', icon: 'clipboard', render: vMedLista }, { id: 'conversas', label: 'Conversas', icon: 'chat', render: vConversas }, { id: 'visitas', label: 'Agenda de visitas', icon: 'calendar', render: vMedVisitas, badge: () => db().atendimentos.filter((a) => a.etapa === 'designado').length }, { id: 'propostas', label: 'Propostas', icon: 'receipt', render: vMedPropostas, badge: () => db().atendimentos.filter((a) => a.etapa === 'orcamento_enviado').length },
          { sec: 'Materiais AppCalhas' }, { id: 'suprimentos', label: 'Materiais e entregas', icon: 'truck', render: vMedSup, badge: () => db().atendimentos.filter(pmAcaoMed).length }, { id: 'entregas', label: 'Agenda de entregas', icon: 'route', render: vMedEntregas }, { id: 'catalogo', label: 'Catálogo e preços', icon: 'store', render: vMedCat }, { id: 'fornecedores', label: 'Fornecedores', icon: 'building', render: vMedForn },
          { sec: 'Qualidade' }, { id: 'pendencias', label: 'Pendências e reclamações', icon: 'alert', render: vMedPend, badge: alertCount }, { id: 'posvenda', label: 'Pós-venda', icon: 'star', render: vMedPos },
          { sec: 'Cadastros' }, { id: 'profissionais', label: 'Profissionais', icon: 'users', render: vMedPros }, { id: 'clientes', label: 'Clientes', icon: 'user', render: vMedClientes }, { sec: 'Gestão' }, { id: 'relatorios', label: 'Relatórios', icon: 'chart', render: vMedRel }],
        hidden: { atendimento: { title: 'Atendimento', parent: 'atendimentos', render: vDetalhe } },
      },
    },
  });
})();
