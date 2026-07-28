#!/usr/bin/env node
/**
 * Gera o conteúdo de um novo mês com a API da Anthropic (Claude) e grava:
 *   - index.html            → novo bloco dentro de MESES (entre os marcadores MESES:START/END)
 *   - conteudo-<ano>-<mes>.md → todo o texto do mês, para copiar/colar
 *
 * O mês novo HERDA a estrutura do último mês preenchido (dias da semana, frequência,
 * mix de formatos, arco de objetivos). A ESTRATEGIA sobrepõe essa herança apenas
 * naquilo que ela mencionar. Sem ESTRATEGIA, a estrutura é replicada como está.
 *
 * Variáveis de ambiente:
 *   MES                (obrigatória)  ex.: "outubro", "10", "2026-10"
 *   ESTRATEGIA         (o comando)    texto livre: tema, frequência, dias, formatos, oferta...
 *   ANTHROPIC_API_KEY  (obrigatória no MODO=ia)
 *   ANO                (opcional)     default: ano do último mês cadastrado
 *   MODO               (opcional)     "ia" (padrão) gera o conteúdo · "vazio" só monta a grade
 *   ATE                (opcional)     só no MODO=vazio: monta a grade de MES até ATE
 *   APRENDIZADO        (opcional)     JSON exportado do "Banco de Aprendizado" do site
 *   MOCK=1             (opcional)     testa o fluxo inteiro sem chamar a API
 *
 * Uso local:
 *   ANTHROPIC_API_KEY=... MES=outubro ESTRATEGIA="foco em reels, 3x por semana" \
 *     node scripts/gerar-mes.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ARQ_HTML = path.join(RAIZ, 'index.html');
const MARCA_INICIO = '/* ==== MESES:START';
const MARCA_FIM = '/* ==== MESES:END ==== */';

const NOMES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const DOW = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

function erro(msg) {
  console.error('\n✖ ' + msg + '\n');
  process.exit(1);
}

/* ---------- entrada ---------- */

function parseMes(bruto) {
  const v = String(bruto || '').trim().toLowerCase();
  if (!v) erro('Informe o mês em MES (ex.: MES=outubro).');

  let m = v.match(/^(\d{4})-(\d{1,2})$/);
  if (m) return { mes: +m[2], ano: +m[1] };

  if (/^\d{1,2}$/.test(v)) return { mes: +v, ano: null };

  const semAcento = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const i = NOMES.findIndex((n) => semAcento(n) === semAcento(v));
  if (i >= 0) return { mes: i + 1, ano: null };

  erro(`Mês "${bruto}" não reconhecido. Use "outubro", "10" ou "2026-10".`);
}

/* ---------- leitura do index.html ---------- */

function lerMeses(html) {
  const ini = html.indexOf(MARCA_INICIO);
  const fim = html.indexOf(MARCA_FIM);
  if (ini < 0 || fim < 0 || fim < ini) {
    erro('Marcadores MESES:START / MESES:END não encontrados em index.html. ' +
      'Eles delimitam o bloco de dados e não podem ser removidos.');
  }
  const abre = html.indexOf('const MESES={', ini);
  const bloco = html.slice(abre, fim);
  let meses;
  try {
    meses = new Function(bloco + '; return MESES;')();
  } catch (e) {
    erro('Não consegui ler o bloco MESES de index.html: ' + e.message);
  }
  return { meses, fimIdx: fim };
}

/* ---------- calendário ---------- */

function montarCalendario(ano, mes) {
  const dias = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const firstDow = new Date(Date.UTC(ano, mes - 1, 1)).getUTCDay();
  const uteis = [];
  const finsDeSemana = [];
  for (let d = 1; d <= dias; d++) {
    const dow = (firstDow + (d - 1)) % 7;
    (dow === 0 || dow === 6 ? finsDeSemana : uteis).push({ dia: d, dow });
  }
  return { dias, firstDow, uteis, finsDeSemana };
}

/* ---------- feriados nacionais ---------- */

// Páscoa (Meeus/Jones/Butcher) — base dos feriados móveis
function pascoa(ano) {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(ano, mes - 1, dia));
}

function feriadosDoMes(ano, mes) {
  const fixos = {
    '1-1': 'Confraternização Universal', '4-21': 'Tiradentes', '5-1': 'Dia do Trabalho',
    '9-7': 'Independência', '10-12': 'Nossa Senhora Aparecida', '11-2': 'Finados',
    '11-15': 'Proclamação da República', '11-20': 'Consciência Negra', '12-25': 'Natal',
  };
  const out = [];
  for (const [k, nome] of Object.entries(fixos)) {
    const [m, d] = k.split('-').map(Number);
    if (m === mes) out.push({ dia: d, nome });
  }
  const p = pascoa(ano);
  const desloca = (dias) => new Date(p.getTime() + dias * 86400000);
  for (const [dt, nome] of [[desloca(-47), 'Carnaval'], [desloca(-2), 'Sexta-feira Santa'], [desloca(60), 'Corpus Christi']]) {
    if (dt.getUTCFullYear() === ano && dt.getUTCMonth() + 1 === mes) {
      out.push({ dia: dt.getUTCDate(), nome });
    }
  }
  return out.sort((a, b) => a.dia - b.dia);
}

