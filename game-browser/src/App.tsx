import { useEffect, useState, useRef } from "react";

type Player = {
  id: string;
  x: number;
  y: number;
  color: string;
  input: {
    left: boolean;
    right: boolean;
    up: boolean;
    down: boolean;
    jump: boolean;
  };
};

type GameState = {
  level: number;
  keyCollected: boolean;
  keyX: number;
  keyY: number;
  doorX: number;
  doorY: number;
  keyCarrierId: string | null;
};

type Platform = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const COLORS = ["#FF5733", "#33FF57", "#3357FF", "#F3FF33"];

const LEVEL_PLATFORMS: Record<number, Platform[]> = {
  1: [
    { x: 100, y: 500, width: 250, height: 40 },
    { x: 450, y: 400, width: 300, height: 40 },
    { x: 250, y: 250, width: 200, height: 40 },
    { x: 800, y: 300, width: 220, height: 40 },
  ],
  2: [
    { x: 50, y: 550, width: 200, height: 40 },
    { x: 350, y: 450, width: 180, height: 40 },
    { x: 650, y: 350, width: 180, height: 40 },
    { x: 450, y: 180, width: 200, height: 40 },
  ],
};

export default function App() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [gameState, setGameState] = useState<GameState>({
    level: 1,
    keyCollected: false,
    keyX: 320,
    keyY: 200,
    doorX: 900,
    doorY: 240,
    keyCarrierId: null,
  });

  const playersRef = useRef<Player[]>([]);
  const gameStateRef = useRef<GameState>(gameState);
  const wsRef = useRef<WebSocket | null>(null);

  const velocitiesRef = useRef<
    Record<string, { vy: number; isGrounded: boolean }>
  >({});

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:3000");
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("Conectado al host");
      ws.send(JSON.stringify({ type: "screen" }));
    };

    ws.onmessage = (msg) => {
      const data = JSON.parse(msg.data);

      if (data.type === "state") {
        const updatedPlayers = data.players
          .slice(0, 4)
          .map((p: any, index: number) => {
            const existingPlayer = playersRef.current.find(
              (ex) => ex.id === p.id,
            );
            return {
              id: p.id,
              x: existingPlayer ? existingPlayer.x : p.x,
              y: existingPlayer ? existingPlayer.y : p.y,
              color: COLORS[index % COLORS.length],
              input: p.input || {
                left: false,
                right: false,
                up: false,
                down: false,
                jump: false,
              },
            };
          });
        playersRef.current = updatedPlayers;
      }
    };

    const gameInterval = setInterval(() => {
      updatePhysics();
    }, 1000 / 30);

    return () => {
      ws.close();
      clearInterval(gameInterval);
    };
  }, []);

  const updatePhysics = () => {
    let currentPlayers = [...playersRef.current];
    let currentGeo = { ...gameStateRef.current };

    if (currentPlayers.length === 0) return;

    const platforms = LEVEL_PLATFORMS[currentGeo.level] || [];
    const PLAYER_SIZE = 30;

    currentPlayers = currentPlayers.map((player) => {
      if (!velocitiesRef.current[player.id]) {
        velocitiesRef.current[player.id] = { vy: 0, isGrounded: false };
      }

      const physics = velocitiesRef.current[player.id];
      let nextX = player.x;
      let nextY = player.y;

      if (player.input.left) nextX -= 5;
      if (player.input.right) nextX += 5;

      const JUMP_FORCE = -14;
      if (player.input.jump && physics.isGrounded) {
        physics.vy = JUMP_FORCE;
        physics.isGrounded = false;
      }

      const GRAVITY = 0.8;
      const TERMINAL_VELOCITY = 12;
      physics.vy += GRAVITY;
      if (physics.vy > TERMINAL_VELOCITY) physics.vy = TERMINAL_VELOCITY;

      nextY += physics.vy;

      nextX = Math.max(0, Math.min(window.innerWidth - PLAYER_SIZE, nextX));

      const DEATH_ZONE_Y = window.innerHeight - 50;
      if (nextY >= DEATH_ZONE_Y) {
        if (currentGeo.level === 1) {
          nextX = 150;
          nextY = 400;
        } else {
          nextX = 100;
          nextY = 450;
        }
        physics.vy = 0;
        physics.isGrounded = false;

        if (currentGeo.keyCarrierId === player.id) {
          currentGeo.keyCollected = false;
          currentGeo.keyCarrierId = null;
          if (currentGeo.level === 1) {
            currentGeo.keyX = 320;
            currentGeo.keyY = 200;
          } else {
            currentGeo.keyX = 540;
            currentGeo.keyY = 130;
          }
        }

        return { ...player, x: nextX, y: nextY };
      }

      let groundedThisFrame = false;
      for (const plat of platforms) {
        const matchX =
          nextX + PLAYER_SIZE > plat.x && nextX < plat.x + plat.width;

        if (matchX) {
          if (
            player.y + PLAYER_SIZE <= plat.y &&
            nextY + PLAYER_SIZE >= plat.y
          ) {
            nextY = plat.y - PLAYER_SIZE;
            physics.vy = 0;
            groundedThisFrame = true;
          } else if (
            player.y >= plat.y + plat.height &&
            nextY <= plat.y + plat.height
          ) {
            nextY = plat.y + plat.height;
            physics.vy = 0;
          }
        }
      }

      physics.isGrounded = groundedThisFrame;

      return { ...player, x: nextX, y: nextY };
    });

    for (let i = 0; i < currentPlayers.length; i++) {
      for (let j = 0; j < currentPlayers.length; j++) {
        if (i === j) continue;
        const p1 = currentPlayers[i];
        const p2 = currentPlayers[j];

        const physics1 = velocitiesRef.current[p1.id];
        const hitX = Math.abs(p1.x - p2.x) < PLAYER_SIZE;

        if (hitX) {
          if (p1.y + PLAYER_SIZE <= p2.y && p1.y + PLAYER_SIZE + 5 >= p2.y) {
            p1.y = p2.y - PLAYER_SIZE;
            if (physics1) {
              physics1.vy = 0;
              physics1.isGrounded = true;
            }
          }
        }
      }
    }

    if (!currentGeo.keyCollected) {
      const luckyPlayer = currentPlayers.find(
        (p) =>
          Math.abs(p.x - currentGeo.keyX) < PLAYER_SIZE &&
          Math.abs(p.y - currentGeo.keyY) < PLAYER_SIZE,
      );
      if (luckyPlayer) {
        currentGeo.keyCollected = true;
        currentGeo.keyCarrierId = luckyPlayer.id;
      }
    } else {
      const carrier = currentPlayers.find(
        (p) => p.id === currentGeo.keyCarrierId,
      );
      if (carrier) {
        currentGeo.keyX = carrier.x + 5;
        currentGeo.keyY = carrier.y - 25;
      } else {
        currentGeo.keyCollected = false;
        currentGeo.keyCarrierId = null;
      }
    }

    if (currentGeo.keyCollected) {
      const allAtDoor = currentPlayers.every(
        (p) =>
          Math.abs(p.x - currentGeo.doorX) < 40 &&
          Math.abs(p.y - currentGeo.doorY) < 40,
      );

      if (allAtDoor) {
        if (currentGeo.level === 1) {
          currentGeo.level = 2;
          currentGeo.keyCollected = false;
          currentGeo.keyCarrierId = null;
          currentGeo.keyX = 540;
          currentGeo.keyY = 130;
          currentGeo.doorX = 120;
          currentGeo.doorY = 490;
        } else {
          alert("¡Ganaron el juego completo!");
          currentGeo.level = 1;
          currentGeo.keyCollected = false;
          currentGeo.keyCarrierId = null;
          currentGeo.keyX = 320;
          currentGeo.keyY = 200;
          currentGeo.doorX = 900;
          currentGeo.doorY = 240;
        }
      }
    }

    playersRef.current = currentPlayers;
    gameStateRef.current = currentGeo;
    setPlayers(currentPlayers);
    setGameState(currentGeo);
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        background: "linear-gradient(to bottom, #7ac1eb, #bfe3f7)",
        overflow: "hidden",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 20,
          left: 20,
          color: "#1e3d59",
          zIndex: 10,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 28 }}>NIVEL: {gameState.level}</h2>
        <p style={{ margin: "5px 0 0 0", fontWeight: "bold" }}>
          {gameState.keyCollected
            ? "🔑 ¡Llave obtenida! Vayan a la puerta"
            : "⚠️ Busquen la llave"}
        </p>
        <p style={{ margin: "5px 0 0 0", fontSize: 14 }}>
          Jugadores: {players.length} / 4
        </p>
      </div>

      {(LEVEL_PLATFORMS[gameState.level] || []).map((plat, index) => (
        <div
          key={index}
          style={{
            position: "absolute",
            left: plat.x,
            top: plat.y,
            width: plat.width,
            height: plat.height,
            background:
              "linear-gradient(to bottom, #a1d974 0%, #7cb64b 25%, #634631 30%, #4a3222 100%)",
            borderRadius: "12px",
            boxShadow:
              "0 12px 0px rgba(0,0,0,0.15), inset 0 4px 0 rgba(255,255,255,0.3)",
            borderBottom: "6px solid #362216",
          }}
        />
      ))}

      <div
        style={{
          position: "absolute",
          left: gameState.doorX,
          top: gameState.doorY,
          width: 50,
          height: 60,
          backgroundColor: "#a05a2c",
          border: "3px solid #fff",
          borderRadius: "8px 8px 0 0",
          boxShadow: "0 8px 16px rgba(0,0,0,0.2)",
          zIndex: 2,
        }}
      >
        <div
          style={{
            color: "white",
            fontSize: 10,
            textAlign: "center",
            marginTop: 20,
            fontWeight: "bold",
          }}
        >
          SALIDA
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: gameState.keyX,
          top: gameState.keyY,
          fontSize: 28,
          zIndex: 3,
          filter: "drop-shadow(0px 4px 6px rgba(0,0,0,0.2))",
          transition: gameState.keyCollected ? "none" : "all 0.1s linear",
        }}
      >
        🔑
      </div>

      {players.map((p) => (
        <div
          key={p.id}
          style={{
            position: "absolute",
            left: p.x,
            top: p.y,
            width: 30,
            height: 30,
            backgroundColor: p.color,
            borderRadius: "6px",
            boxShadow: "0 6px 12px rgba(0,0,0,0.25)",
            border: "2px solid #fff",
            zIndex: 5,
            transition: "left 0.05s linear, top 0.05s linear",
          }}
        />
      ))}
    </div>
  );
}
