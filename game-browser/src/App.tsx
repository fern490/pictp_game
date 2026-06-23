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
  buttonX: number;
  buttonY: number;
  buttonPressed: boolean;
  buttonTimer: number;
  buttonActive: boolean;
  buttonPressedAt?: number;
  boxX: number;
  boxY: number;
  boxVelocityY: number;
  boxDropped: boolean;
};

type Platform = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type LevelConfig = {
  platforms: Platform[];
  keyStartX: number;
  keyStartY: number;
  doorX: number;
  doorY: number;
  buttonX: number;
  buttonY: number;
};

const COLORS = ["#FF5733", "#33FF57", "#3357FF", "#F3FF33"];

const LEVEL_CONFIGS: Record<number, LevelConfig> = {
  1: {
    platforms: [
      { x: 30, y: 520, width: 180, height: 40 },
      { x: 130, y: 420, width: 140, height: 40 },
      { x: 260, y: 290, width: 200, height: 40 },
      { x: 323, y: 278, width: 80, height: 12 },
      { x: 320, y: 460, width: 160, height: 40 },
      { x: 570, y: 410, width: 150, height: 40 },
      { x: 780, y: 450, width: 160, height: 40 },
      { x: 1140, y: 340, width: 180, height: 40 },
      { x: 886, y: 440, width: 50, height: 12 },
    ],
    keyStartX: 350,
    keyStartY: 90,
    doorX: 1200,
    doorY: 276,
    buttonX: 376,
    buttonY: 442,
  },
  2: {
    platforms: [
      { x: 1, y: 540, width: 2500, height: 40 },
      { x: 250, y: 130, width: 380, height: 30 },
      { x: 0, y: 250, width: 45, height: 220 },
      { x: 100, y: 531, width: 80, height: 12 },
    ],
    keyStartX: 900,
    keyStartY: 150,
    doorX: 1220,
    doorY: 280,
    buttonX: 59,
    buttonY: 300,
  },
};

const STARS = [
  { x: "10%", y: "15%", size: 24, opacity: 0.9 },
  { x: "25%", y: "5%", size: 14, opacity: 0.6 },
  { x: "42%", y: "20%", size: 18, opacity: 0.8 },
  { x: "60%", y: "10%", size: 22, opacity: 0.9 },
  { x: "78%", y: "25%", size: 16, opacity: 0.7 },
  { x: "92%", y: "8%", size: 20, opacity: 0.8 },
  { x: "15%", y: "45%", size: 12, opacity: 0.5 },
  { x: "85%", y: "50%", size: 15, opacity: 0.6 },
];

