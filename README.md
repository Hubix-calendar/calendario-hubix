# 📅 Calendário Editorial — HUBIX BPO Financeiro

**No ar:** <https://hubix-calendar.github.io/calendario-hubix/>

Site pronto para distribuir ao cliente. Calendário mensal **estilo Apple, minimalista**, focado em **aquisição de novos clientes de mídia exterior** (outdoor, painéis, mobiliário urbano).

- **Vários meses no mesmo site** — setas `‹ ›` ao lado do nome do mês. Cada mês tem link direto (`.../#2026-09`)
- Grade do **mês inteiro**; dias com conteúdo têm marcador colorido por formato
- **Clique no dia → popup** com o conteúdo:
  - **Reel/vídeo:** roteiro de gravação (cena, áudio, texto na tela) + descrição do post
  - **Arte/imagem (Post, Carrossel, Frase):** briefing de design (formato, estilo, texto na arte, cores, elementos, o que o design deve fazer)
- Roteiros de Reel em **texto corrido, prontos para teleprompter** (só a fala).
- **Aprovar / Recusar** dentro do popup. Ao recusar, abre campo para explicar o motivo. A decisão fica salva no navegador e marca o dia com ✓ ou ✕.
- **🧠 Banco de Aprendizado** (botão no canto inferior): toda recusa é registrada, o sistema extrai os **padrões recorrentes** dos motivos e permite exportar a base (JSON).
- Setembro/2026: **22 peças** — 6 Reels · 6 Frases · 5 Posts · 5 Carrosséis
- Arquivo único (`index.html`), responsivo, tema claro/escuro
- Aprovações ficam salvas **por mês** no navegador; o Banco de Aprendizado é único e soma todos os meses

## 🎨 Identidade Visual da HUBIX (tela de instalação)

No primeiro acesso o site abre a tela **"Identidade Visual da HUBIX"** (a "ID" da marca). Reabre a qualquer momento no botão **⚙** no topo. Captura e aplica:

- **Nome** da marca
- **Logo** (upload PNG/SVG — vem com o logo verde da HUBIX embutido por padrão)
- **Cor primária** e **cor de destaque** (padrão: verde HUBIX `#01B671` / `#0CA678`)
- **Slogan** (opcional)
- **Tom de voz** (padrão: *Profissional e direto*)

Tudo fica salvo **só no navegador** (localStorage). As cores mudam o tema do calendário na hora.

## 🤖 Gerar um mês novo — você escreve a estratégia, o sistema executa

Você não edita código. Escreve **como quer o mês** num campo de texto e o site atualiza sozinho.

### A regra de herança

O mês novo **herda a estrutura do último mês preenchido**: mesmos dias da semana,
mesma frequência, mesmo mix de formatos, mesmo arco de objetivos.

- **Campo de estratégia em branco** → replica a estrutura exatamente, só com temas e ângulos novos.
- **Campo preenchido** → o que você escrever tem prioridade. O resto continua herdado.

Você escreve em português corrido, como pediria a um estrategista:

> *"Fevereiro é mês curto e de retomada. Quero 3 posts por semana em vez de 5,
> só segunda, quarta e sexta. Puxa mais reel e menos frase. Tema central:
> planejamento tributário para o ano novo. Na última semana, empurra o
> diagnóstico gratuito com prazo."*

O sistema devolve, no resumo da execução, **o que manteve e o que mudou** por causa do seu pedido.

### Configuração — uma vez só

