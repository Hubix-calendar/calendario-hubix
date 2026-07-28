# 📅 Calendário Editorial — HUBIX BPO Financeiro (Setembro 2026)

Site pronto para distribuir ao cliente. Calendário mensal **estilo Apple, minimalista**, focado em **aquisição de novos clientes de mídia exterior** (outdoor, painéis, mobiliário urbano).

- Grade do **mês inteiro**; dias com conteúdo têm marcador colorido por formato
- **Clique no dia → popup** com o conteúdo:
  - **Reel/vídeo:** roteiro de gravação (cena, áudio, texto na tela) + descrição do post
  - **Arte/imagem (Post, Carrossel, Frase):** briefing de design (formato, estilo, texto na arte, cores, elementos, o que o design deve fazer)
- Roteiros de Reel em **texto corrido, prontos para teleprompter** (só a fala).
- **Aprovar / Recusar** dentro do popup. Ao recusar, abre campo para explicar o motivo. A decisão fica salva no navegador e marca o dia com ✓ ou ✕.
- **🧠 Banco de Aprendizado** (botão no canto inferior): toda recusa é registrada, o sistema extrai os **padrões recorrentes** dos motivos e permite exportar a base (JSON) para alimentar uma IA.
- **✨ Refazer com IA:** ao recusar, um botão reescreve o conteúdo aplicando o ajuste e o reenvia como aprovado. Usa a **API gratuita do Google Gemini**.
- **22 peças** equilibradas: 6 Reels · 5 Carrosséis · 6 Posts · 5 Frases
- Arquivo único (`index.html`), responsivo, tema claro/escuro

## 🎨 Identidade Visual da HUBIX (tela de instalação)

No primeiro acesso o site abre a tela **"Identidade Visual da HUBIX"** (a "ID" da marca). Reabre a qualquer momento no botão **⚙** no topo. Captura e aplica:

- **Nome** da marca
- **Logo** (upload PNG/SVG — vem com o logo verde da HUBIX embutido por padrão)
- **Cor primária** e **cor de destaque** (padrão: verde HUBIX `#01B671` / `#0CA678`)
- **Slogan** (opcional)
- **Tom de voz** — guia a IA ao reescrever (padrão: *Profissional e direto*)
- **Chave da API Gemini** (opcional)

Tudo fica salvo **só no navegador** (localStorage). As cores mudam o tema do calendário na hora; o tom entra no prompt da IA.

## 🤖 Ligar o "Refazer com IA" (grátis)

1. Acesse [aistudio.google.com/apikey](https://aistudio.google.com/apikey) e crie uma **API key gratuita** do Google Gemini.
2. No site, recuse um conteúdo, escreva o motivo, clique em **✨ Refazer com IA** e cole a chave quando pedido.
3. A chave fica salva **só no seu navegador** (localStorage) — **nunca vá para o GitHub**. Não coloque a chave dentro do `index.html`.

> ⚠️ Importante: se o site público for usado por várias pessoas, cada uma precisa inserir a própria chave. Não é possível embutir uma chave num site público sem expô-la. Para uma IA sempre ativa e compartilhada, seria preciso um backend (aí sim com custo).

## 🌐 Como publicar de graça (GitHub Pages)

Custo zero. Em ~1 minuto o cliente recebe um link público.

1. Em [github.com](https://github.com) → **New repository**
   - Nome: `calendario-hubix`
   - Visibilidade: **Public**
2. **Add file → Upload files** → arraste `index.html` (e este `README.md`) → **Commit changes**
3. **Settings → Pages**
   - Source: **Deploy from a branch**
   - Branch: `main` / pasta `/ (root)` → **Save**
4. Aguarde ~1 min. O site fica em:
   `https://SEU-USUARIO.github.io/calendario-hubix`

### Alternativa por linha de comando (Git instalado)

```bash
cd "C:/CALENDARIO HUBIX"
git init
git add .
git commit -m "Calendário editorial Setembro - HUBIX BPO Financeiro"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/calendario-hubix.git
git push -u origin main
```

Depois ative o Pages em **Settings → Pages** (passo 3 acima).

## 📁 Arquivos

| Arquivo | O que é |
|---|---|
| `index.html` | O site distribuível (abre no navegador, funciona offline) |
| `conteudo-setembro.md` | Todo o conteúdo em texto (para copiar/colar nos posts) |
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