/* ---------- mês vazio (sem API) ---------- */

// Ritmo semanal padrão dos slots. O formato de cada slot pode ser trocado na hora de preencher.
const RITMO = ['reel', 'carrossel', 'post', 'frase'];

function pecasVazias(cal) {
  return cal.uteis.map((u, i) => ({
    dia: u.dia,
    f: RITMO[i % RITMO.length],
    goal: '', t: '', legenda: '', tags: '', roteiro: '',
    design: { formato: '', estilo: '', texto: '', cores: '', elementos: '', acao: '' },
  }));
}

/* ---------- schema da resposta ---------- */

const S = (desc) => ({ type: 'string', description: desc });

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['plano', 'pecas', 'feriados'],
  properties: {
    plano: S('2 a 4 linhas: o que foi mantido da estrutura herdada e o que mudou por causa da estratégia deste mês.'),
    feriados: {
      type: 'array',
      description: 'Feriados nacionais brasileiros que caem neste mês. Vazio se não houver.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['dia', 'nome'],
        properties: {
          dia: { type: 'integer', description: 'Dia do mês (1-31)' },
          nome: S('Nome do feriado'),
        },
      },
    },
    pecas: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['dia', 'f', 'funil', 'goal', 't', 'objetivo', 'legenda', 'cta', 'tags', 'stories', 'conexao', 'roteiro', 'producao', 'design'],
        properties: {
          dia: { type: 'integer', description: 'Dia do mês em que a peça vai ao ar.' },
          f: { type: 'string', enum: ['post', 'carrossel', 'frase', 'reel'], description: 'Formato da peça' },
          funil: { type: 'string', enum: ['Atração', 'Consideração', 'Conversão', 'Relacionamento'], description: 'Etapa do funil' },
          goal: S('Objetivo curto no formato "Etapa · tema". Ex.: "Consideração · prova social"'),
          t: S('Título interno da peça (aparece no calendário)'),
          objetivo: S('2 a 4 linhas: o que esta peça precisa alcançar e por que ela está nesta data'),
          legenda: S('Legenda do post, pronta para publicar. Use \\n para quebras de linha'),
          cta: S('A chamada para ação, em uma frase'),
          tags: S('Hashtags separadas por espaço, começando com #'),
          stories: {
            type: 'array',
            description: '2 a 3 stories complementares. Ex.: "Story 1: enquete — ... | SIM / NÃO"',
            items: { type: 'string' },
          },
          conexao: {
            type: 'object', additionalProperties: false, required: ['de', 'para'],
            description: 'Lugar da peça na narrativa do mês',
            properties: {
              de: S('O que veio antes e como esta peça se conecta com aquilo'),
              para: S('O que vem depois e como esta peça prepara o terreno'),
            },
          },
          roteiro: S('SOMENTE se f="reel": texto corrido para teleprompter, só a fala, sem marcações de cena. Para os outros formatos, string vazia ""'),
          producao: {
            type: 'object', additionalProperties: false, required: ['corpo', 'edicao', 'thumb'],
            description: 'SOMENTE se f="reel". Para os outros formatos, todos os campos como string vazia "".',
            properties: {
              corpo: S('Enquadramento, linguagem corporal, tom e duração ideal'),
              edicao: S('Ambiente, iluminação, áudio, textos em tela, legendas, cortes'),
              thumb: S('Descrição da thumbnail: expressão, texto sobreposto, fundo, formato'),
            },
          },
          design: {
            type: 'object',
            additionalProperties: false,
            required: ['formato', 'estilo', 'texto', 'cores', 'elementos', 'acao'],
            description: 'SOMENTE se f != "reel". Para reel, todos os campos como string vazia "".',
            properties: {
              formato: S('Ex.: "Carrossel · 6 slides · 1080×1350px (4:5)"'),
              estilo: S('Direção visual em uma frase'),
              texto: S('Texto exato que vai na arte. Em carrossel, um slide por linha (S1..S6)'),
              cores: S('Paleta e onde aplicar'),
              elementos: S('Ícones, grafismos, assinatura'),
              acao: S('O que o designer precisa executar'),
            },
          },
        },
      },
    },
  },
};

/* ---------- prompt ---------- */

