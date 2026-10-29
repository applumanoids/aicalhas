/* =====================================================================
   AiCalhas — Cenário 1: Vitrine de profissionais
   O cliente encontra profissionais e negocia diretamente com eles.
   A AiCalhas organiza a vitrine: cadastros, moderação e relatos.
   ===================================================================== */
(function () {
  'use strict';
  const A = AiC, e = A.esc, I = A.icon;
  const db = () => A.db();
  const MYPRO = 'PRF-101', MYCLI = 'CLI-201';
  const pro = (id) => db().pros.find((p) => p.id === id);
  const srvName = (id) => (db().servicos.find((s) => s.id === id) || { nome: id }).nome;
  const activeSrv = (p) => (p.servDet || []).filter((s) => s.ativo).map((s) => s.srv);
  const pubPhotos = (p) => db().portfolio.filter((f) => f.pro === p.id && f.status === 'Publicado');
  const PRICE = { 'SRV-01': 450, 'SRV-02': 380, 'SRV-03': 180, 'SRV-04': 150, 'SRV-05': 220, 'SRV-06': 260, 'SRV-07': 190 };
  const PRAZO = { 'SRV-01': '1 a 2 dias', 'SRV-02': '1 dia', 'SRV-03': 'Mesmo dia', 'SRV-04': 'Mesmo dia', 'SRV-05': '1 dia', 'SRV-06': '1 dia', 'SRV-07': 'Mesmo dia' };
  const DOCS = { id: 'Documento de identificação / CNPJ', endereco: 'Comprovante de endereço', nr35: 'Certificado NR-35 (trabalho em altura)', seguro: 'Seguro de responsabilidade civil (opcional)' };
  const CANAIS = ['WhatsApp', 'Telefone', 'Mensagem na plataforma'];
  const MSGPAD = { 'SRV-01': 'Gostaria de um orçamento para instalar calhas novas.', 'SRV-02': 'Preciso trocar um trecho de calha danificado.', 'SRV-03': 'Minha calha está vazando, vocês conseguem avaliar?', 'SRV-04': 'Preciso de limpeza das calhas antes das chuvas.', 'SRV-05': 'Preciso instalar rufos no muro.', 'SRV-06': 'O condutor está entupido e transbordando.', 'SRV-07': 'Gostaria de uma revisão geral das calhas.' };

  /* ------------------------------------------------------------------
     Dados fictícios iniciais
     ------------------------------------------------------------------ */
  function seed() {
    const b = A.base(), d = A.d;
    const views = { 'PRF-101': 1284, 'PRF-102': 932, 'PRF-103': 1510, 'PRF-104': 611, 'PRF-105': 874, 'PRF-106': 458, 'PRF-107': 0, 'PRF-108': 0 };
    b.pros.forEach((p) => {
      p.servDet = p.servicos.map((s) => ({ srv: s, apartir: PRICE[s], prazo: PRAZO[s], obs: '', ativo: true }));
      p.views = views[p.id] || 0;
      p.urgencia = p.id === 'PRF-101' || p.id === 'PRF-103';
      p.publicado = p.status === 'Publicado' ? d(-400 + (p.desde - 2009) * 20) : null;
      p.docs = p.docs || { id: true, endereco: true, nr35: true, seguro: p.id !== 'PRF-104' };
    });
    b.portfolio = [
      ['FOT-01', 'PRF-101', 'calha-frontal', 'Calha galvanizada corte 33 — residência no Taquaral', 'Publicado', -60],
      ['FOT-02', 'PRF-101', 'condutor', 'Condutores PVC 88 mm — sobrado em Valinhos', 'Publicado', -45],
      ['FOT-03', 'PRF-101', 'rufo', 'Rufo com pingadeira em platibanda — Sumaré', 'Publicado', -30],
      ['FOT-04', 'PRF-101', 'calha-cobre', 'Calha de cobre em projeto especial — Cambuí', 'Em moderação', -1],
      ['FOT-05', 'PRF-102', 'aluminio', 'Calha de alumínio dobrada na obra', 'Publicado', -50],
      ['FOT-06', 'PRF-102', 'calha-frontal', 'Troca completa de calhas — Paulínia', 'Publicado', -20],
      ['FOT-07', 'PRF-103', 'limpeza', 'Limpeza preventiva antes das chuvas', 'Publicado', -40],
      ['FOT-08', 'PRF-103', 'vazamento', 'Correção de vazamento em emenda', 'Publicado', -25],
      ['FOT-09', 'PRF-103', 'condutor', 'Desentupimento de condutor', 'Publicado', -12],
      ['FOT-10', 'PRF-104', 'rufo', 'Chapéu de muro galvanizado', 'Publicado', -70],
      ['FOT-11', 'PRF-104', 'obra', 'Calha instalada em galpão', 'Em moderação', 0],
      ['FOT-12', 'PRF-105', 'calha-frontal', 'Calhas e condutores em residência', 'Publicado', -33],
      ['FOT-13', 'PRF-105', 'aluminio', 'Calha de alumínio em área gourmet', 'Publicado', -16],
      ['FOT-14', 'PRF-106', 'condutor', 'Captação de água da chuva para cisterna', 'Publicado', -28],
      ['FOT-15', 'PRF-106', 'calha-cobre', 'Calha de cobre em fachada', 'Publicado', -9],
    ].map((r) => ({ id: r[0], pro: r[1], img: r[2], legenda: r[3], status: r[4], ts: d(r[5], '10:00'), motivo: '' }));
    b.avaliacoes = [
      ['AV-01', 'PRF-101', 'Roberto Nunes', 5, 'Trocou toda a calha da frente em um dia. Pontual e deixou tudo limpo.', 'Publicada', -20, 'Obrigado, Roberto! Foi um prazer atender vocês.'],
      ['AV-02', 'PRF-101', 'Helena Martins', 4, 'Bom serviço, só atrasou um pouco para chegar no dia combinado.', 'Publicada', -34, ''],
      ['AV-03', 'PRF-101', 'Escola Pequeno Saber', 5, 'Resolveu o vazamento da quadra coberta rapidamente.', 'Publicada', -48, ''],
      ['AV-04', 'PRF-101', 'Padaria Pão Dourado', 5, 'Atendimento excelente, explicou tudo antes de começar.', 'Em moderação', -1, ''],
      ['AV-05', 'PRF-103', 'Mariana Costa', 5, 'Limpeza muito bem feita, mandou fotos do antes e depois.', 'Publicada', -70, ''],
      ['AV-06', 'PRF-104', 'Gustavo Ramos', 1, 'Péssimo! Liga para a CALHAS XYZ que é melhor: (11) 9xxxx-xxxx. Esse cara é um enrolado.', 'Em moderação', 0, ''],
      ['AV-07', 'PRF-102', 'Tiago Moreira', 4, 'Bom acabamento na calha de alumínio.', 'Publicada', -15, ''],
      ['AV-08', 'PRF-105', 'Rogério Campos', 5, 'Muito organizado, recomendo.', 'Publicada', -10, ''],
      ['AV-09', 'PRF-106', 'Patrícia Lemos', 4, 'Projeto de captação bem explicado.', 'Publicada', -13, ''],
    ].map((r) => ({ id: r[0], pro: r[1], cliente: r[2], nota: r[3], texto: r[4], status: r[5], ts: d(r[6], '18:00'), resposta: r[7], motivo: '' }));
    const CT = [
      [-3, '10:42', 'Mariana Costa', 'Campinas', 'PRF-101', 'SRV-03', 'WhatsApp', 'Respondido', 'Olá! A calha da frente da minha casa está vazando na emenda perto da garagem. Vocês atendem no Taquaral?'],
      [-1, '14:15', 'Clínica Vida Plena', 'Campinas', 'PRF-101', 'SRV-07', 'Mensagem na plataforma', 'Aguardando retorno', 'Precisamos de uma revisão das calhas antes do período de chuvas.'],
      [0, '08:30', 'Sérgio Almeida', 'Sumaré', 'PRF-101', 'SRV-02', 'WhatsApp', 'Aguardando retorno', 'Preciso trocar cerca de 12 m de calha de um sobrado.'],
      [-2, '19:02', 'Luciana Prado', 'Valinhos', 'PRF-103', 'SRV-04', 'WhatsApp', 'Respondido', ''],
      [-4, '11:20', 'Tiago Moreira', 'Campinas', 'PRF-102', 'SRV-01', 'Telefone', 'Respondido', ''],
      [-5, '09:10', 'Gustavo Ramos', 'Indaiatuba', 'PRF-106', 'SRV-06', 'WhatsApp', 'Respondido', ''],
      [-6, '16:45', 'Padaria Pão Dourado', 'Hortolândia', 'PRF-104', 'SRV-03', 'Telefone', 'Sem resposta', 'Vazamento na calha sobre a área do forno.'],
      [-7, '13:00', 'Helena Martins', 'Jundiaí', 'PRF-105', 'SRV-04', 'Mensagem na plataforma', 'Sem resposta', ''],
      [-8, '10:05', 'Beatriz Fontes', 'Vinhedo', 'PRF-103', 'SRV-07', 'WhatsApp', 'Respondido', ''],
      [-9, '15:30', 'Ricardo Sato', 'Campinas', 'PRF-101', 'SRV-01', 'WhatsApp', 'Respondido', ''],
      [-11, '08:50', 'Daniela Vieira', 'Paulínia', 'PRF-102', 'SRV-02', 'Telefone', 'Respondido', ''],
      [-12, '17:20', 'Cond. Jardim das Palmeiras', 'Sumaré', 'PRF-104', 'SRV-07', 'WhatsApp', 'Respondido', ''],
      [-14, '09:40', 'Escola Pequeno Saber', 'Campinas', 'PRF-101', 'SRV-05', 'Telefone', 'Respondido', ''],
      [-15, '14:00', 'Rogério Campos', 'Jundiaí', 'PRF-105', 'SRV-02', 'WhatsApp', 'Respondido', ''],
      [-17, '11:11', 'Patrícia Lemos', 'Indaiatuba', 'PRF-106', 'SRV-01', 'Mensagem na plataforma', 'Respondido', ''],
      [-19, '10:30', 'André Luiz', 'Americana', 'PRF-104', 'SRV-05', 'WhatsApp', 'Respondido', ''],
      [-21, '16:00', 'Fábio Nogueira', 'Campinas', 'PRF-103', 'SRV-03', 'WhatsApp', 'Respondido', ''],
      [-23, '09:00', 'Marta Ribeiro', 'Valinhos', 'PRF-101', 'SRV-06', 'Telefone', 'Respondido', ''],
      [-26, '18:10', 'Roberto Nunes', 'Valinhos', 'PRF-101', 'SRV-02', 'WhatsApp', 'Respondido', ''],
      [-29, '12:00', 'Vinícius Rocha', 'Sumaré', 'PRF-102', 'SRV-06', 'WhatsApp', 'Respondido', ''],
      [-36, '10:20', 'Vanessa Dias', 'Hortolândia', 'PRF-101', 'SRV-03', 'WhatsApp', 'Respondido', ''],
      [-43, '15:45', 'Caio Mendonça', 'Campinas', 'PRF-106', 'SRV-07', 'Telefone', 'Respondido', ''],
      [-52, '09:30', 'Sílvia Torres', 'Vinhedo', 'PRF-105', 'SRV-01', 'WhatsApp', 'Respondido', ''],
      [-75, '11:00', 'Mariana Costa', 'Campinas', 'PRF-103', 'SRV-04', 'WhatsApp', 'Respondido', 'Preciso de limpeza das calhas antes das chuvas.'],
    ];
    b.contatos = CT.map((r, i) => ({ id: 'CTT-' + (501 + i), ts: d(r[0], r[1]), cliente: r[2], cidade: r[3], pro: r[4], srv: r[5], canal: r[6], retorno: r[7], msg: r[8] || MSGPAD[r[5]], clienteId: r[2] === 'Mariana Costa' ? MYCLI : '' }));
    b.relatos = [
      { id: 'REL-01', ts: d(0, '08:40'), cliente: 'Padaria Pão Dourado', cidade: 'Hortolândia', pro: 'PRF-104', tipo: 'Profissional não atende mais a minha cidade', desc: 'Liguei e o João informou que não atende mais Hortolândia, mas o perfil continua mostrando a cidade.', status: 'Aberto', parecer: '', medida: '' },
      { id: 'REL-02', ts: d(-2, '17:05'), cliente: 'Helena Martins', cidade: 'Jundiaí', pro: 'PRF-105', tipo: 'Sem retorno após o contato', desc: 'Enviei mensagem pela plataforma há cinco dias e não tive resposta.', status: 'Em apuração', parecer: '', medida: '' },
      { id: 'REL-03', ts: d(-12, '10:30'), cliente: 'Roberto Nunes', cidade: 'Valinhos', pro: 'PRF-102', tipo: 'Informações desatualizadas no perfil', desc: 'O telefone que aparece no perfil não existe mais.', status: 'Concluído', parecer: 'Telefone atualizado após contato com o profissional.', medida: 'Perfil atualizado' },
    ];
    b.clientes.forEach((c) => { c.prefContato = 'WhatsApp'; c.lgpd = true; });
    return b;
  }
  function seedLogs() {
    return A.L([
      [-12, '10:31', 'Roberto Nunes', 'cliente', 'Relato registrado sobre perfil', 'REL-03 · RL Calhas Sob Medida'],
      [-12, '14:02', 'Juliana Rocha', 'mediador', 'Relato concluído — perfil atualizado', 'REL-03'],
      [-9, '09:15', 'Juliana Rocha', 'mediador', 'Foto aprovada no portfólio', 'FOT-15 · Águas Pluviais Soluções'],
      [-6, '16:46', 'Sistema', 'sistema', 'Contato gerado pela vitrine (telefone)', 'CTT-507 · Pereira Funilaria'],
      [-3, '10:42', 'Mariana Costa', 'cliente', 'Contato simulado com profissional (WhatsApp)', 'CTT-501 · Mendes Calhas & Coberturas'],
      [-3, '11:05', 'Carlos Mendes', 'profissional', 'Contato marcado como respondido', 'CTT-501 · Mariana Costa'],
      [-2, '17:05', 'Helena Martins', 'cliente', 'Relato registrado sobre profissional', 'REL-02 · Teixeira Coberturas'],
      [-2, '17:40', 'Juliana Rocha', 'mediador', 'Apuração de relato iniciada', 'REL-02'],
      [-1, '16:20', 'Lucas Barbosa', 'profissional', 'Cadastro de profissional enviado para análise', 'PRF-107 · Barbosa Calhas'],
      [-1, '18:00', 'Padaria Pão Dourado', 'cliente', 'Avaliação enviada para moderação', 'AV-04 · Mendes Calhas & Coberturas'],
      [-1, '19:12', 'Carlos Mendes', 'profissional', 'Foto enviada ao portfólio', 'FOT-04 · Calha de cobre'],
      [0, '08:05', 'Paulo Henrique Dias', 'profissional', 'Cadastro de profissional enviado para análise', 'PRF-108 · PH Calhas e Rufos'],
      [0, '08:30', 'Sistema', 'sistema', 'Contato gerado pela vitrine (WhatsApp)', 'CTT-503 · Mendes Calhas & Coberturas'],
      [0, '08:40', 'Padaria Pão Dourado', 'cliente', 'Relato registrado: profissional não atende mais a cidade', 'REL-01 · Pereira Funilaria'],
      [0, '09:02', 'Gustavo Ramos', 'cliente', 'Avaliação enviada para moderação', 'AV-06 · Pereira Funilaria'],
      [0, '09:10', 'João Pereira', 'profissional', 'Foto enviada ao portfólio', 'FOT-11 · Calha em galpão'],
    ]);
  }

  /* ------------------------------------------------------------------
     Componentes do cenário
     ------------------------------------------------------------------ */
  function proCard(p, preview) {
    const ph = pubPhotos(p).slice(0, 3);
    return '<section class="card pcard"><div class="pcard-top">' + A.av(p.empresa, p.cor) + '<div class="tt"><h3>' + e(p.empresa) + '</h3><small>' + e(p.nome) + ' — ' + e(p.cidade) + ' — desde ' + p.desde + '</small>' + A.rating(p.nota, p.avals) + '</div><span class="ver" title="Cadastro e documentos verificados pela AiCalhas">' + I('shield', 14) + ' Verificado</span></div>' +
      '<div class="body">' + (ph.length ? '<div class="thumbs">' + ph.map((f) => A.photo(f.img)).join('') + '</div>' : '') +
      A.chips(activeSrv(p).slice(0, 3).map(srvName).concat(activeSrv(p).length > 3 ? ['+' + (activeSrv(p).length - 3)] : [])) +
      '<div class="small muted">' + I('pin', 14) + ' Atende: ' + e(p.regioes.join(', ')) + '</div>' +
      (p.urgencia ? '<div class="small" style="color:var(--ok)">' + I('clock', 14) + ' Atende urgências</div>' : '') + '</div>' +
      (preview ? '' : '<div class="acts">' + A.nav('Ver perfil', 'perfil', p.id, 'sm p', 'user') + A.b('Ver portfólio', 'c1.portfolio', { id: p.id }, 'sm', 'image') + A.b('Entrar em contato', 'c1.contato', { id: p.id }, 'sm', 'chat') + '</div>') +
      '</section>';
  }
  function completude(p) {
    const itens = [
      ['Descrição do perfil', !!(p.sobre && p.sobre.length > 40)],
      ['Ao menos 3 serviços ativos', activeSrv(p).length >= 3],
      ['Ao menos 2 cidades atendidas', p.regioes.length >= 2],
      ['Ao menos 4 fotos publicadas', pubPhotos(p).length >= 4],
      ['Telefone e e-mail informados', !!(p.tel && p.email)],
    ];
    return { itens: itens, pct: Math.round((itens.filter((x) => x[1]).length / itens.length) * 100) };
  }
  const reviewsOf = (p, all) => db().avaliacoes.filter((a) => a.pro === p.id && (all || a.status === 'Publicada')).sort((a, b) => (a.ts < b.ts ? 1 : -1));
  function reviewList(list, withReply) {
    if (!list.length) return A.empty('Nenhuma avaliação publicada ainda.', 'star');
    return list.map((a) => '<div class="li" style="align-items:flex-start">' + A.av(a.cliente) + '<div class="lt"><b>' + e(a.cliente) + ' ' + A.stars(a.nota) + '</b><small>' + A.fd(a.ts) + (a.status !== 'Publicada' ? ' — ' + A.badge(a.status) : '') + '</small><div style="margin-top:4px">' + e(a.texto) + '</div>' +
      (a.resposta ? '<div class="note neutral" style="margin-top:8px"><div><b>Resposta do profissional:</b> ' + e(a.resposta) + '</div></div>' : '') + '</div>' +
      (withReply && a.status === 'Publicada' && !a.resposta ? A.b('Responder', 'c1.avResp', { id: a.id }, 'sm', 'chat') : '') + '</div>').join('');
  }
  const perOpts = AiC.PERIODS;

  /* ------------------------------------------------------------------
     Telas — Cliente
     ------------------------------------------------------------------ */
  function vBuscar() {
    const cid = A.fv('busca', 'cid'), sv = A.fv('busca', 'srv'), ord = A.fv('busca', 'ord', 'nota');
    let list = db().pros.filter((p) => p.status === 'Publicado');
    if (cid) list = list.filter((p) => p.regioes.indexOf(cid) >= 0);
    if (sv) list = list.filter((p) => activeSrv(p).indexOf(sv) >= 0);
    list.sort((a, b) => (ord === 'nome' ? a.empresa.localeCompare(b.empresa) : ord === 'avals' ? b.avals - a.avals : b.nota - a.nota));
    return A.ph('Encontre um profissional de calhas', 'Pesquise por cidade e serviço, compare perfis, portfólios e avaliações e fale diretamente com o profissional.', A.b('Comprar materiais', 'c1.loja', {}, '', 'cart')) +
      A.card(null, A.filters('busca', [
        { k: 'cid', l: 'Cidade', o: A.opts(db().cidades, 'Todas as cidades') },
        { k: 'srv', l: 'Serviço', o: A.opts(db().servicos.filter((s) => s.ativo).map((s) => ({ v: s.id, l: s.nome })), 'Todos os serviços') },
        { k: 'ord', l: 'Ordenar por', def: 'nota', o: [{ v: 'nota', l: 'Melhor avaliação' }, { v: 'avals', l: 'Mais avaliações' }, { v: 'nome', l: 'Nome' }] },
      ]) + '<div class="row small muted">' + I('shield', 15) + ' ' + list.length + ' profissional(is) com cadastro verificado pela AiCalhas' + (cid ? ' em ' + e(cid) : '') + '.</div>') +
      (list.length ? '<div class="pcards mt">' + list.map((p) => proCard(p)).join('') + '</div>' : '<div class="card mt">' + A.empty('Nenhum profissional publicado atende a esse filtro. Tente outra cidade ou serviço.', 'search') + '</div>');
  }
  function vPerfil() {
    const p = pro(A.sel('perfil')) || db().pros.find((x) => x.status === 'Publicado');
    if (!p || p.status !== 'Publicado') return A.ph('Perfil indisponível', 'Este perfil não está publicado na vitrine no momento.', '', ['buscar', 'Voltar à busca']);
    const rv = reviewsOf(p), tab = A.tab('perfil', 'port');
    const ph = pubPhotos(p);
    return '<button class="back" data-act="core.nav" data-view="buscar">' + I('arrowL', 15) + ' Voltar à busca</button>' +
      '<section class="card mb16"><div class="cover"></div><div class="prof-h">' + A.av(p.empresa, p.cor, 'lg') + '<div class="tt"><h2>' + e(p.empresa) + '</h2><div class="row"><span class="muted">' + e(p.nome) + ' — ' + e(p.cidade) + '/SP — atua desde ' + p.desde + '</span><span class="ver">' + I('shield', 14) + ' Cadastro verificado</span></div>' + A.rating(p.nota, p.avals + ' avaliações') + '</div>' +
      '<div class="acts-row">' + A.b('Entrar em contato', 'c1.contato', { id: p.id }, 'p', 'chat') + A.b('Avaliar', 'c1.avaliar', { id: p.id }, '', 'star') + A.b('Relatar problema', 'c1.relatar', { id: p.id }, 'gh', 'flag') + '</div></div></section>' +
      '<div class="g21"><div class="stack">' +
      A.card(null, A.tabs('perfil', [{ id: 'port', l: 'Portfólio', n: ph.length }, { id: 'aval', l: 'Avaliações', n: rv.length }]) +
        (tab === 'port' ? (ph.length ? '<div class="gal">' + ph.map((f) => '<div class="gal-i">' + A.zoomable(f.img, f.legenda) + '</div>').join('') + '</div>' : A.empty('Sem fotos publicadas.', 'image')) : reviewList(rv))) +
      '</div><div class="stack">' +
      A.card('Serviços oferecidos', (p.servDet || []).filter((s) => s.ativo).map((s) => '<div class="li"><div class="lt"><b>' + e(srvName(s.srv)) + '</b><small>Prazo médio: ' + e(s.prazo) + '</small></div><span class="small muted">a partir de</span><b class="num">' + A.money(s.apartir) + '</b></div>').join(''), { icon: 'tool' }) +
      A.card('Regiões atendidas', A.chips(p.regioes, 'acc'), { icon: 'pin' }) +
      A.card('Sobre', '<p>' + e(p.sobre) + '</p>' + A.note('Preço, prazo, execução e pagamento são combinados diretamente com o profissional. A AiCalhas verifica o cadastro e modera avaliações.'), { icon: 'info' }) +
      '</div></div>';
  }
  function vCliContatos() {
    const list = db().contatos.filter((c) => c.clienteId === MYCLI).sort((a, b) => (a.ts < b.ts ? 1 : -1));
    return A.ph('Meus contatos', 'Profissionais com quem você entrou em contato pela vitrine.') +
      A.note('Neste modelo, a conversa e a negociação acontecem diretamente entre você e o profissional. A AiCalhas registra apenas que o contato foi gerado.') + '<div class="mt"></div>' +
      A.card(null, A.table([
        { l: 'Data', f: (c) => A.fdtn(c.ts) },
        { l: 'Profissional', f: (c) => '<b>' + e(pro(c.pro).empresa) + '</b><small>' + e(pro(c.pro).nome) + '</small>' },
        { l: 'Serviço', f: (c) => e(srvName(c.srv)) },
        { l: 'Canal', f: (c) => e(c.canal) },
        { l: 'Retorno informado', f: (c) => A.badge(c.retorno) },
        { l: '', cls: 'r', f: (c) => '<div class="acts-row" style="justify-content:flex-end">' + A.nav('Perfil', 'perfil', c.pro, 'sm', 'user') + A.b('Avaliar', 'c1.avaliar', { id: c.pro }, 'sm', 'star') + A.b('Relatar', 'c1.relatar', { id: c.pro }, 'sm gh', 'flag') + '</div>' },
      ], list, { empty: 'Você ainda não entrou em contato com nenhum profissional.' }), { flush: true });
  }
  function vCliMinhas() {
    const me = A.me().nome;
    const av = db().avaliacoes.filter((a) => a.cliente === me).sort((a, b) => (a.ts < b.ts ? 1 : -1));
    const rl = db().relatos.filter((r) => r.cliente === me).sort((a, b) => (a.ts < b.ts ? 1 : -1));
    const tab = A.tab('minhas', 'av');
    return A.ph('Avaliações e relatos', 'Acompanhe as avaliações enviadas e os relatos feitos à AiCalhas.') +
      A.card(null, A.tabs('minhas', [{ id: 'av', l: 'Minhas avaliações', n: av.length }, { id: 'rl', l: 'Meus relatos', n: rl.length }]) +
        (tab === 'av' ? A.table([
          { l: 'Data', f: (a) => A.fd(a.ts) }, { l: 'Profissional', f: (a) => e(pro(a.pro).empresa) }, { l: 'Nota', f: (a) => A.stars(a.nota) }, { l: 'Comentário', f: (a) => e(a.texto) }, { l: 'Situação', f: (a) => A.badge(a.status) + (a.motivo ? '<small>' + e(a.motivo) + '</small>' : '') },
        ], av, { empty: 'Você ainda não avaliou nenhum profissional.' }) : A.table([
          { l: 'Data', f: (r) => A.fd(r.ts) }, { l: 'Profissional', f: (r) => e(pro(r.pro).empresa) }, { l: 'Tipo', f: (r) => e(r.tipo) }, { l: 'Situação', f: (r) => A.badge(r.status) }, { l: 'Retorno da AiCalhas', f: (r) => e(r.parecer || 'Em andamento') },
        ], rl, { empty: 'Nenhum relato registrado.' })));
  }
  function vCliDados() {
    const c = db().clientes.find((x) => x.id === MYCLI);
    return A.ph('Meus dados', 'Cadastro de cliente usado para registrar contatos, avaliações e relatos.', A.b('Editar dados', 'c1.cliEdit', {}, 'p', 'edit')) +
      '<div class="g2">' + A.card('Cadastro', A.dl([['Nome', e(c.nome)], ['Tipo de imóvel', e(c.tipo)], ['Telefone', e(c.tel)], ['E-mail', e(c.email)], ['Cidade', e(c.cidade)], ['Bairro', e(c.bairro)], ['Contato preferido', e(c.prefContato)], ['Cliente desde', A.fd(c.desde)]]), { icon: 'user' }) +
      A.card('Privacidade', A.dl([['Compartilhamento de contato', c.lgpd ? A.badge('Autorizado', 'ok') : A.badge('Não autorizado', 'bad')], ['Finalidade', 'Enviar seus dados apenas ao profissional que você escolher contatar.']], 'one') + '<div class="mt"></div>' + A.note('Em um sistema real, este bloco registra o consentimento (LGPD) com data e versão do termo aceito.'), { icon: 'shield' }) + '</div>';
  }

  /* ------------------------------------------------------------------
     Telas — Profissional
     ------------------------------------------------------------------ */
  function vProPainel() {
    const p = pro(MYPRO);
    const ct = db().contatos.filter((c) => c.pro === p.id);
    const ct30 = ct.filter((c) => A.inPeriod(c.ts, '30'));
    const cp = completude(p);
    const pend = [];
    db().portfolio.filter((f) => f.pro === p.id && f.status === 'Em moderação').forEach((f) => pend.push(['Foto em moderação pela AiCalhas', f.legenda, 'portfolio']));
    reviewsOf(p).filter((a) => !a.resposta).forEach((a) => pend.push(['Avaliação sem resposta', a.cliente + ' — ' + a.nota + ' estrelas', 'avaliacoes']));
    ct.filter((c) => c.retorno === 'Aguardando retorno').forEach((c) => pend.push(['Contato aguardando seu retorno', c.cliente + ' — ' + srvName(c.srv), 'contatos']));
    return A.ph('Olá, ' + A.first(p.nome) + '!', 'Acompanhe como seu perfil está aparecendo na vitrine e os contatos gerados pelos clientes.', A.nav('Editar perfil', 'perfil', null, 'p', 'edit')) +
      '<div class="g4 mb16">' +
      A.kpi({ l: 'Visualizações do perfil', v: A.num(p.views), s: 'Últimos 30 dias', icon: 'eye' }) +
      A.kpi({ l: 'Contatos recebidos', v: ct30.length, s: 'Últimos 30 dias', icon: 'chat' }) +
      A.kpi({ l: 'Nota média', v: A.num(p.nota, 1), s: p.avals + ' avaliações', icon: 'star' }) +
      A.kpi({ l: 'Situação do perfil', v: A.badge(p.status), s: 'Publicado na vitrine', icon: 'shield', tone: p.status === 'Publicado' ? 'ok' : 'warn' }) +
      '</div><div class="g21"><div class="stack">' +
      A.card('Contatos recentes', ct.sort((a, b) => (a.ts < b.ts ? 1 : -1)).slice(0, 5).map((c) => '<div class="li clk" data-act="c1.ctVer" data-id="' + c.id + '">' + A.av(c.cliente) + '<div class="lt"><b>' + e(c.cliente) + '</b><small>' + e(srvName(c.srv)) + ' — ' + e(c.cidade) + ' — ' + e(c.canal) + '</small></div>' + A.badge(c.retorno) + '<span class="small muted nowrap">' + A.ago(c.ts) + '</span></div>').join('') || A.empty('Nenhum contato ainda.'), { icon: 'chat', right: A.nav('Ver todos', 'contatos', null, 'sm gh') }) +
      A.card('Pendências do perfil', pend.length ? pend.map((x) => '<div class="li clk" data-act="core.nav" data-view="' + x[2] + '">' + I('alert', 18) + '<div class="lt"><b>' + e(x[0]) + '</b><small>' + e(x[1]) + '</small></div>' + I('arrowR', 16) + '</div>').join('') : A.empty('Tudo em dia.', 'check'), { icon: 'bell' }) +
      '</div><div class="stack">' +
      A.card('Perfil completo: ' + cp.pct + '%', '<div class="bar" style="grid-template-columns:1fr auto"><span class="tr"><span class="fl" style="width:' + cp.pct + '%"></span></span><b>' + cp.pct + '%</b></div><ul class="ul chk mt">' + cp.itens.map((x) => '<li style="color:' + (x[1] ? 'inherit' : 'var(--muted)') + '">' + I(x[1] ? 'check' : 'x', 15) + '<span>' + e(x[0]) + '</span></li>').join('') + '</ul>', { icon: 'clipboard' }) +
      '<div><div class="small muted" style="margin-bottom:6px">Como os clientes veem você</div>' + proCard(p, true) + '</div>' +
      '</div></div>';
  }
  function vProPerfil() {
    const p = pro(MYPRO);
    return A.ph('Meu perfil', 'Dados exibidos na vitrine. Alterações ficam registradas no histórico e podem ser revisadas pela AiCalhas.', A.b('Editar perfil', 'c1.proEdit', {}, 'p', 'edit')) +
      '<div class="g21">' + A.card('Dados do perfil', A.dl([['Nome fantasia', e(p.empresa)], ['Responsável', e(p.nome)], ['Documento', e(p.doc)], ['Cidade-base', e(p.cidade)], ['Telefone / WhatsApp', e(p.tel)], ['E-mail', e(p.email)], ['Atua desde', p.desde], ['Atende urgências', p.urgencia ? 'Sim' : 'Não']]) + '<h4 style="margin:16px 0 6px">Descrição</h4><p>' + e(p.sobre) + '</p>' +
        '<h4 style="margin:16px 0 6px">Documentos verificados</h4><ul class="ul chk">' + Object.keys(DOCS).map((k) => '<li style="color:' + (p.docs[k] ? 'inherit' : 'var(--muted)') + '">' + I(p.docs[k] ? 'check' : 'x', 15) + '<span>' + e(DOCS[k]) + '</span></li>').join('') + '</ul>', { icon: 'user' }) +
      '<div><div class="small muted" style="margin-bottom:6px">Prévia na vitrine</div>' + proCard(p, true) + '</div></div>';
  }
  function vProServicos() {
    const p = pro(MYPRO);
    return A.ph('Serviços oferecidos', 'Defina o que você faz, o valor de referência e o prazo médio. Apenas serviços ativos aparecem na vitrine.', A.b('Adicionar serviço', 'c1.srvAdd', {}, 'p', 'plus')) +
      A.card(null, A.table([
        { l: 'Serviço', f: (s) => '<b>' + e(srvName(s.srv)) + '</b>' + (s.obs ? '<small>' + e(s.obs) + '</small>' : '') },
        { l: 'A partir de', cls: 'r', f: (s) => A.money(s.apartir) },
        { l: 'Prazo médio', f: (s) => e(s.prazo) },
        { l: 'Situação', f: (s) => A.badge(s.ativo ? 'Ativo' : 'Inativo', s.ativo ? 'ok' : 'neutral') },
        { l: '', cls: 'r', f: (s) => '<div class="acts-row" style="justify-content:flex-end">' + A.b('Editar', 'c1.srvEdit', { srv: s.srv }, 'sm', 'edit') + A.b(s.ativo ? 'Desativar' : 'Ativar', 'c1.srvToggle', { srv: s.srv }, 'sm') + A.b('', 'c1.srvDel', { srv: s.srv }, 'sm gh', 'trash', ' title="Remover serviço" aria-label="Remover serviço"') + '</div>' },
      ], p.servDet.map((s) => Object.assign({ id: s.srv }, s)), { empty: 'Nenhum serviço cadastrado.' }), { flush: true });
  }
  function vProRegioes() {
    const p = pro(MYPRO);
    return A.ph('Regiões atendidas', 'Os clientes encontram você pelas cidades marcadas aqui. Mantenha a lista atualizada para evitar contatos sem resultado.', A.b('Editar regiões', 'c1.regEdit', {}, 'p', 'edit')) +
      '<div class="g2">' + A.card('Cidades atendidas (' + p.regioes.length + ')', '<div class="chips">' + p.regioes.map((c) => '<span class="chip acc">' + e(c) + '<button type="button" data-act="c1.regDel" data-c="' + e(c) + '" title="Remover ' + e(c) + '" aria-label="Remover ' + e(c) + '">' + I('x', 13) + '</button></span>').join('') + '</div><div class="mt"></div>' +
        A.dl([['Atende urgências', p.urgencia ? 'Sim, em até 24 h' : 'Não'], ['Cidade-base', e(p.cidade)]]) + '<div class="mt"></div>' + A.note('Se você deixar de atender uma cidade, remova-a aqui. A AiCalhas também pode ajustar a lista quando receber relatos de clientes.'), { icon: 'pin' }) +
      A.card('Mapa de atendimento', A.regionMap(p.regioes), { icon: 'map' }) + '</div>';
  }
  function vProPortfolio() {
    const list = db().portfolio.filter((f) => f.pro === MYPRO).sort((a, b) => (a.ts < b.ts ? 1 : -1));
    return A.ph('Portfólio', 'Mostre trabalhos reais. Cada foto passa pela moderação da AiCalhas antes de aparecer na vitrine.', A.b('Adicionar fotos', 'c1.fotoAdd', {}, 'p', 'camera')) +
      A.note('<b>Regras do portfólio:</b> somente fotos de trabalhos próprios; sem marca d\'água ou telefone de outras empresas; sem dados pessoais ou rosto de clientes; imagem nítida e relacionada a calhas e coberturas.') + '<div class="mt"></div>' +
      A.card(null, list.length ? '<div class="gal">' + list.map((f) => '<div class="gal-i">' + A.zoomable(f.img, f.legenda, A.badge(f.status)) + (f.motivo ? '<small class="muted">Motivo: ' + e(f.motivo) + '</small>' : '') + '<div class="acts-row">' + A.b('Remover', 'c1.fotoDel', { id: f.id }, 'sm gh', 'trash') + '</div></div>').join('') + '</div>' : A.empty('Nenhuma foto cadastrada.', 'image'));
  }
  function vProContatos() {
    const list = db().contatos.filter((c) => c.pro === MYPRO).sort((a, b) => (a.ts < b.ts ? 1 : -1));
    return A.ph('Contatos recebidos', 'Clientes que entraram em contato a partir do seu perfil. A negociação acontece diretamente com você.') +
      A.card(null, A.table([
        { l: 'Data', f: (c) => A.fdtn(c.ts) },
        { l: 'Cliente', f: (c) => '<b>' + e(c.cliente) + '</b><small>' + e(c.cidade) + '</small>' },
        { l: 'Serviço', f: (c) => e(srvName(c.srv)) },
        { l: 'Canal', f: (c) => e(c.canal) },
        { l: 'Retorno', f: (c) => A.badge(c.retorno) },
        { l: '', cls: 'r', f: (c) => '<div class="acts-row" style="justify-content:flex-end">' + A.b('Ver mensagem', 'c1.ctVer', { id: c.id }, 'sm', 'eye') + (c.retorno !== 'Respondido' ? A.b('Marcar como respondido', 'c1.ctResp', { id: c.id }, 'sm ok', 'check') : '') + '</div>' },
      ], list), { flush: true });
  }
  function vProAvaliacoes() {
    const p = pro(MYPRO);
    const all = reviewsOf(p, true);
    return A.ph('Avaliações recebidas', 'Avaliações publicadas passam pela moderação da AiCalhas. Você pode responder publicamente.') +
      '<div class="g4 mb16">' + A.kpi({ l: 'Nota média', v: A.num(p.nota, 1), icon: 'star' }) + A.kpi({ l: 'Avaliações publicadas', v: reviewsOf(p).length, icon: 'check' }) + A.kpi({ l: 'Em moderação', v: all.filter((a) => a.status === 'Em moderação').length, icon: 'clock', tone: 'warn' }) + A.kpi({ l: 'Sem resposta', v: reviewsOf(p).filter((a) => !a.resposta).length, icon: 'chat' }) + '</div>' +
      A.card(null, reviewList(all, true));
  }
  function vProCadastro() {
    return A.ph('Novo cadastro de profissional', 'Simulação do formulário que um instalador preenche para entrar na vitrine. O cadastro enviado aparece para o mediador aprovar.') +
      '<div class="g21"><div>' + A.card('Como funciona a entrada na vitrine', '<ol class="ol"><li>O profissional preenche dados, serviços, regiões e documentos.</li><li>A AiCalhas confere documentos (incluindo NR-35 para trabalho em altura).</li><li>O mediador aprova, pede ajuste ou recusa o cadastro.</li><li>Aprovado, o perfil aparece na busca dos clientes.</li></ol><div class="mt"></div>' + A.b('Preencher cadastro de demonstração', 'c1.cadastro', {}, 'p', 'clipboard'), { icon: 'clipboard' }) + '</div>' +
      '<div>' + A.card('Cadastros enviados por esta demonstração', (db().pros.filter((p) => p.criadoDemo).map((p) => '<div class="li">' + A.av(p.empresa, p.cor) + '<div class="lt"><b>' + e(p.empresa) + '</b><small>' + e(p.cidade) + ' — enviado ' + A.ago(p.enviado) + '</small></div>' + A.badge(p.status) + '</div>').join('') || A.empty('Nenhum cadastro enviado ainda.', 'inbox')), { icon: 'inbox' }) + '</div></div>';
  }

  /* ------------------------------------------------------------------
     Telas — Mediador
     ------------------------------------------------------------------ */
  function filaMed() {
    const f = [];
    db().pros.filter((p) => p.status === 'Em análise').forEach((p) => f.push({ ic: 'clipboard', t: 'Cadastro aguardando análise', s: p.empresa + ' — ' + p.cidade, v: 'cadastros', when: p.enviado }));
    db().portfolio.filter((x) => x.status === 'Em moderação').forEach((x) => f.push({ ic: 'image', t: 'Foto para moderar', s: pro(x.pro).empresa + ' — ' + x.legenda, v: 'moderacao', tab: 'foto', when: x.ts }));
    db().avaliacoes.filter((x) => x.status === 'Em moderação').forEach((x) => f.push({ ic: 'star', t: 'Avaliação para moderar', s: x.cliente + ' sobre ' + pro(x.pro).empresa, v: 'moderacao', tab: 'aval', when: x.ts }));
    db().relatos.filter((x) => x.status !== 'Concluído').forEach((x) => f.push({ ic: 'flag', t: 'Relato ' + x.status.toLowerCase(), s: x.tipo + ' — ' + pro(x.pro).empresa, v: 'relatos', when: x.ts }));
    return f;
  }
  function vMedPainel() {
    const d = db();
    const ct30 = d.contatos.filter((c) => A.inPeriod(c.ts, '30'));
    const fila = filaMed();
        return A.ph('Painel da vitrine', 'Qualidade dos cadastros, moderação de conteúdo e contatos gerados para os profissionais.', A.nav('Ver relatórios', 'relatorios', null, '', 'chart')) +
      '<div class="g4 mb16">' +
      A.kpi({ l: 'Profissionais publicados', v: d.pros.filter((p) => p.status === 'Publicado').length, s: d.pros.filter((p) => p.status === 'Suspenso').length + ' suspenso(s)', icon: 'users' }) +
      A.kpi({ l: 'Cadastros em análise', v: d.pros.filter((p) => p.status === 'Em análise').length, s: 'Aguardando aprovação', icon: 'clipboard', tone: 'warn' }) +
      A.kpi({ l: 'Itens em moderação', v: d.portfolio.filter((x) => x.status === 'Em moderação').length + d.avaliacoes.filter((x) => x.status === 'Em moderação').length, s: 'Fotos e avaliações', icon: 'image', tone: 'warn' }) +
      A.kpi({ l: 'Contatos gerados', v: ct30.length, s: 'Últimos 30 dias', icon: 'chat', tone: 'ok' }) +
      '</div><div class="g21"><div class="stack">' +
      A.card('Fila de trabalho (' + fila.length + ')', fila.length ? fila.map((x) => '<div class="li clk" data-act="c1.goFila" data-view="' + x.v + '" data-tab="' + (x.tab || '') + '">' + I(x.ic, 18) + '<div class="lt"><b>' + e(x.t) + '</b><small>' + e(x.s) + '</small></div><span class="small muted nowrap">' + (x.when ? A.ago(x.when) : '') + '</span>' + I('arrowR', 16) + '</div>').join('') : A.empty('Nenhuma pendência na vitrine.', 'check'), { icon: 'inbox' }) +
      '</div><div class="stack">' +
      A.card('Contatos por cidade (30 dias)', A.bars(A.toBars(A.count(ct30, (c) => c.cidade))), { icon: 'pin' }) +
      A.card('Contatos por canal (30 dias)', A.bars(A.toBars(A.count(ct30, (c) => c.canal))), { icon: 'phone' }) +
      '</div></div>';
  }
  function vMedCadastros() {
    const tab = A.tab('cad', 'Em análise');
    const groups = ['Em análise', 'Ajuste solicitado', 'Publicado', 'Recusado'];
    const list = db().pros.filter((p) => p.status === tab).sort((a, b) => ((a.enviado || '') < (b.enviado || '') ? 1 : -1));
    return A.ph('Análise de cadastros', 'Confira dados e documentos antes de publicar um profissional na vitrine.') +
      A.card(null, A.tabs('cad', groups.map((g) => ({ id: g, l: g === 'Publicado' ? 'Aprovados' : g === 'Recusado' ? 'Recusados' : g, n: db().pros.filter((p) => p.status === g).length }))) +
        (list.length ? list.map((p) => {
          const okDocs = Object.keys(DOCS).filter((k) => k !== 'seguro' && p.docs[k]).length;
          return '<div class="li" style="align-items:flex-start">' + A.av(p.empresa, p.cor) + '<div class="lt"><b>' + e(p.empresa) + ' — ' + e(p.nome) + '</b><small>' + e(p.cidade) + ' — ' + e(p.doc) + (p.enviado ? ' — enviado ' + A.ago(p.enviado) : '') + '</small>' +
            '<div class="row" style="margin-top:6px">' + A.badge('Documentos obrigatórios: ' + okDocs + '/3', okDocs === 3 ? 'ok' : 'warn') + A.chips(p.servicos.map(srvName).slice(0, 3)) + '</div>' + (p.motivo ? '<small style="margin-top:4px">Observação: ' + e(p.motivo) + '</small>' : '') + '</div>' +
            '<div class="acts-row">' + A.b('Ver detalhes', 'c1.cadVer', { id: p.id }, 'sm', 'eye') + (p.status === 'Em análise' || p.status === 'Ajuste solicitado' ? A.b('Aprovar e publicar', 'c1.cadAprovar', { id: p.id }, 'sm ok', 'check') : '') + '</div></div>';
        }).join('') : A.empty('Nenhum cadastro nesta situação.', 'inbox')));
  }
  function vMedProfissionais() {
    const cid = A.fv('prof', 'cid'), st = A.fv('prof', 'st');
    let list = db().pros.slice();
    if (cid) list = list.filter((p) => p.regioes.indexOf(cid) >= 0);
    if (st) list = list.filter((p) => p.status === st);
    const ct30 = db().contatos.filter((c) => A.inPeriod(c.ts, '30'));
    return A.ph('Gestão de profissionais', 'Atualize contatos e regiões, suspenda ou reative perfis da vitrine.', A.b('Cadastrar profissional', 'c1.proNovo', {}, 'p', 'plus')) +
      A.card(null, A.filters('prof', [{ k: 'cid', l: 'Cidade atendida', o: A.opts(db().cidades, 'Todas') }, { k: 'st', l: 'Situação', o: A.opts(['Publicado', 'Em análise', 'Ajuste solicitado', 'Suspenso', 'Recusado'], 'Todas') }]) +
        A.table([
          { l: 'Profissional', f: (p) => '<div class="row" style="flex-wrap:nowrap">' + A.av(p.empresa, p.cor) + '<div><b>' + e(p.empresa) + '</b><small>' + e(p.nome) + ' — ' + e(p.tel) + '</small></div></div>' },
          { l: 'Regiões atendidas', f: (p) => e(p.regioes.join(', ')) },
          { l: 'Nota', f: (p) => (p.nota ? A.num(p.nota, 1) + ' ★' : '—') },
          { l: 'Contatos 30d', cls: 'r', f: (p) => ct30.filter((c) => c.pro === p.id).length },
          { l: 'Situação', f: (p) => A.badge(p.status) },
          { l: '', cls: 'r', f: (p) => '<div class="acts-row" style="justify-content:flex-end">' + A.b('Atualizar', 'c1.proGer', { id: p.id }, 'sm', 'edit') + (p.status === 'Publicado' ? A.b('Suspender', 'c1.proSusp', { id: p.id }, 'sm dg') : p.status === 'Suspenso' ? A.b('Reativar', 'c1.proReat', { id: p.id }, 'sm ok') : '') + '</div>' },
        ], list), { flush: true });
  }
  function vMedModeracao() {
    const tab = A.tab('mod', 'foto');
    const fotos = db().portfolio.filter((f) => f.status === 'Em moderação');
    const avs = db().avaliacoes.filter((a) => a.status === 'Em moderação');
    const hist = db().portfolio.filter((f) => f.status !== 'Em moderação' && f.moderadoEm).concat(db().avaliacoes.filter((a) => a.status !== 'Em moderação' && a.moderadoEm));
    return A.ph('Moderação de conteúdo', 'Fotos de portfólio e avaliações só aparecem na vitrine depois de aprovadas.') +
      '<div class="g21"><div>' + A.card(null, A.tabs('mod', [{ id: 'foto', l: 'Fotos do portfólio', n: fotos.length }, { id: 'aval', l: 'Avaliações', n: avs.length }]) +
        (tab === 'foto' ? (fotos.length ? '<div class="gal">' + fotos.map((f) => '<div class="gal-i">' + A.zoomable(f.img, f.legenda) + '<small><b>' + e(pro(f.pro).empresa) + '</b> — enviada ' + A.ago(f.ts) + '</small><div class="acts-row">' + A.b('Aprovar', 'c1.fotoAprovar', { id: f.id }, 'sm ok', 'check') + A.b('Recusar', 'c1.fotoRecusar', { id: f.id }, 'sm dg', 'x') + '</div></div>').join('') + '</div>' : A.empty('Nenhuma foto aguardando moderação.', 'check'))
          : (avs.length ? avs.map((a) => '<div class="li" style="align-items:flex-start">' + A.av(a.cliente) + '<div class="lt"><b>' + e(a.cliente) + ' sobre ' + e(pro(a.pro).empresa) + ' ' + A.stars(a.nota) + '</b><small>' + A.fdt(a.ts) + '</small><div style="margin-top:4px">“' + e(a.texto) + '”</div></div><div class="acts-row">' + A.b('Publicar', 'c1.avPublicar', { id: a.id }, 'sm ok', 'check') + A.b('Recusar', 'c1.avRecusar', { id: a.id }, 'sm dg', 'x') + '</div></div>').join('') : A.empty('Nenhuma avaliação aguardando moderação.', 'check')))) + '</div>' +
      '<div class="stack">' + A.card('Regras de moderação', '<ul class="ul chk"><li>' + I('check', 15) + '<span>Fotos de trabalhos do próprio profissional</span></li><li>' + I('check', 15) + '<span>Sem marca d\'água, telefone ou logotipo de terceiros</span></li><li>' + I('check', 15) + '<span>Sem dados pessoais ou rosto de clientes</span></li><li>' + I('check', 15) + '<span>Avaliações sem ofensas, propaganda ou dados de contato</span></li><li>' + I('check', 15) + '<span>Notas baixas são publicadas quando respeitam as regras</span></li></ul>', { icon: 'shield' }) +
      A.card('Decisões recentes', hist.length ? hist.sort((a, b) => (a.moderadoEm < b.moderadoEm ? 1 : -1)).slice(0, 6).map((x) => '<div class="li"><div class="lt"><b>' + e(x.legenda || ('Avaliação de ' + x.cliente)) + '</b><small>' + A.fdt(x.moderadoEm) + (x.motivo ? ' — ' + e(x.motivo) : '') + '</small></div>' + A.badge(x.status) + '</div>').join('') : A.empty('As decisões tomadas nesta demonstração aparecem aqui.', 'history'), { icon: 'history' }) + '</div></div>';
  }
  function vMedRelatos() {
    const st = A.fv('rel', 'st');
    let list = db().relatos.slice().sort((a, b) => (a.ts < b.ts ? 1 : -1));
    if (st) list = list.filter((r) => r.status === st);
    return A.ph('Relatos de clientes', 'Reclamações e informações enviadas pelos clientes sobre os profissionais da vitrine.') +
      A.card(null, A.filters('rel', [{ k: 'st', l: 'Situação', o: A.opts(['Aberto', 'Em apuração', 'Concluído'], 'Todas') }]) + A.table([
        { l: 'Data', f: (r) => A.fdtn(r.ts) },
        { l: 'Cliente', f: (r) => '<b>' + e(r.cliente) + '</b><small>' + e(r.cidade) + '</small>' },
        { l: 'Profissional', f: (r) => e(pro(r.pro).empresa) },
        { l: 'Tipo', f: (r) => e(r.tipo) },
        { l: 'Situação', f: (r) => A.badge(r.status) },
        { l: '', cls: 'r', f: (r) => A.b('Abrir', 'c1.relVer', { id: r.id }, 'sm', 'eye') },
      ], list), { flush: true });
  }
  function vMedClientes() {
    const q = A.fv('cli', 'q').toLowerCase();
    let list = db().clientes.slice();
    if (q) list = list.filter((c) => (c.nome + ' ' + c.cidade + ' ' + c.email).toLowerCase().indexOf(q) >= 0);
    return A.ph('Clientes', 'Cadastro de clientes que usam a vitrine para encontrar profissionais.', A.b('Cadastrar cliente', 'c1.cliNovo', {}, 'p', 'plus')) +
      A.card(null, A.filters('cli', [{ k: 'q', type: 'search', l: 'Buscar por nome, cidade ou e-mail' }]) + A.table([
        { l: 'Cliente', f: (c) => '<b>' + e(c.nome) + '</b><small>' + e(c.contato || c.email) + '</small>' },
        { l: 'Tipo', k: 'tipo' }, { l: 'Cidade', f: (c) => e(c.cidade + ' — ' + c.bairro) },
        { l: 'Contatos gerados', cls: 'r', f: (c) => db().contatos.filter((x) => x.cliente === c.nome).length },
        { l: 'Cliente desde', f: (c) => A.fd(c.desde) },
        { l: '', cls: 'r', f: (c) => A.b('Ver', 'c1.cliVer', { id: c.id }, 'sm', 'eye') },
      ], list), { flush: true });
  }
  function vMedCatalogo() {
    return A.ph('Catálogo de serviços', 'Serviços que os profissionais podem oferecer e que os clientes usam como filtro de busca.', A.b('Cadastrar serviço', 'c1.catNovo', {}, 'p', 'plus')) +
      A.card(null, A.table([
        { l: 'Código', k: 'id' }, { l: 'Serviço', f: (s) => '<b>' + e(s.nome) + '</b><small>' + e(s.desc) + '</small>' },
        { l: 'Profissionais', cls: 'r', f: (s) => db().pros.filter((p) => p.status === 'Publicado' && activeSrv(p).indexOf(s.id) >= 0).length },
        { l: 'Situação', f: (s) => A.badge(s.ativo ? 'Ativo' : 'Inativo', s.ativo ? 'ok' : 'neutral') },
        { l: '', cls: 'r', f: (s) => '<div class="acts-row" style="justify-content:flex-end">' + A.b('Editar', 'c1.catEdit', { id: s.id }, 'sm', 'edit') + A.b(s.ativo ? 'Desativar' : 'Ativar', 'c1.catToggle', { id: s.id }, 'sm') + '</div>' },
      ], db().servicos), { flush: true });
  }
  function vMedRelatorios() {
    const tab = A.tab('rep', 'ct');
    const per = A.fv('rep', 'per', '30'), cid = A.fv('rep', 'cid'), sv = A.fv('rep', 'srv'), pf = A.fv('rep', 'pro');
    const d = db();
    let ct = d.contatos.filter((c) => A.inPeriod(c.ts, per));
    if (cid) ct = ct.filter((c) => c.cidade === cid);
    if (sv) ct = ct.filter((c) => c.srv === sv);
    if (pf) ct = ct.filter((c) => c.pro === pf);
    const filt = A.filters('rep', [
      { k: 'per', l: 'Período', def: '30', o: perOpts },
      { k: 'cid', l: 'Cidade', o: A.opts(d.cidades, 'Todas') },
      { k: 'srv', l: 'Serviço', o: A.opts(d.servicos.map((s) => ({ v: s.id, l: s.nome })), 'Todos') },
      { k: 'pro', l: 'Profissional', o: A.opts(d.pros.filter((p) => p.status !== 'Em análise').map((p) => ({ v: p.id, l: p.empresa })), 'Todos') },
    ]);
    let body = '';
    if (tab === 'ct') {
      const resp = ct.filter((c) => c.retorno === 'Respondido').length;
      body = '<div class="g4 mb16">' + A.kpi({ l: 'Contatos gerados', v: ct.length, icon: 'chat' }) + A.kpi({ l: 'Respondidos pelo profissional', v: A.pct(resp, ct.length), s: resp + ' de ' + ct.length, icon: 'check', tone: 'ok' }) + A.kpi({ l: 'Sem resposta', v: ct.filter((c) => c.retorno === 'Sem resposta').length, icon: 'alert', tone: 'bad' }) + A.kpi({ l: 'Profissionais contatados', v: Object.keys(A.count(ct, (c) => c.pro)).length, icon: 'users' }) + '</div>' +
        '<div class="g3 mb16">' + A.card('Por profissional', A.bars(A.toBars(A.count(ct, (c) => pro(c.pro).empresa)))) + A.card('Por cidade', A.bars(A.toBars(A.count(ct, (c) => c.cidade)))) + A.card('Por serviço', A.bars(A.toBars(A.count(ct, (c) => srvName(c.srv))))) + '</div>' +
        A.card('Contatos gerados no período (' + ct.length + ')', A.table([
          { l: 'Data', f: (c) => A.fdtn(c.ts) }, { l: 'Cliente', f: (c) => e(c.cliente) }, { l: 'Cidade', k: 'cidade' }, { l: 'Profissional', f: (c) => e(pro(c.pro).empresa) }, { l: 'Serviço', f: (c) => e(srvName(c.srv)) }, { l: 'Canal', k: 'canal' }, { l: 'Retorno', f: (c) => A.badge(c.retorno) },
          { l: '', cls: 'r', f: (c) => A.b('Detalhes', 'c1.ctDet', { id: c.id }, 'sm', 'eye') },
        ], ct.sort((a, b) => (a.ts < b.ts ? 1 : -1))), { flush: true });
    } else if (tab === 'reg') {
      const rows = d.cidades.filter((c) => !cid || c === cid).map((c) => {
        const ps = d.pros.filter((p) => p.status === 'Publicado' && p.regioes.indexOf(c) >= 0 && (!sv || activeSrv(p).indexOf(sv) >= 0));
        const n = ct.filter((x) => x.cidade === c).length;
        return { id: c, cidade: c, pros: ps, n: n, nota: ps.length ? A.avg(ps, 'nota') : 0, cob: ps.length >= 3 ? 'Boa' : ps.length === 2 ? 'Atenção' : 'Baixa' };
      });
      body = A.note('Cidades com baixa cobertura indicam onde buscar novos parceiros. Contatos consideram o período e os filtros selecionados.') + '<div class="mt"></div><div class="g12">' +
        A.card('Profissionais por cidade', A.bars(rows.map((r) => ({ l: r.cidade, v: r.pros.length })).sort((a, b) => b.v - a.v))) +
        A.card('Cobertura por região', A.table([
          { l: 'Cidade', f: (r) => '<b>' + e(r.cidade) + '</b>' }, { l: 'Profissionais', cls: 'r', f: (r) => r.pros.length }, { l: 'Contatos', cls: 'r', f: (r) => r.n }, { l: 'Nota média', cls: 'r', f: (r) => (r.nota ? A.num(r.nota, 1) : '—') },
          { l: 'Cobertura', f: (r) => A.badge(r.cob, r.cob === 'Boa' ? 'ok' : r.cob === 'Atenção' ? 'warn' : 'bad') }, { l: '', cls: 'r', f: (r) => A.b('Detalhes', 'c1.regDet', { c: r.cidade }, 'sm', 'eye') },
        ], rows), { flush: true }) + '</div>';
    } else {
      const ps = d.pros.filter((p) => p.status !== 'Em análise' && (!pf || p.id === pf));
      const mod = d.portfolio.concat(d.avaliacoes);
      const rec = mod.filter((x) => x.status === 'Recusado' || x.status === 'Recusada').length;
      body = '<div class="g4 mb16">' + A.kpi({ l: 'Nota média da vitrine', v: A.num(A.avg(d.pros.filter((p) => p.status === 'Publicado'), 'nota'), 1), icon: 'star' }) + A.kpi({ l: 'Itens em moderação', v: mod.filter((x) => x.status === 'Em moderação').length, icon: 'clock', tone: 'warn' }) + A.kpi({ l: 'Itens recusados', v: rec, icon: 'x', tone: 'bad' }) + A.kpi({ l: 'Relatos abertos', v: d.relatos.filter((r) => r.status !== 'Concluído').length, icon: 'flag', tone: 'warn' }) + '</div>' +
        A.card('Qualidade por profissional', A.table([
          { l: 'Profissional', f: (p) => '<b>' + e(p.empresa) + '</b>' }, { l: 'Nota', cls: 'r', f: (p) => (p.nota ? A.num(p.nota, 1) : '—') },
          { l: 'Avaliações publicadas', cls: 'r', f: (p) => d.avaliacoes.filter((a) => a.pro === p.id && a.status === 'Publicada').length },
          { l: 'Fotos publicadas', cls: 'r', f: (p) => pubPhotos(p).length },
          { l: 'Relatos (abertos/total)', cls: 'r', f: (p) => d.relatos.filter((r) => r.pro === p.id && r.status !== 'Concluído').length + ' / ' + d.relatos.filter((r) => r.pro === p.id).length },
          { l: 'Taxa de retorno', cls: 'r', f: (p) => { const c = ct.filter((x) => x.pro === p.id); return c.length ? A.pct(c.filter((x) => x.retorno === 'Respondido').length, c.length) : '—'; } },
          { l: 'Situação', f: (p) => A.badge(p.status) }, { l: '', cls: 'r', f: (p) => A.b('Detalhes', 'c1.proDet', { id: p.id }, 'sm', 'eye') },
        ], ps), { flush: true }) + '<div class="mt"></div>' + A.card('Relatos por tipo', A.bars(A.toBars(A.count(d.relatos, (r) => r.tipo))));
    }
    return A.ph('Relatórios da vitrine', 'Indicadores compatíveis com o modelo de vitrine: contatos gerados, cobertura de regiões e qualidade dos perfis.') +
      A.tabs('rep', [{ id: 'ct', l: 'Contatos gerados' }, { id: 'reg', l: 'Cobertura por região' }, { id: 'qual', l: 'Qualidade e moderação' }]) +
      '<div class="card mb16" style="padding:12px 14px 0">' + filt + '</div>' + body;
  }

  /* ------------------------------------------------------------------
     Ações
     ------------------------------------------------------------------ */
  const srvOpts = () => db().servicos.filter((s) => s.ativo).map((s) => ({ v: s.id, l: s.nome }));
  const actions = {
    'c1.goFila': (ds) => { if (ds.tab) A.setTab('mod', ds.tab); A.go(ds.view); },
    'c1.loja': () => {
      A.modal({ title: 'Loja de materiais AiCalhas', sub: 'Neste cenário, a venda de materiais pode existir como um botão separado da vitrine.', size: 'lg', body: A.note('A compra de materiais é independente da contratação do profissional. Os itens abaixo são ilustrativos.') + '<div class="mt"></div>' + A.table([
        { l: 'Material', f: (m) => '<b>' + e(m.nome) + '</b>' }, { l: 'Unidade', k: 'un' }, { l: 'Preço', cls: 'r', f: (m) => A.money(m.preco) }, { l: '', cls: 'r', f: (m) => A.b('Tenho interesse', 'c1.lojaInt', { id: m.id }, 'sm', 'cart') },
      ], db().materiais.slice(0, 8)) });
    },
    'c1.lojaInt': (ds) => { const m = db().materiais.find((x) => x.id === ds.id); A.log('Interesse em material da loja (simulado)', m.nome); A.toast('Interesse registrado em "' + m.nome + '". Um vendedor entraria em contato (simulação).'); },
    'c1.portfolio': (ds) => {
      const p = pro(ds.id), ph = pubPhotos(p);
      A.modal({ title: 'Portfólio — ' + p.empresa, sub: ph.length + ' foto(s) aprovada(s) pela AiCalhas', size: 'lg', body: ph.length ? '<div class="gal">' + ph.map((f) => '<div class="gal-i">' + A.photo(f.img, f.legenda) + '</div>').join('') + '</div>' : A.empty('Sem fotos publicadas.', 'image'), foot: '<button class="btn" data-act="core.close">Fechar</button>' + A.b('Entrar em contato', 'c1.contato', { id: p.id }, 'p', 'chat') });
    },
    'c1.contato': (ds) => {
      const p = pro(ds.id), c = db().clientes.find((x) => x.id === MYCLI);
      A.form({ title: 'Entrar em contato com ' + p.empresa, sub: 'Simulação: nenhuma mensagem real é enviada.', submit: 'c1.contatoSave', submitLabel: 'Enviar contato', icon: 'send', extra: { pro: p.id },
        intro: 'Seus dados serão compartilhados apenas com este profissional. A conversa e a negociação seguem diretamente entre vocês.',
        fields: [
          { name: 'nome', label: 'Seu nome', value: c.nome, required: true },
          { name: 'tel', label: 'Telefone / WhatsApp', type: 'tel', value: c.tel, required: true },
          { name: 'srv', label: 'Serviço desejado', type: 'select', options: activeSrv(p).map((s) => ({ v: s, l: srvName(s) })), required: true },
          { name: 'cidade', label: 'Cidade do imóvel', type: 'select', options: p.regioes, value: p.regioes.indexOf(c.cidade) >= 0 ? c.cidade : p.regioes[0], required: true },
          { name: 'canal', label: 'Como prefere ser contatado?', type: 'radios', options: CANAIS, value: c.prefContato || 'WhatsApp', full: true, required: true },
          { name: 'msg', label: 'Mensagem', type: 'textarea', value: 'Olá! Encontrei seu perfil na AiCalhas. A calha da frente da minha casa está vazando na emenda. Vocês conseguem avaliar ainda esta semana?', full: true, required: true },
          { name: 'lgpd', type: 'check', text: 'Autorizo o compartilhamento do meu nome e telefone com este profissional para este atendimento.', value: true, required: true },
        ] });
    },
    'c1.contatoSave': (v, x) => {
      const d = db(), p = pro(x.pro);
      const id = A.nextId('CTT-', d.contatos);
      d.contatos.push({ id: id, ts: A.now(), cliente: v.nome, cidade: v.cidade, pro: p.id, srv: v.srv, canal: v.canal, retorno: 'Aguardando retorno', msg: v.msg, clienteId: MYCLI });
      p.views += 1;
      A.log('Contato simulado com profissional (' + v.canal + ')', id + ' · ' + p.empresa);
      A.refresh();
      A.modal({ title: 'Contato registrado', size: 'sm', body: '<div class="empty" style="padding:6px">' + I('check', 34) + '<p><b>Contato enviado para ' + e(p.empresa) + '.</b></p></div>' +
        A.dl([['Canal escolhido', e(v.canal)], ['Telefone do profissional', e(p.tel)], ['Protocolo', id]], 'one') + '<div class="mt"></div>' +
        A.note('Simulação: em um sistema real, o ' + (v.canal === 'WhatsApp' ? 'WhatsApp abriria com a mensagem pronta' : v.canal === 'Telefone' ? 'telefone do profissional seria exibido para ligação' : 'profissional receberia a mensagem na plataforma') + '. O contato já aparece no perfil do profissional e nos relatórios da AiCalhas.'),
        foot: '<button class="btn" data-act="core.close">Fechar</button>' + A.nav('Ver meus contatos', 'contatos', null, 'p') });
    },
    'c1.avaliar': (ds) => {
      const p = pro(ds.id);
      A.form({ title: 'Avaliar ' + p.empresa, sub: 'Sua avaliação passa pela moderação da AiCalhas antes de ser publicada.', submit: 'c1.avSave', submitLabel: 'Enviar avaliação', icon: 'star', extra: { pro: p.id },
        fields: [
          { name: 'nota', label: 'Nota', type: 'radios', options: [{ v: 5, l: '★★★★★ Excelente' }, { v: 4, l: '★★★★ Bom' }, { v: 3, l: '★★★ Regular' }, { v: 2, l: '★★ Ruim' }, { v: 1, l: '★ Péssimo' }], value: 5, full: true, required: true },
          { name: 'srv', label: 'Serviço realizado', type: 'select', options: activeSrv(p).map((s) => ({ v: s, l: srvName(s) })) },
          { name: 'quando', label: 'Quando foi realizado?', type: 'date', value: A.d(-2).slice(0, 10) },
          { name: 'texto', label: 'Comentário', type: 'textarea', full: true, required: true, value: 'Atendimento rápido e serviço bem feito. A calha não vazou mais.' },
        ] });
    },
    'c1.avSave': (v, x) => {
      const d = db(), id = A.nextId('AV-', d.avaliacoes);
      d.avaliacoes.push({ id: id, pro: x.pro, cliente: A.me().nome, nota: +v.nota, texto: v.texto, status: 'Em moderação', ts: A.now(), resposta: '', motivo: '' });
      A.done('Avaliação enviada. Ela será publicada após a moderação da AiCalhas.', 'Avaliação enviada para moderação', id + ' · ' + pro(x.pro).empresa);
    },
    'c1.relatar': (ds) => {
      const p = pro(ds.id);
      A.form({ title: 'Relatar problema sobre ' + p.empresa, sub: 'O relato é enviado à equipe AiCalhas, que apura e responde.', submit: 'c1.relSave', submitLabel: 'Enviar relato', icon: 'flag', extra: { pro: p.id },
        fields: [
          { name: 'tipo', label: 'Tipo de problema', type: 'select', required: true, full: true, options: ['Profissional não atende mais a minha cidade', 'Sem retorno após o contato', 'Informações desatualizadas no perfil', 'Conduta inadequada', 'Outro'] },
          { name: 'desc', label: 'Descreva o que aconteceu', type: 'textarea', required: true, full: true, value: 'Entrei em contato pelo WhatsApp há três dias e ainda não tive resposta.' },
        ] });
    },
    'c1.relSave': (v, x) => {
      const d = db(), id = A.nextId('REL-', d.relatos), c = d.clientes.find((k) => k.id === MYCLI);
      d.relatos.push({ id: id, ts: A.now(), cliente: A.me().nome, cidade: c.cidade, pro: x.pro, tipo: v.tipo, desc: v.desc, status: 'Aberto', parecer: '', medida: '' });
      A.done('Relato enviado à AiCalhas. Acompanhe em “Avaliações e relatos”.', 'Relato registrado sobre profissional', id + ' · ' + pro(x.pro).empresa);
    },
    'c1.cliEdit': () => {
      const c = db().clientes.find((x) => x.id === MYCLI);
      A.form({ title: 'Editar meus dados', submit: 'c1.cliEditSave', fields: [
        { name: 'nome', label: 'Nome', value: c.nome, help: 'Nome fixo nesta demonstração.', type: 'text' },
        { name: 'tipo', label: 'Tipo de imóvel', type: 'select', options: ['Residencial', 'Comercial', 'Condomínio'], value: c.tipo },
        { name: 'tel', label: 'Telefone / WhatsApp', type: 'tel', value: c.tel, required: true },
        { name: 'email', label: 'E-mail', type: 'email', value: c.email, required: true },
        { name: 'cidade', label: 'Cidade', type: 'select', options: db().cidades, value: c.cidade },
        { name: 'bairro', label: 'Bairro', value: c.bairro },
        { name: 'prefContato', label: 'Contato preferido', type: 'select', options: CANAIS, value: c.prefContato },
        { name: 'lgpd', type: 'check', text: 'Autorizo compartilhar meus dados de contato com os profissionais que eu escolher.', value: c.lgpd },
      ] });
    },
    'c1.cliEditSave': (v) => { const c = db().clientes.find((x) => x.id === MYCLI); ['tipo', 'tel', 'email', 'cidade', 'bairro', 'prefContato', 'lgpd'].forEach((k) => { c[k] = v[k]; }); A.done('Dados atualizados.', 'Cadastro de cliente atualizado', MYCLI); },

    /* Profissional */
    'c1.proEdit': () => {
      const p = pro(MYPRO);
      A.form({ title: 'Editar perfil', submit: 'c1.proEditSave', fields: [
        { name: 'empresa', label: 'Nome fantasia', value: p.empresa, required: true },
        { name: 'cidade', label: 'Cidade-base', type: 'select', options: db().cidades, value: p.cidade },
        { name: 'tel', label: 'Telefone / WhatsApp', type: 'tel', value: p.tel, required: true },
        { name: 'email', label: 'E-mail', type: 'email', value: p.email, required: true },
        { name: 'desde', label: 'Atua desde (ano)', type: 'number', min: 1970, max: 2026, value: p.desde },
        { name: 'urgencia', type: 'check', text: 'Atendo urgências em até 24 h', value: p.urgencia, half: true },
        { name: 'sobre', label: 'Descrição do perfil', type: 'textarea', rows: 4, value: p.sobre, full: true, required: true },
      ] });
    },
    'c1.proEditSave': (v) => { const p = pro(MYPRO); ['empresa', 'cidade', 'tel', 'email', 'sobre', 'urgencia'].forEach((k) => { p[k] = v[k]; }); p.desde = +v.desde || p.desde; A.done('Perfil atualizado na vitrine.', 'Perfil do profissional atualizado', MYPRO + ' · ' + p.empresa); },
    'c1.srvAdd': () => {
      const p = pro(MYPRO), has = p.servDet.map((s) => s.srv);
      const opts = srvOpts().filter((o) => has.indexOf(o.v) < 0);
      if (!opts.length) { A.toast('Você já oferece todos os serviços do catálogo.', 'warn'); return; }
      A.form({ title: 'Adicionar serviço', submit: 'c1.srvSave', fields: [
        { name: 'srv', label: 'Serviço', type: 'select', options: opts, required: true, full: true },
        { name: 'apartir', label: 'Valor de referência (a partir de)', type: 'number', min: 0, step: 10, value: 200, required: true },
        { name: 'prazo', label: 'Prazo médio', value: '1 dia', required: true },
        { name: 'obs', label: 'Observação (opcional)', full: true, placeholder: 'Ex.: inclui teste de escoamento' },
      ] });
    },
    'c1.srvSave': (v, x) => {
      const p = pro(MYPRO);
      if (x.edit) { const s = p.servDet.find((k) => k.srv === x.edit); s.apartir = +v.apartir; s.prazo = v.prazo; s.obs = v.obs; A.done('Serviço atualizado.', 'Serviço oferecido atualizado', srvName(s.srv)); return; }
      p.servDet.push({ srv: v.srv, apartir: +v.apartir, prazo: v.prazo, obs: v.obs, ativo: true });
      if (p.servicos.indexOf(v.srv) < 0) p.servicos.push(v.srv);
      A.done('Serviço adicionado ao perfil.', 'Serviço oferecido adicionado', srvName(v.srv));
    },
    'c1.srvEdit': (ds) => {
      const s = pro(MYPRO).servDet.find((k) => k.srv === ds.srv);
      A.form({ title: 'Editar serviço — ' + srvName(s.srv), submit: 'c1.srvSave', extra: { edit: s.srv }, fields: [
        { name: 'apartir', label: 'Valor de referência (a partir de)', type: 'number', min: 0, step: 10, value: s.apartir, required: true },
        { name: 'prazo', label: 'Prazo médio', value: s.prazo, required: true },
        { name: 'obs', label: 'Observação', value: s.obs, full: true },
      ] });
    },
    'c1.srvToggle': (ds) => { const s = pro(MYPRO).servDet.find((k) => k.srv === ds.srv); s.ativo = !s.ativo; A.done('Serviço ' + (s.ativo ? 'ativado' : 'desativado') + '.', 'Serviço ' + (s.ativo ? 'ativado' : 'desativado') + ' no perfil', srvName(s.srv)); },
    'c1.srvDel': (ds) => A.confirm({ title: 'Remover serviço', msg: 'Remover <b>' + e(srvName(ds.srv)) + '</b> do seu perfil?', ok: 'Remover', danger: true, onOk: () => { const p = pro(MYPRO); p.servDet = p.servDet.filter((k) => k.srv !== ds.srv); p.servicos = p.servicos.filter((k) => k !== ds.srv); A.done('Serviço removido.', 'Serviço removido do perfil', srvName(ds.srv)); } }),
    'c1.regEdit': () => {
      const p = pro(MYPRO);
      A.form({ title: 'Editar regiões atendidas', submit: 'c1.regSave', fields: [
        { name: 'regioes', label: 'Cidades atendidas', type: 'checks', options: db().cidades, value: p.regioes, full: true },
        { name: 'urgencia', type: 'check', text: 'Atendo urgências em até 24 h', value: p.urgencia },
      ] });
    },
    'c1.regSave': (v) => { if (!v.regioes.length) { A.toast('Selecione ao menos uma cidade.', 'warn'); return; } const p = pro(MYPRO); p.regioes = v.regioes; p.urgencia = v.urgencia; A.done('Regiões atualizadas.', 'Regiões atendidas atualizadas', v.regioes.join(', ')); },
    'c1.regDel': (ds) => {
      const p = pro(MYPRO);
      if (p.regioes.length <= 1) { A.toast('Mantenha ao menos uma cidade atendida.', 'warn'); return; }
      A.confirm({ title: 'Remover cidade', msg: 'Deixar de atender <b>' + e(ds.c) + '</b>? Seu perfil não aparecerá mais nas buscas dessa cidade.', ok: 'Remover', danger: true, onOk: () => { p.regioes = p.regioes.filter((c) => c !== ds.c); A.done('Cidade removida das regiões atendidas.', 'Cidade removida das regiões atendidas', ds.c); } });
    },
    'c1.fotoAdd': () => {
      const p = pro(MYPRO);
      A.form({ title: 'Adicionar fotos ao portfólio', sub: 'As fotos ficam “Em moderação” até a aprovação da AiCalhas.', submit: 'c1.fotoSave', submitLabel: 'Enviar para moderação', icon: 'camera', size: 'lg', fields: [
        { name: 'legenda', label: 'Legenda', required: true, value: 'Troca de calha frontal com condutor novo', full: true },
        { name: 'srv', label: 'Serviço relacionado', type: 'select', options: activeSrv(p).map((s) => ({ v: s, l: srvName(s) })) },
        { name: 'cidade', label: 'Cidade da obra', type: 'select', options: p.regioes },
        { name: 'fotos', label: 'Fotos', type: 'photos', full: true, presets: ['calha-frontal', 'condutor', 'rufo', 'aluminio', 'calha-cobre', 'limpeza'], preselect: ['aluminio'] },
        { name: 'autoria', type: 'check', text: 'Declaro que as fotos são de trabalhos realizados pela minha empresa e não expõem dados de clientes.', required: true },
      ] });
    },
    'c1.fotoSave': (v) => {
      if (!v.fotos || !v.fotos.length) { A.toast('Escolha ao menos uma foto ou imagem ilustrativa.', 'warn'); return; }
      const d = db();
      v.fotos.forEach((img, i) => { d.portfolio.push({ id: A.nextId('FOT-', d.portfolio), pro: MYPRO, img: img, legenda: v.legenda + (v.fotos.length > 1 ? ' (' + (i + 1) + ')' : '') + ' — ' + v.cidade, status: 'Em moderação', ts: A.now(), motivo: '' }); });
      A.done(v.fotos.length + ' foto(s) enviada(s) para moderação.', 'Foto(s) enviada(s) ao portfólio', v.fotos.length + ' arquivo(s) · ' + v.legenda);
    },
    'c1.fotoDel': (ds) => A.confirm({ title: 'Remover foto', msg: 'Remover esta foto do portfólio?', ok: 'Remover', danger: true, onOk: () => { const d = db(); const f = d.portfolio.find((x) => x.id === ds.id); d.portfolio = d.portfolio.filter((x) => x.id !== ds.id); A.done('Foto removida.', 'Foto removida do portfólio', ds.id + ' · ' + f.legenda); } }),
    'c1.ctVer': (ds) => {
      const c = db().contatos.find((x) => x.id === ds.id);
      A.modal({ title: 'Contato ' + c.id, sub: A.fdt(c.ts), body: A.dl([['Cliente', e(c.cliente)], ['Cidade', e(c.cidade)], ['Serviço', e(srvName(c.srv))], ['Canal', e(c.canal)], ['Retorno', A.badge(c.retorno)]]) + '<h4 style="margin:16px 0 6px">Mensagem</h4><div class="note neutral"><div>' + e(c.msg) + '</div></div>',
        foot: '<button class="btn" data-act="core.close">Fechar</button>' + (A.profile() === 'profissional' && c.retorno !== 'Respondido' ? A.b('Marcar como respondido', 'c1.ctResp', { id: c.id }, 'ok', 'check') : '') });
    },
    'c1.ctResp': (ds) => { const c = db().contatos.find((x) => x.id === ds.id); c.retorno = 'Respondido'; A.done('Contato marcado como respondido.', 'Contato marcado como respondido', c.id + ' · ' + c.cliente); },
    'c1.avResp': (ds) => {
      const a = db().avaliacoes.find((x) => x.id === ds.id);
      A.form({ title: 'Responder avaliação de ' + a.cliente, submit: 'c1.avRespSave', extra: { id: a.id }, one: true, fields: [{ name: 'resposta', label: 'Sua resposta pública', type: 'textarea', required: true, value: 'Obrigado pela avaliação! Ficamos à disposição.' }] });
    },
    'c1.avRespSave': (v, x) => { const a = db().avaliacoes.find((k) => k.id === x.id); a.resposta = v.resposta; A.done('Resposta publicada.', 'Resposta publicada em avaliação', a.id + ' · ' + a.cliente); },
    'c1.cadastro': () => {
      A.form({ title: 'Cadastro de profissional', sub: 'Dados fictícios já preenchidos — ajuste se quiser.', submit: 'c1.cadSave', submitLabel: 'Enviar para análise', icon: 'send', size: 'lg', fields: [
        { type: 'section', label: 'Dados da empresa' },
        { name: 'empresa', label: 'Nome fantasia', value: 'Silva Calhas Express', required: true },
        { name: 'nome', label: 'Responsável', value: 'Diego Silva', required: true },
        { name: 'doc', label: 'CNPJ ou CPF', value: 'CNPJ 98.765.432/0001-10', required: true },
        { name: 'desde', label: 'Atua desde (ano)', type: 'number', value: 2017, min: 1970, max: 2026 },
        { name: 'tel', label: 'Telefone / WhatsApp', type: 'tel', value: '(19) 99000-1717', required: true },
        { name: 'email', label: 'E-mail', type: 'email', value: 'diego@silvacalhas.demo', required: true },
        { name: 'cidade', label: 'Cidade-base', type: 'select', options: db().cidades, value: 'Paulínia' },
        { name: 'sobre', label: 'Descrição', type: 'textarea', value: 'Instalação e troca de calhas galvanizadas e de alumínio, com atendimento rápido em Paulínia e Campinas.', full: true },
        { type: 'section', label: 'Serviços e regiões' },
        { name: 'servicos', label: 'Serviços oferecidos', type: 'checks', options: srvOpts(), value: ['SRV-01', 'SRV-02', 'SRV-04'], full: true },
        { name: 'regioes', label: 'Cidades atendidas', type: 'checks', options: db().cidades, value: ['Paulínia', 'Campinas'], full: true },
        { type: 'section', label: 'Documentos (simulação de envio)' },
        { name: 'docs', label: 'Documentos anexados', type: 'checks', options: Object.keys(DOCS).map((k) => ({ v: k, l: DOCS[k] })), value: ['id', 'endereco', 'nr35'], full: true },
        { name: 'termos', type: 'check', text: 'Li e aceito os termos de uso da vitrine, a política de privacidade e as regras de portfólio e avaliações.', required: true },
      ] });
    },
    'c1.cadSave': (v) => {
      if (!v.servicos.length || !v.regioes.length) { A.toast('Selecione ao menos um serviço e uma cidade.', 'warn'); return; }
      const d = db(), id = A.nextId('PRF-', d.pros);
      const docs = { id: false, endereco: false, nr35: false, seguro: false };
      v.docs.forEach((k) => { docs[k] = true; });
      d.pros.push({ id: id, nome: v.nome, empresa: v.empresa, cidade: v.cidade, regioes: v.regioes, servicos: v.servicos, servDet: v.servicos.map((s) => ({ srv: s, apartir: PRICE[s], prazo: PRAZO[s], obs: '', ativo: true })), nota: 0, avals: 0, tel: v.tel, email: v.email, desde: +v.desde || 2020, status: 'Em análise', cor: A.colorFor(v.empresa), doc: v.doc, sobre: v.sobre, docs: docs, views: 0, enviado: A.now(), criadoDemo: true, urgencia: false });
      A.log('Cadastro de profissional enviado para análise', id + ' · ' + v.empresa);
      A.close(); A.refresh();
      A.modal({ title: 'Cadastro enviado', size: 'sm', body: '<div class="empty" style="padding:6px">' + I('check', 34) + '<p><b>' + e(v.empresa) + '</b> foi enviado para análise.</p></div>' + A.note('Troque para o perfil <b>Mediador</b> e abra “Análise de cadastros” para aprovar. Depois de aprovado, o perfil aparece na busca do cliente.'), foot: '<button class="btn" data-act="core.close">Fechar</button>' + A.b('Ir para o Mediador', 'core.switch', { p: 'mediador' }, 'p', 'shield') });
    },

    /* Mediador */
    'c1.cadVer': (ds) => {
      const p = pro(ds.id);
      const canAct = p.status === 'Em análise' || p.status === 'Ajuste solicitado';
      A.modal({ title: p.empresa, sub: 'Cadastro ' + p.id + ' — ' + p.status, size: 'lg', body:
        '<div class="g2"><div>' + A.dl([['Responsável', e(p.nome)], ['Documento', e(p.doc)], ['Cidade-base', e(p.cidade)], ['Atua desde', p.desde], ['Telefone', e(p.tel)], ['E-mail', e(p.email)], ['Enviado em', p.enviado ? A.fdt(p.enviado) : '—']]) + '<h4 style="margin:14px 0 6px">Descrição</h4><p>' + e(p.sobre) + '</p></div>' +
        '<div><h4 style="margin:0 0 6px">Checklist de documentos</h4><ul class="ul chk">' + Object.keys(DOCS).map((k) => '<li style="color:' + (p.docs[k] ? 'inherit' : 'var(--bad)') + '">' + I(p.docs[k] ? 'check' : 'x', 15) + '<span>' + e(DOCS[k]) + (p.docs[k] ? '' : ' — pendente') + '</span></li>').join('') + '</ul>' +
        '<h4 style="margin:14px 0 6px">Serviços</h4>' + A.chips(p.servicos.map(srvName)) + '<h4 style="margin:14px 0 6px">Regiões</h4>' + A.chips(p.regioes, 'acc') + '</div></div>' +
        (!p.docs.nr35 ? '<div class="mt"></div>' + A.note('Sem certificado NR-35. Recomenda-se solicitar ajuste antes de publicar, pois o serviço envolve trabalho em altura.', 'warn') : ''),
        foot: '<button class="btn" data-act="core.close">Fechar</button>' + (canAct ? A.b('Recusar', 'c1.cadRecusar', { id: p.id }, 'dg', 'x') + A.b('Solicitar ajuste', 'c1.cadAjuste', { id: p.id }, '', 'edit') + A.b('Aprovar e publicar', 'c1.cadAprovar', { id: p.id }, 'ok', 'check') : '') });
    },
    'c1.cadAprovar': (ds) => {
      const p = pro(ds.id);
      A.confirm({ title: 'Aprovar e publicar', msg: 'Publicar <b>' + e(p.empresa) + '</b> na vitrine? O perfil passará a aparecer na busca dos clientes de ' + e(p.regioes.join(', ')) + '.', note: !p.docs.nr35 ? 'Atenção: o certificado NR-35 não foi enviado.' : '', noteTone: 'warn', ok: 'Aprovar e publicar', onOk: () => { p.status = 'Publicado'; p.publicado = A.now(); p.motivo = ''; A.done(p.empresa + ' foi publicado na vitrine.', 'Cadastro aprovado e publicado na vitrine', p.id + ' · ' + p.empresa); } });
    },
    'c1.cadAjuste': (ds) => {
      const p = pro(ds.id);
      A.form({ title: 'Solicitar ajuste — ' + p.empresa, submit: 'c1.cadStatus', extra: { id: p.id, st: 'Ajuste solicitado' }, submitLabel: 'Enviar solicitação', icon: 'send', one: true, fields: [
        { name: 'itens', label: 'O que precisa ser ajustado', type: 'checks', options: ['Enviar certificado NR-35', 'Enviar comprovante de endereço', 'Corrigir dados de contato', 'Detalhar a descrição dos serviços', 'Revisar regiões atendidas'], value: !p.docs.nr35 ? ['Enviar certificado NR-35'] : [] },
        { name: 'obs', label: 'Mensagem ao profissional', type: 'textarea', value: 'Olá! Para publicar seu perfil, precisamos dos itens marcados.', required: true },
      ] });
    },
    'c1.cadRecusar': (ds) => {
      const p = pro(ds.id);
      A.form({ title: 'Recusar cadastro — ' + p.empresa, submit: 'c1.cadStatus', extra: { id: p.id, st: 'Recusado' }, submitLabel: 'Recusar cadastro', btnCls: 'dgs', icon: 'x', one: true, fields: [
        { name: 'motivo', label: 'Motivo', type: 'select', options: ['Documentação inválida', 'Serviços fora do escopo da plataforma', 'Dados inconsistentes', 'Outro'], required: true },
        { name: 'obs', label: 'Observação', type: 'textarea', required: true, value: 'Documento enviado não corresponde ao CNPJ informado.' },
      ] });
    },
    'c1.cadStatus': (v, x) => { const p = pro(x.id); p.status = x.st; p.motivo = (v.itens && v.itens.length ? v.itens.join('; ') + '. ' : '') + (v.motivo ? v.motivo + ': ' : '') + v.obs; A.done('Cadastro atualizado: ' + x.st + '.', 'Cadastro ' + (x.st === 'Recusado' ? 'recusado' : 'com ajuste solicitado'), p.id + ' · ' + p.empresa); },
    'c1.proGer': (ds) => {
      const p = pro(ds.id);
      A.form({ title: 'Atualizar profissional — ' + p.empresa, sub: 'Use quando o profissional informar mudanças ou após apurar um relato.', submit: 'c1.proGerSave', extra: { id: p.id }, fields: [
        { name: 'tel', label: 'Telefone / WhatsApp', type: 'tel', value: p.tel, required: true },
        { name: 'email', label: 'E-mail', type: 'email', value: p.email, required: true },
        { name: 'regioes', label: 'Regiões atendidas', type: 'checks', options: db().cidades, value: p.regioes, full: true },
        { name: 'motivo', label: 'Motivo da alteração (registro interno)', type: 'textarea', required: true, full: true, value: p.id === 'PRF-104' ? 'Profissional confirmou por telefone que deixou de atender Hortolândia (relato REL-01).' : 'Atualização solicitada pelo profissional por telefone.' },
      ] });
    },
    'c1.proGerSave': (v, x) => {
      if (!v.regioes.length) { A.toast('Mantenha ao menos uma cidade atendida.', 'warn'); return; }
      const p = pro(x.id), antes = p.regioes.slice();
      p.tel = v.tel; p.email = v.email; p.regioes = v.regioes;
      const rem = antes.filter((c) => v.regioes.indexOf(c) < 0), add = v.regioes.filter((c) => antes.indexOf(c) < 0);
      A.done('Perfil de ' + p.empresa + ' atualizado.', 'Contatos/regiões atualizados pelo mediador', p.id + (rem.length ? ' · removidas: ' + rem.join(', ') : '') + (add.length ? ' · incluídas: ' + add.join(', ') : '') + ' · ' + v.motivo);
    },
    'c1.proSusp': (ds) => {
      const p = pro(ds.id);
      A.form({ title: 'Suspender ' + p.empresa, sub: 'O perfil deixa de aparecer na vitrine até ser reativado.', submit: 'c1.proSuspSave', extra: { id: p.id }, submitLabel: 'Suspender perfil', btnCls: 'dgs', icon: 'x', one: true, fields: [
        { name: 'motivo', label: 'Motivo', type: 'select', options: ['Reclamações recorrentes', 'Documentação vencida', 'Solicitação do profissional', 'Outro'], required: true },
        { name: 'obs', label: 'Observação', type: 'textarea', required: true, value: 'Três relatos de falta de retorno nos últimos 30 dias.' },
      ] });
    },
    'c1.proSuspSave': (v, x) => { const p = pro(x.id); p.status = 'Suspenso'; p.motivo = v.motivo + ': ' + v.obs; A.done(p.empresa + ' foi suspenso da vitrine.', 'Perfil suspenso da vitrine', p.id + ' · ' + v.motivo, 'warn'); },
    'c1.proReat': (ds) => { const p = pro(ds.id); A.confirm({ title: 'Reativar perfil', msg: 'Reativar <b>' + e(p.empresa) + '</b> na vitrine?', ok: 'Reativar', onOk: () => { p.status = 'Publicado'; A.done('Perfil reativado.', 'Perfil reativado na vitrine', p.id + ' · ' + p.empresa); } }); },
    'c1.proNovo': () => actions['c1.cadastro'](),
    'c1.proDet': (ds) => {
      const p = pro(ds.id);
      A.modal({ title: p.empresa, sub: p.nome + ' — ' + p.status, size: 'lg', body: '<div class="g2"><div>' + A.dl([['Nota', p.nota ? A.num(p.nota, 1) + ' (' + p.avals + ')' : '—'], ['Visualizações (30d)', A.num(p.views)], ['Contatos (total)', db().contatos.filter((c) => c.pro === p.id).length], ['Relatos', db().relatos.filter((r) => r.pro === p.id).length], ['Regiões', e(p.regioes.join(', '))], ['Serviços', e(activeSrv(p).map(srvName).join(', '))]]) + '</div><div>' + A.regionMap(p.regioes) + '</div></div>' });
    },
    'c1.fotoAprovar': (ds) => { const f = db().portfolio.find((x) => x.id === ds.id); f.status = 'Publicado'; f.moderadoEm = A.now(); A.done('Foto aprovada e publicada no portfólio.', 'Foto aprovada no portfólio', f.id + ' · ' + pro(f.pro).empresa); },
    'c1.fotoRecusar': (ds) => {
      const f = db().portfolio.find((x) => x.id === ds.id);
      A.form({ title: 'Recusar foto', submit: 'c1.modRecusar', extra: { tipo: 'foto', id: f.id }, submitLabel: 'Recusar', btnCls: 'dgs', icon: 'x', one: true, fields: [{ name: 'motivo', label: 'Motivo (enviado ao profissional)', type: 'select', required: true, value: f.img === 'obra' ? 'Marca d\'água ou telefone de terceiros' : '', options: ['Marca d\'água ou telefone de terceiros', 'Dados pessoais de cliente visíveis', 'Imagem não relacionada a calhas', 'Baixa qualidade'] }] });
    },
    'c1.avPublicar': (ds) => { const a = db().avaliacoes.find((x) => x.id === ds.id); a.status = 'Publicada'; a.moderadoEm = A.now(); const p = pro(a.pro); p.nota = Math.round(((p.nota * p.avals + a.nota) / (p.avals + 1)) * 10) / 10; p.avals += 1; A.done('Avaliação publicada no perfil.', 'Avaliação publicada', a.id + ' · ' + p.empresa); },
    'c1.avRecusar': (ds) => {
      const a = db().avaliacoes.find((x) => x.id === ds.id);
      A.form({ title: 'Recusar avaliação', submit: 'c1.modRecusar', extra: { tipo: 'aval', id: a.id }, submitLabel: 'Recusar', btnCls: 'dgs', icon: 'x', one: true, fields: [{ name: 'motivo', label: 'Motivo (enviado ao autor)', type: 'select', required: true, value: a.id === 'AV-06' ? 'Propaganda ou contato de terceiros' : '', options: ['Linguagem ofensiva', 'Propaganda ou contato de terceiros', 'Não relacionada ao serviço', 'Dados pessoais expostos'] }] });
    },
    'c1.modRecusar': (v, x) => {
      const d = db();
      const it = x.tipo === 'foto' ? d.portfolio.find((k) => k.id === x.id) : d.avaliacoes.find((k) => k.id === x.id);
      it.status = x.tipo === 'foto' ? 'Recusado' : 'Recusada'; it.motivo = v.motivo; it.moderadoEm = A.now();
      A.done((x.tipo === 'foto' ? 'Foto' : 'Avaliação') + ' recusada. O motivo foi registrado.', (x.tipo === 'foto' ? 'Foto recusada' : 'Avaliação recusada') + ' na moderação', it.id + ' · ' + v.motivo);
    },
    'c1.relVer': (ds) => {
      const r = db().relatos.find((x) => x.id === ds.id), p = pro(r.pro);
      A.modal({ title: 'Relato ' + r.id + ' — ' + r.tipo, sub: A.fdt(r.ts) + ' — ' + r.status, size: 'lg', body:
        A.dl([['Cliente', e(r.cliente) + ' (' + e(r.cidade) + ')'], ['Profissional', e(p.empresa) + ' — ' + e(p.tel)], ['Regiões atuais do perfil', e(p.regioes.join(', '))], ['Situação', A.badge(r.status)]]) +
        '<h4 style="margin:16px 0 6px">Relato do cliente</h4><div class="note neutral"><div>' + e(r.desc) + '</div></div>' +
        (r.parecer ? '<h4 style="margin:16px 0 6px">Parecer da AiCalhas</h4>' + A.dl([['Medida', e(r.medida)], ['Parecer', e(r.parecer)]], 'one') : '') +
        (r.status !== 'Concluído' && /cidade/i.test(r.tipo) ? '<div class="mt"></div>' + A.note('Sugestão: confirme com o profissional e atualize as regiões do perfil para evitar novos contatos sem resultado.', 'warn') : ''),
        foot: '<button class="btn" data-act="core.close">Fechar</button>' + (r.status !== 'Concluído' ? A.b('Atualizar perfil do profissional', 'c1.proGer', { id: p.id }, '', 'edit') + (r.status === 'Aberto' ? A.b('Iniciar apuração', 'c1.relApurar', { id: r.id }, '', 'search') : '') + A.b('Concluir relato', 'c1.relConcluir', { id: r.id }, 'ok', 'check') : '') });
    },
    'c1.relApurar': (ds) => { const r = db().relatos.find((x) => x.id === ds.id); r.status = 'Em apuração'; A.done('Apuração iniciada. O cliente vê o relato como “Em apuração”.', 'Apuração de relato iniciada', r.id); },
    'c1.relConcluir': (ds) => {
      const r = db().relatos.find((x) => x.id === ds.id);
      A.form({ title: 'Concluir relato ' + r.id, submit: 'c1.relConcluirSave', extra: { id: r.id }, submitLabel: 'Concluir relato', one: true, fields: [
        { name: 'medida', label: 'Medida adotada', type: 'select', required: true, options: ['Perfil atualizado', 'Orientação ao profissional', 'Suspensão do perfil', 'Sem procedência'], value: /cidade|desatualizad/i.test(r.tipo) ? 'Perfil atualizado' : 'Orientação ao profissional' },
        { name: 'parecer', label: 'Parecer (visível ao cliente)', type: 'textarea', required: true, value: /cidade/i.test(r.tipo) ? 'Confirmamos com o profissional e removemos a cidade do perfil. Obrigado por avisar!' : 'Entramos em contato com o profissional e registramos a orientação.' },
      ] });
    },
    'c1.relConcluirSave': (v, x) => { const r = db().relatos.find((k) => k.id === x.id); r.status = 'Concluído'; r.medida = v.medida; r.parecer = v.parecer; A.done('Relato concluído e cliente informado (simulação).', 'Relato concluído — ' + v.medida.toLowerCase(), r.id); },
    'c1.cliNovo': () => A.form({ title: 'Cadastrar cliente', submit: 'c1.cliNovoSave', fields: [
      { name: 'nome', label: 'Nome ou razão social', required: true, value: 'Otávio Mendes' },
      { name: 'tipo', label: 'Tipo', type: 'select', options: ['Residencial', 'Comercial', 'Condomínio'] },
      { name: 'tel', label: 'Telefone', type: 'tel', required: true, value: '(19) 98111-2233' },
      { name: 'email', label: 'E-mail', type: 'email', required: true, value: 'otavio.mendes@email.demo' },
      { name: 'cidade', label: 'Cidade', type: 'select', options: db().cidades },
      { name: 'bairro', label: 'Bairro', value: 'Centro' },
      { name: 'lgpd', type: 'check', text: 'Cliente autorizou o tratamento dos dados para uso da plataforma.', value: true, required: true },
    ] }),
    'c1.cliNovoSave': (v) => { const d = db(), id = A.nextId('CLI-', d.clientes); d.clientes.push({ id: id, nome: v.nome, tipo: v.tipo, tel: v.tel, email: v.email, cidade: v.cidade, bairro: v.bairro, endereco: '', desde: A.now(), prefContato: 'WhatsApp', lgpd: v.lgpd }); A.done('Cliente cadastrado.', 'Cliente cadastrado', id + ' · ' + v.nome); },
    'c1.cliVer': (ds) => {
      const c = db().clientes.find((x) => x.id === ds.id);
      const ct = db().contatos.filter((x) => x.cliente === c.nome);
      A.modal({ title: c.nome, sub: c.id + ' — ' + c.tipo, size: 'lg', body: A.dl([['Telefone', e(c.tel)], ['E-mail', e(c.email)], ['Endereço', e((c.endereco ? c.endereco + ' — ' : '') + c.bairro + ', ' + c.cidade)], ['Contato', e(c.contato || '—')]]) + '<h4 style="margin:16px 0 6px">Contatos gerados</h4>' + A.table([{ l: 'Data', f: (x) => A.fd(x.ts) }, { l: 'Profissional', f: (x) => e(pro(x.pro).empresa) }, { l: 'Serviço', f: (x) => e(srvName(x.srv)) }, { l: 'Retorno', f: (x) => A.badge(x.retorno) }], ct, { empty: 'Nenhum contato gerado por este cliente.' }) });
    },
    'c1.catNovo': () => A.form({ title: 'Cadastrar serviço', submit: 'c1.catSave', one: true, fields: [{ name: 'nome', label: 'Nome do serviço', required: true, value: 'Instalação de tela contra folhas' }, { name: 'desc', label: 'Descrição', type: 'textarea', required: true, value: 'Instalação de tela protetora para evitar entupimento por folhas.' }] }),
    'c1.catEdit': (ds) => { const s = db().servicos.find((x) => x.id === ds.id); A.form({ title: 'Editar serviço ' + s.id, submit: 'c1.catSave', extra: { id: s.id }, one: true, fields: [{ name: 'nome', label: 'Nome do serviço', required: true, value: s.nome }, { name: 'desc', label: 'Descrição', type: 'textarea', required: true, value: s.desc }] }); },
    'c1.catSave': (v, x) => {
      const d = db();
      if (x.id) { const s = d.servicos.find((k) => k.id === x.id); s.nome = v.nome; s.desc = v.desc; A.done('Serviço atualizado.', 'Serviço do catálogo atualizado', s.id + ' · ' + s.nome); return; }
      const id = 'SRV-' + String(d.servicos.length + 1).padStart(2, '0');
      d.servicos.push({ id: id, nome: v.nome, desc: v.desc, ativo: true });
      A.done('Serviço cadastrado no catálogo.', 'Serviço cadastrado no catálogo', id + ' · ' + v.nome);
    },
    'c1.catToggle': (ds) => { const s = db().servicos.find((x) => x.id === ds.id); s.ativo = !s.ativo; A.done('Serviço ' + (s.ativo ? 'ativado' : 'desativado') + '.', 'Serviço do catálogo ' + (s.ativo ? 'ativado' : 'desativado'), s.id + ' · ' + s.nome); },
    'c1.ctDet': (ds) => {
      const c = db().contatos.find((x) => x.id === ds.id), p = pro(c.pro);
      A.modal({ title: 'Contato ' + c.id, sub: A.fdt(c.ts) + ' — gerado pela vitrine', body: A.dl([['Cliente', e(c.cliente)], ['Cidade', e(c.cidade)], ['Profissional', e(p.empresa)], ['Serviço', e(srvName(c.srv))], ['Canal', e(c.canal)], ['Retorno informado', A.badge(c.retorno)]]) + '<h4 style="margin:16px 0 6px">Mensagem enviada</h4><div class="note neutral"><div>' + e(c.msg) + '</div></div><div class="mt"></div>' + A.note('Neste modelo, a AiCalhas registra o contato gerado. O andamento da negociação não é acompanhado.') });
    },
    'c1.regDet': (ds) => {
      const ps = db().pros.filter((p) => p.status === 'Publicado' && p.regioes.indexOf(ds.c) >= 0);
      A.modal({ title: 'Cobertura — ' + ds.c, sub: ps.length + ' profissional(is) publicado(s)', body: ps.length ? ps.map((p) => '<div class="li">' + A.av(p.empresa, p.cor) + '<div class="lt"><b>' + e(p.empresa) + '</b><small>' + e(activeSrv(p).map(srvName).join(', ')) + '</small></div>' + A.rating(p.nota) + '</div>').join('') : A.empty('Nenhum profissional publicado atende esta cidade.', 'pin') });
    },
  };

  /* ------------------------------------------------------------------
     Configuração do cenário
     ------------------------------------------------------------------ */
  const cntMod = () => db().portfolio.filter((x) => x.status === 'Em moderação').length + db().avaliacoes.filter((x) => x.status === 'Em moderação').length;
  A.start({
    id: 'c1', num: 1, title: 'Vitrine de profissionais',
    seed: seed, seedLogs: seedLogs, actions: actions,
    about: {
      level: 1,
      resumo: 'O cliente pesquisa profissionais por cidade e serviço, compara perfis, portfólios e avaliações e negocia diretamente com o instalador. A AiCalhas cuida da qualidade da vitrine.',
      como: ['O profissional se cadastra com dados, serviços, regiões, documentos e fotos.', 'A AiCalhas analisa o cadastro e publica o perfil na vitrine.', 'O cliente busca por cidade e serviço e compara os profissionais.', 'O cliente entra em contato diretamente (WhatsApp, telefone ou mensagem).', 'Preço, prazo, execução e pagamento são combinados entre cliente e profissional.', 'O cliente pode avaliar o profissional ou relatar problemas, que passam pela moderação.'],
      mediador: ['Analisa o cadastro antes de publicar', 'Confere se o portfólio atende às regras', 'Atualiza regiões atendidas e contatos', 'Modera avaliações e apura reclamações recebidas'],
      limite: 'a AiCalhas não participa da negociação, do orçamento, do pagamento nem da execução. O papel dela termina quando o contato é gerado; depois disso, atua apenas na moderação de avaliações e na apuração de relatos.',
      exemplo: 'Um instalador deixou de atender Hortolândia. Uma padaria relata que o contato não teve resultado; o mediador confirma com o profissional e atualiza as regiões do perfil para evitar novos contatos sem retorno.',
      painel: 'Profissionais, perfis, cadastros em análise, moderação de fotos e avaliações, relatos de clientes e contatos gerados. A venda de materiais pode existir como um botão separado.',
      perfil: {
        cliente: { t: 'Você escolhe e negocia diretamente com o profissional.', d: 'Pesquise, compare portfólios e avaliações e fale com o instalador. Preço, prazo e pagamento são combinados entre vocês.' },
        profissional: { t: 'Seu perfil é a sua vitrine.', d: 'Mantenha serviços, regiões e fotos atualizados. Cadastro e fotos passam pela análise da AiCalhas antes de aparecer para os clientes.' },
        mediador: { t: 'Você cuida da qualidade da vitrine.', d: 'Aprove cadastros, modere fotos e avaliações, apure relatos e acompanhe os contatos gerados. A negociação não passa por você.' },
      },
    },
    profiles: {
      cliente: {
        home: 'buscar',
        menu: [
          { sec: 'Vitrine' },
          { id: 'buscar', label: 'Buscar profissionais', icon: 'search', render: vBuscar },
          { id: 'contatos', label: 'Meus contatos', icon: 'chat', render: vCliContatos },
          { id: 'minhas', label: 'Avaliações e relatos', icon: 'star', render: vCliMinhas },
          { sec: 'Cadastro' },
          { id: 'dados', label: 'Meus dados', icon: 'user', render: vCliDados },
        ],
        hidden: { perfil: { title: 'Perfil do profissional', parent: 'buscar', render: vPerfil } },
      },
      profissional: {
        home: 'painel',
        menu: [
          { sec: 'Meu negócio' },
          { id: 'painel', label: 'Meu painel', icon: 'home', render: vProPainel },
          { id: 'contatos', label: 'Contatos recebidos', icon: 'chat', render: vProContatos, badge: () => db().contatos.filter((c) => c.pro === MYPRO && c.retorno === 'Aguardando retorno').length },
          { id: 'avaliacoes', label: 'Avaliações', icon: 'star', render: vProAvaliacoes },
          { sec: 'Perfil na vitrine' },
          { id: 'perfil', label: 'Meu perfil', icon: 'user', render: vProPerfil },
          { id: 'servicos', label: 'Serviços oferecidos', icon: 'tool', render: vProServicos },
          { id: 'regioes', label: 'Regiões atendidas', icon: 'pin', render: vProRegioes },
          { id: 'portfolio', label: 'Portfólio', icon: 'image', render: vProPortfolio },
          { sec: 'Demonstração' },
          { id: 'cadastro', label: 'Novo cadastro', icon: 'clipboard', render: vProCadastro },
        ],
      },
      mediador: {
        home: 'painel',
        menu: [
          { sec: 'Operação da vitrine' },
          { id: 'painel', label: 'Painel', icon: 'home', render: vMedPainel },
          { id: 'cadastros', label: 'Análise de cadastros', icon: 'clipboard', render: vMedCadastros, badge: () => db().pros.filter((p) => p.status === 'Em análise').length },
          { id: 'moderacao', label: 'Moderação', icon: 'image', render: vMedModeracao, badge: cntMod },
          { id: 'relatos', label: 'Relatos de clientes', icon: 'flag', render: vMedRelatos, badge: () => db().relatos.filter((r) => r.status !== 'Concluído').length },
          { sec: 'Cadastros' },
          { id: 'profissionais', label: 'Profissionais', icon: 'users', render: vMedProfissionais },
          { id: 'clientes', label: 'Clientes', icon: 'user', render: vMedClientes },
          { id: 'catalogo', label: 'Catálogo de serviços', icon: 'layers', render: vMedCatalogo },
          { sec: 'Gestão' },
          { id: 'relatorios', label: 'Relatórios', icon: 'chart', render: vMedRelatorios },
        ],
      },
    },
  });
})();