1. Pegue uma chave em [console.anthropic.com](https://console.anthropic.com) → **API Keys** → *Create Key*
2. No repositório: **Settings → Secrets and variables → Actions → New repository secret**
   - Name: `ANTHROPIC_API_KEY`
   - Secret: cole a chave
3. Confira **Settings → Actions → General → Workflow permissions** = **Read and write permissions**
   (sem isso o robô não consegue publicar o commit)

### Gerar o mês

Aba **Actions** → **Novo mês do calendário** → **Run workflow**:

| Campo | O que colocar |
|---|---|
| **mes** | `outubro`, `novembro`, ou `2027-01` |
| **estrategia** | **o comando.** Como você quer o mês. Em branco = repete a estrutura do mês anterior |
| **ano** | em branco usa o ano do último mês cadastrado |
| **modo** | `ia` escreve o conteúdo · `vazio` só monta a grade pra preencher à mão |
| **ate** | só no modo `vazio` — monta a grade de vários meses de uma vez |
| **aprendizado** | opcional — cole o JSON do botão **🧠 → Copiar base** do site |
| **mock** | marque para **testar sem gastar API** |

Leva ~2–4 min. O resumo da execução traz o link direto do mês e o plano do que mudou.

O que o script garante sozinho, sem você pedir:

- Grade certa do mês (nº de dias, dia da semana do 1º), calculada — não chutada
- **Feriados nacionais** marcados, incluindo os móveis (Carnaval, Sexta-feira Santa, Corpus Christi)
- Reel sai com **roteiro corrido de teleprompter**; post, carrossel e frase saem com **briefing de design**
- **Proibido inventar número** — onde precisaria de um dado real, escreve `[INSERIR NÚMERO REAL]`
- Valida antes de gravar: dia repetido, dia inexistente, reel sem roteiro, arte sem briefing.
  Se algo estiver errado, **aborta sem tocar no site**

**Custo aproximado:** US$ 0,40 a 0,90 por mês gerado (Claude Opus 5). O modo `vazio` é grátis — não chama a API.

### Rodar do próprio PC

```bash
npm install

# mês com conteúdo, herdando a estrutura do mês anterior
ANTHROPIC_API_KEY=sk-ant-... MES=outubro node scripts/gerar-mes.mjs

# mês com estratégia própria
ANTHROPIC_API_KEY=sk-ant-... MES=fevereiro ANO=2027 \
  ESTRATEGIA="3 posts por semana, só seg/qua/sex. Foco em reels. Tema: planejamento tributário." \
  node scripts/gerar-mes.mjs

# só a grade vazia, de outubro a dezembro (não usa API)
MODO=vazio MES=outubro ATE=dezembro node scripts/gerar-mes.mjs
```

Extras úteis: `MOCK=1` roda o fluxo inteiro sem chamar a API · `DEBUG_PROMPT=1` mostra
exatamente o que seria enviado ao Claude, sem enviar.

### Se o mês sair ruim

Nada foi perdido. Apague o bloco `'2026-10':{...}` de dentro dos marcadores
`MESES:START` / `MESES:END` em `index.html`, apague o `conteudo-2026-10.md`,
e rode de novo — dessa vez sendo mais específico na **estrategia**.

## 📁 Arquivos

| Arquivo | O que é |
|---|---|
| `index.html` | O site distribuível (abre no navegador, funciona offline). Os dados de todos os meses ficam entre os marcadores `MESES:START` / `MESES:END` — **não remova esses comentários**, o script os usa para achar onde escrever |
| `conteudo-setembro.md` | Conteúdo de setembro em texto (para copiar/colar nos posts) |
| `conteudo-<ano>-<mes>.md` | Idem, gerado automaticamente para cada mês novo |
| `scripts/gerar-mes.mjs` | O gerador: chama a API do Claude e escreve no `index.html` |
| `.github/workflows/gerar-mes.yml` | O botão **Run workflow** da aba Actions |
| `package.json` | Dependência do SDK da Anthropic |
| `README.md` | Este guia |

## 🎨 Layout (Google Stitch integrado)

O visual foi gerado no **Google Stitch** e fundido ao sistema: paleta Material verde HUBIX
(`#006d41` / `#01b671`), fontes **Hanken Grotesk** (títulos) + **Inter** (corpo), nav fixa,
título display, cards de estatística e calendário arredondado estilo Apple. As fontes vêm do
Google Fonts com fallback do sistema (funciona offline em fonte padrão).

Para variar de novo no Stitch (`stitch.withgoogle.com`), use como brief:

> Landing page de calendário editorial para a HUBIX (BPO Financeiro), público de mídia exterior.
> Estilo minimalista Apple, verde #01B671. Nav fixa com logo, hero com título grande, 4 stat cards,
> calendário mensal em grade 7 colunas com bolinhas por formato, e modal de conteúdo com Aprovado/Recusado.

Cole o código do Stitch aqui no chat que a casca nova é fundida à lógica existente.

## ✍️ Antes de enviar ao cliente

- Ajustar os `__%` do case (dia 22) com números reais.
- Conferir link/oferta do "diagnóstico gratuito" (dias 25, 29).
- Adaptar tom de voz e assinatura visual à marca HUBIX.