/**
 * Lê a estrutura do mês de referência: em que dias da semana sai conteúdo,
 * com que frequência, em que mix de formatos e em que arco narrativo.
 * É isso que o mês novo herda quando a estratégia não pede outra coisa.
 */
function descreverEstrutura(mesRef, chaveRef) {
  const dias = Object.keys(mesRef.data).map(Number).sort((a, b) => a - b);
  const porDow = {}, porFormato = {}, arco = [];
  for (const d of dias) {
    const it = mesRef.data[String(d).padStart(2, '0')];
    const dow = (mesRef.firstDow + (d - 1)) % 7;
    (porDow[dow] = porDow[dow] || []).push(it.f);
    porFormato[it.f] = (porFormato[it.f] || 0) + 1;
    if (it.goal) arco.push(it.goal);
  }
  const dowUsados = Object.keys(porDow).map(Number).sort();
  const semanas = Math.max(1, Math.round(mesRef.dias / 7));

  const L = [];
  L.push(`- Volume: **${dias.length} peças** em ${mesRef.dias} dias (~${(dias.length / semanas).toFixed(1)} por semana).`);
  L.push(`- Dias da semana usados: **${dowUsados.map((d) => DOW[d]).join(', ')}**.` +
    (dowUsados.some((d) => d === 0 || d === 6) ? '' : ' Nada em sábado e domingo.'));
  L.push(`- Cadência: ${dias.length === new Set(dias).size && dias.length >= semanas * 4 ? 'uma peça por dia útil, sem pular dias' : 'ver distribuição acima'}.`);
  L.push(`- Mix de formatos: ${Object.entries(porFormato).sort((a, b) => b[1] - a[1]).map(([f, n]) => `${n} ${f}`).join(' · ')}.`);
  L.push(`- Rodízio por dia da semana: ` + dowUsados
    .map((d) => `${DOW[d]} → ${[...new Set(porDow[d])].join('/')}`).join(' · ') + '.');
  if (arco.length) {
    L.push(`- Arco dos objetivos, na ordem em que apareceram em ${chaveRef}:`);
    L.push('  ' + arco.join(' → '));
  }
  return L.join('\n');
}

