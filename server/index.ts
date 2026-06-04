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
  { x: 150, y: 470 },
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
    if (client.readyState === 1) {
      client.send(state);
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
      // No creamos jugador todavía: esperamos el primer mensaje
      // para saber si es pantalla o gamepad
      console.log(`🟢 Conectado: ${id}`);
    },

    message(ws, message) {
      try {
        const data = JSON.parse(message.toString());
        const id = (ws as any).id;

        // ── Identificar pantalla ──────────────────────────────────────────
        if (data.type === "screen") {
          screens.add(id);
          players.delete(id); // por si acaso se creó antes
          console.log(`🖥️  Pantalla registrada: ${id}`);
          return;
        }

        // ── Registrar gamepad la primera vez que manda input ──────────────
        if (!players.has(id) && !screens.has(id)) {
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

        // ── Actualizar input ──────────────────────────────────────────────
        const player = players.get(id);
        if (!player) return;

        // FIX CRÍTICO: el gamepad envía { left, right, jump } directamente
        // como raíz del JSON, no anidado en data.input
        player.input = {
          ...player.input,
          ...data,
        };
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
            : `🖥️  Pantalla desconectada: ${id}`
        );
      }
    },
  },
});

setInterval(() => {
  broadcast();
}, 1000 / 30);

console.log("🚀 HOST running on ws://localhost:3000");