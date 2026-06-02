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

function updateGame() {}

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

      const spawns = [
        { x: 100, y: 10 },
        { x: 200, y: 10 },
        { x: 300, y: 100 },
        { x: 400, y: 100 },
      ];

      const spawnIndex = clients.size - 1;
      const spawn = spawns[spawnIndex % spawns.length];

      players.set(id, {
        id,
        x: spawn.x,
        y: spawn.y,
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
      try {
        const data = JSON.parse(message.toString());
        const id = (ws as any).id;
        const player = players.get(id);

        if (!player) return;

        player.input = {
          ...player.input,
          ...data.input,
        };
      } catch (e) {
        console.error("Error procesando mensaje:", e);
      }
    },
    close(ws) {
      clients.delete(ws);
      const id = (ws as any).id;

      if (id) {
        players.delete(id);
        console.log(`Jugador desconectado: ${id}`);
      }
    },
  },
});

setInterval(() => {
  updateGame();
  broadcast();
}, 1000 / 30);

console.log("HOST running on :3000");