function montarPrompt({ ano, mes, nomeMes, cal, referencia, refKey, mesRef, estrategia, aprendizado }) {
  const listaUteis = cal.uteis
    .map((u) => `${u.dia} (${DOW[u.dow]})`)
    .join(', ');
  const listaFds = cal.finsDeSemana.map((u) => u.dia).join(', ');
  const feriados = feriadosDoMes(ano, mes);

  const partes = [];

  partes.push(`# Tarefa

Você é o estrategista de conteúdo da HUBIX, uma empresa de BPO Financeiro (terceirização do financeiro).

Monte o calendário editorial de Instagram de **${nomeMes} de ${ano}**.

## Público e objetivo
- Público: donos e gestores de empresas de **mídia exterior** (outdoor, painéis de LED, mobiliário urbano, empenas).
- Objetivo único do mês: **aquisição de novos clientes** para o BPO Financeiro da HUBIX.
- Dores reais desse público: fluxo de caixa apertado apesar do faturamento alto, prazos de locação x prazos de pagamento, confusão tributária (ISS x ICMS), inadimplência de locação, não saber a margem real por ponto de mídia, dono preso na planilha em vez de vendendo.
- Tom de voz: profissional e direto. Sem jargão de guru, sem promessa milagrosa, sem emoji em excesso.

## O calendário de ${nomeMes}/${ano}
- O mês tem ${cal.dias} dias. O dia 1 cai numa ${DOW[cal.firstDow]}.
- Dias úteis: ${listaUteis}.
- Fins de semana: ${listaFds || '—'}.
- Feriados nacionais: ${feriados.length ? feriados.map((f) => `${f.dia} (${f.nome})`).join(', ') : 'nenhum'}.

## Regras obrigatórias
1. **Formato dos campos.** Reel (\`f: "reel"\`) → preencha \`roteiro\` com a fala em **texto corrido**, pronta para teleprompter (só o que a pessoa fala: sem "CENA 1", sem corte, sem descrição de imagem) **e** \`producao\` com enquadramento, edição e thumbnail; deixe todos os campos de \`design\` vazios. Post, carrossel e frase → preencha \`design\` completo e deixe \`roteiro\` e \`producao\` vazios.
1b. **Toda peça, sem exceção**, leva \`objetivo\`, \`funil\`, \`cta\`, \`stories\` e \`conexao\` preenchidos. \`conexao\` amarra a peça na narrativa: de onde ela vem e o que ela prepara. Em carrossel, \`design.texto\` traz **slide a slide** (CAPA, S2, S3… e o slide de CTA).
2. Um dia não pode aparecer duas vezes. Todo dia usado tem que existir no mês (1 a ${cal.dias}).
3. Se um feriado cair num dia com conteúdo, a peça daquele dia conversa com a data — de forma sóbria, sem clichê. Preencha também o campo \`feriados\` da resposta.
4. **Nunca invente números, percentuais ou resultados de clientes.** Se uma peça pedir um dado real (case, redução de inadimplência, economia), escreva literalmente \`[INSERIR NÚMERO REAL]\` no lugar do número — na legenda e no briefing.
5. Temas e ângulos precisam ser **novos**. Repetir a estrutura não é repetir o assunto.
6. Escreva tudo em português do Brasil.
7. No campo \`plano\`, resuma em 2 a 4 linhas o que você fez: o que manteve da estrutura herdada e o que mudou por causa da estratégia deste mês.`);

  partes.push(`## Estrutura herdada de ${refKey}

${descreverEstrutura(mesRef, refKey)}

**Regra de herança:** replique essa estrutura em ${nomeMes} — mesmos dias da semana, mesma frequência, mesmo mix de formatos, mesmo arco de objetivos, adaptando as datas ao calendário de ${nomeMes}.
**Só altere o que a estratégia abaixo pedir explicitamente.** Se a estratégia não falar de dias, frequência ou formatos, não mexa neles.`);

  partes.push(`## Referência de estilo — mês já aprovado (${refKey})

Use isto como padrão de profundidade, tom e formato dos campos. **Não repita os mesmos temas**: ${nomeMes} precisa de ângulos novos.

\`\`\`json
${JSON.stringify(referencia, null, 1)}
\`\`\``);

  if (aprendizado && aprendizado.length) {
    const motivos = aprendizado
      .map((e) => `- [${e.formato || '?'}] "${e.titulo || ''}" → recusado porque: ${e.motivo}`)
      .join('\n');
    partes.push(`## Aprendizado — o que o cliente já recusou

Estes conteúdos foram reprovados. Leia os motivos, identifique o padrão e **não repita o erro** em ${nomeMes}.

${motivos}`);
  }

  if (estrategia && estrategia.trim()) {
    partes.push(`## ESTRATÉGIA DE ${nomeMes.toUpperCase()} — comando do cliente

Este é o pedido. Ele tem prioridade sobre a estrutura herdada em tudo que mencionar.
Onde ele for omisso, vale a estrutura herdada.

"""
${estrategia.trim()}
"""`);
  } else {
    partes.push(`## Estratégia de ${nomeMes}

Nenhuma instrução específica foi dada. **Replique a estrutura herdada exatamente** —
mesmos dias da semana, mesma frequência, mesmo mix de formatos, mesmo arco —
mudando apenas os temas, ângulos e textos, que precisam ser novos.`);
  }

  partes.push(`Responda apenas com o JSON no schema definido.`);
  return partes.join('\n\n');
}

/* ---------- serialização ---------- */

function limparParaScript(s) {
  // impede que uma string feche a tag <script> do index.html
  return s.replace(/<\//g, '<\\/');
}

function montarObjetoMes({ nomeMes, ano, mes, cal, feriados, pecas, vazio }) {
  const data = {};
  for (const p of pecas.sort((a, b) => a.dia - b.dia)) {
    const item = vazio
      ? { vazio: 1, f: p.f, goal: '', t: '', legenda: '', tags: '' }
      : {
        f: p.f, funil: p.funil, goal: p.goal, t: p.t,
        objetivo: p.objetivo, legenda: p.legenda, cta: p.cta, tags: p.tags,
        stories: p.stories || [], conexao: p.conexao || { de: '', para: '' },
      };
    if (p.f === 'reel') {
      item.roteiro = vazio ? '' : p.roteiro;
      if (!vazio && p.producao) item.producao = p.producao;
    } else {
      item.design = vazio
        ? { formato: '', estilo: '', texto: '', cores: '', elementos: '', acao: '' }
        : p.design;
    }
    data[String(p.dia).padStart(2, '0')] = item;
  }
  const fer = {};
  for (const f of feriados) fer[String(f.dia).padStart(2, '0')] = f.nome;

  return {
    nome: nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1),
    ano,
    mes,
    dias: cal.dias,
    firstDow: cal.firstDow,
    feriados: fer,
    data,
  };
}

function inserirNoHtml(html, chave, objMes) {
  const fim = html.indexOf(MARCA_FIM);
  const fecha = html.lastIndexOf('};', fim);
  if (fecha < 0) erro('Não encontrei o fechamento do objeto MESES em index.html.');

  const entrada = limparParaScript(
    `'${chave}':` + JSON.stringify(objMes, null, 1)
  );
  return html.slice(0, fecha) + ',\n' + entrada + '\n' + html.slice(fecha);
}

