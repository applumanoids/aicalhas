/* =====================================================================
   AiCalhas — Cenário 2: Indicação direcionada
   O cliente informa a necessidade e a AiCalhas encaminha para um
   profissional adequado. A negociação segue direto entre as partes.
   ===================================================================== */
(function () {
  'use strict';
  const A = AiC, e = A.esc, I = A.icon;
  const db = () => A.db();
  const MYPRO = 'PRF-101', MYCLI = 'CLI-201';
  const pro = (id) => db().pros.find((p) => p.id === id);
  const ped = (id) => db().pedidos.find((p) => p.id === id);
  const cli = (id) => db().clientes.find((c) => c.id === id);
  const srvName = (id) => (db().servicos.find((s) => s.id === id) || { nome: id }).nome;
  const URG = ['Urgente (24 h)', 'Esta semana', 'Nas próximas 2 semanas', 'Sem pressa'];
  const PRAZO = { 'Urgente (24 h)': 4, 'Esta semana': 12, 'Nas próximas 2 semanas': 24, 'Sem pressa': 48 };
  const RECUSA = ['Sem agenda no período', 'Fora da minha região', 'Serviço que não realizo', 'Distância / deslocamento', 'Outro'];
  const STEPS = ['Solicitação recebida', 'Análise da AiCalhas', 'Profissional indicado', 'Profissional aceitou', 'Contato realizado', 'Finalizado'];
  const stepOf = (p) => ({ 'Recebido': 1, 'Em triagem': 1, 'Recusado': 1, 'Encaminhado': 2, 'Aceito': 4, 'Em contato': 5, 'Concluído': 6, 'Cancelado': 1 })[p.status];
  const aberto = (p) => ['Encaminhado', 'Aceito', 'Em contato'].indexOf(p.status) >= 0;

  /* ------------------------------------------------------------------
     Dados fictícios
     ------------------------------------------------------------------ */
  function seed() {
    const b = A.base(), d = A.d;
    b.pros.forEach((p) => {
      p.status = p.status === 'Publicado' ? 'Ativo' : 'Em homologação';
      p.dias = ['seg', 'ter', 'qua', 'qui', 'sex'].concat(p.id === 'PRF-101' || p.id === 'PRF-105' ? ['sáb'] : []);
      p.capacidade = p.id === 'PRF-103' ? 3 : 6;
      p.pausa = false;
    });
    b.clientes.push({ id: 'CLI-209', nome: 'Sérgio Almeida', tipo: 'Residencial', cidade: 'Sumaré', bairro: 'Jardim Bela Vista', endereco: 'Rua Tupi, 88', tel: '(19) 98333-4455', email: 'sergio.almeida@email.demo', desde: d(-2) });
    const H = (ts, txt, by, vis) => ({ ts: ts, txt: txt, by: by || '', vis: vis || 'all' });
    const P = [];
    P.push({ id: 'PED-2041', ts: d(0, '08:12'), clienteId: 'CLI-201', srv: 'SRV-03', titulo: 'Calha da frente vazando — trocar trecho', desc: 'A calha da frente da casa está vazando na emenda perto da garagem. Quando chove forte, a água escorre pela parede. Acho que precisa trocar uns 8 metros.', urgencia: 'Esta semana', periodo: 'Manhã', fotos: ['vazamento', 'calha-frontal'], status: 'Em triagem', prioridade: 'Alta', pro: null, tentativas: [], consultas: {}, cobrancas: 0,
      hist: [H(d(0, '08:12'), 'Solicitação recebida pela AiCalhas', 'Mariana Costa'), H(d(0, '08:40'), 'Triagem iniciada — a AiCalhas está analisando o pedido', 'Juliana Rocha'), H(d(0, '08:44'), 'Classificado como conserto de vazamento, prioridade alta. Cliente prefere visita pela manhã.', 'Juliana Rocha', 'interno')] });
    P.push({ id: 'PED-2042', ts: d(0, '11:05'), clienteId: 'CLI-204', srv: 'SRV-04', titulo: 'Limpeza de calhas antes do verão', desc: 'Casa térrea com muitas árvores próximas. As calhas transbordam quando chove.', urgencia: 'Nas próximas 2 semanas', periodo: 'Tarde', fotos: ['limpeza'], status: 'Recebido', prioridade: 'Normal', pro: null, tentativas: [], consultas: {}, cobrancas: 0, hist: [H(d(0, '11:05'), 'Solicitação recebida pela AiCalhas', 'Helena Martins')] });
    P.push({ id: 'PED-2043', ts: d(0, '13:20'), clienteId: 'CLI-208', srv: 'SRV-07', titulo: 'Revisão de calhas e rufos do prédio da clínica', desc: 'Prédio de dois andares. Queremos uma revisão preventiva antes do período de chuvas.', urgencia: 'Esta semana', periodo: 'Qualquer horário', fotos: [], status: 'Recebido', prioridade: 'Normal', pro: null, tentativas: [], consultas: {}, cobrancas: 0, hist: [H(d(0, '13:20'), 'Solicitação recebida pela AiCalhas', 'Clínica Vida Plena')] });
    P.push({ id: 'PED-2040', ts: d(0, '07:55'), clienteId: 'CLI-206', srv: 'SRV-05', titulo: 'Rufo solto na platibanda da quadra', desc: 'Com o vento de ontem, um trecho do rufo da quadra coberta soltou e está batendo. Precisamos de atendimento rápido por segurança dos alunos.', urgencia: 'Urgente (24 h)', periodo: 'Manhã', fotos: ['rufo'], status: 'Encaminhado', prioridade: 'Alta', pro: 'PRF-101', encaminhadoEm: d(0, '12:00'), prazoResp: 4, tentativas: [{ pro: 'PRF-101', ts: d(0, '12:00'), resp: 'Aguardando' }], consultas: { 'PRF-101': 'Confirmou disponibilidade para hoje à tarde.' }, cobrancas: 0,
      hist: [H(d(0, '07:55'), 'Solicitação recebida pela AiCalhas', 'Escola Pequeno Saber'), H(d(0, '09:10'), 'Triagem concluída — urgência por segurança', 'Juliana Rocha'), H(d(0, '12:00'), 'Pedido encaminhado a Mendes Calhas & Coberturas', 'Juliana Rocha')] });
    P.push({ id: 'PED-2038', ts: d(-1, '10:20'), clienteId: 'CLI-203', srv: 'SRV-07', titulo: 'Revisão geral de calhas e condutores (3 blocos)', desc: 'Condomínio com três blocos. Há infiltração na garagem do bloco B quando chove.', urgencia: 'Esta semana', periodo: 'Manhã', fotos: ['condutor'], status: 'Encaminhado', prioridade: 'Normal', pro: 'PRF-104', encaminhadoEm: d(-1, '15:00'), prazoResp: 12, tentativas: [{ pro: 'PRF-104', ts: d(-1, '15:00'), resp: 'Aguardando' }], consultas: {}, cobrancas: 1,
      hist: [H(d(-1, '10:20'), 'Solicitação recebida pela AiCalhas', 'Cond. Jardim das Palmeiras'), H(d(-1, '15:00'), 'Pedido encaminhado a Pereira Funilaria de Obra', 'Juliana Rocha'), H(d(0, '09:00'), 'Cobrança de resposta enviada ao profissional (simulação)', 'Juliana Rocha', 'interno')] });
    P.push({ id: 'PED-2037', ts: d(-1, '08:30'), clienteId: 'CLI-209', srv: 'SRV-02', titulo: 'Troca de 12 m de calha em sobrado', desc: 'Calha galvanizada antiga com vários pontos de ferrugem. Preciso trocar toda a frente do sobrado.', urgencia: 'Esta semana', periodo: 'Manhã', fotos: ['calha-frontal'], status: 'Recusado', prioridade: 'Normal', pro: null, tentativas: [{ pro: 'PRF-104', ts: d(-1, '10:00'), resp: 'Recusado', motivo: 'Sem agenda no período', respTs: d(-1, '13:20') }], consultas: {}, cobrancas: 0,
      hist: [H(d(-1, '08:30'), 'Solicitação recebida pela AiCalhas', 'Sérgio Almeida'), H(d(-1, '10:00'), 'Pedido encaminhado a Pereira Funilaria de Obra', 'Juliana Rocha'), H(d(-1, '13:20'), 'Profissional recusou: sem agenda no período. A AiCalhas vai indicar outro profissional.', 'João Pereira', 'all')] });
    P.push({ id: 'PED-2035', ts: d(-2, '09:00'), clienteId: 'CLI-202', srv: 'SRV-01', titulo: 'Calha nova para edícula', desc: 'Edícula nova no fundo do terreno, cerca de 7 m de beiral sem calha.', urgencia: 'Nas próximas 2 semanas', periodo: 'Tarde', fotos: ['calha-frontal'], status: 'Aceito', prioridade: 'Normal', pro: 'PRF-101', encaminhadoEm: d(-1, '09:40'), prazoResp: 24, tentativas: [{ pro: 'PRF-101', ts: d(-1, '09:40'), resp: 'Aceito', respTs: d(-1, '11:05') }], consultas: {}, cobrancas: 0,
      hist: [H(d(-2, '09:00'), 'Solicitação recebida pela AiCalhas', 'Roberto Nunes'), H(d(-1, '09:40'), 'Pedido encaminhado a Mendes Calhas & Coberturas', 'Juliana Rocha'), H(d(-1, '11:05'), 'Profissional aceitou. Os contatos foram compartilhados entre as partes.', 'Carlos Mendes')] });
    P.push({ id: 'PED-2034', ts: d(-4, '14:00'), clienteId: 'CLI-205', srv: 'SRV-03', titulo: 'Vazamento na calha sobre o forno', desc: 'Goteira dentro da padaria, perto do forno, sempre que chove.', urgencia: 'Urgente (24 h)', periodo: 'Manhã', fotos: ['vazamento'], status: 'Em contato', prioridade: 'Alta', pro: 'PRF-101', encaminhadoEm: d(-4, '15:10'), prazoResp: 4, contatoEm: d(-3, '08:30'), resultadoPro: 'Em negociação', tentativas: [{ pro: 'PRF-104', ts: d(-4, '14:30'), resp: 'Recusado', motivo: 'Fora da minha região', respTs: d(-4, '15:00') }, { pro: 'PRF-101', ts: d(-4, '15:10'), resp: 'Aceito', respTs: d(-4, '15:40') }], consultas: {}, cobrancas: 0,
      hist: [H(d(-4, '14:00'), 'Solicitação recebida pela AiCalhas', 'Padaria Pão Dourado'), H(d(-4, '14:30'), 'Pedido encaminhado a Pereira Funilaria de Obra', 'Juliana Rocha'), H(d(-4, '15:00'), 'Profissional recusou: fora da região', 'João Pereira'), H(d(-4, '15:10'), 'Pedido reencaminhado a Mendes Calhas & Coberturas', 'Juliana Rocha'), H(d(-4, '15:40'), 'Profissional aceitou. Os contatos foram compartilhados entre as partes.', 'Carlos Mendes'), H(d(-3, '08:30'), 'Profissional registrou contato com o cliente e visita no local', 'Carlos Mendes')] });
    P.push({ id: 'PED-2033', ts: d(-5, '10:00'), clienteId: 'CLI-207', srv: 'SRV-06', titulo: 'Condutor entupido transbordando', desc: 'O condutor da lateral transborda e molha o muro do vizinho.', urgencia: 'Esta semana', periodo: 'Tarde', fotos: ['condutor'], status: 'Em contato', prioridade: 'Normal', pro: 'PRF-106', encaminhadoEm: d(-5, '11:00'), prazoResp: 12, contatoEm: d(-4, '09:00'), resultadoPro: 'Serviço contratado', tentativas: [{ pro: 'PRF-106', ts: d(-5, '11:00'), resp: 'Aceito', respTs: d(-5, '12:30') }], consultas: {}, cobrancas: 0,
      hist: [H(d(-5, '10:00'), 'Solicitação recebida pela AiCalhas', 'Gustavo Ramos'), H(d(-5, '11:00'), 'Pedido encaminhado a Águas Pluviais Soluções', 'Juliana Rocha'), H(d(-5, '12:30'), 'Profissional aceitou. Os contatos foram compartilhados entre as partes.', 'Fernanda Alves'), H(d(-4, '09:00'), 'Profissional registrou contato com o cliente', 'Fernanda Alves'), H(d(-2, '17:00'), 'Profissional informou: serviço contratado', 'Fernanda Alves', 'interno')] });
    P.push({ id: 'PED-2029', ts: d(-75, '09:00'), clienteId: 'CLI-201', srv: 'SRV-04', titulo: 'Limpeza de calhas', desc: 'Limpeza geral das calhas antes das chuvas.', urgencia: 'Nas próximas 2 semanas', periodo: 'Manhã', fotos: ['limpeza'], status: 'Concluído', prioridade: 'Normal', pro: 'PRF-103', encaminhadoEm: d(-75, '10:00'), prazoResp: 24, contatoEm: d(-74, '09:00'), resultadoPro: 'Serviço contratado', resultado: 'Serviço contratado', clienteConfirmou: true, avaliacao: { nota: 5, txt: 'Indicação certeira, profissional muito atencioso.' }, tentativas: [{ pro: 'PRF-103', ts: d(-75, '10:00'), resp: 'Aceito', respTs: d(-75, '11:10') }], consultas: {}, cobrancas: 0,
      hist: [H(d(-75, '09:00'), 'Solicitação recebida pela AiCalhas', 'Mariana Costa'), H(d(-75, '10:00'), 'Pedido encaminhado a Telhado Seguro Manutenção', 'Juliana Rocha'), H(d(-75, '11:10'), 'Profissional aceitou. Os contatos foram compartilhados entre as partes.', 'Ana Beatriz Souza'), H(d(-72, '16:00'), 'Indicação finalizada: serviço contratado', 'Juliana Rocha')] });
    // Histórico para relatórios
    const rnd = A.rng(41);
    const nomes = [['Luciana Prado', 'Valinhos'], ['Tiago Moreira', 'Campinas'], ['Beatriz Fontes', 'Vinhedo'], ['Ricardo Sato', 'Campinas'], ['Daniela Vieira', 'Paulínia'], ['Rogério Campos', 'Jundiaí'], ['Patrícia Lemos', 'Indaiatuba'], ['André Luiz', 'Americana'], ['Fábio Nogueira', 'Campinas'], ['Marta Ribeiro', 'Valinhos'], ['Vinícius Rocha', 'Sumaré'], ['Vanessa Dias', 'Hortolândia'], ['Caio Mendonça', 'Campinas'], ['Sílvia Torres', 'Vinhedo'], ['Otávio Brandão', 'Jundiaí'], ['Lígia Paiva', 'Campinas'], ['Hugo Tavares', 'Sumaré'], ['Renato Pires', 'Hortolândia']];
    const ativos = b.pros.filter((p) => p.status === 'Ativo');
    nomes.forEach((n, i) => {
      const cand = ativos.filter((p) => p.regioes.indexOf(n[1]) >= 0);
      const p1 = cand[Math.floor(rnd() * cand.length)];
      const srv = p1.servicos[Math.floor(rnd() * p1.servicos.length)];
      const day = -(6 + i * 4 + Math.floor(rnd() * 3));
      const tent = [];
      let pf = p1;
      if (rnd() < 0.3 && cand.length > 1) { const p0 = cand.find((x) => x !== p1); tent.push({ pro: p0.id, ts: d(day, '10:00'), resp: rnd() < 0.6 ? 'Recusado' : 'Substituído', motivo: RECUSA[Math.floor(rnd() * 4)], respTs: d(day, '14:00') }); }
      tent.push({ pro: pf.id, ts: d(day, '15:00'), resp: 'Aceito', respTs: d(day, String(15 + Math.floor(rnd() * 4)) + ':30') });
      const r = rnd();
      const st = r < 0.08 ? 'Cancelado' : 'Concluído';
      const res = st === 'Cancelado' ? 'Cliente desistiu' : r < 0.68 ? 'Serviço contratado' : r < 0.86 ? 'Não contratado' : 'Em negociação';
      P.push({ id: 'PED-' + (2010 + i), ts: d(day, '09:00'), clienteId: '', clienteNome: n[0], cidadeAvulsa: n[1], srv: srv, titulo: b.servicos.find((s) => s.id === srv).nome, desc: '', urgencia: URG[Math.floor(rnd() * 4)], periodo: 'Manhã', fotos: [], status: st, prioridade: 'Normal', pro: pf.id, encaminhadoEm: d(day, '15:00'), prazoResp: 12, contatoEm: d(day + 1, '10:00'), resultado: res, resultadoPro: res, clienteConfirmou: st === 'Concluído', tentativas: tent, consultas: {}, cobrancas: 0, hist: [H(d(day, '09:00'), 'Solicitação recebida pela AiCalhas', n[0]), H(d(day + 2, '17:00'), 'Indicação finalizada: ' + res.toLowerCase(), 'Juliana Rocha')] });
    });
    b.pedidos = P;
    return b;
  }
  function seedLogs() {
    return A.L([
      [-5, '11:00', 'Juliana Rocha', 'mediador', 'Pedido encaminhado ao profissional', 'PED-2033 · Águas Pluviais Soluções'],
      [-4, '15:00', 'João Pereira', 'profissional', 'Oportunidade recusada: fora da minha região', 'PED-2034'],
      [-4, '15:10', 'Juliana Rocha', 'mediador', 'Profissional substituído e pedido reencaminhado', 'PED-2034 · Mendes Calhas & Coberturas'],
      [-4, '15:40', 'Carlos Mendes', 'profissional', 'Oportunidade aceita', 'PED-2034 · Padaria Pão Dourado'],
      [-3, '08:30', 'Carlos Mendes', 'profissional', 'Contato com cliente registrado', 'PED-2034'],
      [-2, '17:00', 'Fernanda Alves', 'profissional', 'Resultado informado: serviço contratado', 'PED-2033'],
      [-1, '10:00', 'Juliana Rocha', 'mediador', 'Pedido encaminhado ao profissional', 'PED-2037 · Pereira Funilaria de Obra'],
      [-1, '11:05', 'Carlos Mendes', 'profissional', 'Oportunidade aceita', 'PED-2035 · Roberto Nunes'],
      [-1, '13:20', 'João Pereira', 'profissional', 'Oportunidade recusada: sem agenda no período', 'PED-2037'],
      [-1, '15:00', 'Juliana Rocha', 'mediador', 'Pedido encaminhado ao profissional', 'PED-2038 · Pereira Funilaria de Obra'],
      [0, '07:55', 'Escola Pequeno Saber', 'cliente', 'Solicitação registrada', 'PED-2040'],
      [0, '08:12', 'Mariana Costa', 'cliente', 'Solicitação registrada com 2 fotos', 'PED-2041'],
      [0, '08:40', 'Juliana Rocha', 'mediador', 'Triagem iniciada', 'PED-2041'],
      [0, '09:00', 'Juliana Rocha', 'mediador', 'Cobrança de resposta enviada ao profissional', 'PED-2038 · Pereira Funilaria de Obra'],
      [0, '12:00', 'Juliana Rocha', 'mediador', 'Pedido encaminhado ao profissional', 'PED-2040 · Mendes Calhas & Coberturas'],
      [0, '11:05', 'Helena Martins', 'cliente', 'Solicitação registrada', 'PED-2042'],
      [0, '13:20', 'Clínica Vida Plena', 'cliente', 'Solicitação registrada', 'PED-2043'],
    ]);
  }

  /* ------------------------------------------------------------------
     Auxiliares
     ------------------------------------------------------------------ */
  const nomeCli = (p) => (p.clienteId ? cli(p.clienteId).nome : p.clienteNome);
  const cidadeOf = (p) => (p.clienteId ? cli(p.clienteId).cidade : p.cidadeAvulsa);
  const bairroOf = (p) => (p.clienteId ? cli(p.clienteId).bairro : '');
  const horasEnc = (p) => (p.encaminhadoEm ? A.hoursSince(p.encaminhadoEm) : 0);
  const atrasado = (p) => p.status === 'Encaminhado' && horasEnc(p) > p.prazoResp;
  const cargaAberta = (id) => db().pedidos.filter((p) => p.pro === id && aberto(p)).length;
  const hist = (p, txt, vis) => p.hist.push({ ts: A.now(), txt: txt, by: A.me().nome, vis: vis || 'all' });
  function statusBadge(p) {
    if (atrasado(p)) return A.badge('Sem resposta no prazo', 'bad');
    if (p.status === 'Recusado') return A.badge('Recusado — substituir', 'bad');
    if (p.alerta && aberto(p)) return A.badge(p.status, 'warn') + ' ' + A.badge('Alerta', 'bad');
    return A.badge(p.status);
  }
  function score(p, x) {
    const reg = p.regioes.indexOf(cidadeOf(x)) >= 0, esp = p.servicos.indexOf(x.srv) >= 0;
    const disp = p.pausa ? 0 : p.disp === 'Disponível' ? 1 : p.disp === 'Agenda cheia' ? 0.3 : 0;
    const s = (reg ? 40 : 0) + (esp ? 30 : 0) + disp * 20 + (p.nota / 5) * 10 - cargaAberta(p.id) * 2;
    return { reg: reg, esp: esp, disp: disp, s: Math.max(0, Math.round(s)) };
  }
  const tentados = (x) => x.tentativas.map((t) => t.pro);
  function respHoras(t) { return t.respTs ? (new Date(t.respTs) - new Date(t.ts)) / 36e5 : null; }

  /* ------------------------------------------------------------------
     Telas — Cliente
     ------------------------------------------------------------------ */
  function vCliLista() {
    const list = db().pedidos.filter((p) => p.clienteId === MYCLI).sort((a, b) => (a.ts < b.ts ? 1 : -1));
    return A.ph('Minhas solicitações', 'Conte o que precisa e a AiCalhas indica um profissional adequado para a sua região.', A.nav('Nova solicitação', 'nova', null, 'p', 'plus')) +
      (list.length ? '<div class="stack">' + list.map((p) => {
        const pf = p.pro && ['Aceito', 'Em contato', 'Concluído'].indexOf(p.status) >= 0 ? pro(p.pro) : null;
        return '<section class="card"><div class="card-h">' + I('clipboard', 18) + '<h3>' + e(p.titulo) + '</h3><div class="card-r">' + A.badge(p.status === 'Recusado' ? 'Em análise' : p.status === 'Encaminhado' ? 'Aguardando aceite' : p.status, p.status === 'Recusado' ? 'warn' : null) + '</div></div><div class="card-b">' +
          '<div class="small muted mb16">' + e(p.id) + ' — aberta em ' + A.fdt(p.ts) + ' — ' + e(srvName(p.srv)) + ' — ' + e(p.urgencia) + '</div>' + A.stepper(STEPS, stepOf(p)) +
          '<div class="row mt">' + (pf ? '<span class="small">' + I('user', 15) + ' Profissional indicado: <b>' + e(pf.empresa) + '</b></span>' : '<span class="small muted">' + I('clock', 15) + ' ' + (p.status === 'Encaminhado' ? 'Aguardando o profissional aceitar a indicação.' : 'A AiCalhas está selecionando o profissional.') + '</span>') + '<span class="spacer"></span>' + A.nav('Acompanhar', 'solicitacao', p.id, 'sm p', 'eye') + '</div></div></section>';
      }).join('') + '</div>' : A.card(null, A.empty('Você ainda não fez nenhuma solicitação.', 'inbox', A.nav('Nova solicitação', 'nova', null, 'p', 'plus'))));
  }
  function vCliNova() {
    const c = cli(MYCLI);
    return A.ph('Nova solicitação', 'Descreva o problema, envie fotos e informe o endereço. A AiCalhas analisa e indica um profissional.') +
      '<div class="g21"><div>' + A.card(null, '<form data-form="c2.novaSave" class="fg" autocomplete="off">' +
        '<div class="f"><label>Serviço necessário <i class="req">*</i></label><select class="inp" name="srv" required>' + db().servicos.filter((s) => s.ativo).map((s) => '<option value="' + s.id + '"' + (s.id === 'SRV-02' ? ' selected' : '') + '>' + e(s.nome) + '</option>').join('') + '</select></div>' +
        '<div class="f"><label>Urgência <i class="req">*</i></label><select class="inp" name="urgencia" required>' + URG.map((u) => '<option' + (u === 'Esta semana' ? ' selected' : '') + '>' + u + '</option>').join('') + '</select></div>' +
        '<div class="f full"><label>Título <i class="req">*</i></label><input class="inp" name="titulo" required value="Rufo do muro dos fundos soltando"></div>' +
        '<div class="f full"><label>Descreva a necessidade <i class="req">*</i></label><textarea class="inp" name="desc" rows="4" required>O rufo do muro dos fundos está solto em dois pontos e a água da chuva escorre pela parede do vizinho.</textarea></div>' +
        '<div class="f"><label>Cidade <i class="req">*</i></label><select class="inp" name="cidade" required>' + db().cidades.map((x) => '<option' + (x === c.cidade ? ' selected' : '') + '>' + x + '</option>').join('') + '</select></div>' +
        '<div class="f"><label>Bairro</label><input class="inp" name="bairro" value="' + e(c.bairro) + '"></div>' +
        '<div class="f full"><label>Endereço (compartilhado só após o aceite do profissional)</label><input class="inp" name="endereco" value="' + e(c.endereco) + '"></div>' +
        '<div class="f"><label>Melhor período para contato</label><select class="inp" name="periodo"><option>Manhã</option><option>Tarde</option><option>Qualquer horário</option></select></div>' +
        '<div class="f"><label>Telefone para contato</label><input class="inp" name="tel" type="tel" value="' + e(c.tel) + '"></div>' +
        '<div class="f full"><label>Fotos do local</label>' + photoInput() + '</div>' +
        '<div class="f full"><label class="ck single"><input type="checkbox" data-bool="1" name="consent" required checked><span>Autorizo a AiCalhas a compartilhar meus dados de contato com o profissional indicado, somente após ele aceitar o pedido. <i class="req">*</i></span></label></div>' +
        '<div class="f full"><div class="row"><span class="spacer"></span><button class="btn p" type="submit">' + I('send', 16) + ' Enviar solicitação</button></div></div></form>') + '</div>' +
      '<div class="stack">' + A.card('O que acontece depois', '<ol class="ol"><li>A AiCalhas analisa seu pedido (triagem).</li><li>Selecionamos um profissional da sua região, com a especialidade necessária e disponibilidade.</li><li>Quando ele aceita, vocês recebem os contatos um do outro.</li><li>Orçamento, preço e pagamento são combinados diretamente com o profissional.</li><li>Conferimos se você recebeu retorno. Se não, indicamos outro.</li></ol>', { icon: 'route' }) + '</div></div>';
  }
  function photoInput() {
    return '<div class="pf"><label class="pf-up">' + I('camera', 22) + '<span><b>Escolher fotos do dispositivo</b><small>Simulação: as imagens ficam apenas neste navegador.</small></span><input type="file" name="fotos" accept="image/*" multiple data-preview="1"></label><div class="fprev"></div><div class="pf-or">Ou marque imagens ilustrativas:</div><div class="pf-pre" data-multi="fotos__preset">' +
      ['rufo', 'vazamento', 'calha-frontal', 'condutor', 'limpeza'].map((k, i) => '<label class="pf-p"><input type="checkbox" name="fotos__preset" value="' + k + '"' + (i === 0 ? ' checked' : '') + '>' + A.photo(k) + '<small>' + e(A.ILL[k].l) + '</small></label>').join('') + '</div></div>';
  }
  function vCliDetalhe() {
    const p = ped(A.sel('solicitacao'));
    if (!p) return A.empty('Solicitação não encontrada.');
    const pf = p.pro && ['Aceito', 'Em contato', 'Concluído'].indexOf(p.status) >= 0 ? pro(p.pro) : null;
    let box;
    if (p.status === 'Cancelado') box = A.empty('Solicitação cancelada.', 'x');
    else if (pf) box = '<div class="li">' + A.av(pf.empresa, pf.cor) + '<div class="lt"><b>' + e(pf.empresa) + '</b><small>' + e(pf.nome) + ' — ' + A.num(pf.nota, 1) + ' ★ (' + pf.avals + ')</small></div></div>' +
      A.dl([['Telefone / WhatsApp', e(pf.tel)], ['E-mail', e(pf.email)]], 'one') + '<div class="mt"></div>' + A.note('Combine visita, orçamento, preço e pagamento diretamente com o profissional.') +
      (p.status !== 'Concluído' ? '<div class="row mt">' + A.b('Simular contato', 'c2.cliContato', { id: p.id }, 'p sm', 'phone') + '</div>' : '');
    else if (p.status === 'Encaminhado') box = A.empty('Um profissional foi selecionado e está analisando seu pedido. Assim que ele aceitar, os contatos aparecem aqui.', 'clock');
    else box = A.empty('A AiCalhas está analisando seu pedido e selecionando o profissional mais adequado.', 'search');
    const acts = [];
    if (['Aceito', 'Em contato'].indexOf(p.status) >= 0 && !p.clienteConfirmou) { acts.push(A.b('Já recebi contato do profissional', 'c2.cliConfirma', { id: p.id }, 'ok', 'check')); acts.push(A.b('Ainda não recebi retorno', 'c2.cliSemRetorno', { id: p.id }, 'dg', 'alert')); }
    if (['Aceito', 'Em contato', 'Encaminhado'].indexOf(p.status) >= 0) acts.push(A.b('Pedir outro profissional', 'c2.cliOutro', { id: p.id }, '', 'swap'));
    if (p.status === 'Concluído' && !p.avaliacao) acts.push(A.b('Avaliar a indicação', 'c2.cliAvaliar', { id: p.id }, 'p', 'star'));
    if (['Recebido', 'Em triagem', 'Encaminhado', 'Recusado'].indexOf(p.status) >= 0) acts.push(A.b('Cancelar solicitação', 'c2.cliCancelar', { id: p.id }, 'gh', 'x'));
    return A.ph(p.titulo, e(p.id) + ' — aberta em ' + A.fdt(p.ts), '', ['solicitacoes', 'Minhas solicitações']) +
      A.card(null, A.stepper(STEPS, stepOf(p))) + '<div class="g21 mt"><div class="stack">' +
      A.card('Sua solicitação', A.dl([['Serviço', e(srvName(p.srv))], ['Urgência', e(p.urgencia)], ['Local', e(bairroOf(p) + ', ' + cidadeOf(p))], ['Melhor período', e(p.periodo)]]) + '<p class="mt">' + e(p.desc) + '</p>' + (p.fotos.length ? '<div class="gal">' + p.fotos.map((f) => A.zoomable(f, 'Foto enviada')).join('') + '</div>' : ''), { icon: 'clipboard' }) +
      A.card('Andamento', A.timeline(p.hist.filter((h) => h.vis === 'all').slice().reverse().map((h) => ({ ts: h.ts, txt: h.txt }))), { icon: 'history' }) +
      '</div><div class="stack">' + A.card('Profissional indicado', box, { icon: 'user' }) +
      (acts.length ? A.card('O que você pode fazer', '<div class="stack" style="gap:8px">' + acts.join('') + '</div>', { icon: 'flag' }) : '') +
      (p.avaliacao ? A.card('Sua avaliação', A.stars(p.avaliacao.nota) + '<p class="mt">' + e(p.avaliacao.txt) + '</p>', { icon: 'star' }) : '') + '</div></div>';
  }
  function vCliDados() {
    const c = cli(MYCLI);
    return A.ph('Meus dados', 'Usados pela AiCalhas para analisar seus pedidos e repassados ao profissional somente após o aceite.', A.b('Editar dados', 'c2.cliEdit', {}, 'p', 'edit')) +
      A.card('Cadastro', A.dl([['Nome', e(c.nome)], ['Tipo de imóvel', e(c.tipo)], ['Telefone', e(c.tel)], ['E-mail', e(c.email)], ['Endereço', e(c.endereco)], ['Bairro / cidade', e(c.bairro + ', ' + c.cidade)]]), { icon: 'user' });
  }

  /* ------------------------------------------------------------------
     Telas — Profissional
     ------------------------------------------------------------------ */
  function oppCard(p) {
    const restam = p.prazoResp - horasEnc(p);
    const pf = pro(MYPRO);
    return '<section class="card"><div class="card-h">' + I('inbox', 18) + '<h3>' + e(p.titulo) + '</h3><div class="card-r">' + (restam > 0 ? A.badge('Responder em ' + Math.max(1, Math.round(restam)) + ' h', restam < 2 ? 'bad' : 'warn') : A.badge('Prazo vencido', 'bad')) + '</div></div><div class="card-b"><div class="g2">' +
      '<div>' + A.dl([['Serviço', e(srvName(p.srv))], ['Urgência', e(p.urgencia)], ['Local', e((bairroOf(p) ? bairroOf(p) + ', ' : '') + cidadeOf(p))], ['Tipo de cliente', e(p.clienteId ? cli(p.clienteId).tipo : 'Residencial')]]) + '<p class="mt">' + e(p.desc) + '</p>' +
      '<div class="row small" style="color:var(--ok)">' + (pf.regioes.indexOf(cidadeOf(p)) >= 0 ? I('check', 14) + ' Você atende ' + e(cidadeOf(p)) : '') + (pf.servicos.indexOf(p.srv) >= 0 ? ' ' + I('check', 14) + ' Especialidade compatível' : '') + '</div></div>' +
      '<div>' + (p.fotos.length ? '<div class="thumbs" style="grid-template-columns:repeat(2,1fr)">' + p.fotos.map((f) => A.zoomable(f, 'Foto do cliente')).join('') + '</div>' : '<div class="note neutral"><div>Cliente não enviou fotos.</div></div>') + '<div class="small muted mt">' + I('shield', 14) + ' Nome, telefone e endereço completos são liberados após o aceite.</div></div>' +
      '</div></div><div class="pcard"><div class="acts">' + A.b('Ver detalhes', 'c2.oppVer', { id: p.id }, 'sm', 'eye') + '<span class="spacer"></span>' + A.b('Recusar', 'c2.recusar', { id: p.id }, 'sm dg', 'x') + A.b('Aceitar pedido', 'c2.aceitar', { id: p.id }, 'sm ok', 'check') + '</div></div></section>';
  }
  function vProOpp() {
    const list = db().pedidos.filter((p) => p.status === 'Encaminhado' && p.pro === MYPRO);
    const hist = db().pedidos.filter((p) => p.tentativas.some((t) => t.pro === MYPRO && t.resp !== 'Aguardando')).sort((a, b) => (a.ts < b.ts ? 1 : -1)).slice(0, 8);
    return A.ph('Oportunidades recebidas', 'Pedidos que a AiCalhas selecionou para você. Aceite ou recuse dentro do prazo para manter sua taxa de resposta.') +
      (list.length ? '<div class="stack">' + list.map(oppCard).join('') + '</div>' : A.card(null, A.empty('Nenhuma oportunidade aguardando resposta. Novas indicações aparecem aqui.', 'inbox'))) +
      '<div class="mt"></div>' + A.card('Respostas recentes', A.table([
        { l: 'Pedido', f: (p) => '<b>' + e(p.id) + '</b><small>' + e(p.titulo) + '</small>' },
        { l: 'Cidade', f: (p) => e(cidadeOf(p)) },
        { l: 'Sua resposta', f: (p) => { const t = p.tentativas.filter((x) => x.pro === MYPRO).pop(); return A.badge(t.resp) + (t.motivo ? '<small>' + e(t.motivo) + '</small>' : ''); } },
        { l: 'Respondido em', f: (p) => { const t = p.tentativas.filter((x) => x.pro === MYPRO).pop(); return t.respTs ? A.fdtn(t.respTs) : '—'; } },
      ], hist), { flush: true, icon: 'history' });
  }
  function vProAceitos() {
    const list = db().pedidos.filter((p) => p.pro === MYPRO && ['Aceito', 'Em contato', 'Concluído'].indexOf(p.status) >= 0 && A.inPeriod(p.ts, '30')).sort((a, b) => (a.ts < b.ts ? 1 : -1));
    return A.ph('Pedidos aceitos', 'Clientes indicados que você aceitou. Registre o contato e informe o resultado — isso ajuda a AiCalhas a confirmar o atendimento.') +
      (list.length ? '<div class="stack">' + list.map((p) => {
        const c = p.clienteId ? cli(p.clienteId) : null;
        const acts = [];
        if (p.status === 'Aceito') acts.push(A.b('Registrar contato com cliente', 'c2.regContato', { id: p.id }, 'sm p', 'phone'));
        if (p.status === 'Em contato') acts.push(A.b('Informar resultado', 'c2.resultado', { id: p.id }, 'sm p', 'flag'));
        return '<section class="card"><div class="card-h">' + I('briefcase', 18) + '<h3>' + e(p.titulo) + '</h3><div class="card-r">' + A.badge(p.status) + '</div></div><div class="card-b"><div class="g2"><div>' +
          A.dl([['Cliente', e(nomeCli(p)) + (c && c.contato ? '<small> — ' + e(c.contato) + '</small>' : '')], ['Telefone', e(c ? c.tel : '—')], ['Endereço', e(c ? c.endereco + ' — ' + c.bairro + ', ' + c.cidade : cidadeOf(p))], ['Melhor período', e(p.periodo)]]) + '</div><div>' +
          A.dl([['Serviço', e(srvName(p.srv))], ['Aceito em', A.fdt((p.tentativas.filter((t) => t.pro === MYPRO).pop() || {}).respTs)], ['Contato registrado', p.contatoEm ? A.fdt(p.contatoEm) : A.badge('Pendente', 'warn')], ['Resultado informado', e(p.resultadoPro || '—')]]) + '</div></div>' +
          (acts.length ? '<div class="row mt"><span class="spacer"></span>' + acts.join('') + '</div>' : '') + '</div></section>';
      }).join('') + '</div>' : A.card(null, A.empty('Nenhum pedido aceito nos últimos 30 dias.', 'briefcase')));
  }
  function vProDisp() {
    const p = pro(MYPRO);
    const DIAS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];
    return A.ph('Disponibilidade e área de atuação', 'A AiCalhas usa estas informações para decidir para quem encaminhar cada pedido.', A.b('Editar disponibilidade', 'c2.dispEdit', {}, 'p', 'edit')) +
      '<div class="g2">' + A.card('Situação para receber indicações', A.dl([['Situação', p.pausa ? A.badge('Pausado', 'bad') : A.badge(p.disp)], ['Dias de atendimento', e(DIAS.filter((d) => p.dias.indexOf(d) >= 0).join(', '))], ['Capacidade', p.capacidade + ' indicações por semana'], ['Em aberto agora', cargaAberta(p.id) + ' pedido(s)']]) + '<div class="row mt">' + (p.pausa ? A.b('Retomar indicações', 'c2.pausa', {}, 'ok', 'play') : A.b('Pausar indicações', 'c2.pausa', {}, 'dg', 'pause')) + '</div>', { icon: 'calendar' }) +
      A.card('Especialidades', A.chips(p.servicos.map(srvName), 'acc') + '<h4 style="margin:16px 0 6px">Cidades atendidas</h4>' + A.chips(p.regioes), { icon: 'tool' }) +
      '</div><div class="mt"></div>' + A.card('Mapa de atendimento', A.regionMap(p.regioes), { icon: 'map' });
  }
  function vProDesempenho() {
    const per = A.fv('pdes', 'per', '90');
    const tent = [];
    db().pedidos.filter((p) => A.inPeriod(p.ts, per)).forEach((p) => p.tentativas.forEach((t) => { if (t.pro === MYPRO) tent.push({ p: p, t: t }); }));
    const ac = tent.filter((x) => x.t.resp === 'Aceito'), rc = tent.filter((x) => x.t.resp === 'Recusado');
    const tempos = tent.map((x) => respHoras(x.t)).filter((x) => x != null);
    const contr = ac.filter((x) => x.p.resultadoPro === 'Serviço contratado' || x.p.resultado === 'Serviço contratado');
    return A.ph('Meu desempenho', 'Indicadores usados pela AiCalhas para priorizar parceiros.') +
      '<div class="card mb16" style="padding:12px 14px 0">' + A.filters('pdes', [{ k: 'per', l: 'Período', def: '90', o: A.PERIODS }]) + '</div>' +
      '<div class="g4 mb16">' + A.kpi({ l: 'Indicações recebidas', v: tent.length, icon: 'inbox' }) + A.kpi({ l: 'Taxa de aceite', v: A.pct(ac.length, tent.length), s: ac.length + ' aceitas, ' + rc.length + ' recusadas', icon: 'thumb', tone: 'ok' }) +
      A.kpi({ l: 'Tempo médio de resposta', v: tempos.length ? A.num(A.avg(tempos), 1) + ' h' : '—', icon: 'clock' }) + A.kpi({ l: 'Serviços contratados', v: contr.length, s: A.pct(contr.length, ac.length) + ' das aceitas', icon: 'check', tone: 'ok' }) + '</div>' +
      A.card('Indicações no período', A.table([
        { l: 'Pedido', f: (x) => '<b>' + e(x.p.id) + '</b><small>' + e(x.p.titulo) + '</small>' }, { l: 'Cidade', f: (x) => e(cidadeOf(x.p)) },
        { l: 'Recebida', f: (x) => A.fdtn(x.t.ts) }, { l: 'Resposta', f: (x) => A.badge(x.t.resp) }, { l: 'Tempo', cls: 'r', f: (x) => (respHoras(x.t) != null ? A.num(respHoras(x.t), 1) + ' h' : '—') },
        { l: 'Resultado', f: (x) => e(x.p.resultadoPro || x.p.resultado || '—') },
      ], tent.sort((a, b) => (a.t.ts < b.t.ts ? 1 : -1))), { flush: true });
  }

  /* ------------------------------------------------------------------
     Telas — Mediador
     ------------------------------------------------------------------ */
  function alertas() {
    const d = db(), out = [];
    d.pedidos.forEach((p) => {
      if (atrasado(p)) out.push({ p: p, t: 'Sem resposta do profissional há ' + Math.round(horasEnc(p)) + ' h', tone: 'bad' });
      if (p.status === 'Recusado') out.push({ p: p, t: 'Profissional recusou — indicar outro', tone: 'bad' });
      if (p.alerta && aberto(p)) out.push({ p: p, t: p.alerta, tone: 'warn' });
      if (p.status === 'Em contato' && !p.verificado) out.push({ p: p, t: 'Verificar retorno com o cliente', tone: 'info' });
    });
    return out;
  }
  function vMedPainel() {
    const d = db(), al = alertas();
    const p30 = d.pedidos.filter((p) => A.inPeriod(p.ts, '30'));
    const fila = d.pedidos.filter((p) => p.status === 'Recebido' || p.status === 'Em triagem').sort((a, b) => (a.ts < b.ts ? -1 : 1));
    const enc = d.pedidos.filter((p) => p.status === 'Encaminhado');
    return A.ph('Central de indicações', 'Triagem, encaminhamento, respostas dos parceiros e confirmação do atendimento.', A.nav('Abrir triagem', 'triagem', null, 'p', 'inbox')) +
      '<div class="g4 mb16">' + A.kpi({ l: 'Novos pedidos', v: d.pedidos.filter((p) => p.status === 'Recebido').length, s: d.pedidos.filter((p) => p.status === 'Em triagem').length + ' em triagem', icon: 'inbox' }) +
      A.kpi({ l: 'Aguardando resposta', v: enc.length, s: enc.filter(atrasado).length + ' fora do prazo', icon: 'clock', tone: 'warn' }) +
      A.kpi({ l: 'Precisam de ação', v: al.filter((x) => x.tone !== 'info').length, s: 'Recusas, atrasos e alertas', icon: 'alert', tone: 'bad' }) +
      A.kpi({ l: 'Indicações finalizadas', v: p30.filter((p) => p.status === 'Concluído').length, s: 'Últimos 30 dias', icon: 'check', tone: 'ok' }) + '</div>' +
      '<div class="g2"><div class="stack">' +
      A.card('Fila de triagem (' + fila.length + ')', fila.length ? fila.map((p) => '<div class="li clk" data-act="core.nav" data-view="pedido" data-id="' + p.id + '">' + A.av(nomeCli(p)) + '<div class="lt"><b>' + e(p.titulo) + '</b><small>' + e(nomeCli(p)) + ' — ' + e(cidadeOf(p)) + ' — ' + e(p.urgencia) + '</small></div>' + A.badge(p.status) + '<span class="small muted nowrap">' + A.ago(p.ts) + '</span></div>').join('') : A.empty('Nenhum pedido aguardando triagem.', 'check'), { icon: 'inbox' }) +
      A.card('Prazos de resposta dos parceiros', enc.length ? enc.map((p) => { const r = p.prazoResp - horasEnc(p); return '<div class="li clk" data-act="core.nav" data-view="pedido" data-id="' + p.id + '">' + A.av(pro(p.pro).empresa, pro(p.pro).cor) + '<div class="lt"><b>' + e(pro(p.pro).empresa) + '</b><small>' + e(p.id) + ' — ' + e(p.titulo) + '</small></div>' + (r > 0 ? A.badge('Restam ' + Math.max(1, Math.round(r)) + ' h', 'warn') : A.badge('Vencido há ' + Math.round(-r) + ' h', 'bad')) + '</div>'; }).join('') : A.empty('Nenhum pedido aguardando resposta.', 'check'), { icon: 'clock' }) +
      '</div><div class="stack">' +
      A.card('Alertas e verificações (' + al.length + ')', al.length ? al.map((x) => '<div class="li clk" data-act="core.nav" data-view="pedido" data-id="' + x.p.id + '">' + I(x.tone === 'info' ? 'phone' : 'alert', 18) + '<div class="lt"><b>' + e(x.t) + '</b><small>' + e(x.p.id) + ' — ' + e(nomeCli(x.p)) + ' — ' + e(cidadeOf(x.p)) + '</small></div>' + I('arrowR', 16) + '</div>').join('') : A.empty('Sem alertas.', 'check'), { icon: 'bell' }) +
      A.card('Funil de indicações (30 dias)', funil(p30), { icon: 'chart' }) + '</div></div>';
  }
  function funil(list) {
    return A.funnel([
      { l: 'Pedidos recebidos', v: list.length },
      { l: 'Encaminhados', v: list.filter((p) => p.tentativas.length).length },
      { l: 'Aceitos', v: list.filter((p) => p.tentativas.some((t) => t.resp === 'Aceito')).length },
      { l: 'Contato realizado', v: list.filter((p) => p.contatoEm).length },
      { l: 'Serviço contratado', v: list.filter((p) => (p.resultado || p.resultadoPro) === 'Serviço contratado').length },
    ]);
  }
  function vMedTriagem() {
    const list = db().pedidos.filter((p) => ['Recebido', 'Em triagem', 'Recusado'].indexOf(p.status) >= 0).sort((a, b) => (a.ts < b.ts ? -1 : 1));
    return A.ph('Triagem e encaminhamento', 'Entenda cada pedido, classifique e selecione o parceiro adequado por região, especialidade e disponibilidade.') +
      (list.length ? '<div class="stack">' + list.map((p) => '<section class="card"><div class="card-h">' + I('clipboard', 18) + '<h3>' + e(p.id) + ' — ' + e(p.titulo) + '</h3><div class="card-r">' + statusBadge(p) + A.badge('Prioridade ' + p.prioridade.toLowerCase(), p.prioridade === 'Alta' ? 'bad' : 'neutral') + '</div></div><div class="card-b"><div class="g21"><div>' +
        A.dl([['Cliente', e(nomeCli(p))], ['Local', e((bairroOf(p) ? bairroOf(p) + ', ' : '') + cidadeOf(p))], ['Serviço', e(srvName(p.srv))], ['Urgência', e(p.urgencia)], ['Recebido', A.fdt(p.ts) + ' (' + A.ago(p.ts) + ')'], ['Tentativas', p.tentativas.length ? p.tentativas.map((t) => e(pro(t.pro).empresa) + ': ' + e(t.resp)).join('<br>') : 'Nenhuma']]) +
        '<p class="mt">' + e(p.desc) + '</p></div><div>' + (p.fotos.length ? '<div class="thumbs" style="grid-template-columns:repeat(2,1fr)">' + p.fotos.map((f) => A.zoomable(f, 'Foto do cliente')).join('') + '</div>' : '<div class="note neutral"><div>Sem fotos.</div></div>') + '</div></div>' +
        '<div class="row mt">' + A.nav('Abrir pedido', 'pedido', p.id, 'sm', 'eye') + A.b('Pedir mais informações', 'c2.pedirInfo', { id: p.id }, 'sm', 'chat') + A.b('Classificar', 'c2.classificar', { id: p.id }, 'sm', 'edit') + '<span class="spacer"></span>' +
        (p.status === 'Recebido' ? A.b('Iniciar triagem', 'c2.triar', { id: p.id }, 'sm p', 'search') : A.b(p.status === 'Recusado' ? 'Selecionar outro profissional' : 'Selecionar profissional', 'c2.selecionar', { id: p.id }, 'sm p', 'route')) + '</div></div></section>').join('') + '</div>' : A.card(null, A.empty('Nenhum pedido aguardando triagem.', 'check')));
  }
  function vMedEnc() {
    const st = A.fv('enc', 'st'), cid = A.fv('enc', 'cid');
    let list = db().pedidos.filter((p) => ['Encaminhado', 'Aceito', 'Em contato'].indexOf(p.status) >= 0 || (p.status === 'Concluído' && A.inPeriod(p.ts, '30')));
    if (st) list = list.filter((p) => p.status === st);
    if (cid) list = list.filter((p) => cidadeOf(p) === cid);
    list.sort((a, b) => (a.ts < b.ts ? 1 : -1));
    return A.ph('Acompanhamento dos encaminhamentos', 'Confira se os parceiros responderam, cobre retornos, substitua quando necessário e confirme o atendimento com o cliente.') +
      A.card(null, A.filters('enc', [{ k: 'st', l: 'Situação', o: A.opts(['Encaminhado', 'Aceito', 'Em contato', 'Concluído'], 'Todas') }, { k: 'cid', l: 'Cidade', o: A.opts(db().cidades, 'Todas') }]) + A.table([
        { l: 'Pedido', f: (p) => '<b>' + e(p.id) + '</b><small>' + e(p.titulo) + '</small>' },
        { l: 'Cliente', f: (p) => e(nomeCli(p)) + '<small>' + e(cidadeOf(p)) + '</small>' },
        { l: 'Profissional', f: (p) => (p.pro ? e(pro(p.pro).empresa) : '—') },
        { l: 'Encaminhado', f: (p) => (p.encaminhadoEm ? A.fdtn(p.encaminhadoEm) + '<small>' + A.ago(p.encaminhadoEm) + '</small>' : '—') },
        { l: 'Situação', f: (p) => statusBadge(p) },
        { l: '', cls: 'r', f: (p) => '<div class="acts-row" style="justify-content:flex-end">' + (p.status === 'Encaminhado' ? A.b('Cobrar', 'c2.cobrar', { id: p.id }, 'sm', 'bell') + A.b('Substituir', 'c2.substituir', { id: p.id }, 'sm dg', 'swap') : '') + (p.status === 'Em contato' || p.status === 'Aceito' ? A.b('Verificar retorno', 'c2.verificar', { id: p.id }, 'sm ok', 'phone') : '') + A.nav('Abrir', 'pedido', p.id, 'sm', 'eye') + '</div>' },
      ], list), { flush: true });
  }
  function vMedPedido() {
    const p = ped(A.sel('pedido'));
    if (!p) return A.empty('Pedido não encontrado.');
    const c = p.clienteId ? cli(p.clienteId) : null;
    const acts = [];
    if (p.status === 'Recebido') acts.push(A.b('Iniciar triagem', 'c2.triar', { id: p.id }, 'p', 'search'));
    if (['Recebido', 'Em triagem', 'Recusado'].indexOf(p.status) >= 0) { acts.push(A.b('Classificar pedido', 'c2.classificar', { id: p.id }, '', 'edit')); acts.push(A.b('Pedir mais informações', 'c2.pedirInfo', { id: p.id }, '', 'chat')); }
    if (['Em triagem', 'Recusado'].indexOf(p.status) >= 0) acts.push(A.b(p.status === 'Recusado' ? 'Selecionar outro profissional' : 'Selecionar profissional', 'c2.selecionar', { id: p.id }, 'p', 'route'));
    if (p.status === 'Encaminhado') { acts.push(A.b('Cobrar resposta do profissional', 'c2.cobrar', { id: p.id }, '', 'bell')); acts.push(A.b('Substituir profissional', 'c2.substituir', { id: p.id }, 'dg', 'swap')); }
    if (p.status === 'Aceito' || p.status === 'Em contato') { acts.push(A.b('Verificar retorno com o cliente', 'c2.verificar', { id: p.id }, 'ok', 'phone')); acts.push(A.b('Substituir profissional', 'c2.substituir', { id: p.id }, 'dg', 'swap')); }
    if (['Recebido', 'Em triagem', 'Encaminhado', 'Recusado'].indexOf(p.status) >= 0) acts.push(A.b('Cancelar pedido', 'c2.medCancelar', { id: p.id }, 'gh', 'x'));
    acts.push(A.b('Registrar observação interna', 'c2.obs', { id: p.id }, 'gh', 'edit'));
    return A.ph(p.id + ' — ' + p.titulo, 'Recebido em ' + A.fdt(p.ts) + ' — ' + e(nomeCli(p)), statusBadge(p), ['triagem', 'Triagem']) +
      A.card(null, A.stepper(STEPS, stepOf(p))) + '<div class="g21 mt"><div class="stack">' +
      A.card('Solicitação', A.dl([['Serviço', e(srvName(p.srv))], ['Urgência', e(p.urgencia)], ['Prioridade', e(p.prioridade)], ['Melhor período', e(p.periodo)]]) + '<p class="mt">' + e(p.desc || 'Sem descrição registrada.') + '</p>' + (p.fotos.length ? '<div class="gal">' + p.fotos.map((f) => A.zoomable(f, 'Foto do cliente')).join('') + '</div>' : ''), { icon: 'clipboard' }) +
      A.card('Tentativas de encaminhamento', A.table([
        { l: 'Profissional', f: (t) => '<b>' + e(pro(t.pro).empresa) + '</b>' }, { l: 'Encaminhado', f: (t) => A.fdtn(t.ts) }, { l: 'Resposta', f: (t) => A.badge(t.resp) + (t.motivo ? '<small>' + e(t.motivo) + '</small>' : '') }, { l: 'Tempo', cls: 'r', f: (t) => (respHoras(t) != null ? A.num(respHoras(t), 1) + ' h' : A.ago(t.ts)) },
      ], p.tentativas, { empty: 'O pedido ainda não foi encaminhado.' }), { icon: 'route', flush: true }) +
      A.card('Histórico do pedido', A.timeline(p.hist.slice().reverse().map((h) => ({ ts: h.ts, txt: (h.vis === 'interno' ? '[interno] ' : '') + h.txt, by: h.by }))), { icon: 'history' }) +
      '</div><div class="stack">' + A.card('Ações da AiCalhas', '<div class="stack" style="gap:8px">' + acts.join('') + '</div>', { icon: 'shield' }) +
      A.card('Cliente', A.dl([['Nome', e(nomeCli(p)) + (c && c.contato ? '<small> — ' + e(c.contato) + '</small>' : '')], ['Telefone', e(c ? c.tel : '—')], ['Endereço', e(c ? c.endereco + ' — ' + c.bairro + ', ' + c.cidade : cidadeOf(p))], ['Consentimento LGPD', A.badge('Autorizado', 'ok')]], 'one'), { icon: 'user' }) +
      (p.pro ? A.card('Profissional atual', '<div class="li">' + A.av(pro(p.pro).empresa, pro(p.pro).cor) + '<div class="lt"><b>' + e(pro(p.pro).empresa) + '</b><small>' + e(pro(p.pro).tel) + ' — ' + A.num(pro(p.pro).nota, 1) + ' ★</small></div></div>' + A.dl([['Contato com cliente', p.contatoEm ? A.fdt(p.contatoEm) : 'Não registrado'], ['Resultado informado', e(p.resultadoPro || '—')], ['Cliente confirmou', p.clienteConfirmou ? 'Sim' : 'Não']], 'one'), { icon: 'tool' }) : '') +
      (p.alerta ? AiC.note('<b>Alerta:</b> ' + e(p.alerta), 'warn') : '') + '</div></div>';
  }
  function vMedParceiros() {
    const cid = A.fv('parc', 'cid'), sv = A.fv('parc', 'srv');
    let list = db().pros.slice();
    if (cid) list = list.filter((p) => p.regioes.indexOf(cid) >= 0);
    if (sv) list = list.filter((p) => p.servicos.indexOf(sv) >= 0);
    return A.ph('Parceiros', 'Rede de profissionais que recebem indicações. Mantenha regiões, especialidades e disponibilidade atualizadas.', A.b('Cadastrar parceiro', 'c2.parcNovo', {}, 'p', 'plus')) +
      A.card(null, A.filters('parc', [{ k: 'cid', l: 'Cidade', o: A.opts(db().cidades, 'Todas') }, { k: 'srv', l: 'Especialidade', o: A.opts(db().servicos.map((s) => ({ v: s.id, l: s.nome })), 'Todas') }]) + A.table([
        { l: 'Parceiro', f: (p) => '<div class="row" style="flex-wrap:nowrap">' + A.av(p.empresa, p.cor) + '<div><b>' + e(p.empresa) + '</b><small>' + e(p.nome) + ' — ' + e(p.tel) + '</small></div></div>' },
        { l: 'Regiões', f: (p) => e(p.regioes.join(', ')) },
        { l: 'Especialidades', f: (p) => e(p.servicos.map(srvName).join(', ')) },
        { l: 'Disponibilidade', f: (p) => (p.pausa ? A.badge('Pausado') : A.badge(p.disp)) },
        { l: 'Aceite', cls: 'r', f: (p) => (p.taxaAceite ? p.taxaAceite + '%' : '—') },
        { l: 'Em aberto', cls: 'r', f: (p) => cargaAberta(p.id) },
        { l: 'Situação', f: (p) => A.badge(p.status, p.status === 'Ativo' ? 'ok' : 'warn') },
        { l: '', cls: 'r', f: (p) => '<div class="acts-row" style="justify-content:flex-end">' + A.b('Editar', 'c2.parcEdit', { id: p.id }, 'sm', 'edit') + (p.status !== 'Ativo' ? A.b('Homologar', 'c2.parcHomolog', { id: p.id }, 'sm ok', 'check') : '') + '</div>' },
      ], list), { flush: true });
  }
  function vMedClientes() {
    return A.ph('Clientes', 'Clientes que fizeram solicitações de indicação.', A.b('Cadastrar cliente', 'c2.cliNovo', {}, 'p', 'plus')) +
      A.card(null, A.table([
        { l: 'Cliente', f: (c) => '<b>' + e(c.nome) + '</b><small>' + e(c.contato || c.email) + '</small>' }, { l: 'Tipo', k: 'tipo' }, { l: 'Cidade', f: (c) => e(c.bairro + ', ' + c.cidade) }, { l: 'Telefone', k: 'tel' },
        { l: 'Pedidos', cls: 'r', f: (c) => db().pedidos.filter((p) => p.clienteId === c.id).length },
        { l: '', cls: 'r', f: (c) => A.b('Ver pedidos', 'c2.cliVer', { id: c.id }, 'sm', 'eye') },
      ], db().clientes), { flush: true });
  }
  function vMedCatalogo() {
    return A.ph('Serviços', 'Catálogo usado na triagem e no cadastro de especialidades dos parceiros.', A.b('Cadastrar serviço', 'c2.srvNovo', {}, 'p', 'plus')) +
      A.card(null, A.table([
        { l: 'Código', k: 'id' }, { l: 'Serviço', f: (s) => '<b>' + e(s.nome) + '</b><small>' + e(s.desc) + '</small>' },
        { l: 'Parceiros aptos', cls: 'r', f: (s) => db().pros.filter((p) => p.status === 'Ativo' && p.servicos.indexOf(s.id) >= 0).length },
        { l: 'Pedidos (90 dias)', cls: 'r', f: (s) => db().pedidos.filter((p) => p.srv === s.id && A.inPeriod(p.ts, '90')).length },
        { l: 'Situação', f: (s) => A.badge(s.ativo ? 'Ativo' : 'Inativo', s.ativo ? 'ok' : 'neutral') },
      ], db().servicos), { flush: true });
  }
  function vMedRel() {
    const d = db(), tab = A.tab('rep', 'fun');
    const per = A.fv('rep', 'per', '90'), cid = A.fv('rep', 'cid'), sv = A.fv('rep', 'srv');
    let list = d.pedidos.filter((p) => A.inPeriod(p.ts, per));
    if (cid) list = list.filter((p) => cidadeOf(p) === cid);
    if (sv) list = list.filter((p) => p.srv === sv);
    const filt = A.filters('rep', [{ k: 'per', l: 'Período', def: '90', o: A.PERIODS }, { k: 'cid', l: 'Cidade', o: A.opts(d.cidades, 'Todas') }, { k: 'srv', l: 'Serviço', o: A.opts(d.servicos.map((s) => ({ v: s.id, l: s.nome })), 'Todos') }]);
    const tents = []; list.forEach((p) => p.tentativas.forEach((t) => tents.push({ p: p, t: t })));
    let body = '';
    if (tab === 'fun') {
      const tempos = tents.map((x) => respHoras(x.t)).filter((x) => x != null);
      body = '<div class="g4 mb16">' + A.kpi({ l: 'Pedidos recebidos', v: list.length, icon: 'inbox' }) + A.kpi({ l: 'Taxa de aceite na 1ª indicação', v: A.pct(list.filter((p) => p.tentativas[0] && p.tentativas[0].resp === 'Aceito').length, list.filter((p) => p.tentativas.length).length), icon: 'thumb' }) +
        A.kpi({ l: 'Tempo médio de resposta', v: tempos.length ? A.num(A.avg(tempos), 1) + ' h' : '—', icon: 'clock' }) + A.kpi({ l: 'Substituições', v: list.filter((p) => p.tentativas.length > 1).length, icon: 'swap', tone: 'warn' }) + '</div>' +
        '<div class="g2 mb16">' + A.card('Funil de indicações', funil(list), { icon: 'chart' }) + A.card('Resultado das indicações finalizadas', A.bars(A.toBars(A.count(list.filter((p) => p.status === 'Concluído' || p.status === 'Cancelado'), (p) => p.resultado || 'Sem resultado'))), { icon: 'flag' }) + '</div>' +
        A.card('Pedidos do período (' + list.length + ')', A.table([
          { l: 'Pedido', f: (p) => '<b>' + e(p.id) + '</b><small>' + e(p.titulo) + '</small>' }, { l: 'Data', f: (p) => A.fdtn(p.ts) }, { l: 'Cidade', f: (p) => e(cidadeOf(p)) }, { l: 'Profissional', f: (p) => (p.pro ? e(pro(p.pro).empresa) : '—') }, { l: 'Tentativas', cls: 'r', f: (p) => p.tentativas.length }, { l: 'Situação', f: (p) => statusBadge(p) }, { l: 'Resultado', f: (p) => e(p.resultado || '—') },
          { l: '', cls: 'r', f: (p) => A.b('Detalhes', 'c2.repDet', { id: p.id }, 'sm', 'eye') },
        ], list.slice().sort((a, b) => (a.ts < b.ts ? 1 : -1))), { flush: true });
    } else if (tab === 'parc') {
      const rows = d.pros.filter((p) => p.status === 'Ativo').map((p) => {
        const t = tents.filter((x) => x.t.pro === p.id), ac = t.filter((x) => x.t.resp === 'Aceito');
        const tm = t.map((x) => respHoras(x.t)).filter((x) => x != null);
        return { id: p.id, p: p, n: t.length, ac: ac.length, rc: t.filter((x) => x.t.resp === 'Recusado').length, sub: t.filter((x) => x.t.resp === 'Substituído' || x.t.resp === 'Sem resposta').length, tm: tm.length ? A.avg(tm) : null, ct: ac.filter((x) => (x.p.resultado || x.p.resultadoPro) === 'Serviço contratado').length };
      });
      body = '<div class="g2 mb16">' + A.card('Indicações por parceiro', A.bars(rows.map((r) => ({ l: r.p.empresa, v: r.n })).sort((a, b) => b.v - a.v))) + A.card('Tempo médio de resposta (h)', A.bars(rows.filter((r) => r.tm != null).map((r) => ({ l: r.p.empresa, v: r.tm, c: r.tm > 8 ? 'var(--bad)' : null })).sort((a, b) => b.v - a.v), { dec: 1, suffix: ' h' })) + '</div>' +
        A.card('Desempenho dos parceiros', A.table([
          { l: 'Parceiro', f: (r) => '<b>' + e(r.p.empresa) + '</b>' }, { l: 'Encaminhados', cls: 'r', k: 'n' }, { l: 'Aceitos', cls: 'r', k: 'ac' }, { l: 'Recusados', cls: 'r', k: 'rc' }, { l: 'Substituídos', cls: 'r', k: 'sub' },
          { l: 'Taxa de aceite', cls: 'r', f: (r) => A.pct(r.ac, r.n) }, { l: 'Resposta média', cls: 'r', f: (r) => (r.tm != null ? A.num(r.tm, 1) + ' h' : '—') }, { l: 'Contratados', cls: 'r', k: 'ct' },
          { l: '', cls: 'r', f: (r) => A.b('Detalhes', 'c2.parcDet', { id: r.id }, 'sm', 'eye') },
        ], rows), { flush: true });
    } else if (tab === 'reg') {
      const rows = d.cidades.map((c) => ({ id: c, c: c, n: list.filter((p) => cidadeOf(p) === c).length, parc: d.pros.filter((p) => p.status === 'Ativo' && p.regioes.indexOf(c) >= 0).length, ct: list.filter((p) => cidadeOf(p) === c && p.resultado === 'Serviço contratado').length }));
      body = '<div class="g12">' + A.card('Pedidos por cidade', A.bars(rows.map((r) => ({ l: r.c, v: r.n })).sort((a, b) => b.v - a.v))) + A.card('Demanda x parceiros disponíveis', A.table([
        { l: 'Cidade', f: (r) => '<b>' + e(r.c) + '</b>' }, { l: 'Pedidos', cls: 'r', k: 'n' }, { l: 'Parceiros ativos', cls: 'r', k: 'parc' }, { l: 'Pedidos por parceiro', cls: 'r', f: (r) => (r.parc ? A.num(r.n / r.parc, 1) : '—') }, { l: 'Contratados', cls: 'r', k: 'ct' },
        { l: 'Atenção', f: (r) => (r.parc <= 1 ? A.badge('Poucos parceiros', 'bad') : r.n / r.parc > 3 ? A.badge('Alta demanda', 'warn') : A.badge('Equilibrado', 'ok')) },
      ], rows), { flush: true }) + '</div>';
    } else {
      const rec = tents.filter((x) => x.t.resp === 'Recusado');
      body = '<div class="g2">' + A.card('Motivos de recusa (' + rec.length + ')', A.bars(A.toBars(A.count(rec, (x) => x.t.motivo || 'Não informado')))) + A.card('Recusas por parceiro', A.bars(A.toBars(A.count(rec, (x) => pro(x.t.pro).empresa)))) + '</div><div class="mt"></div>' +
        A.card('Recusas registradas', A.table([{ l: 'Pedido', f: (x) => e(x.p.id) }, { l: 'Data', f: (x) => A.fdtn(x.t.ts) }, { l: 'Parceiro', f: (x) => e(pro(x.t.pro).empresa) }, { l: 'Cidade', f: (x) => e(cidadeOf(x.p)) }, { l: 'Motivo', f: (x) => e(x.t.motivo || '—') }], rec), { flush: true });
    }
    return A.ph('Relatórios de indicação', 'Indicadores do modelo de indicação: pedidos, encaminhamentos, respostas dos parceiros e resultado.') +
      A.tabs('rep', [{ id: 'fun', l: 'Funil e resultado' }, { id: 'parc', l: 'Desempenho dos parceiros' }, { id: 'reg', l: 'Demanda por região' }, { id: 'rec', l: 'Motivos de recusa' }]) +
      '<div class="card mb16" style="padding:12px 14px 0">' + filt + '</div>' + body;
  }

  /* ------------------------------------------------------------------
     Ações
     ------------------------------------------------------------------ */
  function encaminhar(x, pid) {
    const p = pro(pid);
    x.tentativas.forEach((t) => { if (t.resp === 'Aguardando') { t.resp = 'Substituído'; t.respTs = A.now(); } });
    x.status = 'Encaminhado'; x.pro = pid; x.encaminhadoEm = A.now(); x.prazoResp = PRAZO[x.urgencia] || 12; x.alerta = '';
    x.tentativas.push({ pro: pid, ts: A.now(), resp: 'Aguardando' });
    hist(x, 'Pedido encaminhado a ' + p.empresa + ' (prazo de resposta: ' + x.prazoResp + ' h)');
    A.done('Pedido encaminhado a ' + p.empresa + '. O profissional vê a oportunidade no perfil dele.', x.tentativas.length > 1 ? 'Profissional substituído e pedido reencaminhado' : 'Pedido encaminhado ao profissional', x.id + ' · ' + p.empresa);
  }
  function matchModal(x) {
    const ex = tentados(x);
    const rows = db().pros.filter((p) => p.status === 'Ativo' && ex.indexOf(p.id) < 0).map((p) => Object.assign({ p: p }, score(p, x))).sort((a, b) => b.s - a.s);
    const body = '<div class="note">' + I('info', 17) + '<div>Pedido <b>' + e(x.id) + '</b> — ' + e(srvName(x.srv)) + ' em <b>' + e(cidadeOf(x)) + '</b> — ' + e(x.urgencia) + '. ' + (ex.length ? 'Já tentados: ' + ex.map((i) => e(pro(i).empresa)).join(', ') + '.' : '') + '</div></div><div class="mt"></div>' +
      A.table([
        { l: 'Parceiro', f: (r) => '<div class="row" style="flex-wrap:nowrap">' + A.av(r.p.empresa, r.p.cor) + '<div><b>' + e(r.p.empresa) + '</b><small>' + A.num(r.p.nota, 1) + ' ★ — aceite ' + r.p.taxaAceite + '% — ' + cargaAberta(r.p.id) + ' em aberto</small></div></div>' },
        { l: 'Região', f: (r) => (r.reg ? A.badge('Atende', 'ok') : A.badge('Não atende', 'bad')) },
        { l: 'Especialidade', f: (r) => (r.esp ? A.badge('Sim', 'ok') : A.badge('Não', 'bad')) },
        { l: 'Disponibilidade', f: (r) => (r.p.pausa ? A.badge('Pausado') : A.badge(r.p.disp)) + (x.consultas[r.p.id] ? '<small>' + e(x.consultas[r.p.id]) + '</small>' : '') },
        { l: 'Compatibilidade', cls: 'r', f: (r) => '<b>' + r.s + '%</b>' },
        { l: '', cls: 'r', f: (r) => '<div class="acts-row" style="justify-content:flex-end">' + A.b('Consultar', 'c2.consultar', { id: x.id, pro: r.p.id }, 'sm', 'phone') + A.b('Encaminhar', 'c2.encaminhar', { id: x.id, pro: r.p.id }, 'sm ' + (r.reg && r.esp ? 'p' : ''), 'send') + '</div>' },
      ], rows, { empty: 'Nenhum parceiro ativo disponível. Cadastre novos parceiros para esta região.' }) +
      '<p class="small muted mt">Compatibilidade = região (40) + especialidade (30) + disponibilidade (20) + nota (10) − carga em aberto. Critério demonstrativo, ajustável.</p>';
    A.modal({ title: 'Selecionar profissional', sub: 'Parceiros ordenados por compatibilidade com o pedido', size: 'lg', body: body });
  }
  const actions = {
    /* Cliente */
    'c2.novaSave': (v) => {
      const d = db(), id = A.nextId('PED-', d.pedidos), c = cli(MYCLI);
      if (v.cidade !== c.cidade || v.bairro !== c.bairro || v.endereco !== c.endereco) { c.cidade = v.cidade; c.bairro = v.bairro; c.endereco = v.endereco; }
      const x = { id: id, ts: A.now(), clienteId: MYCLI, srv: v.srv, titulo: v.titulo, desc: v.desc, urgencia: v.urgencia, periodo: v.periodo, fotos: v.fotos || [], status: 'Recebido', prioridade: v.urgencia === 'Urgente (24 h)' ? 'Alta' : 'Normal', pro: null, tentativas: [], consultas: {}, cobrancas: 0, hist: [] };
      hist(x, 'Solicitação recebida pela AiCalhas');
      d.pedidos.push(x);
      A.log('Solicitação registrada' + (x.fotos.length ? ' com ' + x.fotos.length + ' foto(s)' : ''), id + ' · ' + v.titulo);
      A.go('solicitacao', id);
      A.toast('Solicitação ' + id + ' enviada. A AiCalhas vai analisar e indicar um profissional.');
    },
    'c2.cliContato': (ds) => { const x = ped(ds.id), p = pro(x.pro); A.log('Contato simulado com profissional indicado', x.id + ' · ' + p.empresa); A.modal({ title: 'Contato simulado', size: 'sm', body: A.note('Em um sistema real, o WhatsApp abriria com uma mensagem pronta para <b>' + e(p.empresa) + '</b> (' + e(p.tel) + '). Nenhuma mensagem foi enviada.') }); },
    'c2.cliConfirma': (ds) => A.confirm({ title: 'Confirmar contato', msg: 'Confirma que o profissional entrou em contato com você?', ok: 'Sim, recebi contato', onOk: () => { const x = ped(ds.id); x.clienteConfirmou = true; x.alerta = ''; if (x.status === 'Aceito') { x.status = 'Em contato'; x.contatoEm = x.contatoEm || A.now(); } hist(x, 'Cliente confirmou que recebeu contato do profissional'); A.done('Obrigado! A AiCalhas registrou que você foi atendido.', 'Cliente confirmou contato do profissional', x.id); } }),
    'c2.cliSemRetorno': (ds) => { const x = ped(ds.id); x.alerta = 'Cliente informou que ainda não recebeu contato'; hist(x, 'Cliente informou que ainda não recebeu contato. A AiCalhas vai acompanhar.'); A.done('A AiCalhas foi avisada e vai cobrar o profissional ou indicar outro.', 'Cliente informou falta de retorno', x.id, 'warn'); },
    'c2.cliOutro': (ds) => A.form({ title: 'Pedir outro profissional', submit: 'c2.cliOutroSave', extra: { id: ds.id }, one: true, submitLabel: 'Enviar pedido', icon: 'swap', fields: [{ name: 'motivo', label: 'Motivo', type: 'select', options: ['Não recebi retorno', 'Não consegui combinar horário', 'Preço acima do esperado', 'Outro'], required: true }, { name: 'obs', label: 'Comentário', type: 'textarea', value: 'Gostaria de outra opção de profissional.' }] }),
    'c2.cliOutroSave': (v, x) => { const p = ped(x.id); p.alerta = 'Cliente pediu outro profissional: ' + v.motivo; hist(p, 'Cliente pediu outro profissional (' + v.motivo + ')'); A.done('Pedido enviado. A AiCalhas vai indicar outro profissional.', 'Cliente pediu substituição do profissional', p.id + ' · ' + v.motivo, 'warn'); },
    'c2.cliCancelar': (ds) => A.confirm({ title: 'Cancelar solicitação', msg: 'Deseja cancelar esta solicitação?', ok: 'Cancelar solicitação', danger: true, onOk: () => { const x = ped(ds.id); x.status = 'Cancelado'; x.resultado = 'Cliente desistiu'; x.tentativas.forEach((t) => { if (t.resp === 'Aguardando') { t.resp = 'Cancelado'; t.respTs = A.now(); } }); hist(x, 'Solicitação cancelada pelo cliente'); A.done('Solicitação cancelada.', 'Solicitação cancelada pelo cliente', x.id); } }),
    'c2.cliAvaliar': (ds) => A.form({ title: 'Avaliar a indicação', submit: 'c2.cliAvaliarSave', extra: { id: ds.id }, one: true, submitLabel: 'Enviar avaliação', icon: 'star', fields: [{ name: 'nota', label: 'O profissional indicado atendeu bem?', type: 'radios', options: [{ v: 5, l: '★★★★★' }, { v: 4, l: '★★★★' }, { v: 3, l: '★★★' }, { v: 2, l: '★★' }, { v: 1, l: '★' }], value: 5, required: true }, { name: 'txt', label: 'Comentário', type: 'textarea', value: 'Indicação rápida e certeira.', required: true }] }),
    'c2.cliAvaliarSave': (v, x) => { const p = ped(x.id); p.avaliacao = { nota: +v.nota, txt: v.txt }; hist(p, 'Cliente avaliou a indicação: ' + v.nota + ' estrelas'); A.done('Avaliação registrada. Obrigado!', 'Indicação avaliada pelo cliente', p.id + ' · ' + v.nota + ' estrelas'); },
    'c2.cliEdit': () => { const c = cli(MYCLI); A.form({ title: 'Editar meus dados', submit: 'c2.cliEditSave', fields: [{ name: 'tel', label: 'Telefone', type: 'tel', value: c.tel, required: true }, { name: 'email', label: 'E-mail', type: 'email', value: c.email, required: true }, { name: 'endereco', label: 'Endereço', value: c.endereco, full: true }, { name: 'bairro', label: 'Bairro', value: c.bairro }, { name: 'cidade', label: 'Cidade', type: 'select', options: db().cidades, value: c.cidade }] }); },
    'c2.cliEditSave': (v) => { Object.assign(cli(MYCLI), v); A.done('Dados atualizados.', 'Cadastro de cliente atualizado', MYCLI); },

    /* Profissional */
    'c2.oppVer': (ds) => { const x = ped(ds.id); A.modal({ title: x.id + ' — ' + x.titulo, sub: 'Oportunidade encaminhada pela AiCalhas', size: 'lg', body: A.dl([['Serviço', e(srvName(x.srv))], ['Urgência', e(x.urgencia)], ['Local', e((bairroOf(x) ? bairroOf(x) + ', ' : '') + cidadeOf(x))], ['Melhor período', e(x.periodo)], ['Prazo para responder', x.prazoResp + ' h após o encaminhamento']]) + '<p class="mt">' + e(x.desc) + '</p>' + (x.fotos.length ? '<div class="gal">' + x.fotos.map((f) => A.photo(f)).join('') + '</div>' : '') + '<div class="mt"></div>' + A.note('Ao aceitar, você recebe nome, telefone e endereço do cliente e se compromete a fazer contato no período informado.'), foot: '<button class="btn" data-act="core.close">Fechar</button>' + A.b('Recusar', 'c2.recusar', { id: x.id }, 'dg', 'x') + A.b('Aceitar pedido', 'c2.aceitar', { id: x.id }, 'ok', 'check') }); },
    'c2.aceitar': (ds) => { const x = ped(ds.id); A.confirm({ title: 'Aceitar pedido ' + x.id, msg: 'Ao aceitar, os contatos de <b>' + e(nomeCli(x)) + '</b> serão liberados para você e a AiCalhas informará o cliente.', note: 'Combine a visita no período preferido do cliente (' + e(x.periodo.toLowerCase()) + ').', ok: 'Aceitar pedido', onOk: () => {
      const t = x.tentativas.filter((k) => k.pro === MYPRO).pop(); t.resp = 'Aceito'; t.respTs = A.now(); x.status = 'Aceito';
      hist(x, 'Profissional aceitou. Os contatos foram compartilhados entre as partes.');
      A.log('Oportunidade aceita', x.id + ' · ' + nomeCli(x)); A.close(); A.go('aceitos'); A.toast('Pedido aceito. Os dados do cliente estão em “Pedidos aceitos”.'); } }); },
    'c2.recusar': (ds) => A.form({ title: 'Recusar pedido', sub: 'A AiCalhas vai indicar outro profissional ao cliente.', submit: 'c2.recusarSave', extra: { id: ds.id }, one: true, submitLabel: 'Recusar pedido', btnCls: 'dgs', icon: 'x', fields: [{ name: 'motivo', label: 'Motivo da recusa', type: 'select', options: RECUSA, required: true }, { name: 'obs', label: 'Comentário (opcional)', type: 'textarea', value: 'Agenda completa até a próxima semana.' }] }),
    'c2.recusarSave': (v, x) => { const p = ped(x.id); const t = p.tentativas.filter((k) => k.pro === MYPRO).pop(); t.resp = 'Recusado'; t.motivo = v.motivo; t.respTs = A.now(); p.status = 'Recusado'; p.pro = null; hist(p, 'Profissional recusou: ' + v.motivo.toLowerCase() + '. A AiCalhas vai indicar outro profissional.'); A.done('Pedido recusado. A AiCalhas foi avisada para indicar outro profissional.', 'Oportunidade recusada: ' + v.motivo.toLowerCase(), p.id, 'warn'); },
    'c2.regContato': (ds) => A.form({ title: 'Registrar contato com o cliente', submit: 'c2.regContatoSave', extra: { id: ds.id }, submitLabel: 'Registrar contato', icon: 'phone', fields: [{ name: 'quando', label: 'Data e hora do contato', type: 'datetime-local', value: new Date(Date.now() - 3 * 6e4 - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16), required: true }, { name: 'meio', label: 'Meio', type: 'select', options: ['WhatsApp', 'Telefone', 'Visita presencial'] }, { name: 'visita', label: 'Visita combinada para', type: 'date', value: A.d(2).slice(0, 10) }, { name: 'obs', label: 'Observação', type: 'textarea', full: true, value: 'Visita combinada para medir o beiral e passar orçamento.' }] }),
    'c2.regContatoSave': (v, x) => { const p = ped(x.id); p.status = 'Em contato'; p.contatoEm = new Date(v.quando).toISOString(); hist(p, 'Profissional registrou contato com o cliente (' + v.meio + ')' + (v.visita ? '; visita combinada para ' + A.fd(v.visita + 'T12:00') : '')); A.done('Contato registrado.', 'Contato com cliente registrado', p.id + ' · ' + v.meio); },
    'c2.resultado': (ds) => A.form({ title: 'Informar resultado', sub: 'Usado apenas para indicadores da AiCalhas. Valores não são intermediados.', submit: 'c2.resultadoSave', extra: { id: ds.id }, submitLabel: 'Informar resultado', icon: 'flag', fields: [{ name: 'res', label: 'Resultado', type: 'select', options: ['Serviço contratado', 'Em negociação', 'Não contratado'], required: true }, { name: 'valor', label: 'Valor aproximado (opcional)', type: 'number', min: 0, step: 50, value: 1800 }, { name: 'obs', label: 'Observação', type: 'textarea', full: true, value: 'Cliente aprovou o orçamento; execução na próxima semana.' }] }),
    'c2.resultadoSave': (v, x) => { const p = ped(x.id); p.resultadoPro = v.res; p.valorPro = +v.valor || 0; hist(p, 'Profissional informou resultado: ' + v.res.toLowerCase(), 'interno'); A.done('Resultado informado à AiCalhas.', 'Resultado informado: ' + v.res.toLowerCase(), p.id); },
    'c2.dispEdit': () => { const p = pro(MYPRO); A.form({ title: 'Editar disponibilidade', submit: 'c2.dispSave', fields: [{ name: 'disp', label: 'Situação', type: 'select', options: ['Disponível', 'Agenda cheia'], value: p.disp }, { name: 'capacidade', label: 'Capacidade semanal (indicações)', type: 'number', min: 1, max: 30, value: p.capacidade }, { name: 'dias', label: 'Dias de atendimento', type: 'checks', options: ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'], value: p.dias, full: true }, { name: 'servicos', label: 'Especialidades', type: 'checks', options: db().servicos.map((s) => ({ v: s.id, l: s.nome })), value: p.servicos, full: true }, { name: 'regioes', label: 'Cidades atendidas', type: 'checks', options: db().cidades, value: p.regioes, full: true }] }); },
    'c2.dispSave': (v) => { if (!v.regioes.length || !v.servicos.length) { A.toast('Mantenha ao menos uma cidade e uma especialidade.', 'warn'); return; } const p = pro(MYPRO); p.disp = v.disp; p.capacidade = +v.capacidade; p.dias = v.dias; p.servicos = v.servicos; p.regioes = v.regioes; A.done('Disponibilidade atualizada.', 'Disponibilidade e área de atuação atualizadas', p.disp + ' · ' + p.regioes.join(', ')); },
    'c2.pausa': () => { const p = pro(MYPRO); p.pausa = !p.pausa; A.done(p.pausa ? 'Indicações pausadas. Você não receberá novos pedidos.' : 'Indicações retomadas.', p.pausa ? 'Recebimento de indicações pausado' : 'Recebimento de indicações retomado', p.id, p.pausa ? 'warn' : 'ok'); },

    /* Mediador */
    'c2.triar': (ds) => { const x = ped(ds.id); x.status = 'Em triagem'; hist(x, 'Triagem iniciada — a AiCalhas está analisando o pedido'); A.done('Triagem iniciada. O cliente vê o pedido “Em análise”.', 'Triagem iniciada', x.id); },
    'c2.classificar': (ds) => { const x = ped(ds.id); A.form({ title: 'Classificar pedido ' + x.id, submit: 'c2.classSave', extra: { id: x.id }, fields: [{ name: 'srv', label: 'Serviço', type: 'select', options: db().servicos.map((s) => ({ v: s.id, l: s.nome })), value: x.srv }, { name: 'prioridade', label: 'Prioridade', type: 'select', options: ['Alta', 'Normal', 'Baixa'], value: x.prioridade }, { name: 'urgencia', label: 'Urgência', type: 'select', options: URG, value: x.urgencia }, { name: 'obs', label: 'Observação interna', type: 'textarea', full: true, value: 'Pedido claro, fotos suficientes para encaminhar.' }] }); },
    'c2.classSave': (v, x) => { const p = ped(x.id); p.srv = v.srv; p.prioridade = v.prioridade; p.urgencia = v.urgencia; if (p.status === 'Recebido') p.status = 'Em triagem'; hist(p, 'Classificado: ' + srvName(v.srv) + ', prioridade ' + v.prioridade.toLowerCase() + '. ' + v.obs, 'interno'); A.done('Pedido classificado.', 'Pedido classificado na triagem', p.id + ' · ' + srvName(v.srv)); },
    'c2.pedirInfo': (ds) => A.form({ title: 'Pedir mais informações ao cliente', sub: 'A mensagem aparece no andamento da solicitação (simulação).', submit: 'c2.pedirInfoSave', extra: { id: ds.id }, one: true, submitLabel: 'Enviar mensagem', icon: 'send', fields: [{ name: 'msg', label: 'Mensagem', type: 'textarea', required: true, value: 'Olá! Pode enviar uma foto mais próxima do ponto de vazamento e informar a altura aproximada do telhado?' }] }),
    'c2.pedirInfoSave': (v, x) => { const p = ped(x.id); hist(p, 'AiCalhas solicitou mais informações: ' + v.msg); A.done('Mensagem enviada ao cliente (simulação).', 'Mais informações solicitadas ao cliente', p.id); },
    'c2.selecionar': (ds) => { const x = ped(ds.id); if (x.status === 'Recebido') { x.status = 'Em triagem'; hist(x, 'Triagem iniciada — a AiCalhas está analisando o pedido'); A.log('Triagem iniciada', x.id); A.refresh(); } matchModal(x); },
    'c2.consultar': (ds) => {
      const x = ped(ds.id), p = pro(ds.pro);
      const r = p.pausa ? 'Não respondeu à consulta (indicações pausadas).' : p.disp === 'Disponível' ? 'Confirmou disponibilidade para ' + A.when(A.d(1, '09:00')).toLowerCase() + '.' : 'Informou agenda cheia até ' + A.fd(A.d(6)) + '.';
      x.consultas[p.id] = r;
      hist(x, 'Disponibilidade consultada com ' + p.empresa + ': ' + r, 'interno');
      A.log('Disponibilidade consultada com parceiro (simulação)', x.id + ' · ' + p.empresa);
      A.toast(p.empresa + ': ' + r, p.disp === 'Disponível' && !p.pausa ? 'ok' : 'warn');
      matchModal(x);
    },
    'c2.encaminhar': (ds) => { const x = ped(ds.id), p = pro(ds.pro); const sc = score(p, x); const go = () => encaminhar(x, p.id); if (!sc.reg || !sc.esp) A.confirm({ title: 'Encaminhar mesmo assim?', msg: e(p.empresa) + (!sc.reg ? ' não atende ' + e(cidadeOf(x)) : '') + (!sc.reg && !sc.esp ? ' e' : '') + (!sc.esp ? ' não tem a especialidade ' + e(srvName(x.srv)) : '') + '.', ok: 'Encaminhar', onOk: go }); else go(); },
    'c2.cobrar': (ds) => { const x = ped(ds.id), p = pro(x.pro); x.cobrancas = (x.cobrancas || 0) + 1; hist(x, 'Cobrança de resposta enviada a ' + p.empresa + ' (simulação)', 'interno'); A.done('Cobrança enviada a ' + p.empresa + ' (simulação).', 'Cobrança de resposta enviada ao profissional', x.id + ' · ' + p.empresa); },
    'c2.substituir': (ds) => { const x = ped(ds.id); A.confirm({ title: 'Substituir profissional', msg: 'O profissional atual (' + e(x.pro ? pro(x.pro).empresa : '—') + ') deixará de ver este pedido. Em seguida, selecione outro parceiro.', ok: 'Substituir', danger: true, onOk: () => {
      x.tentativas.forEach((t) => { if (t.pro === x.pro && (t.resp === 'Aguardando' || t.resp === 'Aceito')) { t.resp = t.resp === 'Aguardando' ? 'Sem resposta' : 'Substituído'; t.respTs = t.respTs || A.now(); } });
      hist(x, 'AiCalhas substituiu o profissional ' + (x.pro ? pro(x.pro).empresa : '') + ' e vai indicar outro'); A.log('Profissional retirado do pedido para substituição', x.id);
      x.status = 'Em triagem'; x.pro = null; x.contatoEm = null; x.clienteConfirmou = false; A.refresh(); matchModal(x); } }); },
    'c2.verificar': (ds) => { const x = ped(ds.id); A.form({ title: 'Verificar retorno com o cliente', sub: 'Registro da ligação ou mensagem de confirmação com ' + nomeCli(x) + ' (simulação).', submit: 'c2.verificarSave', extra: { id: x.id }, submitLabel: 'Registrar verificação', icon: 'phone', fields: [{ name: 'contato', label: 'O cliente recebeu contato do profissional?', type: 'radios', options: ['Sim', 'Não'], value: 'Sim', required: true, full: true }, { name: 'res', label: 'Resultado', type: 'select', options: ['Serviço contratado', 'Em negociação', 'Não contratado', 'Cliente desistiu'], value: x.resultadoPro || 'Serviço contratado' }, { name: 'obs', label: 'Observação', type: 'textarea', full: true, value: 'Cliente confirmou a visita e aprovou o orçamento.' }] }); },
    'c2.verificarSave': (v, x) => {
      const p = ped(x.id); p.verificado = true;
      if (v.contato === 'Não') { p.alerta = 'Cliente informou que não recebeu contato'; hist(p, 'Verificação: cliente ainda não recebeu contato. Avaliar substituição.', 'interno'); A.done('Verificação registrada. Considere cobrar ou substituir o profissional.', 'Verificação: cliente sem retorno', p.id, 'warn'); return; }
      p.clienteConfirmou = true; p.alerta = ''; p.contatoEm = p.contatoEm || A.now();
      if (v.res === 'Em negociação') { p.status = 'Em contato'; hist(p, 'Verificação: cliente atendido, ainda em negociação', 'interno'); A.done('Verificação registrada. Pedido segue em negociação.', 'Retorno verificado com o cliente (em negociação)', p.id); return; }
      p.status = 'Concluído'; p.resultado = v.res; hist(p, 'Indicação finalizada: ' + v.res.toLowerCase());
      A.done('Indicação finalizada: ' + v.res.toLowerCase() + '.', 'Indicação finalizada após verificação com o cliente', p.id + ' · ' + v.res);
    },
    'c2.medCancelar': (ds) => A.form({ title: 'Cancelar pedido', submit: 'c2.medCancelarSave', extra: { id: ds.id }, one: true, submitLabel: 'Cancelar pedido', btnCls: 'dgs', icon: 'x', fields: [{ name: 'motivo', label: 'Motivo', type: 'select', options: ['Cliente desistiu', 'Pedido duplicado', 'Fora da área de cobertura', 'Serviço fora do escopo'], required: true }] }),
    'c2.medCancelarSave': (v, x) => { const p = ped(x.id); p.status = 'Cancelado'; p.resultado = v.motivo; p.pro = null; p.tentativas.forEach((t) => { if (t.resp === 'Aguardando') { t.resp = 'Cancelado'; t.respTs = A.now(); } }); hist(p, 'Pedido cancelado pela AiCalhas: ' + v.motivo.toLowerCase()); A.done('Pedido cancelado.', 'Pedido cancelado pela AiCalhas', p.id + ' · ' + v.motivo); },
    'c2.obs': (ds) => A.form({ title: 'Observação interna', submit: 'c2.obsSave', extra: { id: ds.id }, one: true, fields: [{ name: 'obs', label: 'Observação (não visível ao cliente)', type: 'textarea', required: true, value: 'Cliente prefere contato por WhatsApp após as 10h.' }] }),
    'c2.obsSave': (v, x) => { const p = ped(x.id); hist(p, v.obs, 'interno'); A.done('Observação registrada.', 'Observação interna registrada', p.id); },
    'c2.parcNovo': () => A.form({ title: 'Cadastrar parceiro', submit: 'c2.parcSave', fields: [{ name: 'empresa', label: 'Empresa', required: true, value: 'Silva Calhas Express' }, { name: 'nome', label: 'Responsável', required: true, value: 'Diego Silva' }, { name: 'tel', label: 'Telefone', type: 'tel', required: true, value: '(19) 99000-1717' }, { name: 'email', label: 'E-mail', type: 'email', required: true, value: 'diego@silvacalhas.demo' }, { name: 'cidade', label: 'Cidade-base', type: 'select', options: db().cidades, value: 'Paulínia' }, { name: 'doc', label: 'CNPJ / CPF', value: 'CNPJ 98.765.432/0001-10' }, { name: 'servicos', label: 'Especialidades', type: 'checks', options: db().servicos.map((s) => ({ v: s.id, l: s.nome })), value: ['SRV-01', 'SRV-02'], full: true }, { name: 'regioes', label: 'Cidades atendidas', type: 'checks', options: db().cidades, value: ['Paulínia', 'Campinas'], full: true }, { name: 'nr35', type: 'check', text: 'Certificado NR-35 (trabalho em altura) conferido', value: true }] }),
    'c2.parcSave': (v, x) => {
      if (!v.regioes.length || !v.servicos.length) { A.toast('Informe ao menos uma cidade e uma especialidade.', 'warn'); return; }
      const d = db();
      if (x.id) { const p = pro(x.id); ['tel', 'email', 'disp'].forEach((k) => { if (v[k] != null) p[k] = v[k]; }); p.servicos = v.servicos; p.regioes = v.regioes; A.done('Parceiro atualizado.', 'Cadastro de parceiro atualizado', p.id + ' · ' + p.empresa); return; }
      const id = A.nextId('PRF-', d.pros);
      d.pros.push({ id: id, nome: v.nome, empresa: v.empresa, cidade: v.cidade, regioes: v.regioes, servicos: v.servicos, nota: 0, avals: 0, tel: v.tel, email: v.email, desde: 2020, status: 'Em homologação', cor: A.colorFor(v.empresa), doc: v.doc, sobre: '', disp: 'Disponível', taxaAceite: 0, tempoResp: 0, dias: ['seg', 'ter', 'qua', 'qui', 'sex'], capacidade: 5, pausa: false });
      A.done('Parceiro cadastrado em homologação.', 'Parceiro cadastrado', id + ' · ' + v.empresa);
    },
    'c2.parcEdit': (ds) => { const p = pro(ds.id); A.form({ title: 'Editar parceiro — ' + p.empresa, submit: 'c2.parcSave', extra: { id: p.id }, fields: [{ name: 'tel', label: 'Telefone', type: 'tel', value: p.tel, required: true }, { name: 'email', label: 'E-mail', type: 'email', value: p.email, required: true }, { name: 'disp', label: 'Disponibilidade', type: 'select', options: ['Disponível', 'Agenda cheia'], value: p.disp }, { name: 'servicos', label: 'Especialidades', type: 'checks', options: db().servicos.map((s) => ({ v: s.id, l: s.nome })), value: p.servicos, full: true }, { name: 'regioes', label: 'Cidades atendidas', type: 'checks', options: db().cidades, value: p.regioes, full: true }] }); },
    'c2.parcHomolog': (ds) => { const p = pro(ds.id); A.confirm({ title: 'Homologar parceiro', msg: 'Ativar <b>' + e(p.empresa) + '</b> para receber indicações?', ok: 'Homologar', onOk: () => { p.status = 'Ativo'; p.taxaAceite = p.taxaAceite || 100; A.done('Parceiro homologado e ativo.', 'Parceiro homologado', p.id + ' · ' + p.empresa); } }); },
    'c2.parcDet': (ds) => { const p = pro(ds.id); const ps = db().pedidos.filter((x) => x.tentativas.some((t) => t.pro === p.id)); A.modal({ title: p.empresa, sub: 'Histórico de indicações', size: 'lg', body: A.table([{ l: 'Pedido', f: (x) => e(x.id) }, { l: 'Data', f: (x) => A.fdtn(x.ts) }, { l: 'Cidade', f: (x) => e(cidadeOf(x)) }, { l: 'Resposta', f: (x) => A.badge(x.tentativas.filter((t) => t.pro === p.id).pop().resp) }, { l: 'Resultado', f: (x) => e(x.resultado || x.resultadoPro || '—') }], ps.sort((a, b) => (a.ts < b.ts ? 1 : -1))) }); },
    'c2.cliNovo': () => A.form({ title: 'Cadastrar cliente', submit: 'c2.cliNovoSave', fields: [{ name: 'nome', label: 'Nome', required: true, value: 'Otávio Mendes' }, { name: 'tipo', label: 'Tipo', type: 'select', options: ['Residencial', 'Comercial', 'Condomínio'] }, { name: 'tel', label: 'Telefone', type: 'tel', required: true, value: '(19) 98111-2233' }, { name: 'email', label: 'E-mail', type: 'email', required: true, value: 'otavio.mendes@email.demo' }, { name: 'cidade', label: 'Cidade', type: 'select', options: db().cidades }, { name: 'bairro', label: 'Bairro', value: 'Centro' }, { name: 'endereco', label: 'Endereço', value: 'Rua Barão de Jaguara, 400', full: true }] }),
    'c2.cliNovoSave': (v) => { const d = db(), id = A.nextId('CLI-', d.clientes); d.clientes.push(Object.assign({ id: id, desde: A.now() }, v)); A.done('Cliente cadastrado.', 'Cliente cadastrado', id + ' · ' + v.nome); },
    'c2.cliVer': (ds) => { const c = cli(ds.id); A.modal({ title: c.nome, sub: c.tipo + ' — ' + c.cidade, size: 'lg', body: A.dl([['Telefone', e(c.tel)], ['E-mail', e(c.email)], ['Endereço', e(c.endereco + ' — ' + c.bairro)]]) + '<h4 style="margin:16px 0 6px">Pedidos</h4>' + A.table([{ l: 'Pedido', f: (x) => e(x.id) }, { l: 'Título', f: (x) => e(x.titulo) }, { l: 'Data', f: (x) => A.fd(x.ts) }, { l: 'Situação', f: (x) => statusBadge(x) }, { l: '', cls: 'r', f: (x) => A.nav('Abrir', 'pedido', x.id, 'sm') }], db().pedidos.filter((x) => x.clienteId === c.id)) }); },
    'c2.srvNovo': () => A.form({ title: 'Cadastrar serviço', submit: 'c2.srvSave', one: true, fields: [{ name: 'nome', label: 'Serviço', required: true, value: 'Instalação de tela contra folhas' }, { name: 'desc', label: 'Descrição', type: 'textarea', required: true, value: 'Instalação de tela protetora para evitar entupimento.' }] }),
    'c2.srvSave': (v) => { const d = db(), id = 'SRV-' + String(d.servicos.length + 1).padStart(2, '0'); d.servicos.push({ id: id, nome: v.nome, desc: v.desc, ativo: true }); A.done('Serviço cadastrado.', 'Serviço cadastrado no catálogo', id + ' · ' + v.nome); },
    'c2.repDet': (ds) => { const x = ped(ds.id); A.modal({ title: x.id + ' — ' + x.titulo, sub: nomeCli(x) + ' — ' + cidadeOf(x), size: 'lg', body: A.dl([['Serviço', e(srvName(x.srv))], ['Situação', statusBadge(x)], ['Resultado', e(x.resultado || '—')], ['Tentativas', x.tentativas.length]]) + '<h4 style="margin:16px 0 6px">Tentativas</h4>' + A.table([{ l: 'Profissional', f: (t) => e(pro(t.pro).empresa) }, { l: 'Data', f: (t) => A.fdtn(t.ts) }, { l: 'Resposta', f: (t) => A.badge(t.resp) + (t.motivo ? '<small>' + e(t.motivo) + '</small>' : '') }], x.tentativas) + '<h4 style="margin:16px 0 6px">Histórico</h4>' + A.timeline(x.hist.slice().reverse().map((h) => ({ ts: h.ts, txt: h.txt, by: h.by }))), foot: '<button class="btn" data-act="core.close">Fechar</button>' + A.nav('Abrir pedido', 'pedido', x.id, 'p') }); },
  };

  /* ------------------------------------------------------------------
     Configuração
     ------------------------------------------------------------------ */
  A.start({
    id: 'c2', num: 2, title: 'Indicação direcionada',
    seed: seed, seedLogs: seedLogs, actions: actions,
    about: {
      level: 2,
      resumo: 'O cliente descreve a necessidade com fotos e localização. A AiCalhas faz a triagem, escolhe um profissional adequado por região, especialidade e disponibilidade e encaminha o pedido. Cliente e profissional negociam diretamente.',
      como: ['O cliente registra a solicitação com descrição, fotos e localização.', 'A AiCalhas faz a triagem e classifica serviço, urgência e prioridade.', 'O mediador seleciona parceiros por região, especialidade e disponibilidade.', 'O profissional recebe a oportunidade e aceita ou recusa dentro do prazo.', 'Com o aceite, os contatos são liberados e a negociação segue direto entre as partes.', 'A AiCalhas verifica se o cliente recebeu retorno e substitui o profissional quando necessário.'],
      mediador: ['Entende o serviço solicitado', 'Identifica profissionais da região e da especialidade', 'Confirma quem está disponível', 'Encaminha o pedido e apresenta as partes', 'Verifica se o cliente recebeu retorno', 'Busca outro parceiro quando o primeiro não atende'],
      limite: 'a AiCalhas acompanha até confirmar que o cliente foi atendido. Orçamento, preço, prazo, pagamento e execução são tratados diretamente entre cliente e profissional.',
      exemplo: 'O cliente precisa de atendimento nesta semana. O mediador consulta os parceiros disponíveis na cidade e encaminha para quem consegue fazer a visita. Se o parceiro recusar ou não responder no prazo, o pedido vai para outro.',
      painel: 'Pedidos recebidos, triagem, encaminhamentos, respostas e prazos dos parceiros, substituições e o resultado de cada indicação.',
      perfil: {
        cliente: { t: 'Você conta o que precisa e a AiCalhas indica quem atende.', d: 'Envie a descrição e as fotos. Quando o profissional aceitar, vocês recebem os contatos e combinam o serviço diretamente.' },
        profissional: { t: 'Você recebe oportunidades selecionadas para o seu perfil.', d: 'Aceite ou recuse dentro do prazo. Ao aceitar, os dados do cliente são liberados e a negociação é com você.' },
        mediador: { t: 'Você faz a triagem e encontra o parceiro certo.', d: 'Classifique os pedidos, encaminhe por região e especialidade, cobre respostas, substitua quando necessário e confirme o atendimento.' },
      },
    },
    profiles: {
      cliente: {
        home: 'solicitacoes',
        menu: [
          { sec: 'Atendimento' },
          { id: 'solicitacoes', label: 'Minhas solicitações', icon: 'clipboard', render: vCliLista },
          { id: 'nova', label: 'Nova solicitação', icon: 'plus', render: vCliNova },
          { sec: 'Cadastro' },
          { id: 'dados', label: 'Meus dados', icon: 'user', render: vCliDados },
        ],
        hidden: { solicitacao: { title: 'Acompanhar solicitação', parent: 'solicitacoes', render: vCliDetalhe } },
      },
      profissional: {
        home: 'oportunidades',
        menu: [
          { sec: 'Indicações' },
          { id: 'oportunidades', label: 'Oportunidades', icon: 'inbox', render: vProOpp, badge: () => db().pedidos.filter((p) => p.status === 'Encaminhado' && p.pro === MYPRO).length },
          { id: 'aceitos', label: 'Pedidos aceitos', icon: 'briefcase', render: vProAceitos, badge: () => db().pedidos.filter((p) => p.pro === MYPRO && p.status === 'Aceito').length },
          { sec: 'Meu perfil' },
          { id: 'disponibilidade', label: 'Disponibilidade', icon: 'calendar', render: vProDisp },
          { id: 'desempenho', label: 'Meu desempenho', icon: 'chart', render: vProDesempenho },
        ],
      },
      mediador: {
        home: 'painel',
        menu: [
          { sec: 'Operação' },
          { id: 'painel', label: 'Central de indicações', icon: 'home', render: vMedPainel },
          { id: 'triagem', label: 'Triagem', icon: 'inbox', render: vMedTriagem, badge: () => db().pedidos.filter((p) => ['Recebido', 'Em triagem', 'Recusado'].indexOf(p.status) >= 0).length },
          { id: 'encaminhamentos', label: 'Encaminhamentos', icon: 'route', render: vMedEnc, badge: () => db().pedidos.filter(atrasado).length },
          { sec: 'Cadastros' },
          { id: 'parceiros', label: 'Parceiros', icon: 'users', render: vMedParceiros },
          { id: 'clientes', label: 'Clientes', icon: 'user', render: vMedClientes },
          { id: 'catalogo', label: 'Serviços', icon: 'layers', render: vMedCatalogo },
          { sec: 'Gestão' },
          { id: 'relatorios', label: 'Relatórios', icon: 'chart', render: vMedRel },
        ],
        hidden: { pedido: { title: 'Pedido', parent: 'triagem', render: vMedPedido } },
      },
    },
  });
})();
