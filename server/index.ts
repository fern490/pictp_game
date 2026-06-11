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
const screens = new Set<string>();
const players = new Map<string, Player>();

const SPAWNS = [
  { x: 150, y: 500 },
  { x: 250, y: 460 },
  { x: 350, y: 550 },
  { x: 450, y: 550 },
];

const DEFAULT_INPUT = {
  left: false,
  right: false,
  up: false,
  down: false,
  jump: false,
};

function broadcast() {
  const state = JSON.stringify({
    type: "state",
    players: Array.from(players.values()),
  });

  for (const client of clients) {
    const clientId = (client as any).id;

    if (screens.has(clientId) && client.readyState === 1) {
      client.send(state);
    }
  }
}

function broadcastInput(player: Player) {
  const msg = JSON.stringify({
    type: "input",
    id: player.id,
    input: player.input,
  });
  for (const client of clients) {
    if (screens.has((client as any).id) && client.readyState === 1) {
      client.send(msg);
    }
  }
}

Bun.serve({
  port: 3000,

  fetch(req, server) {
    if (server.upgrade(req)) return;
    return new Response("HOST running on :3000");
  },

  websocket: {
    open(ws) {
      clients.add(ws);
      const id = crypto.randomUUID();
      (ws as any).id = id;

      console.log(`🟢 Conectado: ${id}`);
    },

    message(ws, message) {
      try {
        const data = JSON.parse(message.toString());
        const id = (ws as any).id;

        if (data.type === "screen") {
          screens.add(id);
          players.delete(id);
          console.log(`🖥️  Pantalla registrada: ${id}`);
          return;
        }

        if (!players.has(id) && !screens.has(id)) {
          if (players.size >= 4) {
            ws.send(JSON.stringify({ type: "full" }));
            ws.close();

            console.log(`🚫 Conexión rechazada: Servidor lleno (Máx 4)`);

            return;
          }

          const spawnIndex = players.size;
          const spawn = SPAWNS[spawnIndex % SPAWNS.length];

          players.set(id, {
            id,
            x: spawn.x,
            y: spawn.y,
            input: { ...DEFAULT_INPUT },
          });

          ws.send(JSON.stringify({ type: "init", id }));

          console.log(`🎮 Jugador ${spawnIndex + 1} registrado: ${id}`);
        }

        const player = players.get(id);
        if (!player) return;

        player.input = {
          ...player.input,
          ...data,
        };

        broadcastInput(player);
      } catch (e) {
        console.error("❌ Error procesando mensaje:", e);
      }
    },

    close(ws) {
      clients.delete(ws);

      const id = (ws as any).id;

      if (id) {
        const wasPlayer = players.has(id);

        players.delete(id);
        screens.delete(id);

        console.log(
          wasPlayer
            ? `🔴 Jugador desconectado: ${id}`
            : `🖥️  Pantalla desconectada: ${id}`,
        );

        broadcast();
      }
    },
  },
});

setInterval(() => {
  broadcast();
}, 1000 / 30);

console.log("🚀 HOST running on ws://localhost:3000");