export default function App() {
  const [players, setPlayers] = useState<Player[]>([]);

  const [gameState, setGameState] = useState<GameState>({
    level: 1,
    keyCollected: false,
    keyX: LEVEL_CONFIGS[1].keyStartX,
    keyY: LEVEL_CONFIGS[1].keyStartY,
    doorX: LEVEL_CONFIGS[1].doorX,
    doorY: LEVEL_CONFIGS[1].doorY,
    keyCarrierId: null,
    buttonX: LEVEL_CONFIGS[1].buttonX,
    buttonY: LEVEL_CONFIGS[1].buttonY,
    buttonPressed: false,
    buttonTimer: 5,
    buttonActive: false,
    boxX: 320,
    boxY: -60,
    boxVelocityY: 0,
    boxDropped: false,
  });

  const playersRef = useRef<Player[]>([]);
  const gameStateRef = useRef<GameState>(gameState);
  const wsRef = useRef<WebSocket | null>(null);
  const DEBUG_SINGLE_PLAYER = false;

  const velocitiesRef = useRef<
    Record<
      string,
      { vy: number; isGrounded: boolean; isOnBoostPlatform: boolean }
    >
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
              x: existingPlayer ? existingPlayer.x : 60,
              y: existingPlayer ? existingPlayer.y : 400,
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

    if (currentGeo.buttonPressed && currentGeo.buttonPressedAt) {
      const elapsedSeconds = (Date.now() - currentGeo.buttonPressedAt) / 1000;

      if (elapsedSeconds < 5) {
        currentGeo.buttonTimer = Math.ceil(5 - elapsedSeconds);
        currentGeo.buttonActive = false;
      } else if (elapsedSeconds >= 5 && elapsedSeconds < 6) {
        currentGeo.buttonTimer = 0;
        currentGeo.buttonActive = true;
      } else {
        currentGeo.buttonPressed = false;
        currentGeo.buttonActive = false;
        currentGeo.buttonTimer = 5;
      }
    }

    const currentLevelConfig = LEVEL_CONFIGS[currentGeo.level];
    const platforms = currentLevelConfig?.platforms || [];
    const PLAYER_SIZE = 30;
    const BOX_SIZE = 40;

    // --- FÍSICA Y MECÁNICA DE LA CAJA (NIVEL 2) ---
    if (currentGeo.level === 2 && currentGeo.boxDropped) {
      let totalPush = 0;

      currentPlayers.forEach((player) => {
        const vOverlap =
          player.y + PLAYER_SIZE > currentGeo.boxY &&
          player.y < currentGeo.boxY + BOX_SIZE;

        if (vOverlap) {
          if (
            player.input.right &&
            player.x + PLAYER_SIZE <= currentGeo.boxX + 6 &&
            player.x + PLAYER_SIZE >= currentGeo.boxX - 6
          ) {
            totalPush += 5;
          }
          if (
            player.input.left &&
            player.x >= currentGeo.boxX + BOX_SIZE - 6 &&
            player.x <= currentGeo.boxX + BOX_SIZE + 6
          ) {
            totalPush -= 5;
          }
        }
      });

      let nextBoxX = currentGeo.boxX + totalPush;
      nextBoxX = Math.max(0, Math.min(window.innerWidth - BOX_SIZE, nextBoxX));

      const BOX_GRAVITY = 0.8;
      const BOX_TERMINAL_VELOCITY = 12;
      currentGeo.boxVelocityY += BOX_GRAVITY;
      if (currentGeo.boxVelocityY > BOX_TERMINAL_VELOCITY) {
        currentGeo.boxVelocityY = BOX_TERMINAL_VELOCITY;
      }
      let nextBoxY = currentGeo.boxY + currentGeo.boxVelocityY;

      for (const plat of platforms) {
        if (nextBoxX + BOX_SIZE > plat.x && nextBoxX < plat.x + plat.width) {
          if (
            currentGeo.boxY + BOX_SIZE <= plat.y &&
            nextBoxY + BOX_SIZE >= plat.y
          ) {
            nextBoxY = plat.y - BOX_SIZE;
            currentGeo.boxVelocityY = 0;
          } else if (
            currentGeo.boxY >= plat.y + plat.height &&
            nextBoxY <= plat.y + plat.height
          ) {
            nextBoxY = plat.y + plat.height;
            currentGeo.boxVelocityY = 0;
          }
        }
        if (nextBoxY + BOX_SIZE > plat.y && nextBoxY < plat.y + plat.height) {
          if (
            totalPush > 0 &&
            currentGeo.boxX + BOX_SIZE <= plat.x &&
            nextBoxX + BOX_SIZE > plat.x
          ) {
            nextBoxX = plat.x - BOX_SIZE;
          } else if (
            totalPush < 0 &&
            currentGeo.boxX >= plat.x + plat.width &&
            nextBoxX < plat.x + plat.width
          ) {
            nextBoxX = plat.x + plat.width;
          }
        }
      }

      currentPlayers.forEach((player) => {
        const vOverlap =
          player.y + PLAYER_SIZE > nextBoxY && player.y < nextBoxY + BOX_SIZE;

        if (vOverlap) {
          if (
            totalPush > 0 &&
            currentGeo.boxX + BOX_SIZE <= player.x &&
            nextBoxX + BOX_SIZE > player.x
          ) {
            player.x = nextBoxX + BOX_SIZE;
            player.x = Math.min(window.innerWidth - PLAYER_SIZE, player.x);
          } else if (
            totalPush < 0 &&
            currentGeo.boxX >= player.x + PLAYER_SIZE &&
            nextBoxX < player.x + PLAYER_SIZE
          ) {
            player.x = nextBoxX - PLAYER_SIZE;
            player.x = Math.max(0, player.x);
          }
        }
      });

      currentGeo.boxX = nextBoxX;
      currentGeo.boxY = nextBoxY;
    }

    // --- FÍSICA Y MOVIMIENTO DE JUGADORES ---
    currentPlayers = currentPlayers.map((player) => {
      if (!velocitiesRef.current[player.id]) {
        velocitiesRef.current[player.id] = {
          vy: 0,
          isGrounded: false,
          isOnBoostPlatform: false,
        };
      }

      const physics = velocitiesRef.current[player.id];
      let nextX = player.x;
      let nextY = player.y;

      if (player.input.left) nextX -= 5;
      if (player.input.right) nextX += 5;

      if (player.input.jump && physics.isGrounded && physics.vy === 0) {
        physics.vy = -14;
        physics.isGrounded = false;
      }

      const GRAVITY = 0.8;
      const TERMINAL_VELOCITY = 12;
      physics.vy += GRAVITY;

      if (physics.vy > TERMINAL_VELOCITY) {
        physics.vy = TERMINAL_VELOCITY;
      }

      nextY += physics.vy;
      nextX = Math.max(0, Math.min(window.innerWidth - PLAYER_SIZE, nextX));

      // Zona de muerte
      const DEATH_ZONE_Y = window.innerHeight - 50;
      if (nextY >= DEATH_ZONE_Y) {
        nextX = 60;
        nextY = 400;
        physics.vy = 0;
        physics.isGrounded = false;

        if (currentGeo.keyCarrierId === player.id) {
          currentGeo.keyCollected = false;
          currentGeo.keyCarrierId = null;
          currentGeo.keyX = LEVEL_CONFIGS[currentGeo.level].keyStartX;
          currentGeo.keyY = LEVEL_CONFIGS[currentGeo.level].keyStartY;
        }

        return { ...player, x: nextX, y: nextY };
      }

      let groundedThisFrame = false;
      let isOnBoostPlatform = false;

      // --- NUEVO SISTEMA DE OBSTÁCULOS (PLATAFORMAS + BOTÓN HORIZONTAL SÓLIDO) ---
      const BTN_W = 45;
      const BTN_H = 15;

      const obstacles = [
        ...platforms,
        {
          x: currentGeo.buttonX,
          y: currentGeo.buttonY,
          width: BTN_W,
          height: BTN_H,
        },
      ];

      // Verificación de Overlap para activar el botón
      const matchButtonX =
        nextX + PLAYER_SIZE > currentGeo.buttonX &&
        nextX < currentGeo.buttonX + BTN_W;
      const matchButtonY =
        nextY + PLAYER_SIZE > currentGeo.buttonY &&
        nextY < currentGeo.buttonY + BTN_H;

      if (matchButtonX && matchButtonY) {
        if (!currentGeo.buttonPressed) {
          currentGeo.buttonPressed = true;
          currentGeo.buttonTimer = 5;
          currentGeo.buttonActive = false;
          currentGeo.buttonPressedAt = Date.now();

          if (currentGeo.level === 2) {
            currentGeo.boxDropped = true;
          }
        }
      }

      if (currentGeo.level === 2 && currentGeo.boxDropped) {
        const matchBoxX =
          nextX + PLAYER_SIZE > currentGeo.boxX &&
          nextX < currentGeo.boxX + BOX_SIZE;
        if (matchBoxX) {
          if (
            player.y + PLAYER_SIZE <= currentGeo.boxY &&
            nextY + PLAYER_SIZE >= currentGeo.boxY
          ) {
            nextY = currentGeo.boxY - PLAYER_SIZE;
            physics.vy = 0;
            groundedThisFrame = true;
          } else if (
            player.y >= currentGeo.boxY + BOX_SIZE &&
            nextY <= currentGeo.boxY + BOX_SIZE
          ) {
            nextY = currentGeo.boxY + BOX_SIZE;
            physics.vy = 0;
          } else if (
            player.y + PLAYER_SIZE > currentGeo.boxY &&
            player.y < currentGeo.boxY + BOX_SIZE
          ) {
            if (player.x + PLAYER_SIZE <= currentGeo.boxX) {
              nextX = currentGeo.boxX - PLAYER_SIZE;
            } else if (player.x >= currentGeo.boxX + BOX_SIZE) {
              nextX = currentGeo.boxX + BOX_SIZE;
            }
          }
        }
      }

      for (const obs of obstacles) {
        const matchX = nextX + PLAYER_SIZE > obs.x && nextX < obs.x + obs.width;

        if (matchX) {
          if (player.y + PLAYER_SIZE <= obs.y && nextY + PLAYER_SIZE >= obs.y) {
            nextY = obs.y - PLAYER_SIZE;
            physics.vy = 0;
            groundedThisFrame = true;

            const isLevel1Boost =
              currentGeo.level === 1 &&
              ((obs.x === 323 && obs.y === 278) ||
                (obs.x === 886 && obs.y === 440));
            const isLevel2Boost =
              currentGeo.level === 2 && obs.x === 100 && obs.y === 531;

            if (isLevel1Boost || isLevel2Boost) {
              isOnBoostPlatform = true;

              if (currentGeo.buttonActive) {
                physics.vy = -27;
                groundedThisFrame = false;
              }
            }
          } else if (
            player.y >= obs.y + obs.height &&
            nextY <= obs.y + obs.height
          ) {
            nextY = obs.y + obs.height;
            physics.vy = 0;
          }
        }
      }

      for (const obs of obstacles) {
        const matchY =
          nextY + PLAYER_SIZE > obs.y && nextY < obs.y + obs.height;

        if (matchY) {
          if (player.x + PLAYER_SIZE <= obs.x && nextX + PLAYER_SIZE > obs.x) {
            nextX = obs.x - PLAYER_SIZE;
          } else if (
            player.x >= obs.x + obs.width &&
            nextX < obs.x + obs.width
          ) {
            nextX = obs.x + obs.width;
          }
        }
      }

      physics.isGrounded = groundedThisFrame;
      physics.isOnBoostPlatform = isOnBoostPlatform;
      return { ...player, x: nextX, y: nextY };
    });

    // Colisiones entre jugadores
    for (let loop = 0; loop < 10; loop++) {
      let changed = false;
      for (let i = 0; i < currentPlayers.length; i++) {
        for (let j = i + 1; j < currentPlayers.length; j++) {
          const p1 = currentPlayers[i];
          const p2 = currentPlayers[j];

          const minX1 = p1.x;
          const maxX1 = p1.x + PLAYER_SIZE;
          const minY1 = p1.y;
          const maxY1 = p1.y + PLAYER_SIZE;

          const minX2 = p2.x;
          const maxX2 = p2.x + PLAYER_SIZE;
          const minY2 = p2.y;
          const maxY2 = p2.y + PLAYER_SIZE;

          const overlapX = Math.min(maxX1, maxX2) - Math.max(minX1, minX2);
          const overlapY = Math.min(maxY1, maxY2) - Math.max(minY1, minY2);

          if (overlapX > 0 && overlapY > 0) {
            if (overlapY <= overlapX + 4) {
              const upper = p1.y < p2.y ? p1 : p2;
              const lower = p1.y < p2.y ? p2 : p1;
              const upperPhysics = velocitiesRef.current[upper.id];
              const lowerPhysics = velocitiesRef.current[lower.id];

              upper.y = lower.y - PLAYER_SIZE;

              if (lowerPhysics && lowerPhysics.vy < 0) {
                if (upperPhysics) {
                  upperPhysics.vy = lowerPhysics.vy;
                  upperPhysics.isGrounded = false;
                }
              } else {
                if (upperPhysics) {
                  upperPhysics.vy = 0;
                  upperPhysics.isGrounded = true;
                }
              }
              changed = true;
            } else {
              const leftPlayer = p1.x < p2.x ? p1 : p2;
              const rightPlayer = p1.x < p2.x ? p2 : p1;
              const pushAmount = overlapX / 2;
              leftPlayer.x -= pushAmount;
              rightPlayer.x += pushAmount;

              leftPlayer.x = Math.max(0, leftPlayer.x);
              rightPlayer.x = Math.min(
                window.innerWidth - PLAYER_SIZE,
                rightPlayer.x,
              );
              changed = true;
            }
          }
        }
      }
      if (!changed) break;
    }

    // Lógica de recolectar la llave
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

    // --- REGLAS DE CAMBIO DE NIVEL (TODOS EN PUERTA + PORTADOR DE LLAVE) ---
    const connectedPlayers = currentPlayers.filter(
      (p) => p.id && p.id.trim() !== "",
    );
    const playersAtDoor = connectedPlayers.filter(
      (p) =>
        Math.abs(p.x - currentGeo.doorX) < 40 &&
        Math.abs(p.y - currentGeo.doorY) < 40,
    );

    // Verificación exacta: la llave está recolectada y su portador llegó a la puerta
    const isCarrierAtDoorWithKey =
      currentGeo.keyCollected &&
      playersAtDoor.some((p) => p.id === currentGeo.keyCarrierId);

    const allAtDoor = DEBUG_SINGLE_PLAYER
      ? playersAtDoor.length >= 1 && isCarrierAtDoorWithKey
      : connectedPlayers.length > 0 &&
        playersAtDoor.length === connectedPlayers.length &&
        isCarrierAtDoorWithKey;

    if (allAtDoor) {
      if (currentGeo.level === 1) {
        currentGeo.level = 2;

        currentGeo.keyCollected = false;
        currentGeo.keyCarrierId = null;
        currentGeo.keyX = LEVEL_CONFIGS[2].keyStartX;
        currentGeo.keyY = LEVEL_CONFIGS[2].keyStartY;
        currentGeo.doorX = LEVEL_CONFIGS[2].doorX;
        currentGeo.doorY = LEVEL_CONFIGS[2].doorY;
        currentGeo.buttonX = LEVEL_CONFIGS[2].buttonX;
        currentGeo.buttonY = LEVEL_CONFIGS[2].buttonY;

        currentGeo.buttonPressed = false;
        currentGeo.buttonActive = false;
        currentGeo.buttonTimer = 5;

        currentGeo.boxX = 320;
        currentGeo.boxY = -60;
        currentGeo.boxVelocityY = 0;
        currentGeo.boxDropped = false;

        currentPlayers = currentPlayers.map((player) => {
          if (velocitiesRef.current[player.id]) {
            velocitiesRef.current[player.id] = {
              vy: 0,
              isGrounded: false,
              isOnBoostPlatform: false,
            };
          }
          return { ...player, x: 60, y: 400 };
        });
      } else {
        alert("¡Juego completo!");
        currentGeo.level = 1;

        currentGeo.keyCollected = false;
        currentGeo.keyCarrierId = null;
        currentGeo.keyX = LEVEL_CONFIGS[1].keyStartX;
        currentGeo.keyY = LEVEL_CONFIGS[1].keyStartY;
        currentGeo.doorX = LEVEL_CONFIGS[1].doorX;
        currentGeo.doorY = LEVEL_CONFIGS[1].doorY;
        currentGeo.buttonX = LEVEL_CONFIGS[1].buttonX;
        currentGeo.buttonY = LEVEL_CONFIGS[1].buttonY;

        currentGeo.buttonPressed = false;
        currentGeo.buttonActive = false;
        currentGeo.buttonTimer = 5;

        currentGeo.boxX = 320;
        currentGeo.boxY = -60;
        currentGeo.boxVelocityY = 0;
        currentGeo.boxDropped = false;
      }
    }

    playersRef.current = currentPlayers;
    gameStateRef.current = currentGeo;
    setPlayers(currentPlayers);
    setGameState(currentGeo);
  };

  const isCarrierAtDoor =
    gameState.keyCollected &&
    players.some(
      (p) =>
        p.id === gameState.keyCarrierId &&
        Math.abs(p.x - gameState.doorX) < 40 &&
        Math.abs(p.y - gameState.doorY) < 40,
    );

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        background: "linear-gradient(to bottom, #0b101e 0%, #1a2540 100%)",
        overflow: "hidden",
        fontFamily: "sans-serif",
      }}
    >
      {STARS.map((star, index) => (
        <div
          key={index}
          style={{
            position: "absolute",
            left: star.x,
            top: star.y,
            fontSize: star.size,
            color: "#FFF8D6",
            opacity: star.opacity,
            textShadow: "0 0 8px rgba(255, 248, 214, 0.8)",
            zIndex: 1,
          }}
        >
          ★
        </div>
      ))}

      <div
        style={{
          position: "absolute",
          top: 20,
          left: 20,
          color: "#e2e8f0",
          textShadow: "1px 1px 3px rgba(0,0,0,0.8)",
          zIndex: 10,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 26 }}>NIVEL: {gameState.level}</h2>
        <p style={{ margin: "4px 0 0 0", fontWeight: "bold", fontSize: 13 }}>
          {gameState.keyCollected ? "🔑 ¡Vayan a la salida!" : ""}
        </p>
        {gameState.buttonPressed && (
          <p
            style={{
              margin: "4px 0 0 0",
              color: gameState.buttonActive ? "#4caf50" : "#ff9800",
              fontSize: 16,
              fontWeight: "bold",
            }}
          >
            {gameState.buttonActive
              ? "🚀 ¡VE!"
              : `⏱️ IMPULSO EN: ${gameState.buttonTimer}...`}
          </p>
        )}
      </div>

      {(LEVEL_CONFIGS[gameState.level]?.platforms || []).map((plat, index) => {
        const isBoostPlatform =
          (gameState.level === 1 &&
            ((plat.x === 323 && plat.y === 278) ||
              (plat.x === 886 && plat.y === 440))) ||
          (gameState.level === 2 && plat.x === 100 && plat.y === 531);

        const isLeftCustomPlatform = gameState.level === 2 && plat.x === 0;

        return (
          <div
            key={index}
            style={{
              position: "absolute",
              left: plat.x,
              top: plat.y,
              width: plat.width,
              height: plat.height,
              background: isBoostPlatform
                ? "#888"
                : isLeftCustomPlatform
                  ? "linear-gradient(to right, #4a3222 0%, #634631 70%, #7cb64b 75%, #a1d974 100%)"
                  : "linear-gradient(to bottom, #a1d974 0%, #7cb64b 25%, #634631 30%, #4a3222 100%)",
              borderRadius: gameState.level === 1 ? "12px" : "0px",
              boxShadow: "0 12px 0px rgba(0,0,0,0.3)",
              zIndex: 2,
            }}
          />
        );
      })}

      <div
        style={{
          position: "absolute",
          left: gameState.buttonX,
          top: gameState.buttonY,
          width: 45,
          height: 15,
          backgroundColor: gameState.buttonActive
            ? "#4caf50"
            : gameState.buttonPressed
              ? "#ff9800"
              : "#f44336",
          borderRadius: "4px",
          border: "2px solid #fff",
          boxShadow: "4px 0px 8px rgba(0,0,0,0.4)",
          zIndex: 3,
          display: "flex",
          flexDirection: "row",
          justifyContent: "center",
          alignItems: "center",
          color: "white",
          fontSize: 9,
          fontWeight: "bold",
          lineHeight: "10px",
        }}
      >
        {gameState.buttonPressed ? (
          gameState.buttonTimer > 0 ? (
            gameState.buttonTimer
          ) : (
            "✔"
          )
        ) : (
          <span>⬜</span>
        )}
      </div>

      {gameState.level === 2 && gameState.boxDropped && (
        <div
          style={{
            position: "absolute",
            left: gameState.boxX,
            top: gameState.boxY,
            width: 40,
            height: 40,
            backgroundColor: "#d2691e",
            border: "3px solid #8b4513",
            borderRadius: "6px",
            boxShadow: "0 4px 10px rgba(0,0,0,0.6)",
            zIndex: 4,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            fontSize: 20,
            userSelect: "none",
            transition: "left 0.05s linear, top 0.05s linear",
          }}
        >
          📦
        </div>
      )}

      <div
        style={{
          position: "absolute",
          left: gameState.doorX,
          top: gameState.doorY,
          width: 50,
          height: 60,
          backgroundColor: isCarrierAtDoor ? "#000000" : "#a05a2c",
          border: "3px solid #ffffff",
          borderRadius: "8px 8px 0 0",
          boxShadow: "0 8px 16px rgba(0,0,0,0.5)",
          zIndex: 3,
          opacity: gameState.keyCollected ? 1 : 0.6,
        }}
      >
        <div
          style={{
            color: "white",
            fontSize: 9,
            textAlign: "center",
            marginTop: 20,
            fontWeight: "bold",
          }}
        >
          {gameState.keyCollected ? "OPEN" : "SALIR"}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: gameState.keyX,
          top: gameState.keyY,
          fontSize: 28,
          zIndex: 4,
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
            boxShadow: "0 6px 12px rgba(0,0,0,0.4)",
            border: "2px solid #fff",
            zIndex: 5,
            transition: "left 0.05s linear, top 0.05s linear",
          }}
        />
      ))}
    </div>
  );
}