/* ---------- markdown ---------- */

function montarMarkdown({ chave, objMes }) {
  const L = [];
  const vazio = Object.values(objMes.data).every((i) => i.vazio);
  L.push(`# ${vazio ? 'Estrutura' : 'Conteúdo'} — ${objMes.nome} ${objMes.ano} · HUBIX BPO Financeiro`);
  L.push('');
  L.push(`Nicho: mídia exterior. Objetivo: aquisição de novos clientes.`);
  L.push('');
  if (vazio) {
    L.push(`> Grade montada, conteúdo a preencher. Um slot por dia útil; feriados marcados.`);
    L.push(`> Preencha aqui e depois espelhe no bloco \`'${chave}'\` de \`index.html\`,`);
    L.push(`> ou peça ao Claude Code para preencher a partir deste arquivo.`);
    L.push('');
    const fer = Object.entries(objMes.feriados || {});
    if (fer.length) {
      L.push(`**Feriados do mês:** ` + fer.map(([d, n]) => `${parseInt(d, 10)} — ${n}`).join(' · '));
      L.push('');
    }
  }
  const rotulo = { post: 'Post', carrossel: 'Carrossel', frase: 'Frase', reel: 'Reel' };
  const ph = (v, dica) => (v && v.trim() ? v : `_(preencher: ${dica})_`);
  // ordem numérica explícita: em JS as chaves "10".."31" são índices inteiros
  // e vêm antes de "01".."09", que são chaves de texto.
  const emOrdem = Object.entries(objMes.data).sort((a, b) => Number(a[0]) - Number(b[0]));
  for (const [dia, it] of emOrdem) {
    const d = parseInt(dia, 10);
    const dow = DOW[(objMes.firstDow + (d - 1)) % 7];
    const feriado = objMes.feriados && objMes.feriados[dia];
    L.push(`## ${d}/${String(objMes.mes).padStart(2, '0')} · ${dow} · ${rotulo[it.f]}` +
      (feriado ? ` · 🇧🇷 ${feriado}` : ''));
    L.push('');
    L.push(`**${ph(it.t, 'título da peça')}**  `);
    L.push(`_${ph(it.goal, 'objetivo, ex.: "Atenção · dor"')}_` + (it.funil ? ` · **${it.funil}**` : ''));
    L.push('');
    if (it.objetivo) { L.push('> ' + it.objetivo.replace(/\n/g, '\n> ')); L.push(''); }
    L.push('**Legenda**');
    L.push('');
    L.push(ph(it.legenda, 'texto do post + CTA'));
    L.push('');
    if (it.roteiro !== undefined) {
      L.push('**Roteiro (teleprompter)**');
      L.push('');
      L.push(ph(it.roteiro, 'fala corrida, sem marcação de cena'));
      L.push('');
    }
    if (it.producao) {
      L.push('**Gravação e edição**');
      L.push('');
      for (const [k, v] of [['Corpo e enquadramento', it.producao.corpo],
        ['Produção e edição', it.producao.edicao], ['Thumbnail', it.producao.thumb]]) {
        if (v) { L.push(`- **${k}:** ${v}`); }
      }
      L.push('');
    }
    if (it.design) {
      L.push('**Briefing de design**');
      L.push('');
      L.push(`| Campo | Conteúdo |`);
      L.push(`|---|---|`);
      const linhas = [
        ['Formato', it.design.formato, 'ex.: Carrossel · 6 slides · 1080×1350'],
        ['Estilo', it.design.estilo, 'direção visual em uma frase'],
        ['Texto na arte', it.design.texto, 'um slide por linha'],
        ['Cores', it.design.cores, 'paleta e onde aplicar'],
        ['Elementos', it.design.elementos, 'ícones, grafismos, assinatura'],
        ['O que fazer', it.design.acao, 'o que o designer executa'],
      ];
      for (const [k, v, dica] of linhas) {
        const val = v && v.trim() ? String(v) : `_(preencher: ${dica})_`;
        L.push(`| ${k} | ${val.replace(/\n/g, '<br>').replace(/\|/g, '\\|')} |`);
      }
      L.push('');
    }
    if (it.cta) { L.push(`**CTA:** ${it.cta}`); L.push(''); }
    L.push(it.tags && it.tags.trim() ? `\`${it.tags}\`` : '_(preencher: 5 a 6 hashtags)_');
    L.push('');
    if (it.stories && it.stories.length) {
      L.push('**Stories**');
      L.push('');
      it.stories.forEach((s) => L.push(`- ${s}`));
      L.push('');
    }
    if (it.conexao && (it.conexao.de || it.conexao.para)) {
      if (it.conexao.de) L.push(`_Vem de:_ ${it.conexao.de}  `);
      if (it.conexao.para) L.push(`_Prepara:_ ${it.conexao.para}`);
      L.push('');
    }
    L.push('---');
    L.push('');
  }
  return L.join('\n');
}

