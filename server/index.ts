type Player = {
  id: string;
  x: number;
  y: number;
  input: {
    left: boolean;
    right: boolean;
    up: boolean;
    down: boolean;
    jump: boolean;
  };
};

const clients = new Set<any>();
const players = new Map<string, Player>();

function updateGame() {
  for (const player of players.values()) {
    if (player.input.left) player.x -= 3;
    if (player.input.right) player.x += 3;
    if (player.input.up) player.y -= 3;
    if (player.input.down) player.y += 3;
  }
}

function broadcast() {
  const state = JSON.stringify({
    type: "state",
    players: Array.from(players.values()),
  });

  for (const client of clients) {
    client.send(state);
  }
}

Bun.serve({
  port: 3000,

  fetch(req, server) {
    if (server.upgrade(req)) return;
    return new Response("HOST running");
  },

  websocket: {
    open(ws) {
      clients.add(ws);
      console.log("Conectado");

      const id = crypto.randomUUID();
      (ws as any).id = id;

      players.set(id, {
        id,
        x: 100,
        y: 100,
        input: {
          left: false,
          right: false,
          up: false,
          down: false,
          jump: false,
        },
      });

      ws.send(JSON.stringify({ type: "init", id }));
    },

    message(ws, message) {
      const data = JSON.parse(message.toString());

      const id = (ws as any).id;
      const player = players.get(id);

      if (!player) return;

      player.input = data.input;
    },

    close(ws) {
      clients.delete(ws);

      const id = (ws as any).id;
      if (id) players.delete(id);
    },
  },
});

setInterval(() => {
  updateGame();
  broadcast();
}, 1000 / 30);

console.log("HOST running on :3000");
