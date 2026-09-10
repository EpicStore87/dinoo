# Dino Online

Clone do jogo do dinossauro do Chrome, com modo solo e multiplayer.
Cada jogador escolhe a cor do dino antes da partida (cores diferentes na mesma sala).
Os dinos usam o sprite classico em pixel art.

## Como jogar

- **Solo**: corrida infinita, salva o recorde no navegador.
- **Multiplayer**: crie uma sala (nome, senha opcional, 2 a 4 jogadores, bots opcionais) ou entre numa sala da lista.
- Antes de comecar, escolha a cor do seu dinossauro. No lobby, cores ja usadas pelos outros ficam bloqueadas.
- **Controles**: `espaco` ou `↑` pula, `↓` abaixa. No celular, toque na metade de cima pra pular e na de baixo pra abaixar.

## Rodando localmente

Precisa do Node.js 18+.

```bash
npm install
npm start
```

Abra `http://localhost:3000`. Na mesma rede, use `http://SEU_IP:3000`.

## Por que nao vai no Netlify

O Netlify so serve arquivos HTML/CSS/JS. Este jogo tem um servidor Node com Socket.io
(salas, bots, multiplayer). Ele precisa ficar ligado. Use **Render** ou **Railway**.

### Publicar no Render (gratis)

1. Crie uma conta em https://render.com
2. Suba esta pasta para um repositorio no GitHub
3. No Render: **New +** → **Web Service** → conecte o repositorio
4. Configure:
   - Build command: `npm install`
   - Start command: `npm start`
   - Instance: Free
5. Create Web Service

O site fica em algo como `https://dino-multiplayer.onrender.com`.
No plano gratis o servidor dorme depois de um tempo sem uso; o primeiro acesso
pode demorar ~30 segundos para acordar.

## Estrutura

```
dino-multiplayer/
├── server.js
├── package.json
└── public/
    ├── index.html
    ├── img/dino.png
    ├── css/style.css
    └── js/
        ├── colors.js
        ├── rng.js
        ├── sound.js
        ├── game.js
        └── main.js
```