/* ---------- main ---------- */

async function main() {
  const MODO = (process.env.MODO || 'ia').trim().toLowerCase();
  if (!['vazio', 'ia'].includes(MODO)) erro(`MODO inválido: "${MODO}". Use "vazio" ou "ia".`);

  const html = fs.readFileSync(ARQ_HTML, 'utf8');
  const { meses } = lerMeses(html);
  const existentes = Object.keys(meses).sort();
  if (!existentes.length) erro('Nenhum mês de referência encontrado em index.html.');

  const pedido = parseMes(process.env.MES);
  const ultimo = meses[existentes[existentes.length - 1]];
  const ano = process.env.ANO ? parseInt(process.env.ANO, 10) : (pedido.ano ?? ultimo.ano);
  const mes = pedido.mes;
  if (!(mes >= 1 && mes <= 12)) erro(`Mês inválido: ${mes}`);
  if (!(ano >= 2024 && ano <= 2100)) erro(`Ano inválido: ${ano}`);

  /* ===== MODO VAZIO: monta a grade de um ou vários meses, sem API ===== */
  if (MODO === 'vazio') {
    let alvos = [{ ano, mes }];
    if (process.env.ATE && process.env.ATE.trim()) {
      const p2 = parseMes(process.env.ATE);
      const anoFim = p2.ano ?? ano;
      const inicio = ano * 12 + (mes - 1);
      const fim = anoFim * 12 + (p2.mes - 1);
      if (fim < inicio) erro(`ATE (${NOMES[p2.mes - 1]}/${anoFim}) vem antes de MES (${NOMES[mes - 1]}/${ano}).`);
      if (fim - inicio > 23) erro('Intervalo grande demais — no máximo 24 meses por execução.');
      alvos = [];
      for (let n = inicio; n <= fim; n++) alvos.push({ ano: Math.floor(n / 12), mes: (n % 12) + 1 });
    }

    const feitos = [];
    const pulados = [];
    for (const alvo of alvos) {
      const ch = `${alvo.ano}-${String(alvo.mes).padStart(2, '0')}`;
      const nm = NOMES[alvo.mes - 1];
      if (meses[ch]) { pulados.push(`${nm}/${alvo.ano} (já existe)`); continue; }
      const c = montarCalendario(alvo.ano, alvo.mes);
      const fer = feriadosDoMes(alvo.ano, alvo.mes);
      console.log(`▸ ${nm}/${alvo.ano}: ${c.dias} dias, ${c.uteis.length} dias úteis` +
        (fer.length ? `, feriados: ${fer.map((f) => f.dia + ' ' + f.nome).join(', ')}` : ''));
      feitos.push(gravar({
        chave: ch, nomeMes: nm, ano: alvo.ano, mes: alvo.mes, cal: c,
        feriados: fer, pecas: pecasVazias(c), usage: {}, vazio: true,
      }));
      meses[ch] = true; // evita duplicar dentro do mesmo laço
    }
    if (pulados.length) console.log('▸ pulados: ' + pulados.join(', '));
    if (!feitos.length) erro('Nenhum mês novo para criar — todos já existem no calendário.');
    publicarSaidas(feitos);
    return;
  }

  /* ===== MODO IA: gera o conteúdo de um mês com o Claude ===== */
  if (!process.env.ANTHROPIC_API_KEY) {
    erro('ANTHROPIC_API_KEY não definida. No GitHub: Settings → Secrets and variables → Actions → New repository secret.');
  }

  const chave = `${ano}-${String(mes).padStart(2, '0')}`;
  const nomeMes = NOMES[mes - 1];
  if (meses[chave]) {
    const jaVazio = Object.values(meses[chave].data).every((i) => i.vazio);
    erro(`${nomeMes} de ${ano} já existe no calendário` +
      (jaVazio ? ' (como estrutura vazia).' : '.') +
      ` Apague o bloco '${chave}' de index.html — entre os marcadores MESES:START/END — e rode de novo.`);
  }

  const cal = montarCalendario(ano, mes);
  // referência de estilo: o último mês que realmente tem conteúdo
  const refKey = [...existentes].reverse()
    .find((k) => Object.values(meses[k].data).some((i) => !i.vazio));
  if (!refKey) erro('Nenhum mês preenchido para servir de referência de estilo.');
  const referencia = meses[refKey].data;

  let aprendizado = [];
  if (process.env.APRENDIZADO && process.env.APRENDIZADO.trim()) {
    try {
      const bruto = JSON.parse(process.env.APRENDIZADO);
      if (Array.isArray(bruto)) aprendizado = bruto.filter((e) => e && e.motivo);
    } catch {
      console.warn('⚠ APRENDIZADO não é um JSON válido — ignorando.');
    }
  }

  const estrategia = process.env.ESTRATEGIA || process.env.OBSERVACOES || '';

  const prompt = montarPrompt({
    ano, mes, nomeMes, cal, referencia, refKey,
    mesRef: meses[refKey],
    estrategia,
    aprendizado,
  });

  console.log(`▸ Gerando ${nomeMes}/${ano} — ${cal.dias} dias, ${cal.uteis.length} dias úteis`);
  console.log(`▸ Estrutura e estilo herdados de: ${refKey}`);
  console.log(estrategia.trim()
    ? `▸ Estratégia informada (${estrategia.trim().length} caracteres) — vai sobrepor a herança onde mencionar`
    : `▸ Sem estratégia informada — replicando a estrutura de ${refKey}`);
  if (aprendizado.length) console.log(`▸ ${aprendizado.length} recusa(s) no aprendizado`);

  // DEBUG_PROMPT=1 mostra exatamente o que seria enviado, sem gastar API
  if (process.env.DEBUG_PROMPT === '1') {
    console.log('\n' + '─'.repeat(70) + '\n' + prompt + '\n' + '─'.repeat(70));
    return;
  }

  // MOCK=1 testa o encanamento inteiro (validação, escrita, markdown) sem chamar a API.
  if (process.env.MOCK === '1') {
    console.log('▸ MOCK=1 — reaproveitando o mês de referência, sem chamar a API');
    const base = Object.values(referencia);
    const pecasMock = cal.uteis.slice(0, base.length).map((u, i) => {
      const b = base[i];
      return {
        dia: u.dia, f: b.f, funil: b.funil || 'Consideração', goal: b.goal, t: '[MOCK] ' + b.t,
        objetivo: b.objetivo || '[MOCK] objetivo da peça',
        legenda: b.legenda, cta: b.cta || '[MOCK] chamada para ação', tags: b.tags,
        stories: b.stories && b.stories.length ? b.stories : ['[MOCK] Story 1'],
        conexao: b.conexao || { de: '[MOCK] anterior', para: '[MOCK] próximo' },
        roteiro: b.roteiro || '',
        producao: b.producao || (b.roteiro ? { corpo: '[MOCK] enquadramento', edicao: '[MOCK] edição', thumb: '[MOCK] thumb' } : { corpo: '', edicao: '', thumb: '' }),
        design: b.design || { formato: '', estilo: '', texto: '', cores: '', elementos: '', acao: '' },
      };
    });
    const rMock = gravar({ chave, nomeMes, ano, mes, cal,
      feriados: feriadosDoMes(ano, mes), pecas: pecasMock, usage: {} });
    publicarSaidas([rMock], 'Execução MOCK — conteúdo falso, só para testar o fluxo.');
    return;
  }

  const client = new Anthropic();

  // Streaming: max_tokens alto (pensamento + resposta) não cabe numa request não-streaming.
  // fallbacks:"default" faz a API reprocessar num modelo alternativo se um classificador
  // recusar o pedido. Se a API rejeitar esta beta, veja a dica no catch abaixo.
  const stream = client.beta.messages.stream({
    model: 'claude-opus-5',
    max_tokens: 64000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: {
      effort: 'high',
      format: { type: 'json_schema', schema: SCHEMA },
    },
    messages: [{ role: 'user', content: prompt }],
  });

  stream.on('text', () => process.stdout.write('.'));
  const resposta = await stream.finalMessage();
  process.stdout.write('\n');

  if (resposta.stop_reason === 'refusal') {
    erro('Claude recusou o pedido (stop_reason: refusal). ' +
      (resposta.stop_details?.explanation || 'Revise as OBSERVACOES e tente de novo.'));
  }
  if (resposta.stop_reason === 'max_tokens') {
    erro('A resposta foi cortada por max_tokens. Aumente max_tokens em scripts/gerar-mes.mjs.');
  }

  const bloco = resposta.content.find((b) => b.type === 'text');
  if (!bloco) erro('A API não devolveu texto. stop_reason: ' + resposta.stop_reason);

  let saida;
  try {
    saida = JSON.parse(bloco.text);
  } catch (e) {
    erro('Resposta não é JSON válido: ' + e.message);
  }

  if (saida.plano) {
    console.log('\n── Plano do mês ──\n' + saida.plano.trim() + '\n');
  }

  const r = gravar({
    chave, nomeMes, ano, mes, cal,
    feriados: saida.feriados || [],
    pecas: saida.pecas || [],
    usage: resposta.usage || {},
  });
  publicarSaidas([r], saida.plano || '');
  return;
}

