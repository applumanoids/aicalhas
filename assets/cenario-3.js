/* =====================================================================
   AiCalhas — Cenário 3: Atendimento acompanhado
   A AiCalhas indica o profissional e acompanha o atendimento da
   solicitação à conclusão: visita, orçamento, aprovação, execução,
   pendências, reclamações e pós-venda. O pagamento é direto ao
   profissional; decisões técnicas ficam com ele.
   ===================================================================== */
(function () {
  'use strict';
  const A = AiC, e = A.esc, I = A.icon;
  const db = () => A.db();
  const MYPRO = 'PRF-101', MYCLI = 'CLI-201';
  const pro = (id) => db().pros.find((p) => p.id === id);
  const cli = (id) => db().clientes.find((c) => c.id === id);
  const atd = (id) => db().atendimentos.find((a) => a.id === id);
  const mat = (id) => db().materiais.find((m) => m.id === id);
  const srvName = (id) => (db().servicos.find((s) => s.id === id) || { nome: id }).nome;
  const ET = {
    solicitado: 'Solicitação recebida', triagem: 'Em triagem', designado: 'Profissional designado', visita_agendada: 'Visita agendada', visita_realizada: 'Aguardando orçamento',
    orcamento_enviado: 'Orçamento em conferência', orcamento_liberado: 'Aguardando aprovação do cliente', aprovado: 'Aprovado — aguardando início', execucao: 'Em execução', concluido: 'Concluído — aguardando confirmação', encerrado: 'Encerrado',
  };
  const ETK = Object.keys(ET);
  const STEPS = ['Solicitação', 'Visita', 'Orçamento', 'Aprovação', 'Execução', 'Conclusão', 'Avaliação'];
  const stepOf = (a) => ({ solicitado: 0, triagem: 0, designado: 1, visita_agendada: 1, visita_realizada: 2, orcamento_enviado: 2, orcamento_liberado: 3, aprovado: 4, execucao: 4, concluido: 5, encerrado: a.avaliacao ? 7 : 6 })[a.etapa];
  const TONE = { solicitado: 'info', triagem: 'warn', designado: 'warn', visita_agendada: 'info', visita_realizada: 'warn', orcamento_enviado: 'warn', orcamento_liberado: 'warn', aprovado: 'info', execucao: 'info', concluido: 'warn', encerrado: 'ok' };
  const etBadge = (a) => A.badge(ET[a.etapa], TONE[a.etapa]);
  const EXEC = ['Materiais separados', 'Remoção da calha antiga', 'Instalação da nova calha', 'Condutores e vedação', 'Teste de escoamento', 'Limpeza final'];
  const CONF = [['escopo', 'Escopo do serviço descrito'], ['materiais', 'Materiais discriminados com quantidades'], ['instalacao', 'Mão de obra / instalação informada'], ['prazo', 'Prazo de execução informado'], ['condicoes', 'Validade e condições de pagamento']];
  const COND = ['Direto ao profissional: 50% na aprovação e 50% na conclusão', 'Direto ao profissional: à vista na conclusão', 'Direto ao profissional: cartão em até 3x'];
  const nomeCli = (a) => (a.clienteId ? cli(a.clienteId).nome : a.clienteNome);
  const cidadeOf = (a) => (a.clienteId ? cli(a.clienteId).cidade : a.cidadeAvulsa);
  const orcMat = (o) => A.sum(o ? o.itens : [], (x) => x.qtd * x.preco);
  const orcTotal = (o) => (o ? orcMat(o) + (+o.maoObra || 0) : 0);
  const prog = (a) => (a.exec ? Math.round((a.exec.etapas.filter((x) => x.ok).length / a.exec.etapas.length) * 100) : 0);

  /* ------------------------------------------------------------------
     Dados fictícios
     ------------------------------------------------------------------ */
  function seed() {
    const b = A.base(), d = A.d;
    b.pros.forEach((p) => { p.status = p.status === 'Publicado' ? 'Ativo' : 'Em homologação'; });
    b.clientes.push({ id: 'CLI-210', nome: 'Tiago Moreira', tipo: 'Residencial', cidade: 'Campinas', bairro: 'Nova Campinas', endereco: 'Rua Hermantino Coelho, 210', tel: '(19) 98222-6611', email: 'tiago.moreira@email.demo', desde: d(-5) });
    const M = (de, nome, txt, ts) => ({ de: de, nome: nome, txt: txt, ts: ts });
    const H = (ts, txt, by, vis) => ({ ts: ts, txt: txt, by: by || '', vis: vis || 'all' });
    const I1 = (id, qtd) => { const m = b.materiais.find((x) => x.id === id); return { id: id, nome: m.nome, un: m.un, qtd: qtd, preco: m.preco, custo: m.custo }; };
    const exec = (done, ini, fim) => ({ inicioPrev: ini, fimPrev: fim, inicio: done >= 0 ? ini : null, etapas: EXEC.map((n, i) => ({ n: n, ok: i < done, ts: i < done ? ini : null })) });
    const L = [];
    L.push({ id: 'ATD-3015', ts: d(-3, '08:40'), clienteId: 'CLI-201', srv: 'SRV-02', titulo: 'Troca da calha frontal com vazamento', desc: 'A calha da frente está vazando na emenda perto da garagem; quando chove forte, a água escorre pela parede.', fotos: ['vazamento', 'calha-frontal'], prioridade: 'Alta', etapa: 'orcamento_liberado', pro: 'PRF-101',
      visita: { data: d(-1, '10:00'), confirmadaPro: true, confirmadaCli: true, realizada: { ts: d(-1, '10:50'), medidas: '9,5 m de calha frontal; 1 descida de 3 m', diagnostico: 'Emenda corroída e suportes soltos. Recomendada a troca de toda a calha frontal; condutor existente aproveitável com nova curva.', fotos: ['vazamento'] } },
      orc: { versao: 1, itens: [I1('MAT-01', 9.5), I1('MAT-07', 2), I1('MAT-06', 1), I1('MAT-08', 12), I1('MAT-09', 2), I1('MAT-10', 2)], maoObra: 950, prazo: '1 dia de execução', validade: d(10), condicoes: COND[0], escopo: 'Remoção da calha frontal existente (9,5 m), instalação de calha galvanizada nº 26 corte 33 com suportes a cada 80 cm, novo bocal e ligação ao condutor existente, vedação e teste de escoamento.', obs: 'Garantia de 12 meses para mão de obra.', enviado: d(-1, '17:30'), status: 'Liberado ao cliente', conferencia: { por: 'Juliana Rocha', ts: d(0, '10:15'), checks: ['escopo', 'materiais', 'instalacao', 'prazo', 'condicoes'], obs: 'Proposta completa.' }, liberado: d(0, '10:20') },
      exec: null, conclusao: null, avaliacao: null, reclamacao: null, pendencias: [],
      m: { criado: d(-3, '08:40'), visita: d(-1, '10:50'), orcamento: d(-1, '17:30') },
      msgs: [M('mediador', 'Juliana Rocha', 'Olá, Mariana! Recebemos sua solicitação. A Mendes Calhas & Coberturas vai fazer a visita técnica e eu acompanho todo o atendimento por aqui.', d(-3, '09:10')), M('cliente', 'Mariana Costa', 'Ótimo! A visita pode ser de manhã?', d(-3, '09:22')), M('mediador', 'Juliana Rocha', 'Visita agendada para ' + A.fdt(d(-1, '10:00')) + '. Carlos confirmou o horário.', d(-3, '10:05')), M('profissional', 'Carlos Mendes', 'Visita feita. A emenda está corroída; recomendo trocar os 9,5 m da frente. Envio o orçamento ainda hoje.', d(-1, '11:30')), M('mediador', 'Juliana Rocha', 'Orçamento conferido: escopo, materiais, instalação e prazo estão descritos. Já está disponível para sua aprovação.', d(0, '10:20')), M('cliente', 'Mariana Costa', 'Obrigada! Vou analisar ainda hoje.', d(0, '10:45'))],
      decisoes: [{ ts: d(0, '10:30'), por: 'Juliana Rocha', txt: 'Cliente perguntou sobre calha de alumínio; o profissional manteve galvanizada por compatibilidade com o condutor existente (decisão técnica do profissional).' }],
      hist: [H(d(-3, '08:40'), 'Solicitação recebida', 'Mariana Costa'), H(d(-3, '09:00'), 'Profissional designado: Mendes Calhas & Coberturas', 'Juliana Rocha'), H(d(-3, '10:05'), 'Visita agendada para ' + A.fdt(d(-1, '10:00')), 'Juliana Rocha'), H(d(-1, '10:50'), 'Visita técnica realizada', 'Carlos Mendes'), H(d(-1, '17:30'), 'Orçamento enviado pelo profissional', 'Carlos Mendes'), H(d(0, '10:15'), 'Orçamento conferido pela AiCalhas', 'Juliana Rocha'), H(d(0, '10:20'), 'Orçamento liberado para aprovação do cliente', 'Juliana Rocha')] });
    L.push({ id: 'ATD-3016', ts: d(-2, '14:00'), clienteId: 'CLI-208', srv: 'SRV-07', titulo: 'Revisão de calhas e rufos do prédio', desc: 'Prédio de dois andares. Revisão preventiva antes do período de chuvas e correção de pontos de infiltração no 2º andar.', fotos: ['rufo'], prioridade: 'Normal', etapa: 'visita_agendada', pro: 'PRF-101',
      visita: { data: d(0, '15:30'), confirmadaPro: true, confirmadaCli: true, realizada: null }, orc: null, exec: null, conclusao: null, avaliacao: null, reclamacao: null, pendencias: [], m: { criado: d(-2, '14:00') },
      msgs: [M('mediador', 'Juliana Rocha', 'Renata, a visita técnica ficou para ' + A.when(d(0, '15:30')).toLowerCase() + ' com a Mendes Calhas. Por favor, deixe a portaria avisada.', d(-1, '09:00')), M('cliente', 'Clínica Vida Plena', 'Combinado, vamos liberar o acesso à laje.', d(-1, '09:40'))],
      decisoes: [], hist: [H(d(-2, '14:00'), 'Solicitação recebida', 'Clínica Vida Plena'), H(d(-2, '16:00'), 'Profissional designado: Mendes Calhas & Coberturas', 'Juliana Rocha'), H(d(-1, '09:00'), 'Visita agendada', 'Juliana Rocha')] });
    L.push({ id: 'ATD-3012', ts: d(-6, '10:00'), clienteId: 'CLI-202', srv: 'SRV-03', titulo: 'Vazamento no rufo da edícula', desc: 'Infiltração na parede da edícula, junto ao rufo, em dias de chuva.', fotos: ['rufo'], prioridade: 'Normal', etapa: 'orcamento_enviado', pro: 'PRF-103',
      visita: { data: d(-3, '14:00'), confirmadaPro: true, confirmadaCli: true, realizada: { ts: d(-3, '14:40'), medidas: '6 m de rufo; 2 m de calha', diagnostico: 'Rufo com vedação ressecada e um trecho solto.', fotos: ['rufo'] } },
      orc: { versao: 1, itens: [I1('MAT-04', 6), I1('MAT-10', 2)], maoObra: 480, prazo: '', validade: d(12), condicoes: COND[1], escopo: 'Troca de 6 m de rufo galvanizado e nova vedação com PU.', obs: '', enviado: d(0, '09:10'), status: 'Em conferência' },
      exec: null, conclusao: null, avaliacao: null, reclamacao: null, pendencias: [], m: { criado: d(-6, '10:00'), visita: d(-3, '14:40'), orcamento: d(0, '09:10') },
      msgs: [M('profissional', 'Ana Beatriz Souza', 'Orçamento enviado para conferência.', d(0, '09:10'))], decisoes: [],
      hist: [H(d(-6, '10:00'), 'Solicitação recebida', 'Roberto Nunes'), H(d(-5, '09:00'), 'Profissional designado: Telhado Seguro Manutenção', 'Juliana Rocha'), H(d(-3, '14:40'), 'Visita técnica realizada', 'Ana Beatriz Souza'), H(d(0, '09:10'), 'Orçamento enviado pelo profissional', 'Ana Beatriz Souza')] });
    L.push({ id: 'ATD-3010', ts: d(-7, '09:00'), clienteId: 'CLI-203', srv: 'SRV-07', titulo: 'Revisão geral de calhas e condutores — 3 blocos', desc: 'Infiltração na garagem do bloco B quando chove. Revisão geral dos três blocos.', fotos: ['condutor'], prioridade: 'Normal', etapa: 'visita_realizada', pro: 'PRF-104',
      visita: { data: d(-3, '09:00'), confirmadaPro: true, confirmadaCli: true, realizada: { ts: d(-3, '11:30'), medidas: '48 m de calha; 9 descidas', diagnostico: 'Condutores do bloco B entupidos e duas emendas com vazamento.', fotos: ['condutor'] } },
      orc: null, exec: null, conclusao: null, avaliacao: null, reclamacao: null, pendencias: [], m: { criado: d(-7, '09:00'), visita: d(-3, '11:30') },
      msgs: [M('cliente', 'Cond. Jardim das Palmeiras', 'Bom dia! Ainda não recebemos o orçamento. Precisamos levar para a assembleia.', d(-1, '10:00'))], decisoes: [],
      hist: [H(d(-7, '09:00'), 'Solicitação recebida', 'Cond. Jardim das Palmeiras'), H(d(-6, '10:00'), 'Profissional designado: Pereira Funilaria de Obra', 'Juliana Rocha'), H(d(-3, '11:30'), 'Visita técnica realizada', 'João Pereira')] });
    L.push({ id: 'ATD-3008', ts: d(-12, '15:00'), clienteId: 'CLI-205', srv: 'SRV-02', titulo: 'Troca de calha sobre a área do forno', desc: 'Calha antiga com furos sobre a área de produção.', fotos: ['vazamento'], prioridade: 'Alta', etapa: 'execucao', pro: 'PRF-101',
      visita: { data: d(-10, '08:00'), confirmadaPro: true, confirmadaCli: true, realizada: { ts: d(-10, '08:40'), medidas: '14 m de calha; 2 descidas', diagnostico: 'Calha com corrosão generalizada.', fotos: [] } },
      orc: { versao: 1, itens: [I1('MAT-01', 14), I1('MAT-08', 18), I1('MAT-06', 2), I1('MAT-05', 2), I1('MAT-10', 3)], maoObra: 1400, prazo: '2 dias de execução', validade: d(5), condicoes: COND[0], escopo: 'Troca de 14 m de calha e duas descidas.', obs: '', enviado: d(-9, '18:00'), status: 'Aprovado', conferencia: { por: 'Juliana Rocha', ts: d(-8, '09:00'), checks: CONF.map((c) => c[0]) }, liberado: d(-8, '09:05'), aprovadoEm: d(-7, '11:00'), aprovadoPor: 'Padaria Pão Dourado' },
      exec: exec(3, d(-2, '07:30'), d(-1, '17:00')), conclusao: null, avaliacao: null, reclamacao: null, pendencias: [], m: { criado: d(-12, '15:00'), visita: d(-10, '08:40'), orcamento: d(-9, '18:00'), aprovado: d(-7, '11:00') },
      msgs: [M('profissional', 'Carlos Mendes', 'Choveu ontem à tarde e paramos na instalação. Retomo amanhã cedo.', d(-1, '16:20')), M('cliente', 'Padaria Pão Dourado', 'Precisamos que termine antes do fim de semana, por favor.', d(-1, '16:45'))], decisoes: [],
      hist: [H(d(-12, '15:00'), 'Solicitação recebida', 'Padaria Pão Dourado'), H(d(-7, '11:00'), 'Orçamento aprovado pelo cliente', 'Padaria Pão Dourado'), H(d(-2, '07:30'), 'Serviço iniciado', 'Carlos Mendes'), H(d(-1, '16:20'), 'Andamento atualizado: 50%', 'Carlos Mendes')] });
    L.push({ id: 'ATD-3013', ts: d(-1, '11:00'), clienteId: 'CLI-210', srv: 'SRV-01', titulo: 'Calhas de alumínio para área gourmet', desc: 'Área gourmet nova, cerca de 8 m de beiral sem calha.', fotos: ['aluminio'], prioridade: 'Normal', etapa: 'designado', pro: 'PRF-102', visita: null, orc: null, exec: null, conclusao: null, avaliacao: null, reclamacao: null, pendencias: [], m: { criado: d(-1, '11:00') },
      msgs: [M('mediador', 'Juliana Rocha', 'Tiago, a RL Calhas Sob Medida vai atender você. Vou combinar o melhor horário para a visita.', d(0, '09:00'))], decisoes: [], hist: [H(d(-1, '11:00'), 'Solicitação recebida', 'Tiago Moreira'), H(d(0, '09:00'), 'Profissional designado: RL Calhas Sob Medida', 'Juliana Rocha')] });
    L.push({ id: 'ATD-3017', ts: d(0, '11:40'), clienteId: 'CLI-207', srv: 'SRV-06', titulo: 'Condutor transbordando na lateral', desc: 'O condutor lateral transborda e molha o muro do vizinho.', fotos: ['condutor'], prioridade: 'Normal', etapa: 'solicitado', pro: null, visita: null, orc: null, exec: null, conclusao: null, avaliacao: null, reclamacao: null, pendencias: [], m: { criado: d(0, '11:40') }, msgs: [], decisoes: [], hist: [H(d(0, '11:40'), 'Solicitação recebida', 'Gustavo Ramos')] });
    L.push({ id: 'ATD-3005', ts: d(-15, '09:00'), clienteId: 'CLI-204', srv: 'SRV-04', titulo: 'Limpeza e tela protetora nas calhas', desc: 'Calhas entupidas por folhas.', fotos: ['limpeza'], prioridade: 'Normal', etapa: 'concluido', pro: 'PRF-105',
      visita: { data: d(-12, '14:00'), confirmadaPro: true, confirmadaCli: true, realizada: { ts: d(-12, '14:30'), medidas: '22 m de calha', diagnostico: 'Calhas íntegras, apenas entupidas.', fotos: [] } },
      orc: { versao: 1, itens: [I1('MAT-12', 22)], maoObra: 520, prazo: '1 dia', validade: d(-2), condicoes: COND[1], escopo: 'Limpeza completa e instalação de tela protetora.', obs: '', enviado: d(-11, '10:00'), status: 'Aprovado', conferencia: { por: 'Juliana Rocha', ts: d(-11, '11:00'), checks: CONF.map((c) => c[0]) }, aprovadoEm: d(-10, '09:00'), aprovadoPor: 'Helena Martins' },
      exec: exec(6, d(-2, '08:00'), d(-2, '17:00')), conclusao: { ts: d(-1, '16:00'), obs: 'Serviço concluído e teste de escoamento realizado.', fotos: ['limpeza'], garantia: '6 meses' }, avaliacao: null, reclamacao: null, pendencias: [],
      m: { criado: d(-15, '09:00'), visita: d(-12, '14:30'), orcamento: d(-11, '10:00'), aprovado: d(-10, '09:00'), concluido: d(-1, '16:00') }, msgs: [M('profissional', 'Marcos Teixeira', 'Serviço concluído. Pode conferir as fotos no atendimento.', d(-1, '16:05'))], decisoes: [],
      hist: [H(d(-15, '09:00'), 'Solicitação recebida', 'Helena Martins'), H(d(-1, '16:00'), 'Serviço concluído pelo profissional', 'Marcos Teixeira')] });
    L.push({ id: 'ATD-3003', ts: d(-30, '10:00'), clienteId: 'CLI-206', srv: 'SRV-02', titulo: 'Troca de calhas da quadra coberta', desc: 'Calhas da quadra com vazamentos.', fotos: ['calha-frontal'], prioridade: 'Normal', etapa: 'encerrado', pro: 'PRF-101',
      visita: { data: d(-28, '09:00'), confirmadaPro: true, confirmadaCli: true, realizada: { ts: d(-28, '09:40'), medidas: '26 m de calha; 4 descidas', diagnostico: 'Troca total recomendada.', fotos: [] } },
      orc: { versao: 1, itens: [I1('MAT-01', 26), I1('MAT-08', 32), I1('MAT-05', 4), I1('MAT-06', 4)], maoObra: 2300, prazo: '3 dias', validade: d(-15), condicoes: COND[0], escopo: 'Troca completa das calhas da quadra.', obs: '', enviado: d(-27, '10:00'), status: 'Aprovado', conferencia: { por: 'Juliana Rocha', ts: d(-27, '14:00'), checks: CONF.map((c) => c[0]) }, aprovadoEm: d(-25, '10:00'), aprovadoPor: 'Escola Pequeno Saber' },
      exec: exec(6, d(-22, '07:30'), d(-20, '17:00')), conclusao: { ts: d(-20, '16:30'), obs: 'Concluído.', fotos: [], garantia: '12 meses' }, confirmado: d(-19, '10:00'), avaliacao: { nota: 5, txt: 'Equipe organizada e AiCalhas sempre informando o andamento.', ts: d(-19, '10:05') },
      reclamacao: { id: 'REC-01', tipo: 'Infiltração após o serviço (garantia)', desc: 'Depois da chuva forte de ontem, apareceu uma goteira no vestiário, próximo a uma das descidas.', ts: d(-1, '08:30'), status: 'Aberta', acoes: [] }, pendencias: [],
      m: { criado: d(-30, '10:00'), visita: d(-28, '09:40'), orcamento: d(-27, '10:00'), aprovado: d(-25, '10:00'), concluido: d(-20, '16:30') },
      msgs: [M('cliente', 'Escola Pequeno Saber', 'Apareceu uma goteira no vestiário depois da chuva de ontem. O serviço tem garantia?', d(-1, '08:35'))], decisoes: [],
      hist: [H(d(-30, '10:00'), 'Solicitação recebida', 'Escola Pequeno Saber'), H(d(-20, '16:30'), 'Serviço concluído', 'Carlos Mendes'), H(d(-19, '10:05'), 'Atendimento avaliado pelo cliente: 5 estrelas', 'Escola Pequeno Saber'), H(d(-1, '08:30'), 'Reclamação registrada: infiltração após o serviço', 'Escola Pequeno Saber')] });
    L.push({ id: 'ATD-2990', ts: d(-80, '10:00'), clienteId: 'CLI-201', srv: 'SRV-04', titulo: 'Limpeza de calhas', desc: 'Limpeza geral antes das chuvas.', fotos: ['limpeza'], prioridade: 'Normal', etapa: 'encerrado', pro: 'PRF-103',
      visita: { data: d(-78, '09:00'), confirmadaPro: true, confirmadaCli: true, realizada: { ts: d(-78, '09:30'), medidas: '18 m de calha', diagnostico: 'Calhas entupidas.', fotos: [] } },
      orc: { versao: 1, itens: [], maoObra: 280, prazo: '1 dia', validade: d(-70), condicoes: COND[1], escopo: 'Limpeza e teste de escoamento.', obs: '', enviado: d(-78, '12:00'), status: 'Aprovado', conferencia: { por: 'Juliana Rocha', ts: d(-78, '14:00'), checks: CONF.map((c) => c[0]) }, aprovadoEm: d(-77, '09:00'), aprovadoPor: 'Mariana Costa' },
      exec: exec(6, d(-75, '08:00'), d(-75, '12:00')), conclusao: { ts: d(-75, '12:00'), obs: 'Concluído.', fotos: [], garantia: '3 meses' }, confirmado: d(-74, '09:00'), avaliacao: { nota: 5, txt: 'Muito bom! Recebi fotos do antes e depois.', ts: d(-74, '09:05') }, reclamacao: null, pendencias: [],
      m: { criado: d(-80, '10:00'), visita: d(-78, '09:30'), orcamento: d(-78, '12:00'), aprovado: d(-77, '09:00'), concluido: d(-75, '12:00') }, msgs: [], decisoes: [], hist: [H(d(-80, '10:00'), 'Solicitação recebida', 'Mariana Costa'), H(d(-74, '09:05'), 'Atendimento avaliado: 5 estrelas', 'Mariana Costa')] });
    // Histórico encerrado para relatórios
    const rnd = A.rng(23);
    const nomes = [['Luciana Prado', 'Valinhos'], ['Ricardo Sato', 'Campinas'], ['Daniela Vieira', 'Paulínia'], ['Rogério Campos', 'Jundiaí'], ['Patrícia Lemos', 'Indaiatuba'], ['André Luiz', 'Americana'], ['Fábio Nogueira', 'Campinas'], ['Marta Ribeiro', 'Valinhos'], ['Vinícius Rocha', 'Sumaré'], ['Vanessa Dias', 'Hortolândia'], ['Caio Mendonça', 'Campinas'], ['Sílvia Torres', 'Vinhedo'], ['Otávio Brandão', 'Jundiaí'], ['Lígia Paiva', 'Campinas']];
    const ativos = b.pros.filter((p) => p.status === 'Ativo');
    nomes.forEach((n, i) => {
      const cand = ativos.filter((p) => p.regioes.indexOf(n[1]) >= 0);
      const p = cand[Math.floor(rnd() * cand.length)];
      const srv = p.servicos[Math.floor(rnd() * p.servicos.length)];
      const c0 = -(10 + i * 6), v = c0 + 1 + Math.floor(rnd() * 2), o = v + 1 + Math.floor(rnd() * 3), ap = o + 1 + Math.floor(rnd() * 2), co = Math.min(-1, ap + 2 + Math.floor(rnd() * 4));
      const its = [['MAT-01', 6 + Math.floor(rnd() * 14)], ['MAT-08', 8 + Math.floor(rnd() * 12)], ['MAT-06', 1 + Math.floor(rnd() * 2)], ['MAT-10', 1 + Math.floor(rnd() * 2)]].slice(0, 2 + Math.floor(rnd() * 3)).map((x) => I1(x[0], x[1]));
      const nota = rnd() < 0.15 ? 3 : rnd() < 0.45 ? 4 : 5;
      const atrasou = rnd() < 0.25, devolvido = rnd() < 0.3, rec = rnd() < 0.18;
      L.push({ id: 'ATD-' + (2960 + i), ts: d(c0, '09:00'), clienteId: '', clienteNome: n[0], cidadeAvulsa: n[1], srv: srv, titulo: b.servicos.find((s) => s.id === srv).nome, desc: '', fotos: [], prioridade: 'Normal', etapa: 'encerrado', pro: p.id,
        visita: { data: d(v, '09:00'), confirmadaPro: true, confirmadaCli: true, realizada: { ts: d(v, '10:00'), medidas: '', diagnostico: '', fotos: [] } },
        orc: { versao: devolvido ? 2 : 1, itens: its, maoObra: 400 + Math.round(rnd() * 11) * 100, prazo: '1 a 2 dias', validade: d(o + 10), condicoes: COND[i % 3], escopo: 'Serviço de ' + b.servicos.find((s) => s.id === srv).nome.toLowerCase() + '.', obs: '', enviado: d(o, '17:00'), status: 'Aprovado', devolucoes: devolvido ? 1 : 0, conferencia: { por: 'Juliana Rocha', ts: d(o + 1, '09:00'), checks: CONF.map((c) => c[0]) }, aprovadoEm: d(ap, '10:00'), aprovadoPor: n[0] },
        exec: exec(6, d(co - 1, '08:00'), d(atrasou ? co - 2 : co, '17:00')), conclusao: { ts: d(co, '16:00'), obs: '', fotos: [], garantia: '12 meses' }, confirmado: d(Math.min(0, co + 1), '09:00'), atrasou: atrasou,
        avaliacao: { nota: nota, txt: '', ts: d(Math.min(0, co + 1), '09:10') }, reclamacao: rec ? { id: 'REC-H' + i, tipo: ['Acabamento', 'Atraso na execução', 'Infiltração após o serviço (garantia)'][i % 3], desc: '', ts: d(Math.min(0, co + 2), '10:00'), status: 'Resolvida', acoes: [{ ts: d(Math.min(0, co + 3), '10:00'), txt: 'Retorno do profissional e ajuste realizado.', por: 'Juliana Rocha' }] } : null, pendencias: [],
        m: { criado: d(c0, '09:00'), visita: d(v, '10:00'), orcamento: d(o, '17:00'), aprovado: d(ap, '10:00'), concluido: d(co, '16:00') }, msgs: [], decisoes: [], hist: [H(d(c0, '09:00'), 'Solicitação recebida', n[0]), H(d(co, '16:00'), 'Serviço concluído', p.nome)] });
    });
    b.atendimentos = L;
    return b;
  }
  function seedLogs() {
    return A.L([
      [-3, '08:40', 'Mariana Costa', 'cliente', 'Solicitação registrada', 'ATD-3015'],
      [-3, '09:00', 'Juliana Rocha', 'mediador', 'Profissional designado', 'ATD-3015 · Mendes Calhas & Coberturas'],
      [-3, '10:05', 'Juliana Rocha', 'mediador', 'Visita agendada', 'ATD-3015'],
      [-3, '11:30', 'Juliana Rocha', 'mediador', 'Visita técnica agendada', 'ATD-3010 · Pereira Funilaria'],
      [-2, '07:30', 'Carlos Mendes', 'profissional', 'Serviço iniciado', 'ATD-3008'],
      [-1, '08:30', 'Escola Pequeno Saber', 'cliente', 'Reclamação registrada', 'ATD-3003 · REC-01'],
      [-1, '10:50', 'Carlos Mendes', 'profissional', 'Visita técnica registrada', 'ATD-3015'],
      [-1, '16:00', 'Marcos Teixeira', 'profissional', 'Serviço concluído', 'ATD-3005'],
      [-1, '16:20', 'Carlos Mendes', 'profissional', 'Andamento atualizado: 50%', 'ATD-3008'],
      [-1, '17:30', 'Carlos Mendes', 'profissional', 'Orçamento enviado para conferência', 'ATD-3015 · ' + A.money(1848.9)],
      [0, '09:00', 'Juliana Rocha', 'mediador', 'Profissional designado', 'ATD-3013 · RL Calhas Sob Medida'],
      [0, '09:10', 'Ana Beatriz Souza', 'profissional', 'Orçamento enviado para conferência', 'ATD-3012'],
      [0, '10:15', 'Juliana Rocha', 'mediador', 'Proposta conferida (5 de 5 itens)', 'ATD-3015'],
      [0, '10:20', 'Juliana Rocha', 'mediador', 'Orçamento liberado ao cliente', 'ATD-3015'],
      [0, '10:30', 'Juliana Rocha', 'mediador', 'Decisão registrada', 'ATD-3015 · material mantido pelo profissional'],
      [0, '11:40', 'Gustavo Ramos', 'cliente', 'Solicitação registrada', 'ATD-3017'],
    ]);
  }

  /* ------------------------------------------------------------------
     Auxiliares de regra
     ------------------------------------------------------------------ */
  function alertas(a) {
    const out = [];
    if (a.etapa === 'visita_realizada' && a.visita && a.visita.realizada && A.hoursSince(a.visita.realizada.ts) > 48) out.push({ t: 'Orçamento atrasado', d: 'Visita feita ' + A.ago(a.visita.realizada.ts) + ' e o orçamento não foi enviado', tone: 'bad' });
    if (a.etapa === 'visita_agendada' && a.visita && A.hoursSince(a.visita.data) > 2) out.push({ t: 'Registro de visita pendente', d: 'Visita prevista para ' + A.fdt(a.visita.data), tone: 'warn' });
    if (a.etapa === 'orcamento_enviado' && a.orc && A.hoursSince(a.orc.enviado) > 8) out.push({ t: 'Conferência de proposta pendente', d: 'Enviado ' + A.ago(a.orc.enviado), tone: 'warn' });
    if (a.etapa === 'orcamento_liberado' && a.orc && a.orc.liberado && A.hoursSince(a.orc.liberado) > 72) out.push({ t: 'Cliente sem resposta ao orçamento', d: 'Liberado ' + A.ago(a.orc.liberado), tone: 'warn' });
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

  /* ------------------------------------------------------------------
     Detalhe do atendimento (compartilhado pelos três perfis)
     ------------------------------------------------------------------ */
  function actionBar(a) {
    const p = A.profile(), B = [];
    const id = { id: a.id };
    if (p === 'mediador') {
      if (a.etapa === 'solicitado') B.push(A.b('Iniciar triagem', 'c3.triar', id, 'p', 'search'));
      if (a.etapa === 'triagem' || a.etapa === 'solicitado') B.push(A.b('Designar profissional', 'c3.designar', id, a.etapa === 'triagem' ? 'p' : '', 'user'));
      if (a.etapa === 'designado') B.push(A.b('Agendar visita', 'c3.agendar', id, 'p', 'calendar'));
      if (a.etapa === 'visita_agendada') B.push(A.b('Reagendar visita', 'c3.agendar', id, '', 'calendar'));
      if (a.etapa === 'visita_realizada') B.push(A.b('Cobrar orçamento do profissional', 'c3.cobrar', id, 'p', 'bell'));
      if (a.etapa === 'orcamento_enviado') B.push(A.b('Conferir proposta', 'c3.conferir', id, 'p', 'clipboard'));
      if (a.etapa === 'orcamento_liberado') { B.push(A.b('Registrar aprovação do cliente', 'c3.aprovarPor', id, 'p', 'check')); B.push(A.b('Lembrar cliente', 'c3.lembrar', id, '', 'bell')); }
      if (a.etapa === 'execucao' || a.etapa === 'aprovado') B.push(A.b('Replanejar prazo', 'c3.replanejar', id, '', 'calendar'));
      if (a.etapa === 'concluido') B.push(A.b('Confirmar conclusão com o cliente', 'c3.confirmarMed', id, 'ok', 'phone'));
      if (a.etapa === 'encerrado' && !a.avaliacao) B.push(A.b('Solicitar avaliação', 'c3.solAval', id, '', 'star'));
      if (a.reclamacao && a.reclamacao.status !== 'Resolvida') B.push(A.b('Tratar reclamação', 'c3.tratarRec', id, 'dg', 'flag'));
      B.push(A.b('Registrar decisão', 'c3.decisao', id, 'gh', 'scale'));
      B.push(A.b('Registrar pendência', 'c3.pend', id, 'gh', 'alert'));
    } else if (p === 'profissional') {
      if (a.etapa === 'designado') B.push(A.b('Sugerir horários de visita', 'c3.sugerir', id, 'p', 'calendar'));
      if (a.etapa === 'visita_agendada') { if (!a.visita.confirmadaPro) B.push(A.b('Confirmar visita', 'c3.confVisPro', id, '', 'check')); B.push(A.b('Registrar visita', 'c3.regVisita', id, 'p', 'clipboard')); }
      if (a.etapa === 'visita_realizada') B.push(A.b(a.orc ? 'Revisar orçamento' : 'Elaborar orçamento', 'c3.orcamento', id, 'p', 'receipt'));
      if (a.etapa === 'aprovado') B.push(A.b('Iniciar serviço', 'c3.iniciar', id, 'p', 'play'));
      if (a.etapa === 'execucao') { B.push(A.b('Atualizar etapas', 'c3.etapas', id, '', 'layers')); B.push(A.b('Concluir serviço', 'c3.concluir', id, 'ok', 'check')); }
      if (a.reclamacao && a.reclamacao.encaminhada && a.reclamacao.status !== 'Resolvida') B.push(A.b('Registrar atendimento de garantia', 'c3.garantia', id, 'p', 'tool'));
    } else {
      if (a.etapa === 'visita_agendada') { if (!a.visita.confirmadaCli) B.push(A.b('Confirmar visita', 'c3.confVisCli', id, 'p', 'check')); B.push(A.b('Pedir outro horário', 'c3.outroHorario', id, '', 'calendar')); }
      if (a.etapa === 'orcamento_liberado') { B.push(A.b('Aprovar orçamento', 'c3.aprovar', id, 'ok', 'check')); B.push(A.b('Solicitar ajuste', 'c3.ajuste', id, '', 'edit')); }
      if (a.etapa === 'concluido') B.push(A.b('Confirmar conclusão e avaliar', 'c3.cliConfirma', id, 'ok', 'check'));
      if (a.etapa === 'encerrado' && !a.avaliacao) B.push(A.b('Avaliar atendimento', 'c3.avaliar', id, 'p', 'star'));
      if (['aprovado', 'execucao', 'concluido', 'encerrado'].indexOf(a.etapa) >= 0 && !(a.reclamacao && a.reclamacao.status !== 'Resolvida')) B.push(A.b('Relatar problema', 'c3.reclamar', id, 'gh', 'flag'));
    }
    return B;
  }
  function orcView(a) {
    const o = a.orc;
    if (!o) return A.empty(a.etapa === 'visita_realizada' ? 'O profissional está preparando o orçamento.' : 'O orçamento é elaborado após a visita técnica.', 'receipt');
    if (A.profile() === 'cliente' && ['Em conferência', 'Devolvido'].indexOf(o.status) >= 0) return A.empty('O orçamento está sendo conferido pela AiCalhas e ficará disponível em breve.', 'clipboard');
    return '<div class="row mb16">' + A.badge(o.status) + '<span class="small muted">Versão ' + o.versao + ' — enviado em ' + A.fdt(o.enviado) + '</span></div>' +
      '<h4 style="margin:0 0 6px">Escopo</h4><p>' + e(o.escopo || '—') + '</p>' +
      A.table([{ l: 'Material', f: (x) => e(x.nome) }, { l: 'Qtd.', cls: 'r', f: (x) => A.num(x.qtd, x.qtd % 1 ? 1 : 0) + ' ' + e(x.un) }, { l: 'Unitário', cls: 'r', f: (x) => A.money(x.preco) }, { l: 'Subtotal', cls: 'r', f: (x) => A.money(x.qtd * x.preco) }], o.itens, { empty: 'Sem materiais (somente mão de obra).', foot: ['Materiais', '', '', A.money(orcMat(o))] }) +
      '<div class="calc"><dl><dt>Materiais</dt><dd>' + A.money(orcMat(o)) + '</dd><dt>Mão de obra / instalação</dt><dd>' + A.money(o.maoObra) + '</dd><dt class="tot">Total do orçamento</dt><dd class="tot">' + A.money(orcTotal(o)) + '</dd></dl></div>' +
      '<div class="mt">' + A.dl([['Prazo de execução', o.prazo ? e(o.prazo) : A.badge('Não informado', 'bad')], ['Validade', A.fd(o.validade)], ['Condições de pagamento', e(o.condicoes)], ['Observações', e(o.obs || '—')]]) + '</div>' +
      (o.conferencia ? '<div class="mt"></div>' + A.note('Conferido pela AiCalhas em ' + A.fdt(o.conferencia.ts) + ' (' + o.conferencia.checks.length + ' de ' + CONF.length + ' itens). A AiCalhas confere se a proposta está completa; medidas e dimensionamento são de responsabilidade do profissional.') : '') +
      (o.devolucao ? '<div class="mt"></div>' + A.note('<b>Devolvido para ajuste:</b> ' + e(o.devolucao), 'warn') : '') +
      (o.ajusteCliente ? '<div class="mt"></div>' + A.note('<b>Ajuste solicitado pelo cliente:</b> ' + e(o.ajusteCliente), 'warn') : '') +
      (o.aprovadoEm ? '<div class="mt"></div>' + A.note('Aprovado por ' + e(o.aprovadoPor) + ' em ' + A.fdt(o.aprovadoEm) + '. Pagamento direto ao profissional, conforme as condições acima.', '', 'check') : '');
  }
  function vDetalhe() {
    const a = atd(A.sel('atendimento'));
    if (!a) return A.empty('Atendimento não encontrado.');
    const p = A.profile(), pf = a.pro ? pro(a.pro) : null, c = a.clienteId ? cli(a.clienteId) : null;
    const tab = A.tab('atd', 'resumo');
    const al = alertas(a);
    const tabs = [{ id: 'resumo', l: 'Resumo' }, { id: 'conversa', l: 'Conversa', n: a.msgs.filter((m) => m.de !== 'sistema').length }, { id: 'visita', l: 'Visita' }, { id: 'orcamento', l: 'Orçamento' }, { id: 'execucao', l: 'Execução' }, { id: 'historico', l: 'Histórico' }];
    let body = '';
    if (tab === 'resumo') {
      body = '<div class="g2"><div>' + A.dl([['Serviço', e(srvName(a.srv))], ['Etapa atual', etBadge(a)], ['Cliente', e(nomeCli(a)) + (c && c.contato ? '<small> — ' + e(c.contato) + '</small>' : '')], ['Local', e(c ? c.bairro + ', ' + c.cidade : cidadeOf(a))], ['Profissional', pf ? e(pf.empresa) : 'A definir'], ['Valor do orçamento', a.orc && (p !== 'cliente' || ['Em conferência', 'Devolvido'].indexOf(a.orc.status) < 0) ? A.money(orcTotal(a.orc)) : '—']]) + '<h4 style="margin:16px 0 6px">Descrição do cliente</h4><p>' + e(a.desc || '—') + '</p></div>' +
        '<div>' + (a.fotos.length ? '<div class="gal">' + a.fotos.map((f) => A.zoomable(f, 'Foto da solicitação')).join('') + '</div>' : A.empty('Sem fotos na solicitação.', 'image')) + '</div></div>' +
        (a.visita && a.etapa === 'visita_agendada' ? '<div class="mt"></div>' + A.note('Visita agendada para <b>' + A.when(a.visita.data) + '</b>. Profissional ' + (a.visita.confirmadaPro ? 'confirmou' : 'ainda não confirmou') + '; cliente ' + (a.visita.confirmadaCli ? 'confirmou' : 'ainda não confirmou') + '.', '', 'calendar') : '') +
        (a.exec && a.etapa === 'execucao' ? '<div class="mt"></div>' + A.note('Execução em andamento: <b>' + prog(a) + '%</b>. Previsão de término: ' + A.fdt(a.exec.fimPrev) + '.', '', 'layers') : '') +
        (a.reclamacao ? '<div class="mt"></div>' + A.note('<b>Reclamação ' + e(a.reclamacao.status.toLowerCase()) + ':</b> ' + e(a.reclamacao.tipo) + ' — ' + e(a.reclamacao.desc) + (a.reclamacao.acoes.length ? '<br><small>Última ação: ' + e(a.reclamacao.acoes[a.reclamacao.acoes.length - 1].txt) + '</small>' : ''), a.reclamacao.status === 'Resolvida' ? '' : 'bad') : '') +
        (a.avaliacao ? '<div class="mt"></div>' + A.note('Avaliação do cliente: ' + A.stars(a.avaliacao.nota) + ' ' + e(a.avaliacao.txt || ''), '', 'star') : '');
    } else if (tab === 'conversa') {
      body = A.note(p === 'mediador' ? 'Conversa entre cliente, profissional e AiCalhas. Tudo fica registrado no atendimento.' : 'A AiCalhas acompanha esta conversa e ajuda quando houver dúvidas ou dificuldades.') + '<div class="mt"></div>' + A.chat(a.msgs, 'c3.msg', a.id);
    } else if (tab === 'visita') {
      const v = a.visita;
      body = !v ? A.empty('A visita ainda não foi agendada.', 'calendar') : A.dl([['Data agendada', A.fdt(v.data)], ['Confirmação do profissional', v.confirmadaPro ? A.badge('Confirmado', 'ok') : A.badge('Pendente', 'warn')], ['Confirmação do cliente', v.confirmadaCli ? A.badge('Confirmado', 'ok') : A.badge('Pendente', 'warn')], ['Situação', v.realizada ? A.badge('Realizada') : A.badge('Agendada')]]) +
        (v.realizada ? '<h4 style="margin:16px 0 6px">Registro da visita</h4>' + A.dl([['Realizada em', A.fdt(v.realizada.ts)], ['Levantamento / medidas', e(v.realizada.medidas || '—')]], '') + '<p class="mt">' + e(v.realizada.diagnostico || '') + '</p>' + (v.realizada.fotos && v.realizada.fotos.length ? '<div class="gal">' + v.realizada.fotos.map((f) => A.zoomable(f, 'Foto da visita')).join('') + '</div>' : '') + '<div class="mt"></div>' + A.note('Medidas e dimensionamento são definidos pelo profissional responsável.') : '');
    } else if (tab === 'orcamento') {
      body = orcView(a);
    } else if (tab === 'execucao') {
      body = !a.exec ? A.empty('A execução começa após a aprovação do orçamento.', 'layers') : '<div class="bar" style="grid-template-columns:auto 1fr auto;margin-bottom:14px"><span>Andamento</span><span class="tr"><span class="fl" style="width:' + prog(a) + '%"></span></span><b>' + prog(a) + '%</b></div>' +
        A.dl([['Início previsto', A.fdt(a.exec.inicioPrev)], ['Término previsto', A.fdt(a.exec.fimPrev)], ['Início real', a.exec.inicio ? A.fdt(a.exec.inicio) : '—'], ['Conclusão', a.conclusao ? A.fdt(a.conclusao.ts) : '—']]) +
        '<ul class="ul chk mt">' + a.exec.etapas.map((x) => '<li style="color:' + (x.ok ? 'inherit' : 'var(--muted)') + '">' + I(x.ok ? 'check' : 'clock', 15) + '<span>' + e(x.n) + (x.ok && x.ts ? ' <small class="muted">— ' + A.fdt(x.ts) + '</small>' : '') + '</span></li>').join('') + '</ul>' +
        (a.conclusao ? '<h4 style="margin:16px 0 6px">Conclusão</h4><p>' + e(a.conclusao.obs) + ' Garantia: ' + e(a.conclusao.garantia) + '.</p>' + (a.conclusao.fotos.length ? '<div class="gal">' + a.conclusao.fotos.map((f) => A.zoomable(f, 'Foto da conclusão')).join('') + '</div>' : '') : '');
    } else {
      const ev = a.hist.filter((h) => p === 'mediador' || h.vis === 'all').map((h) => ({ ts: h.ts, txt: (h.vis === 'interno' ? '[interno] ' : '') + h.txt, by: h.by }));
      body = (p === 'mediador' ? '<h4 style="margin:0 0 8px">Decisões registradas</h4>' + (a.decisoes.length ? A.timeline(a.decisoes.slice().reverse().map((x) => ({ ts: x.ts, txt: x.txt, by: x.por, tone: 'ok' }))) : A.empty('Nenhuma decisão registrada.', 'scale')) + '<h4 style="margin:18px 0 8px">Linha do tempo</h4>' : '') + A.timeline(ev.reverse());
    }
    const acts = actionBar(a);
    const back = p === 'mediador' ? ['atendimentos', 'Atendimentos'] : ['atendimentos', p === 'cliente' ? 'Meus atendimentos' : 'Meus atendimentos'];
    return A.ph(a.titulo, e(a.id) + ' — ' + e(nomeCli(a)) + ' — aberto em ' + A.fdt(a.ts), etBadge(a), back) +
      A.card(null, A.stepper(STEPS, stepOf(a))) +
      (al.length && p !== 'cliente' ? '<div class="mt"></div>' + al.map((x) => A.note('<b>' + e(x.t) + ':</b> ' + e(x.d), x.tone === 'bad' ? 'bad' : 'warn')).join('<div style="height:8px"></div>') : '') +
      '<div class="g21 mt"><div>' + A.card(null, A.tabs('atd', tabs) + body) + '</div><div class="stack">' +
      (acts.length ? A.card(p === 'mediador' ? 'Ações da AiCalhas' : 'O que fazer agora', '<div class="stack" style="gap:8px">' + acts.join('') + '</div>', { icon: p === 'mediador' ? 'shield' : 'flag' }) : '') +
      (pf ? A.card('Profissional responsável', '<div class="li">' + A.av(pf.empresa, pf.cor) + '<div class="lt"><b>' + e(pf.empresa) + '</b><small>' + e(pf.nome) + ' — ' + A.num(pf.nota, 1) + ' ★</small></div></div>' + (p !== 'profissional' ? A.dl([['Telefone', e(pf.tel)]], 'one') : ''), { icon: 'tool' }) : '') +
      (p !== 'cliente' && c ? A.card('Cliente', A.dl([['Nome', e(c.nome)], ['Telefone', e(c.tel)], ['Endereço', e(c.endereco + ' — ' + c.bairro + ', ' + c.cidade)]], 'one'), { icon: 'user' }) : '') +
      A.card('Acompanhamento AiCalhas', '<div class="li">' + A.av('Juliana Rocha', A.USERS.mediador.cor) + '<div class="lt"><b>Juliana Rocha</b><small>Mediadora responsável</small></div></div><p class="small muted mt">' + (p === 'cliente' ? 'Fale com a AiCalhas pela conversa do atendimento sempre que precisar.' : 'Acompanha prazos, cobra respostas e registra decisões.') + '</p>', { icon: 'shield' }) +
      '</div></div>';
  }

  /* ------------------------------------------------------------------
     Listas por perfil
     ------------------------------------------------------------------ */
  function atdCard(a) {
    const pf = a.pro ? pro(a.pro) : null;
    const next = { solicitado: 'A AiCalhas vai analisar o pedido', triagem: 'Seleção do profissional', designado: 'Agendamento da visita', visita_agendada: 'Visita ' + (a.visita ? A.when(a.visita.data) : ''), visita_realizada: 'Profissional preparando orçamento', orcamento_enviado: 'AiCalhas conferindo a proposta', orcamento_liberado: 'Aprovação do orçamento', aprovado: 'Início do serviço', execucao: 'Execução: ' + prog(a) + '%', concluido: 'Confirmação da conclusão', encerrado: a.avaliacao ? 'Atendimento avaliado' : 'Avaliação do atendimento' }[a.etapa];
    return '<section class="card"><div class="card-h">' + I('clipboard', 18) + '<h3>' + e(a.titulo) + '</h3><div class="card-r">' + etBadge(a) + '</div></div><div class="card-b"><div class="small muted mb16">' + e(a.id) + ' — ' + e(nomeCli(a)) + ' — ' + e(cidadeOf(a)) + (pf ? ' — ' + e(pf.empresa) : '') + '</div>' + A.stepper(STEPS, stepOf(a)) +
      '<div class="row mt"><span class="small">' + I('arrowR', 15) + ' Próximo passo: <b>' + e(next) + '</b></span><span class="spacer"></span>' + A.b('Conversa', 'c3.openChat', { id: a.id }, 'sm', 'chat') + A.nav('Abrir atendimento', 'atendimento', a.id, 'sm p', 'eye') + '</div></div></section>';
  }
  function vCliLista() {
    const list = meus().sort((a, b) => (a.ts < b.ts ? 1 : -1));
    return A.ph('Meus atendimentos', 'A AiCalhas acompanha cada etapa: visita, orçamento, aprovação, execução e pós-venda.', A.nav('Nova solicitação', 'nova', null, 'p', 'plus')) + (list.length ? '<div class="stack">' + list.map(atdCard).join('') + '</div>' : A.card(null, A.empty('Nenhum atendimento ainda.', 'inbox')));
  }
  function vCliNova() {
    const c = cli(MYCLI);
    return A.ph('Nova solicitação', 'Descreva a necessidade. A AiCalhas designa o profissional, agenda a visita e acompanha o atendimento até o fim.') +
      '<div class="g21"><div>' + A.card(null, '<form data-form="c3.novaSave" class="fg" autocomplete="off">' +
        '<div class="f"><label>Serviço <i class="req">*</i></label><select class="inp" name="srv" required>' + db().servicos.map((s) => '<option value="' + s.id + '"' + (s.id === 'SRV-05' ? ' selected' : '') + '>' + e(s.nome) + '</option>').join('') + '</select></div>' +
        '<div class="f"><label>Prioridade</label><select class="inp" name="prioridade"><option>Normal</option><option>Alta</option></select></div>' +
        '<div class="f full"><label>Título <i class="req">*</i></label><input class="inp" name="titulo" required value="Rufo do muro dos fundos soltando"></div>' +
        '<div class="f full"><label>Descrição <i class="req">*</i></label><textarea class="inp" name="desc" rows="4" required>O rufo do muro dos fundos está solto em dois pontos e a água escorre pela parede do vizinho.</textarea></div>' +
        '<div class="f full"><label>Endereço</label><input class="inp" name="endereco" value="' + e(c.endereco + ' — ' + c.bairro + ', ' + c.cidade) + '"></div>' +
        '<div class="f full"><label>Fotos</label><div class="pf"><label class="pf-up">' + I('camera', 22) + '<span><b>Escolher fotos do dispositivo</b><small>Simulação: as imagens ficam apenas neste navegador.</small></span><input type="file" name="fotos" accept="image/*" multiple data-preview="1"></label><div class="fprev"></div><div class="pf-or">Ou marque imagens ilustrativas:</div><div class="pf-pre" data-multi="fotos__preset">' + ['rufo', 'vazamento', 'calha-frontal', 'condutor'].map((k, i) => '<label class="pf-p"><input type="checkbox" name="fotos__preset" value="' + k + '"' + (i === 0 ? ' checked' : '') + '>' + A.photo(k) + '<small>' + e(A.ILL[k].l) + '</small></label>').join('') + '</div></div></div>' +
        '<div class="f full"><label class="ck single"><input type="checkbox" data-bool="1" name="consent" required checked><span>Autorizo a AiCalhas a compartilhar meus dados com o profissional designado para este atendimento. <i class="req">*</i></span></label></div>' +
        '<div class="f full"><div class="row"><span class="spacer"></span><button class="btn p" type="submit">' + I('send', 16) + ' Enviar solicitação</button></div></div></form>') + '</div>' +
      '<div>' + A.card('Como a AiCalhas acompanha', '<ol class="ol"><li>Triagem e designação do profissional.</li><li>Agendamento e confirmação da visita.</li><li>Conferência do orçamento antes de chegar a você.</li><li>Registro da sua aprovação e acompanhamento da execução.</li><li>Confirmação da conclusão, avaliação e pós-venda.</li></ol>' + A.note('O pagamento é feito diretamente ao profissional, conforme as condições do orçamento.'), { icon: 'shield' }) + '</div></div>';
  }
  function vConversas() {
    const list = meus().filter((a) => a.msgs.length).sort((a, b) => (a.msgs[a.msgs.length - 1].ts < b.msgs[b.msgs.length - 1].ts ? 1 : -1));
    return A.ph('Conversas', A.profile() === 'mediador' ? 'Conversas de todos os atendimentos acompanhados, com cliente, profissional e AiCalhas.' : 'Conversas dos seus atendimentos. A AiCalhas participa de todas.') +
      A.card(null, list.length ? list.map((a) => { const m = a.msgs[a.msgs.length - 1]; return '<div class="li clk" data-act="c3.openChat" data-id="' + a.id + '">' + A.av(m.nome || 'AiCalhas') + '<div class="lt"><b>' + e(a.id) + ' — ' + e(a.titulo) + '</b><small>' + e(m.nome ? m.nome + ': ' : '') + e(m.txt.length > 110 ? m.txt.slice(0, 110) + '…' : m.txt) + '</small></div><span class="small muted nowrap">' + A.ago(m.ts) + '</span></div>'; }).join('') : A.empty('Nenhuma conversa.', 'chat'));
  }
  function vCliDados() {
    const c = cli(MYCLI);
    return A.ph('Meus dados', 'Usados pela AiCalhas e pelo profissional designado no atendimento.', A.b('Editar dados', 'c3.cliEdit', {}, 'p', 'edit')) + A.card('Cadastro', A.dl([['Nome', e(c.nome)], ['Telefone', e(c.tel)], ['E-mail', e(c.email)], ['Endereço', e(c.endereco + ' — ' + c.bairro + ', ' + c.cidade)]]), { icon: 'user' });
  }
  /* Profissional */
  function vProAgenda() {
    const list = meus();
    const ev = [];
    list.forEach((a) => {
      if (a.visita && !a.visita.realizada) ev.push({ ts: a.visita.data, t: 'Visita técnica', a: a, ic: 'clipboard' });
      if (a.exec && (a.etapa === 'aprovado' || a.etapa === 'execucao')) { ev.push({ ts: a.exec.inicioPrev, t: a.etapa === 'execucao' ? 'Execução em andamento' : 'Início do serviço', a: a, ic: 'tool' }); }
      if (a.reclamacao && a.reclamacao.visitaGarantia && a.reclamacao.status !== 'Resolvida') ev.push({ ts: a.reclamacao.visitaGarantia, t: 'Visita de garantia', a: a, ic: 'shield' });
    });
    ev.sort((x, y) => (x.ts < y.ts ? -1 : 1));
    const days = [];
    for (let i = -1; i < 7; i++) days.push(i);
    const pend = list.filter((a) => actionBar(a).length);
    return A.ph('Minha agenda', 'Visitas, execuções e retornos de garantia dos atendimentos acompanhados pela AiCalhas.') +
      '<div class="g4 mb16">' + A.kpi({ l: 'Visitas agendadas', v: list.filter((a) => a.etapa === 'visita_agendada').length, icon: 'calendar' }) + A.kpi({ l: 'Orçamentos a enviar', v: list.filter((a) => a.etapa === 'visita_realizada').length, icon: 'receipt', tone: 'warn' }) + A.kpi({ l: 'Serviços em execução', v: list.filter((a) => a.etapa === 'execucao').length, icon: 'tool' }) + A.kpi({ l: 'Garantias em aberto', v: list.filter((a) => a.reclamacao && a.reclamacao.status !== 'Resolvida').length, icon: 'shield', tone: 'bad' }) + '</div>' +
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
    const list = all.filter((a) => (tab === 'ativos' ? a.etapa !== 'encerrado' || (a.reclamacao && a.reclamacao.status !== 'Resolvida') : a.etapa === 'encerrado'));
    return A.ph('Meus atendimentos', 'Pedidos designados pela AiCalhas para você.') + A.tabs('plist', [{ id: 'ativos', l: 'Em andamento', n: all.filter((a) => a.etapa !== 'encerrado' || (a.reclamacao && a.reclamacao.status !== 'Resolvida')).length }, { id: 'enc', l: 'Encerrados', n: all.filter((a) => a.etapa === 'encerrado').length }]) +
      (list.length ? '<div class="stack">' + list.map(atdCard).join('') + '</div>' : A.card(null, A.empty('Nenhum atendimento nesta lista.')));
  }
  function vProMateriais() {
    const list = meus().filter((a) => a.orc && ['aprovado', 'execucao'].indexOf(a.etapa) >= 0);
    return A.ph('Lista de materiais', 'Materiais previstos nos orçamentos aprovados. Marque o que já foi separado para a obra.') +
      (list.length ? '<div class="stack">' + list.map((a) => A.card(a.id + ' — ' + a.titulo, A.table([
        { l: 'Separado', f: (x) => '<input type="checkbox" aria-label="Separado" data-act="c3.matSep" data-id="' + a.id + '" data-i="' + x.i + '"' + (x.sep ? ' checked' : '') + '>' },
        { l: 'Material', f: (x) => e(x.nome) }, { l: 'Quantidade', cls: 'r', f: (x) => A.num(x.qtd, x.qtd % 1 ? 1 : 0) + ' ' + e(x.un) }, { l: 'Valor', cls: 'r', f: (x) => A.money(x.qtd * x.preco) },
      ], a.orc.itens.map((x, i) => Object.assign({ i: i }, x)), { empty: 'Sem materiais previstos.' }) + '<div class="row mt"><span class="small muted">' + a.orc.itens.filter((x) => x.sep).length + ' de ' + a.orc.itens.length + ' itens separados — ' + e(nomeCli(a)) + ', ' + e(cidadeOf(a)) + '</span><span class="spacer"></span>' + A.nav('Abrir atendimento', 'atendimento', a.id, 'sm', 'eye') + '</div>', { icon: 'box', right: etBadge(a) })).join('') + '</div>' : A.card(null, A.empty('Nenhum orçamento aprovado aguardando execução.', 'box')));
  }
  /* Mediador */
  function vMedFila() {
    const d = db();
    const ativos = d.atendimentos.filter((a) => a.etapa !== 'encerrado' || (a.reclamacao && a.reclamacao.status !== 'Resolvida'));
    const cols = [
      { t: 'Pedidos novos', ic: 'inbox', f: (a) => ['solicitado', 'triagem'].indexOf(a.etapa) >= 0 },
      { t: 'Visitas a agendar', ic: 'calendar', f: (a) => a.etapa === 'designado' || (a.etapa === 'visita_agendada' && A.dayDiff(a.visita.data) <= 0) },
      { t: 'Orçamentos pendentes', ic: 'receipt', f: (a) => ['visita_realizada', 'orcamento_enviado', 'orcamento_liberado'].indexOf(a.etapa) >= 0 },
      { t: 'Serviços em andamento', ic: 'tool', f: (a) => ['aprovado', 'execucao'].indexOf(a.etapa) >= 0 },
      { t: 'Precisam de solução', ic: 'alert', f: (a) => alertas(a).some((x) => x.tone === 'bad') || a.etapa === 'concluido' || (a.reclamacao && a.reclamacao.status !== 'Resolvida') },
    ];
    const all = d.atendimentos.filter((a) => A.inPeriod(a.ts, '30'));
    return A.ph('Fila do dia', 'Pedidos novos, visitas a agendar, orçamentos pendentes, serviços em andamento e situações que precisam de solução.', A.nav('Ver todos os atendimentos', 'atendimentos', null, '', 'clipboard')) +
      '<div class="g4 mb16">' + A.kpi({ l: 'Atendimentos ativos', v: ativos.length, icon: 'clipboard' }) + A.kpi({ l: 'Alertas de prazo', v: ativos.filter((a) => alertas(a).length).length, icon: 'clock', tone: 'warn' }) + A.kpi({ l: 'Reclamações abertas', v: d.atendimentos.filter((a) => a.reclamacao && a.reclamacao.status !== 'Resolvida').length, icon: 'flag', tone: 'bad' }) + A.kpi({ l: 'Avaliação média (30 dias)', v: A.num(A.avg(all.filter((a) => a.avaliacao), (a) => a.avaliacao.nota) || A.avg(d.atendimentos.filter((a) => a.avaliacao), (a) => a.avaliacao.nota), 1), icon: 'star', tone: 'ok' }) + '</div>' +
      '<div class="kb">' + cols.map((c) => { const items = ativos.filter(c.f); return '<div class="kb-col"><div class="kb-h">' + I(c.ic, 16) + e(c.t) + '<span class="n">' + items.length + '</span></div>' + (items.length ? items.map((a) => { const al = alertas(a); return '<button type="button" class="kb-c ' + (al.some((x) => x.tone === 'bad') ? 'alert' : al.length ? 'warnb' : '') + '" data-act="core.nav" data-view="atendimento" data-id="' + a.id + '"><b>' + e(a.titulo) + '</b><small>' + e(a.id) + ' — ' + e(nomeCli(a)) + '</small>' + etBadge(a) + (al.length ? '<small style="color:var(--bad)">' + e(al[0].t) + '</small>' : '') + (a.pro ? '<small>' + e(pro(a.pro).empresa) + '</small>' : '') + '</button>'; }).join('') : '<div class="small muted" style="padding:6px">Nada aqui.</div>') + '</div>'; }).join('') + '</div>';
  }
  function vMedLista() {
    const et = A.fv('mlist', 'et'), pf = A.fv('mlist', 'pro'), q = A.fv('mlist', 'q').toLowerCase(), al = A.fv('mlist', 'al');
    let list = db().atendimentos.slice();
    if (et) list = list.filter((a) => a.etapa === et);
    if (pf) list = list.filter((a) => a.pro === pf);
    if (al) list = list.filter((a) => alertas(a).length);
    if (q) list = list.filter((a) => (a.id + ' ' + a.titulo + ' ' + nomeCli(a) + ' ' + cidadeOf(a)).toLowerCase().indexOf(q) >= 0);
    list.sort((a, b) => (a.ts < b.ts ? 1 : -1));
    return A.ph('Atendimentos', 'Todos os atendimentos acompanhados, com etapa, prazos e responsáveis.', A.b('Registrar solicitação', 'c3.medNova', {}, 'p', 'plus')) +
      A.card(null, A.filters('mlist', [{ k: 'et', l: 'Etapa', o: A.opts(ETK.map((k) => ({ v: k, l: ET[k] })), 'Todas') }, { k: 'pro', l: 'Profissional', o: A.opts(db().pros.filter((p) => p.status === 'Ativo').map((p) => ({ v: p.id, l: p.empresa })), 'Todos') }, { k: 'al', l: 'Alertas', o: [{ v: '', l: 'Todos' }, { v: '1', l: 'Somente com alerta' }] }, { k: 'q', type: 'search', l: 'Buscar por código, cliente ou cidade' }]) + A.table([
        { l: 'Atendimento', f: (a) => '<b>' + e(a.id) + '</b><small>' + e(a.titulo) + '</small>' },
        { l: 'Cliente', f: (a) => e(nomeCli(a)) + '<small>' + e(cidadeOf(a)) + '</small>' },
        { l: 'Profissional', f: (a) => (a.pro ? e(pro(a.pro).empresa) : '—') },
        { l: 'Etapa', f: (a) => etBadge(a) },
        { l: 'Alertas', f: (a) => { const x = alertas(a); return x.length ? A.badge(x[0].t, x[0].tone === 'bad' ? 'bad' : 'warn') + (x.length > 1 ? '<small>+' + (x.length - 1) + '</small>' : '') : '<span class="muted small">—</span>'; } },
        { l: 'Valor', cls: 'r', f: (a) => (a.orc ? A.money(orcTotal(a.orc)) : '—') },
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
    return A.ph('Propostas', 'Confira se cada orçamento identifica escopo, materiais, instalação e prazos antes de liberar ao cliente.') +
      A.card(null, A.filters('prop', [{ k: 'st', l: 'Situação', o: A.opts(['Em conferência', 'Devolvido', 'Liberado ao cliente', 'Ajuste solicitado', 'Aprovado'], 'Todas') }]) + A.table([
        { l: 'Atendimento', f: (a) => '<b>' + e(a.id) + '</b><small>' + e(a.titulo) + '</small>' }, { l: 'Profissional', f: (a) => e(pro(a.pro).empresa) }, { l: 'Enviado', f: (a) => A.fdtn(a.orc.enviado) }, { l: 'Versão', cls: 'r', f: (a) => a.orc.versao },
        { l: 'Valor', cls: 'r', f: (a) => A.money(orcTotal(a.orc)) }, { l: 'Conferência', f: (a) => (a.orc.conferencia ? a.orc.conferencia.checks.length + '/' + CONF.length : '—') }, { l: 'Situação', f: (a) => A.badge(a.orc.status) },
        { l: '', cls: 'r', f: (a) => '<div class="acts-row" style="justify-content:flex-end">' + (a.etapa === 'orcamento_enviado' ? A.b('Conferir', 'c3.conferir', { id: a.id }, 'sm p', 'clipboard') : '') + A.b('Ver', 'c3.verOrc', { id: a.id }, 'sm', 'eye') + '</div>' },
      ], list), { flush: true });
  }
  function vMedPend() {
    const tab = A.tab('pend', 'pend');
    const rows = [];
    db().atendimentos.forEach((a) => alertas(a).filter((x) => !/^Reclamação/.test(x.t)).forEach((x) => rows.push(Object.assign({ a: a, id: a.id + x.t }, x))));
    const recs = db().atendimentos.filter((a) => a.reclamacao && (tab === 'rec' ? true : a.reclamacao.status !== 'Resolvida')).sort((a, b) => (a.reclamacao.ts < b.reclamacao.ts ? 1 : -1));
    return A.ph('Pendências e reclamações', 'Atrasos, cobranças e problemas que precisam de acompanhamento até a solução.') +
      A.tabs('pend', [{ id: 'pend', l: 'Pendências e atrasos', n: rows.length }, { id: 'rec', l: 'Reclamações', n: db().atendimentos.filter((a) => a.reclamacao && a.reclamacao.status !== 'Resolvida').length }]) +
      (tab === 'pend' ? A.card(null, A.table([
        { l: 'Pendência', f: (r) => A.badge(r.t, r.tone === 'bad' ? 'bad' : 'warn') + '<small>' + e(r.d) + '</small>' }, { l: 'Atendimento', f: (r) => '<b>' + e(r.a.id) + '</b><small>' + e(r.a.titulo) + '</small>' }, { l: 'Profissional', f: (r) => (r.a.pro ? e(pro(r.a.pro).empresa) : '—') }, { l: 'Etapa', f: (r) => etBadge(r.a) },
        { l: '', cls: 'r', f: (r) => '<div class="acts-row" style="justify-content:flex-end">' + (r.manual ? A.b('Resolver', 'c3.pendOk', { id: r.a.id, p: r.manual }, 'sm ok', 'check') : r.t === 'Orçamento atrasado' ? A.b('Cobrar', 'c3.cobrar', { id: r.a.id }, 'sm p', 'bell') : r.t === 'Execução atrasada' ? A.b('Replanejar', 'c3.replanejar', { id: r.a.id }, 'sm', 'calendar') : '') + A.nav('Abrir', 'atendimento', r.a.id, 'sm', 'eye') + '</div>' },
      ], rows, { empty: 'Nenhuma pendência em aberto.' }), { flush: true }) :
        A.card(null, A.table([
          { l: 'Registrada', f: (a) => A.fdtn(a.reclamacao.ts) }, { l: 'Atendimento', f: (a) => '<b>' + e(a.id) + '</b><small>' + e(nomeCli(a)) + '</small>' }, { l: 'Tipo', f: (a) => e(a.reclamacao.tipo) + '<small>' + e(a.reclamacao.desc) + '</small>' }, { l: 'Profissional', f: (a) => e(pro(a.pro).empresa) }, { l: 'Situação', f: (a) => A.badge(a.reclamacao.status) },
          { l: '', cls: 'r', f: (a) => '<div class="acts-row" style="justify-content:flex-end">' + (a.reclamacao.status !== 'Resolvida' ? A.b('Tratar', 'c3.tratarRec', { id: a.id }, 'sm dg', 'flag') : '') + A.nav('Abrir', 'atendimento', a.id, 'sm', 'eye') + '</div>' },
        ], recs, { empty: 'Nenhuma reclamação registrada.' }), { flush: true }));
  }
  function vMedPos() {
    const list = db().atendimentos.filter((a) => (a.etapa === 'concluido' || a.etapa === 'encerrado') && A.inPeriod(a.conclusao.ts, '90')).sort((a, b) => (a.conclusao.ts < b.conclusao.ts ? 1 : -1));
    const av = list.filter((a) => a.avaliacao);
    return A.ph('Pós-venda', 'Confirmação da conclusão com o cliente, avaliações e garantias.') +
      '<div class="g4 mb16">' + A.kpi({ l: 'Concluídos (90 dias)', v: list.length, icon: 'check' }) + A.kpi({ l: 'Aguardando confirmação', v: list.filter((a) => a.etapa === 'concluido').length, icon: 'clock', tone: 'warn' }) + A.kpi({ l: 'Avaliação média', v: A.num(A.avg(av, (a) => a.avaliacao.nota), 1), s: av.length + ' avaliações', icon: 'star', tone: 'ok' }) + A.kpi({ l: 'Sem avaliação', v: list.filter((a) => a.etapa === 'encerrado' && !a.avaliacao).length, icon: 'bell' }) + '</div>' +
      A.card(null, A.table([
        { l: 'Atendimento', f: (a) => '<b>' + e(a.id) + '</b><small>' + e(a.titulo) + '</small>' }, { l: 'Cliente', f: (a) => e(nomeCli(a)) }, { l: 'Concluído', f: (a) => A.fdtn(a.conclusao.ts) },
        { l: 'Garantia até', f: (a) => { const g = parseInt(a.conclusao.garantia, 10) || 12; const dt = new Date(a.conclusao.ts); dt.setMonth(dt.getMonth() + g); return A.fd(dt.toISOString()); } },
        { l: 'Confirmação', f: (a) => (a.etapa === 'concluido' ? A.badge('Pendente', 'warn') : A.badge('Confirmada', 'ok')) }, { l: 'Avaliação', f: (a) => (a.avaliacao ? A.stars(a.avaliacao.nota) : '—') },
        { l: '', cls: 'r', f: (a) => '<div class="acts-row" style="justify-content:flex-end">' + (a.etapa === 'concluido' ? A.b('Confirmar', 'c3.confirmarMed', { id: a.id }, 'sm ok', 'phone') : !a.avaliacao ? A.b('Solicitar avaliação', 'c3.solAval', { id: a.id }, 'sm', 'star') : '') + A.nav('Abrir', 'atendimento', a.id, 'sm', 'eye') + '</div>' },
      ], list), { flush: true });
  }
  function vMedPros() {
    const d = db();
    return A.ph('Profissionais', 'Parceiros que executam os atendimentos acompanhados.', A.b('Cadastrar profissional', 'c3.proNovo', {}, 'p', 'plus')) +
      A.card(null, A.table([
        { l: 'Profissional', f: (p) => '<div class="row" style="flex-wrap:nowrap">' + A.av(p.empresa, p.cor) + '<div><b>' + e(p.empresa) + '</b><small>' + e(p.nome) + ' — ' + e(p.tel) + '</small></div></div>' },
        { l: 'Regiões', f: (p) => e(p.regioes.join(', ')) },
        { l: 'Ativos', cls: 'r', f: (p) => d.atendimentos.filter((a) => a.pro === p.id && a.etapa !== 'encerrado').length },
        { l: 'Com alerta', cls: 'r', f: (p) => d.atendimentos.filter((a) => a.pro === p.id && alertas(a).length).length },
        { l: 'Avaliação', cls: 'r', f: (p) => { const av = d.atendimentos.filter((a) => a.pro === p.id && a.avaliacao); return av.length ? A.num(A.avg(av, (a) => a.avaliacao.nota), 1) + ' ★' : '—'; } },
        { l: 'Situação', f: (p) => A.badge(p.status, p.status === 'Ativo' ? 'ok' : 'warn') },
      ], d.pros), { flush: true });
  }
  function vMedClientes() {
    return A.ph('Clientes', 'Clientes com atendimentos acompanhados.', A.b('Cadastrar cliente', 'c3.cliNovo', {}, 'p', 'plus')) +
      A.card(null, A.table([{ l: 'Cliente', f: (c) => '<b>' + e(c.nome) + '</b><small>' + e(c.contato || c.email) + '</small>' }, { l: 'Tipo', k: 'tipo' }, { l: 'Cidade', f: (c) => e(c.bairro + ', ' + c.cidade) }, { l: 'Telefone', k: 'tel' }, { l: 'Atendimentos', cls: 'r', f: (c) => db().atendimentos.filter((a) => a.clienteId === c.id).length }], db().clientes), { flush: true });
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
      body = '<div class="g4 mb16">' + A.kpi({ l: 'Solicitação → visita', v: avgD('criado', 'visita'), icon: 'calendar' }) + A.kpi({ l: 'Visita → orçamento', v: avgD('visita', 'orcamento'), icon: 'receipt' }) + A.kpi({ l: 'Orçamento → aprovação', v: avgD('orcamento', 'aprovado'), icon: 'check' }) + A.kpi({ l: 'Aprovação → conclusão', v: avgD('aprovado', 'concluido'), icon: 'tool' }) + '</div>' +
        '<div class="g2 mb16">' + A.card('Atendimentos por etapa', A.bars(ETK.map((k) => ({ l: ET[k], v: list.filter((a) => a.etapa === k).length })).filter((x) => x.v))) + A.card('Alertas atuais por tipo', A.bars(A.toBars(A.count([].concat.apply([], d.atendimentos.map((a) => alertas(a))), (x) => x.t)))) + '</div>' +
        A.card('Atendimentos no período (' + list.length + ')', A.table([
          { l: 'Atendimento', f: (a) => '<b>' + e(a.id) + '</b><small>' + e(a.titulo) + '</small>' }, { l: 'Aberto', f: (a) => A.fdtn(a.ts) }, { l: 'Profissional', f: (a) => (a.pro ? e(pro(a.pro).empresa) : '—') }, { l: 'Etapa', f: (a) => etBadge(a) },
          { l: 'Dias até orçamento', cls: 'r', f: (a) => { const x = days(a.m.visita, a.m.orcamento); return x != null ? A.num(x, 1) : '—'; } }, { l: 'Valor', cls: 'r', f: (a) => (a.orc ? A.money(orcTotal(a.orc)) : '—') },
          { l: '', cls: 'r', f: (a) => A.b('Detalhes', 'c3.repDet', { id: a.id }, 'sm', 'eye') },
        ], list.slice().sort((a, b) => (a.ts < b.ts ? 1 : -1))), { flush: true });
    } else if (tab === 'prop') {
      const pr = list.filter((a) => a.orc);
      const ap = pr.filter((a) => a.orc.aprovadoEm);
      const dev = pr.filter((a) => a.orc.devolucoes || a.orc.devolucao);
      body = '<div class="g4 mb16">' + A.kpi({ l: 'Propostas enviadas', v: pr.length, icon: 'receipt' }) + A.kpi({ l: 'Devolvidas na conferência', v: dev.length, s: A.pct(dev.length, pr.length) + ' das propostas', icon: 'swap', tone: 'warn' }) + A.kpi({ l: 'Taxa de aprovação', v: A.pct(ap.length, pr.filter((a) => a.orc.status !== 'Em conferência' && a.orc.status !== 'Devolvido').length), icon: 'check', tone: 'ok' }) + A.kpi({ l: 'Ticket médio aprovado', v: A.kmoney(A.avg(ap, (a) => orcTotal(a.orc))), icon: 'money' }) + '</div>' +
        '<div class="g2">' + A.card('Valor aprovado por serviço', A.bars(Object.entries(ap.reduce((m, a) => { const k = srvName(a.srv); m[k] = (m[k] || 0) + orcTotal(a.orc); return m; }, {})).map((x) => ({ l: x[0], v: x[1] })).sort((a, b) => b.v - a.v), { money: true })) +
        A.card('Situação das propostas', A.bars(A.toBars(A.count(pr, (a) => a.orc.status)))) + '</div>';
    } else if (tab === 'pros') {
      const rows = d.pros.filter((p) => p.status === 'Ativo').map((p) => { const l = list.filter((a) => a.pro === p.id); const tor = l.map((a) => days(a.m.visita, a.m.orcamento)).filter((x) => x != null); const av = l.filter((a) => a.avaliacao); return { id: p.id, p: p, n: l.length, at: l.filter((a) => a.atrasou || alertas(a).some((x) => x.tone === 'bad')).length, tor: tor.length ? A.avg(tor) : null, nota: av.length ? A.avg(av, (a) => a.avaliacao.nota) : null, rec: l.filter((a) => a.reclamacao).length, val: A.sum(l.filter((a) => a.orc && a.orc.aprovadoEm), (a) => orcTotal(a.orc)) }; });
      body = '<div class="g2 mb16">' + A.card('Atendimentos por profissional', A.bars(rows.map((r) => ({ l: r.p.empresa, v: r.n })).sort((a, b) => b.v - a.v))) + A.card('Dias médios entre visita e orçamento', A.bars(rows.filter((r) => r.tor != null).map((r) => ({ l: r.p.empresa, v: r.tor, c: r.tor > 2 ? 'var(--bad)' : null })).sort((a, b) => b.v - a.v), { dec: 1, suffix: ' d' })) + '</div>' +
        A.card('Desempenho dos profissionais', A.table([{ l: 'Profissional', f: (r) => '<b>' + e(r.p.empresa) + '</b>' }, { l: 'Atendimentos', cls: 'r', k: 'n' }, { l: 'Com atraso', cls: 'r', k: 'at' }, { l: 'Visita → orçamento', cls: 'r', f: (r) => (r.tor != null ? A.num(r.tor, 1) + ' d' : '—') }, { l: 'Avaliação', cls: 'r', f: (r) => (r.nota ? A.num(r.nota, 1) + ' ★' : '—') }, { l: 'Reclamações', cls: 'r', k: 'rec' }, { l: 'Valor aprovado', cls: 'r', f: (r) => A.money(r.val) }], rows), { flush: true });
    } else {
      const rec = list.filter((a) => a.reclamacao), av = list.filter((a) => a.avaliacao);
      body = '<div class="g4 mb16">' + A.kpi({ l: 'Avaliação média', v: A.num(A.avg(av, (a) => a.avaliacao.nota), 1), s: av.length + ' avaliações', icon: 'star', tone: 'ok' }) + A.kpi({ l: 'Reclamações', v: rec.length, icon: 'flag', tone: 'bad' }) + A.kpi({ l: 'Reclamações resolvidas', v: A.pct(rec.filter((a) => a.reclamacao.status === 'Resolvida').length, rec.length), icon: 'check' }) + A.kpi({ l: 'Atendimentos encerrados', v: list.filter((a) => a.etapa === 'encerrado').length, icon: 'clipboard' }) + '</div>' +
        '<div class="g2">' + A.card('Distribuição das notas', A.bars([5, 4, 3, 2, 1].map((n) => ({ l: n + ' estrelas', v: av.filter((a) => a.avaliacao.nota === n).length })))) + A.card('Reclamações por tipo', A.bars(A.toBars(A.count(rec, (a) => a.reclamacao.tipo)))) + '</div>';
    }
    return A.ph('Relatórios do atendimento', 'Indicadores do modelo acompanhado: prazos por etapa, propostas, desempenho dos profissionais e pós-venda.') +
      A.tabs('rep', [{ id: 'et', l: 'Etapas e prazos' }, { id: 'prop', l: 'Propostas' }, { id: 'pros', l: 'Profissionais' }, { id: 'pos', l: 'Pós-venda' }]) + '<div class="card mb16" style="padding:12px 14px 0">' + filt + '</div>' + body;
  }

  /* ------------------------------------------------------------------
     Ações
     ------------------------------------------------------------------ */
  const go = (id, tab) => { if (tab) A.setTab('atd', tab); A.go('atendimento', id); };
  const fin = (a, msg, acao, tab) => { A.log(acao, a.id); A.close(); if (tab) A.setTab('atd', tab); A.refresh(); A.toast(msg); };
  const actions = {
    'c3.openChat': (ds) => go(ds.id, 'conversa'),
    'c3.msg': (v) => { const a = atd(v.ref); say(a, v.txt); A.log('Mensagem enviada na conversa do atendimento', a.id); A.refresh(); },
    'c3.novaSave': (v) => {
      const d = db(), id = A.nextId('ATD-', d.atendimentos);
      const a = { id: id, ts: A.now(), clienteId: MYCLI, srv: v.srv, titulo: v.titulo, desc: v.desc, fotos: v.fotos || [], prioridade: v.prioridade, etapa: 'solicitado', pro: null, visita: null, orc: null, exec: null, conclusao: null, avaliacao: null, reclamacao: null, pendencias: [], m: { criado: A.now() }, msgs: [], decisoes: [], hist: [] };
      hist(a, 'Solicitação recebida'); sys(a, 'Solicitação registrada. A AiCalhas vai acompanhar este atendimento.');
      d.atendimentos.push(a); A.log('Solicitação registrada', id + ' · ' + v.titulo); go(id, 'resumo'); A.toast('Solicitação ' + id + ' registrada. A AiCalhas vai designar o profissional.');
    },
    'c3.medNova': () => A.form({ title: 'Registrar solicitação (por telefone)', submit: 'c3.medNovaSave', fields: [{ name: 'cliente', label: 'Cliente', type: 'select', options: db().clientes.map((c) => ({ v: c.id, l: c.nome })), required: true }, { name: 'srv', label: 'Serviço', type: 'select', options: db().servicos.map((s) => ({ v: s.id, l: s.nome })) }, { name: 'titulo', label: 'Título', required: true, value: 'Vazamento na calha da garagem', full: true }, { name: 'desc', label: 'Descrição', type: 'textarea', full: true, required: true, value: 'Cliente ligou relatando vazamento na calha da garagem.' }] }),
    'c3.medNovaSave': (v) => { const d = db(), id = A.nextId('ATD-', d.atendimentos); const a = { id: id, ts: A.now(), clienteId: v.cliente, srv: v.srv, titulo: v.titulo, desc: v.desc, fotos: [], prioridade: 'Normal', etapa: 'triagem', pro: null, visita: null, orc: null, exec: null, conclusao: null, avaliacao: null, reclamacao: null, pendencias: [], m: { criado: A.now() }, msgs: [], decisoes: [], hist: [] }; hist(a, 'Solicitação registrada pela AiCalhas (atendimento telefônico)'); d.atendimentos.push(a); A.log('Solicitação registrada pelo mediador', id); A.close(); go(id, 'resumo'); A.toast('Atendimento ' + id + ' criado em triagem.'); },
    'c3.triar': (ds) => { const a = atd(ds.id); a.etapa = 'triagem'; hist(a, 'Triagem iniciada pela AiCalhas'); fin(a, 'Triagem iniciada.', 'Triagem iniciada'); },
    'c3.designar': (ds) => {
      const a = atd(ds.id), cid = cidadeOf(a);
      const opts = db().pros.filter((p) => p.status === 'Ativo').map((p) => ({ p: p, s: (p.regioes.indexOf(cid) >= 0 ? 2 : 0) + (p.servicos.indexOf(a.srv) >= 0 ? 1 : 0) })).sort((x, y) => y.s - x.s);
      A.form({ title: 'Designar profissional — ' + a.id, sub: srvName(a.srv) + ' em ' + cid, submit: 'c3.designarSave', extra: { id: a.id }, one: true, fields: [
        { name: 'pro', label: 'Profissional', type: 'radios', required: true, value: opts[0].p.id, options: opts.map((o) => ({ v: o.p.id, l: o.p.empresa + ' — ' + (o.p.regioes.indexOf(cid) >= 0 ? 'atende ' + cid : 'fora da região') + (o.p.servicos.indexOf(a.srv) >= 0 ? ', especialidade ok' : ', sem a especialidade') + ' — ' + A.num(o.p.nota, 1) + ' ★' })) },
        { name: 'msg', label: 'Mensagem de apresentação (conversa)', type: 'textarea', value: 'Olá! Vou acompanhar este atendimento. Já designei o profissional e em seguida combinamos a visita.' },
      ] });
    },
    'c3.designarSave': (v, x) => { const a = atd(x.id), p = pro(v.pro); a.pro = p.id; a.etapa = 'designado'; hist(a, 'Profissional designado: ' + p.empresa); if (v.msg) say(a, v.msg); A.log('Profissional designado', a.id + ' · ' + p.empresa); A.close(); A.refresh(); A.toast(p.empresa + ' designado. Próximo passo: agendar a visita.'); },
    'c3.agendar': (ds) => { const a = atd(ds.id); const dflt = a.visita ? a.visita.data : A.d(1, '09:00'); A.form({ title: (a.visita ? 'Reagendar' : 'Agendar') + ' visita — ' + a.id, submit: 'c3.agendarSave', extra: { id: a.id }, fields: [{ name: 'data', label: 'Data e horário', type: 'datetime-local', required: true, value: new Date(new Date(dflt).getTime() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16) }, { name: 'motivo', label: a.visita ? 'Motivo do reagendamento' : 'Observação', value: a.visita ? 'Cliente pediu outro horário' : 'Horário combinado por telefone com as duas partes' }, { name: 'conf', type: 'check', text: 'Horário confirmado com cliente e profissional', value: true }] }); },
    'c3.agendarSave': (v, x) => { const a = atd(x.id); const re = !!a.visita; a.visita = { data: new Date(v.data).toISOString(), confirmadaPro: v.conf, confirmadaCli: v.conf, realizada: null }; a.etapa = 'visita_agendada'; hist(a, (re ? 'Visita reagendada para ' : 'Visita agendada para ') + A.fdt(a.visita.data)); say(a, (re ? 'Visita reagendada para ' : 'Visita agendada para ') + A.fdt(a.visita.data) + '.'); A.log(re ? 'Visita reagendada' : 'Visita agendada', a.id + ' · ' + A.fdt(a.visita.data)); A.close(); A.refresh(); A.toast('Visita ' + (re ? 'reagendada' : 'agendada') + ' para ' + A.when(a.visita.data) + '.'); },
    'c3.sugerir': (ds) => A.form({ title: 'Sugerir horários de visita', submit: 'c3.sugerirSave', extra: { id: ds.id }, one: true, fields: [{ name: 'txt', label: 'Mensagem para a AiCalhas e o cliente', type: 'textarea', required: true, value: 'Posso visitar amanhã às 9h ou às 14h. Qual fica melhor?' }] }),
    'c3.sugerirSave': (v, x) => { const a = atd(x.id); say(a, v.txt); fin(a, 'Sugestão enviada na conversa do atendimento.', 'Horários de visita sugeridos pelo profissional', 'conversa'); },
    'c3.confVisPro': (ds) => { const a = atd(ds.id); a.visita.confirmadaPro = true; hist(a, 'Profissional confirmou a visita'); fin(a, 'Visita confirmada.', 'Visita confirmada pelo profissional'); },
    'c3.confVisCli': (ds) => { const a = atd(ds.id); a.visita.confirmadaCli = true; hist(a, 'Cliente confirmou a visita'); fin(a, 'Visita confirmada.', 'Visita confirmada pelo cliente'); },
    'c3.outroHorario': (ds) => A.form({ title: 'Pedir outro horário', submit: 'c3.outroHorarioSave', extra: { id: ds.id }, one: true, fields: [{ name: 'txt', label: 'Sugestão de horário', type: 'textarea', required: true, value: 'Não estarei em casa nesse horário. Pode ser depois das 14h?' }] }),
    'c3.outroHorarioSave': (v, x) => { const a = atd(x.id); say(a, v.txt); a.pendencias.push({ id: 'PD' + Date.now(), tipo: 'Reagendar visita', desc: 'Cliente pediu outro horário', ts: A.now(), status: 'Aberta' }); fin(a, 'Pedido enviado. A AiCalhas vai reagendar com o profissional.', 'Cliente pediu outro horário de visita', 'conversa'); },
    'c3.regVisita': (ds) => A.form({ title: 'Registrar visita técnica', sub: 'Medidas e dimensionamento são de responsabilidade do profissional.', submit: 'c3.regVisitaSave', extra: { id: ds.id }, size: 'lg', fields: [
      { name: 'ts', label: 'Realizada em', type: 'datetime-local', required: true, value: new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16) },
      { name: 'medidas', label: 'Levantamento / medidas', required: true, value: '32 m de calha; 4 descidas; 12 m de rufo' },
      { name: 'diag', label: 'Diagnóstico', type: 'textarea', full: true, required: true, value: 'Rufos com vedação ressecada no 2º andar e duas descidas com encaixe solto. Calhas em bom estado.' },
      { name: 'fotos', label: 'Fotos da visita', type: 'photos', full: true, presets: ['rufo', 'condutor', 'calha-frontal', 'vazamento'], preselect: ['rufo'] },
    ] }),
    'c3.regVisitaSave': (v, x) => { const a = atd(x.id); a.visita.realizada = { ts: new Date(v.ts).toISOString(), medidas: v.medidas, diagnostico: v.diag, fotos: v.fotos || [] }; a.etapa = 'visita_realizada'; a.m.visita = a.visita.realizada.ts; hist(a, 'Visita técnica realizada e registrada'); sys(a, 'Visita técnica registrada pelo profissional.'); fin(a, 'Visita registrada. Próximo passo: elaborar o orçamento.', 'Visita técnica registrada', 'visita'); },
    'c3.orcamento': (ds) => {
      const a = atd(ds.id), o = a.orc || {};
      const cat = db().materiais;
      A.form({ title: (a.orc ? 'Revisar' : 'Elaborar') + ' orçamento — ' + a.id, sub: 'A AiCalhas confere se a proposta está completa antes de enviá-la ao cliente.', submit: 'c3.orcSave', extra: { id: a.id }, size: 'lg', submitLabel: 'Enviar para conferência', icon: 'send',
        intro: a.orc && (a.orc.devolucao || a.orc.ajusteCliente) ? '<b>Ajuste solicitado:</b> ' + e(a.orc.devolucao || a.orc.ajusteCliente) : '',
        fields: [
          { name: 'escopo', label: 'Escopo do serviço', type: 'textarea', full: true, required: true, value: o.escopo || 'Revisão de calhas e rufos: troca de 12 m de rufo galvanizado, reaperto e vedação das descidas, limpeza e teste de escoamento.' },
          { name: 'itens', label: 'Materiais', type: 'items', catalog: cat, full: true, value: o.itens || [{ id: 'MAT-04', qtd: 12, preco: 42 }, { id: 'MAT-10', qtd: 3, preco: 32 }, { id: 'MAT-11', qtd: 6, preco: 6.5 }] },
          { name: 'maoObra', label: 'Mão de obra / instalação (R$)', type: 'number', min: 0, step: 10, required: true, value: o.maoObra || 1100 },
          { name: 'prazo', label: 'Prazo de execução', value: o.prazo || '1 dia de execução', placeholder: 'Ex.: 2 dias de execução' },
          { name: 'validade', label: 'Validade da proposta', type: 'date', required: true, value: (o.validade || A.d(10)).slice(0, 10) },
          { name: 'condicoes', label: 'Condições de pagamento', type: 'select', options: COND, value: o.condicoes || COND[0] },
          { name: 'obs', label: 'Observações', full: true, value: o.obs || 'Garantia de 12 meses para mão de obra.' },
          { type: 'html', html: '<div class="calc" id="c3calc"></div>' },
        ],
        calc: (f) => { const its = A.readItems(f.querySelector('.ied')); const m = A.sum(its, (x) => x.qtd * x.preco), mo = +f.maoObra.value || 0; const box = document.getElementById('c3calc'); if (box) box.innerHTML = '<dl><dt>Materiais</dt><dd>' + A.money(m) + '</dd><dt>Mão de obra</dt><dd>' + A.money(mo) + '</dd><dt class="tot">Total</dt><dd class="tot">' + A.money(m + mo) + '</dd></dl>'; },
      });
    },
    'c3.orcSave': (v, x) => {
      const a = atd(x.id), prev = a.orc;
      a.orc = { versao: prev ? prev.versao + 1 : 1, itens: v.itens, maoObra: +v.maoObra, prazo: v.prazo, validade: new Date(v.validade + 'T12:00').toISOString(), condicoes: v.condicoes, escopo: v.escopo, obs: v.obs, enviado: A.now(), status: 'Em conferência', devolucoes: prev ? (prev.devolucoes || 0) + (prev.devolucao ? 1 : 0) : 0 };
      a.etapa = 'orcamento_enviado'; a.m.orcamento = A.now();
      hist(a, 'Orçamento ' + (prev ? 'revisado (versão ' + a.orc.versao + ')' : 'enviado') + ' para conferência da AiCalhas'); sys(a, 'Orçamento enviado para conferência da AiCalhas.');
      A.log('Orçamento enviado para conferência', a.id + ' · ' + A.money(orcTotal(a.orc))); A.close(); A.setTab('atd', 'orcamento'); A.refresh(); A.toast('Orçamento enviado. A AiCalhas vai conferir antes de liberar ao cliente.');
    },
    'c3.conferir': (ds) => {
      const a = atd(ds.id), o = a.orc;
      const auto = { escopo: !!(o.escopo && o.escopo.length > 15), materiais: o.itens.length > 0, instalacao: +o.maoObra > 0, prazo: !!(o.prazo && o.prazo.trim()), condicoes: !!(o.validade && o.condicoes) };
      const falta = CONF.filter((c) => !auto[c[0]]).map((c) => c[1]);
      A.form({ title: 'Conferir proposta — ' + a.id, sub: pro(a.pro).empresa + ' — ' + A.money(orcTotal(o)), submit: 'c3.conferirSave', extra: { id: a.id }, size: 'lg', submitLabel: 'Registrar conferência', icon: 'clipboard',
        intro: 'A AiCalhas confere se a proposta identifica escopo, materiais, instalação e prazos. Medidas e dimensionamento são decisões técnicas do profissional.',
        after: '<div class="mt"></div>' + A.card('Resumo da proposta', '<p>' + e(o.escopo) + '</p>' + A.dl([['Materiais', o.itens.length + ' item(ns) — ' + A.money(orcMat(o))], ['Mão de obra', A.money(o.maoObra)], ['Prazo', o.prazo ? e(o.prazo) : A.badge('Não informado', 'bad')], ['Validade / condições', A.fd(o.validade) + ' — ' + e(o.condicoes)]])),
        fields: [
          { name: 'checks', label: 'Itens conferidos', type: 'checks', options: CONF.map((c) => ({ v: c[0], l: c[1] })), value: CONF.filter((c) => auto[c[0]]).map((c) => c[0]), full: true },
          { name: 'decisao', label: 'Decisão', type: 'radios', required: true, full: true, value: falta.length ? 'devolver' : 'liberar', options: [{ v: 'liberar', l: 'Liberar ao cliente' }, { v: 'devolver', l: 'Devolver ao profissional para ajuste' }] },
          { name: 'obs', label: 'Observação', type: 'textarea', full: true, value: falta.length ? 'Faltou informar: ' + falta.join(', ').toLowerCase() + '.' : 'Proposta completa.' },
        ] });
    },
    'c3.conferirSave': (v, x) => {
      const a = atd(x.id), o = a.orc;
      if (v.decisao === 'liberar' && v.checks.length < CONF.length) { A.toast('Para liberar, todos os itens precisam estar conferidos. Devolva a proposta ao profissional para ajuste.', 'warn'); return; }
      o.conferencia = { por: A.me().nome, ts: A.now(), checks: v.checks, obs: v.obs };
      if (v.decisao === 'liberar') { o.status = 'Liberado ao cliente'; o.liberado = A.now(); o.devolucao = ''; a.etapa = 'orcamento_liberado'; hist(a, 'Orçamento conferido e liberado para aprovação do cliente'); say(a, 'Orçamento conferido: escopo, materiais, instalação e prazo estão descritos. Já está disponível para aprovação.'); fin(a, 'Proposta liberada ao cliente.', 'Proposta conferida e liberada ao cliente', 'orcamento'); }
      else { o.status = 'Devolvido'; o.devolucao = v.obs; a.etapa = 'visita_realizada'; hist(a, 'Orçamento devolvido ao profissional para ajuste', 'interno'); say(a, 'Orçamento devolvido para ajuste: ' + v.obs); fin(a, 'Proposta devolvida ao profissional para ajuste.', 'Proposta devolvida ao profissional para ajuste', 'orcamento'); }
    },
    'c3.verOrc': (ds) => { const a = atd(ds.id); A.modal({ title: 'Orçamento — ' + a.id, sub: a.titulo + ' — ' + pro(a.pro).empresa, size: 'lg', body: orcView(a), foot: '<button class="btn" data-act="core.close">Fechar</button>' + A.nav('Abrir atendimento', 'atendimento', a.id, 'p') }); },
    'c3.cobrar': (ds) => { const a = atd(ds.id), p = pro(a.pro); say(a, A.first(p.nome) + ', ainda não recebemos o orçamento da visita de ' + A.fd(a.visita.realizada.ts) + '. Consegue enviar até amanhã? O cliente está aguardando.', 'mediador'); hist(a, 'AiCalhas cobrou o envio do orçamento', 'interno'); a.decisoes.push({ ts: A.now(), por: A.me().nome, txt: 'Cobrança de orçamento enviada a ' + p.empresa + '; cliente informado do novo prazo.' }); say(a, 'Cobramos o orçamento do profissional e avisamos assim que chegar.'); fin(a, 'Cobrança enviada ao profissional e cliente atualizado (simulação).', 'Cobrança de orçamento enviada ao profissional', 'conversa'); },
    'c3.lembrar': (ds) => { const a = atd(ds.id); say(a, 'Olá! O orçamento está disponível para aprovação até ' + A.fd(a.orc.validade) + '. Posso ajudar com alguma dúvida?'); fin(a, 'Lembrete enviado ao cliente (simulação).', 'Lembrete de aprovação enviado ao cliente', 'conversa'); },
    'c3.aprovar': (ds) => { const a = atd(ds.id), o = a.orc; A.confirm({ title: 'Aprovar orçamento', msg: 'Aprovar o orçamento de <b>' + e(pro(a.pro).empresa) + '</b> no valor de <b>' + A.money(orcTotal(o)) + '</b>?', note: 'Condições: ' + e(o.condicoes) + '. O pagamento é feito diretamente ao profissional; a AiCalhas registra a aprovação e acompanha a execução.', ok: 'Aprovar orçamento', onOk: () => aprovar(a, A.me().nome, 'pela plataforma') }); },
    'c3.aprovarPor': (ds) => A.form({ title: 'Registrar aprovação do cliente', sub: 'Use quando o cliente aprovar por telefone ou mensagem.', submit: 'c3.aprovarPorSave', extra: { id: ds.id }, one: true, fields: [{ name: 'canal', label: 'Canal da aprovação', type: 'select', options: ['Telefone', 'WhatsApp', 'E-mail'] }, { name: 'obs', label: 'Registro', type: 'textarea', required: true, value: 'Cliente aprovou por telefone às ' + A.ft(A.now()) + ', sem alterações.' }] }),
    'c3.aprovarPorSave': (v, x) => { const a = atd(x.id); a.decisoes.push({ ts: A.now(), por: A.me().nome, txt: 'Aprovação do cliente registrada via ' + v.canal.toLowerCase() + ': ' + v.obs }); aprovar(a, nomeCli(a) + ' (registrado por ' + A.me().nome + ')', 'via ' + v.canal.toLowerCase()); },
    'c3.ajuste': (ds) => A.form({ title: 'Solicitar ajuste no orçamento', submit: 'c3.ajusteSave', extra: { id: ds.id }, one: true, fields: [{ name: 'txt', label: 'O que precisa ser ajustado?', type: 'textarea', required: true, value: 'É possível incluir tela protetora contra folhas na calha nova?' }] }),
    'c3.ajusteSave': (v, x) => { const a = atd(x.id); a.orc.status = 'Ajuste solicitado'; a.orc.ajusteCliente = v.txt; a.etapa = 'visita_realizada'; hist(a, 'Cliente solicitou ajuste no orçamento'); say(a, 'Gostaria de um ajuste no orçamento: ' + v.txt); fin(a, 'Ajuste solicitado. O profissional vai revisar o orçamento.', 'Ajuste no orçamento solicitado pelo cliente', 'conversa'); },
    'c3.iniciar': (ds) => A.form({ title: 'Iniciar serviço', submit: 'c3.iniciarSave', extra: { id: ds.id }, fields: [{ name: 'ini', label: 'Início', type: 'datetime-local', required: true, value: new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16) }, { name: 'fim', label: 'Término previsto', type: 'date', required: true, value: A.d(1).slice(0, 10) }] }),
    'c3.iniciarSave': (v, x) => { const a = atd(x.id); a.exec.inicio = new Date(v.ini).toISOString(); a.exec.fimPrev = new Date(v.fim + 'T17:00').toISOString(); a.etapa = 'execucao'; hist(a, 'Serviço iniciado'); sys(a, 'Serviço iniciado pelo profissional. Previsão de término: ' + A.fd(a.exec.fimPrev) + '.'); fin(a, 'Serviço iniciado.', 'Serviço iniciado', 'execucao'); },
    'c3.etapas': (ds) => { const a = atd(ds.id); A.form({ title: 'Atualizar etapas da execução', submit: 'c3.etapasSave', extra: { id: a.id }, fields: [{ name: 'ok', label: 'Etapas concluídas', type: 'checks', full: true, options: a.exec.etapas.map((x) => x.n), value: a.exec.etapas.filter((x) => x.ok).map((x) => x.n).concat(a.exec.etapas.filter((x) => !x.ok).slice(0, 1).map((x) => x.n)) }, { name: 'obs', label: 'Comentário para o cliente e a AiCalhas', type: 'textarea', full: true, value: 'Calha instalada; amanhã cedo faço a vedação e o teste de escoamento.' }, { name: 'fotos', label: 'Fotos do andamento', type: 'photos', full: true, presets: ['calha-frontal', 'condutor', 'aluminio'] }] }); },
    'c3.etapasSave': (v, x) => { const a = atd(x.id); a.exec.etapas.forEach((s) => { const ok = v.ok.indexOf(s.n) >= 0; if (ok && !s.ok) s.ts = A.now(); s.ok = ok; }); if (v.obs) say(a, v.obs); sys(a, 'Andamento atualizado: ' + prog(a) + '%.'); hist(a, 'Andamento atualizado: ' + prog(a) + '%'); fin(a, 'Andamento atualizado: ' + prog(a) + '%.', 'Andamento da execução atualizado (' + prog(a) + '%)', 'execucao'); },
    'c3.concluir': (ds) => A.form({ title: 'Concluir serviço', sub: 'Todas as etapas serão marcadas como concluídas.', submit: 'c3.concluirSave', extra: { id: ds.id }, fields: [{ name: 'obs', label: 'Relato da conclusão', type: 'textarea', full: true, required: true, value: 'Serviço concluído, teste de escoamento aprovado e área limpa.' }, { name: 'garantia', label: 'Garantia', type: 'select', options: ['12 meses', '6 meses', '3 meses'] }, { name: 'fotos', label: 'Fotos finais', type: 'photos', full: true, presets: ['calha-frontal', 'condutor', 'aluminio'], preselect: ['calha-frontal'] }] }),
    'c3.concluirSave': (v, x) => { const a = atd(x.id); a.exec.etapas.forEach((s) => { if (!s.ok) { s.ok = true; s.ts = A.now(); } }); a.conclusao = { ts: A.now(), obs: v.obs, fotos: v.fotos || [], garantia: v.garantia }; a.etapa = 'concluido'; a.m.concluido = A.now(); hist(a, 'Serviço concluído pelo profissional'); sys(a, 'Serviço concluído. A AiCalhas vai confirmar com o cliente.'); fin(a, 'Serviço concluído. A AiCalhas vai confirmar com o cliente.', 'Serviço concluído', 'execucao'); },
    'c3.confirmarMed': (ds) => A.form({ title: 'Confirmar conclusão com o cliente', submit: 'c3.confirmarMedSave', extra: { id: ds.id }, one: true, fields: [{ name: 'res', label: 'Resultado do contato', type: 'radios', options: ['Cliente confirmou que está tudo certo', 'Cliente apontou pendência'], value: 'Cliente confirmou que está tudo certo', required: true }, { name: 'obs', label: 'Registro', type: 'textarea', value: 'Cliente confirmou por telefone; avaliação solicitada.' }] }),
    'c3.confirmarMedSave': (v, x) => { const a = atd(x.id); if (/pendência/.test(v.res)) { a.pendencias.push({ id: 'PD' + Date.now(), tipo: 'Pendência apontada na conclusão', desc: v.obs, ts: A.now(), status: 'Aberta' }); fin(a, 'Pendência registrada. Acompanhe até a solução.', 'Cliente apontou pendência na conclusão'); return; } a.etapa = 'encerrado'; a.confirmado = A.now(); hist(a, 'Conclusão confirmada com o cliente'); say(a, 'Conclusão confirmada. Obrigado! Você pode avaliar o atendimento quando quiser.'); fin(a, 'Conclusão confirmada. Avaliação solicitada ao cliente.', 'Conclusão confirmada com o cliente'); },
    'c3.cliConfirma': (ds) => A.form({ title: 'Confirmar conclusão e avaliar', submit: 'c3.avaliarSave', extra: { id: ds.id, confirma: true }, one: true, submitLabel: 'Confirmar e avaliar', icon: 'star', fields: [{ name: 'nota', label: 'Como foi o atendimento?', type: 'radios', options: [{ v: 5, l: '★★★★★' }, { v: 4, l: '★★★★' }, { v: 3, l: '★★★' }, { v: 2, l: '★★' }, { v: 1, l: '★' }], value: 5, required: true }, { name: 'txt', label: 'Comentário', type: 'textarea', value: 'Serviço caprichado e a AiCalhas me manteve informada em todas as etapas.' }] }),
    'c3.avaliar': (ds) => actions['c3.cliConfirma'](ds),
    'c3.avaliarSave': (v, x) => { const a = atd(x.id); if (a.etapa === 'concluido') { a.etapa = 'encerrado'; a.confirmado = A.now(); hist(a, 'Cliente confirmou a conclusão'); } a.avaliacao = { nota: +v.nota, txt: v.txt, ts: A.now() }; hist(a, 'Atendimento avaliado pelo cliente: ' + v.nota + ' estrelas'); fin(a, 'Obrigado pela avaliação!', 'Atendimento avaliado (' + v.nota + ' estrelas)'); },
    'c3.solAval': (ds) => { const a = atd(ds.id); say(a, 'Como foi o atendimento? Sua avaliação nos ajuda a manter a qualidade dos profissionais.'); fin(a, 'Pedido de avaliação enviado (simulação).', 'Avaliação solicitada ao cliente', 'conversa'); },
    'c3.reclamar': (ds) => A.form({ title: 'Relatar problema', sub: 'A AiCalhas acompanha a solução com o profissional.', submit: 'c3.reclamarSave', extra: { id: ds.id }, one: true, submitLabel: 'Enviar relato', icon: 'flag', fields: [{ name: 'tipo', label: 'Tipo', type: 'select', options: ['Infiltração após o serviço (garantia)', 'Atraso na execução', 'Acabamento', 'Cobrança diferente do orçamento', 'Outro'], required: true }, { name: 'desc', label: 'Descrição', type: 'textarea', required: true, value: 'Notei uma goteira perto da descida depois da chuva.' }] }),
    'c3.reclamarSave': (v, x) => { const a = atd(x.id); a.reclamacao = { id: 'REC-' + Date.now().toString().slice(-4), tipo: v.tipo, desc: v.desc, ts: A.now(), status: 'Aberta', acoes: [] }; hist(a, 'Reclamação registrada: ' + v.tipo); say(a, 'Registrei um problema: ' + v.desc); fin(a, 'Relato enviado. A AiCalhas vai acompanhar a solução.', 'Reclamação registrada'); },
    'c3.tratarRec': (ds) => { const a = atd(ds.id); A.form({ title: 'Tratar reclamação — ' + a.id, sub: a.reclamacao.tipo, submit: 'c3.tratarRecSave', extra: { id: a.id }, fields: [{ name: 'acao', label: 'Ação', type: 'select', full: true, required: true, options: ['Encaminhar ao profissional para garantia', 'Agendar visita de garantia', 'Contato com o cliente', 'Encerrar como resolvida'], value: a.reclamacao.encaminhada ? 'Agendar visita de garantia' : 'Encaminhar ao profissional para garantia' }, { name: 'data', label: 'Data da visita (se aplicável)', type: 'datetime-local', value: new Date(new Date(A.d(1, '08:30')).getTime() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16) }, { name: 'obs', label: 'Registro', type: 'textarea', full: true, required: true, value: 'Profissional acionado para avaliar a infiltração dentro da garantia, sem custo ao cliente.' }] }); },
    'c3.tratarRecSave': (v, x) => {
      const a = atd(x.id), r = a.reclamacao;
      r.acoes.push({ ts: A.now(), txt: v.acao + ': ' + v.obs, por: A.me().nome });
      if (/Encerrar/.test(v.acao)) { r.status = 'Resolvida'; hist(a, 'Reclamação encerrada como resolvida'); say(a, 'Reclamação encerrada como resolvida. Obrigado pela paciência!'); }
      else { r.status = 'Em tratamento'; if (/Encaminhar|Agendar/.test(v.acao)) r.encaminhada = true; if (/Agendar/.test(v.acao) && v.data) r.visitaGarantia = new Date(v.data).toISOString(); hist(a, 'Reclamação em tratamento: ' + v.acao.toLowerCase()); say(a, v.obs); }
      a.decisoes.push({ ts: A.now(), por: A.me().nome, txt: 'Reclamação: ' + v.acao + '. ' + v.obs });
      fin(a, 'Reclamação atualizada: ' + r.status.toLowerCase() + '.', 'Reclamação tratada — ' + v.acao.toLowerCase());
    },
    'c3.garantia': (ds) => A.form({ title: 'Registrar atendimento de garantia', submit: 'c3.garantiaSave', extra: { id: ds.id }, one: true, fields: [{ name: 'obs', label: 'O que foi feito', type: 'textarea', required: true, value: 'Refeita a vedação do bocal da descida 3 e teste de escoamento aprovado. Sem custo ao cliente.' }, { name: 'fotos', label: 'Fotos', type: 'photos', presets: ['condutor', 'calha-frontal'] }] }),
    'c3.garantiaSave': (v, x) => { const a = atd(x.id); a.reclamacao.acoes.push({ ts: A.now(), txt: 'Atendimento de garantia: ' + v.obs, por: A.me().nome }); a.reclamacao.garantiaFeita = true; say(a, 'Atendimento de garantia realizado: ' + v.obs); hist(a, 'Profissional registrou atendimento de garantia'); fin(a, 'Atendimento de garantia registrado. A AiCalhas vai confirmar com o cliente.', 'Atendimento de garantia registrado'); },
    'c3.replanejar': (ds) => { const a = atd(ds.id); A.form({ title: 'Replanejar prazo — ' + a.id, submit: 'c3.replanejarSave', extra: { id: a.id }, fields: [{ name: 'fim', label: 'Nova previsão de término', type: 'date', required: true, value: A.d(2).slice(0, 10) }, { name: 'motivo', label: 'Motivo', type: 'select', options: ['Chuva', 'Falta de material', 'Imprevisto na obra', 'Pedido do cliente'] }, { name: 'obs', label: 'Mensagem ao cliente', type: 'textarea', full: true, required: true, value: 'Por causa da chuva, a conclusão ficou para a nova data. O profissional confirmou a equipe.' }, { name: 'ciente', type: 'check', text: 'Cliente e profissional cientes do novo prazo', value: true }] }); },
    'c3.replanejarSave': (v, x) => { const a = atd(x.id); const antes = a.exec.fimPrev; a.exec.fimPrev = new Date(v.fim + 'T17:00').toISOString(); a.decisoes.push({ ts: A.now(), por: A.me().nome, txt: 'Prazo replanejado de ' + A.fd(antes) + ' para ' + A.fd(a.exec.fimPrev) + ' (' + v.motivo.toLowerCase() + ').' }); say(a, v.obs); hist(a, 'Prazo de execução replanejado para ' + A.fd(a.exec.fimPrev)); fin(a, 'Prazo replanejado e cliente informado.', 'Prazo de execução replanejado'); },
    'c3.decisao': (ds) => A.form({ title: 'Registrar decisão', sub: 'Registro de aprovações, alterações e combinados do atendimento.', submit: 'c3.decisaoSave', extra: { id: ds.id }, one: true, fields: [{ name: 'tipo', label: 'Tipo', type: 'select', options: ['Aprovação', 'Alteração de escopo', 'Prazo', 'Combinado com o cliente', 'Outro'] }, { name: 'txt', label: 'Decisão', type: 'textarea', required: true, value: 'Cliente aceitou incluir tela contra folhas; profissional enviará versão 2 do orçamento.' }] }),
    'c3.decisaoSave': (v, x) => { const a = atd(x.id); a.decisoes.push({ ts: A.now(), por: A.me().nome, txt: v.tipo + ': ' + v.txt }); hist(a, 'Decisão registrada (' + v.tipo.toLowerCase() + ')', 'interno'); fin(a, 'Decisão registrada no atendimento.', 'Decisão registrada (' + v.tipo.toLowerCase() + ')', 'historico'); },
    'c3.pend': (ds) => A.form({ title: 'Registrar pendência', submit: 'c3.pendSave', extra: { id: ds.id }, one: true, fields: [{ name: 'tipo', label: 'Pendência', required: true, value: 'Aguardar retorno do cliente sobre a cor do rufo' }, { name: 'desc', label: 'Detalhe', type: 'textarea', value: 'Cliente vai decidir até amanhã.' }] }),
    'c3.pendSave': (v, x) => { const a = atd(x.id); a.pendencias.push({ id: 'PD' + Date.now(), tipo: v.tipo, desc: v.desc, ts: A.now(), status: 'Aberta' }); fin(a, 'Pendência registrada.', 'Pendência registrada'); },
    'c3.pendOk': (ds) => { const a = atd(ds.id); const p = a.pendencias.find((k) => k.id === ds.p); p.status = 'Resolvida'; p.resolvida = A.now(); hist(a, 'Pendência resolvida: ' + p.tipo, 'interno'); fin(a, 'Pendência resolvida.', 'Pendência resolvida'); },
    'c3.matSep': (ds, el) => { const a = atd(ds.id); const it = a.orc.itens[+ds.i]; it.sep = !it.sep; A.log(it.sep ? 'Material marcado como separado' : 'Material desmarcado', a.id + ' · ' + it.nome); A.refresh(); },
    'c3.cliEdit': () => { const c = cli(MYCLI); A.form({ title: 'Editar meus dados', submit: 'c3.cliEditSave', fields: [{ name: 'tel', label: 'Telefone', type: 'tel', value: c.tel, required: true }, { name: 'email', label: 'E-mail', type: 'email', value: c.email, required: true }, { name: 'endereco', label: 'Endereço', value: c.endereco, full: true }] }); },
    'c3.cliEditSave': (v) => { Object.assign(cli(MYCLI), v); A.done('Dados atualizados.', 'Cadastro de cliente atualizado', MYCLI); },
    'c3.cliNovo': () => A.form({ title: 'Cadastrar cliente', submit: 'c3.cliNovoSave', fields: [{ name: 'nome', label: 'Nome', required: true, value: 'Otávio Mendes' }, { name: 'tipo', label: 'Tipo', type: 'select', options: ['Residencial', 'Comercial', 'Condomínio'] }, { name: 'tel', label: 'Telefone', type: 'tel', required: true, value: '(19) 98111-2233' }, { name: 'email', label: 'E-mail', type: 'email', required: true, value: 'otavio.mendes@email.demo' }, { name: 'cidade', label: 'Cidade', type: 'select', options: db().cidades }, { name: 'bairro', label: 'Bairro', value: 'Centro' }, { name: 'endereco', label: 'Endereço', value: 'Rua Barão de Jaguara, 400', full: true }] }),
    'c3.cliNovoSave': (v) => { const d = db(), id = A.nextId('CLI-', d.clientes); d.clientes.push(Object.assign({ id: id, desde: A.now() }, v)); A.done('Cliente cadastrado.', 'Cliente cadastrado', id + ' · ' + v.nome); },
    'c3.proNovo': () => A.form({ title: 'Cadastrar profissional', submit: 'c3.proNovoSave', fields: [{ name: 'empresa', label: 'Empresa', required: true, value: 'Silva Calhas Express' }, { name: 'nome', label: 'Responsável', required: true, value: 'Diego Silva' }, { name: 'tel', label: 'Telefone', type: 'tel', required: true, value: '(19) 99000-1717' }, { name: 'email', label: 'E-mail', type: 'email', required: true, value: 'diego@silvacalhas.demo' }, { name: 'servicos', label: 'Especialidades', type: 'checks', full: true, options: db().servicos.map((s) => ({ v: s.id, l: s.nome })), value: ['SRV-01', 'SRV-02'] }, { name: 'regioes', label: 'Cidades', type: 'checks', full: true, options: db().cidades, value: ['Paulínia', 'Campinas'] }] }),
    'c3.proNovoSave': (v) => { const d = db(), id = A.nextId('PRF-', d.pros); d.pros.push({ id: id, nome: v.nome, empresa: v.empresa, cidade: v.regioes[0] || 'Campinas', regioes: v.regioes, servicos: v.servicos, nota: 0, avals: 0, tel: v.tel, email: v.email, status: 'Em homologação', cor: A.colorFor(v.empresa) }); A.done('Profissional cadastrado em homologação.', 'Profissional cadastrado', id + ' · ' + v.empresa); },
    'c3.repDet': (ds) => { const a = atd(ds.id); A.modal({ title: a.id + ' — ' + a.titulo, sub: nomeCli(a) + ' — ' + cidadeOf(a), size: 'lg', body: A.stepper(STEPS, stepOf(a)) + '<div class="mt"></div>' + A.dl([['Profissional', a.pro ? e(pro(a.pro).empresa) : '—'], ['Etapa', etBadge(a)], ['Valor', a.orc ? A.money(orcTotal(a.orc)) : '—'], ['Avaliação', a.avaliacao ? A.stars(a.avaliacao.nota) : '—'], ['Aberto', A.fdt(a.m.criado)], ['Visita', a.m.visita ? A.fdt(a.m.visita) : '—'], ['Orçamento', a.m.orcamento ? A.fdt(a.m.orcamento) : '—'], ['Aprovação', a.m.aprovado ? A.fdt(a.m.aprovado) : '—'], ['Conclusão', a.m.concluido ? A.fdt(a.m.concluido) : '—'], ['Reclamação', a.reclamacao ? e(a.reclamacao.tipo + ' — ' + a.reclamacao.status) : 'Nenhuma']]), foot: '<button class="btn" data-act="core.close">Fechar</button>' + A.nav('Abrir atendimento', 'atendimento', a.id, 'p') }); },
  };
  function aprovar(a, por, via) {
    const o = a.orc;
    o.status = 'Aprovado'; o.aprovadoEm = A.now(); o.aprovadoPor = por; a.etapa = 'aprovado'; a.m.aprovado = A.now();
    a.exec = { inicioPrev: A.d(2, '08:00'), fimPrev: A.d(2, '17:00'), inicio: null, etapas: EXEC.map((n) => ({ n: n, ok: false, ts: null })) };
    hist(a, 'Orçamento aprovado ' + via + ' — ' + A.money(orcTotal(o)));
    sys(a, 'Orçamento aprovado. Pagamento direto ao profissional conforme as condições. Início previsto: ' + A.fd(a.exec.inicioPrev) + '.');
    a.decisoes.push({ ts: A.now(), por: A.me().nome, txt: 'Aprovação registrada ' + via + ': ' + A.money(orcTotal(o)) + ' — ' + o.condicoes + '.' });
    A.log('Orçamento aprovado ' + via, a.id + ' · ' + A.money(orcTotal(o)));
    A.close(); A.setTab('atd', 'resumo'); A.refresh();
    A.toast('Orçamento aprovado. O profissional já pode agendar o início do serviço.');
  }

  /* ------------------------------------------------------------------
     Configuração
     ------------------------------------------------------------------ */
  const alertCount = () => db().atendimentos.filter((a) => alertas(a).some((x) => x.tone === 'bad')).length;
  A.start({
    id: 'c3', num: 3, title: 'Atendimento acompanhado',
    seed: seed, seedLogs: seedLogs, actions: actions,
    about: {
      level: 3,
      resumo: 'A AiCalhas indica o profissional e permanece presente no atendimento, da solicitação à conclusão: combina a visita, confere o orçamento, registra a aprovação, acompanha a execução e cuida do pós-venda. O pagamento é feito direto ao profissional.',
      como: ['O cliente registra a solicitação e a AiCalhas faz a triagem.', 'O mediador designa o profissional e combina a visita com as duas partes.', 'O profissional registra a visita e envia o orçamento.', 'A AiCalhas confere se a proposta tem escopo, materiais, instalação e prazos e libera ao cliente.', 'O cliente aprova e o profissional executa, atualizando as etapas.', 'A AiCalhas confirma a conclusão, solicita avaliação e acompanha garantias e reclamações.'],
      mediador: ['Faz a triagem e seleciona o parceiro', 'Ajuda a combinar a visita', 'Acompanha o envio do orçamento', 'Confere escopo, materiais, instalação e prazos', 'Registra aprovações e alterações', 'Acompanha andamento e atrasos', 'Encaminha problemas para quem precisa resolvê-los', 'Confirma a conclusão e solicita avaliação'],
      limite: 'a AiCalhas acompanha o processo comercial e operacional, mas não define medidas nem dimensionamento (decisões técnicas do profissional) e não recebe o pagamento, que é feito diretamente ao profissional.',
      exemplo: 'O instalador visitou o condomínio, mas não enviou o orçamento. O mediador cobra o retorno, atualiza o cliente e acompanha até existir uma resposta.',
      painel: 'Cada etapa do atendimento, conversas, visitas, propostas, documentos, pendências, atrasos, reclamações e pós-venda.',
      perfil: {
        cliente: { t: 'A AiCalhas acompanha você do pedido à conclusão.', d: 'Converse com o profissional e com a AiCalhas, aprove o orçamento conferido e acompanhe cada etapa. O pagamento é direto ao profissional.' },
        profissional: { t: 'Você executa; a AiCalhas organiza o atendimento.', d: 'Registre a visita, envie o orçamento para conferência e atualize as etapas da execução. Decisões técnicas são suas.' },
        mediador: { t: 'Você coordena cada atendimento até o fim.', d: 'Acompanhe a fila do dia, agende visitas, confira propostas, cobre respostas, registre decisões e resolva pendências e reclamações.' },
      },
    },
    profiles: {
      cliente: {
        home: 'atendimentos',
        menu: [{ sec: 'Atendimento' }, { id: 'atendimentos', label: 'Meus atendimentos', icon: 'clipboard', render: vCliLista, badge: () => meus().filter((a) => ['orcamento_liberado', 'concluido'].indexOf(a.etapa) >= 0 || (a.etapa === 'visita_agendada' && !a.visita.confirmadaCli)).length }, { id: 'nova', label: 'Nova solicitação', icon: 'plus', render: vCliNova }, { id: 'conversas', label: 'Conversas', icon: 'chat', render: vConversas }, { sec: 'Cadastro' }, { id: 'dados', label: 'Meus dados', icon: 'user', render: vCliDados }],
        hidden: { atendimento: { title: 'Atendimento', parent: 'atendimentos', render: vDetalhe } },
      },
      profissional: {
        home: 'agenda',
        menu: [{ sec: 'Trabalho' }, { id: 'agenda', label: 'Agenda', icon: 'calendar', render: vProAgenda }, { id: 'atendimentos', label: 'Meus atendimentos', icon: 'briefcase', render: vProLista, badge: () => meus().filter((a) => actionBar(a).length).length }, { id: 'materiais', label: 'Lista de materiais', icon: 'box', render: vProMateriais }, { id: 'conversas', label: 'Conversas', icon: 'chat', render: vConversas }],
        hidden: { atendimento: { title: 'Atendimento', parent: 'atendimentos', render: vDetalhe } },
      },
      mediador: {
        home: 'fila',
        menu: [{ sec: 'Operação' }, { id: 'fila', label: 'Fila do dia', icon: 'home', render: vMedFila }, { id: 'atendimentos', label: 'Atendimentos', icon: 'clipboard', render: vMedLista }, { id: 'conversas', label: 'Conversas', icon: 'chat', render: vConversas }, { id: 'visitas', label: 'Agenda de visitas', icon: 'calendar', render: vMedVisitas, badge: () => db().atendimentos.filter((a) => a.etapa === 'designado').length }, { id: 'propostas', label: 'Propostas', icon: 'receipt', render: vMedPropostas, badge: () => db().atendimentos.filter((a) => a.etapa === 'orcamento_enviado').length }, { id: 'pendencias', label: 'Pendências e reclamações', icon: 'alert', render: vMedPend, badge: alertCount }, { id: 'posvenda', label: 'Pós-venda', icon: 'star', render: vMedPos },
          { sec: 'Cadastros' }, { id: 'profissionais', label: 'Profissionais', icon: 'users', render: vMedPros }, { id: 'clientes', label: 'Clientes', icon: 'user', render: vMedClientes }, { sec: 'Gestão' }, { id: 'relatorios', label: 'Relatórios', icon: 'chart', render: vMedRel }],
        hidden: { atendimento: { title: 'Atendimento', parent: 'atendimentos', render: vDetalhe } },
      },
    },
  });
})();