/* ---------- validação + gravação ---------- */

function gravar({ chave, nomeMes, ano, mes, cal, feriados, pecas, usage, vazio }) {
  const html = fs.readFileSync(ARQ_HTML, 'utf8');
  const vistos = new Set();
  const uteisSet = new Set(cal.uteis.map((u) => u.dia));
  const problemas = [];
  const avisos = [];

  for (const p of pecas) {
    if (!Number.isInteger(p.dia) || p.dia < 1 || p.dia > cal.dias) {
      problemas.push(`dia ${p.dia} fora de 1–${cal.dias}`); continue;
    }
    if (vistos.has(p.dia)) { problemas.push(`dia ${p.dia} duplicado`); continue; }
    vistos.add(p.dia);
    // fim de semana é aviso, não erro: a estratégia do mês pode ter pedido
    if (!uteisSet.has(p.dia)) avisos.push(`dia ${p.dia} cai em fim de semana`);
    if (vazio) continue; // slot reservado: só a grade importa
    if (p.f === 'reel' && !p.roteiro.trim()) problemas.push(`dia ${p.dia}: reel sem roteiro`);
    if (p.f === 'reel' && !(p.producao && p.producao.corpo.trim())) problemas.push(`dia ${p.dia}: reel sem orientação de gravação`);
    if (p.f !== 'reel' && !p.design.formato.trim()) problemas.push(`dia ${p.dia}: ${p.f} sem briefing de design`);
    if (!p.legenda.trim() || !p.t.trim()) problemas.push(`dia ${p.dia}: título ou legenda vazios`);
    if (!p.objetivo.trim()) problemas.push(`dia ${p.dia}: sem objetivo`);
    if (!p.cta.trim()) problemas.push(`dia ${p.dia}: sem CTA`);
    if (!p.stories || !p.stories.length) problemas.push(`dia ${p.dia}: sem stories`);
  }
  if (!pecas.length) problemas.push('nenhuma peça na resposta');
  if (problemas.length) {
    erro('A resposta não passou na validação:\n  - ' + problemas.join('\n  - '));
  }
  if (avisos.length) console.log('⚠ ' + avisos.join('\n⚠ '));

  /* ----- gravação ----- */
  const objMes = montarObjetoMes({ nomeMes, ano, mes, cal, feriados, pecas, vazio });
  const novoHtml = inserirNoHtml(html, chave, objMes);

  // confere que o resultado ainda é JS válido antes de salvar
  const { meses: conferencia } = lerMeses(novoHtml);
  if (!conferencia[chave]) erro('Falha ao inserir o mês em index.html (bloco não relido).');

  fs.writeFileSync(ARQ_HTML, novoHtml, 'utf8');

  const arqMd = path.join(RAIZ, `conteudo-${chave}.md`);
  fs.writeFileSync(arqMd, montarMarkdown({ chave, objMes }), 'utf8');

  const u = usage || {};
  console.log(`✔ ${objMes.nome}/${ano}: ${pecas.length} ${vazio ? 'slots reservados' : 'peças gravadas'}`);
  console.log(`  index.html            (bloco '${chave}')`);
  console.log(`  conteudo-${chave}.md`);
  if (!vazio) console.log(`  tokens: ${u.input_tokens ?? '?'} entrada / ${u.output_tokens ?? '?'} saída`);
  return { chave, rotulo: `${objMes.nome} ${ano}`, pecas: pecas.length };
}

function publicarSaidas(resultados, plano = '') {
  if (!process.env.GITHUB_OUTPUT || !resultados.length) return;
  const chaves = resultados.map((r) => r.chave).join(' ');
  const rotulos = resultados.map((r) => r.rotulo).join(', ');
  const total = resultados.reduce((s, r) => s + r.pecas, 0);
  const delim = 'EOF_' + Math.random().toString(36).slice(2);
  fs.appendFileSync(process.env.GITHUB_OUTPUT,
    `chave=${resultados[0].chave}\nchaves=${chaves}\nrotulo=${rotulos}\npecas=${total}\n` +
    `plano<<${delim}\n${plano.trim()}\n${delim}\n`);
}

main().catch((e) => {
  const msg = String(e?.message || e);
  if (/fallback|server-side-fallback|beta/i.test(msg)) {
    console.error('\nDica: a API rejeitou o parâmetro de fallback. Em scripts/gerar-mes.mjs, ' +
      'apague as linhas `betas: [...]` e `fallbacks: \'default\',` e troque ' +
      '`client.beta.messages.stream` por `client.messages.stream`.');
  }
  erro(msg);
});
