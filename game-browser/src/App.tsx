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
  2: [
    { x: 1, y: 540, width: 2500, height: 40 },
    
    { x: 90, y: 420, width: 110, height: 30 }, 

    { x: 0, y: 290, width: 45, height: 200 }, 
  ],
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
    keyX: 350,
    keyY: 50,
    doorX: 1220,
    doorY: 280,
    keyCarrierId: null,
    buttonX: 385,
    buttonY: 436,
    buttonPressed: false,
    buttonTimer: 5,
    buttonActive: false,
  });

  const playersRef = useRef<Player[]>([]);
  const gameStateRef = useRef<GameState>(gameState);
  const wsRef = useRef<WebSocket | null>(null);

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

    const platforms = LEVEL_PLATFORMS[currentGeo.level] || [];
    const PLAYER_SIZE = 30;
    const BUTTON_WIDTH = 40;

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

      if (player.input.jump && physics.isGrounded) {
        physics.vy = -14;
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
        nextX = 60;
        nextY = 400;
        physics.vy = 0;
        physics.isGrounded = false;

        if (currentGeo.keyCarrierId === player.id) {
          currentGeo.keyCollected = false;
          currentGeo.keyCarrierId = null;
          currentGeo.keyX = 350;
          currentGeo.keyY = 90;
        }

        return { ...player, x: nextX, y: nextY };
      }

      let groundedThisFrame = false;
      let isOnBoostPlatform = false;

      const matchButtonX =
        nextX + PLAYER_SIZE > currentGeo.buttonX &&
        nextX < currentGeo.buttonX + BUTTON_WIDTH;
      if (matchButtonX) {
        if (
          player.y + PLAYER_SIZE <= currentGeo.buttonY &&
          nextY + PLAYER_SIZE >= currentGeo.buttonY
        ) {
          nextY = currentGeo.buttonY - PLAYER_SIZE;
          physics.vy = 0;
          groundedThisFrame = true;

          if (!currentGeo.buttonPressed) {
            currentGeo.buttonPressed = true;
            currentGeo.buttonTimer = 5;
            currentGeo.buttonActive = false;
            currentGeo.buttonPressedAt = Date.now();
          }
        }
      }

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

            const isFirstBoost = plat.x === 323 && plat.y === 278;
            const isSecondBoost = plat.x === 886 && plat.y === 440;

            if (currentGeo.level === 1 && (isFirstBoost || isSecondBoost)) {
              isOnBoostPlatform = true;

              if (currentGeo.buttonActive) {
                physics.vy = -27;
                groundedThisFrame = false;
              }
            }
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
      physics.isOnBoostPlatform = isOnBoostPlatform;
      return { ...player, x: nextX, y: nextY };
    });

    for (let loop = 0; loop < 3; loop++) {
      for (let i = 0; i < currentPlayers.length; i++) {
        for (let j = 0; j < currentPlayers.length; j++) {
          if (i === j) continue;

          const p1 = currentPlayers[i];
          const p2 = currentPlayers[j];

          const physics1 = velocitiesRef.current[p1.id];

          const overlapX =
            p1.x + PLAYER_SIZE > p2.x && p1.x < p2.x + PLAYER_SIZE;
          const overlapY =
            p1.y + PLAYER_SIZE > p2.y && p1.y < p2.y + PLAYER_SIZE;

          if (overlapX && overlapY) {
            const overlapLeft = p1.x + PLAYER_SIZE - p2.x;
            const overlapRight = p2.x + PLAYER_SIZE - p1.x;
            const overlapTop = p1.y + PLAYER_SIZE - p2.y;
            const overlapBottom = p2.y + PLAYER_SIZE - p1.y;

            const minX = Math.min(overlapLeft, overlapRight);
            const minY = Math.min(overlapTop, overlapBottom);

            if (minY < minX) {
              if (p1.y < p2.y) {
                p1.y = p2.y - PLAYER_SIZE;
                if (physics1) {
                  physics1.vy = 0;
                  physics1.isGrounded = true;
                }
              }
            } else {
              if (overlapLeft < overlapRight) {
                if (p1.input.right && !p2.input.left) {
                  p1.x = p2.x - PLAYER_SIZE;
                } else if (p2.input.left && !p1.input.right) {
                  p2.x = p1.x + PLAYER_SIZE;
                } else {
                  const mid = (p1.x + p2.x) / 2;
                  p1.x = mid - PLAYER_SIZE / 2;
                  p2.x = mid + PLAYER_SIZE / 2;
                }
              } else {
                if (p1.input.left && !p2.input.right) {
                  p1.x = p2.x + PLAYER_SIZE;
                } else if (p2.input.right && !p1.input.left) {
                  p2.x = p1.x - PLAYER_SIZE;
                } else {
                  const mid = (p1.x + p2.x) / 2;
                  p2.x = mid - PLAYER_SIZE / 2;
                  p1.x = mid + PLAYER_SIZE / 2;
                }
              }
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

    const allAtDoor =
      currentPlayers.length === 1 &&
      currentPlayers.every(
        (p) =>
          Math.abs(p.x - currentGeo.doorX) < 40 &&
          Math.abs(p.y - currentGeo.doorY) < 40,
      );

    if (allAtDoor) {
      if (currentGeo.level === 1) {
        currentGeo.level = 2;

        currentGeo.keyCollected = false;
        currentGeo.keyCarrierId = null;
        currentGeo.keyX = 350;
        currentGeo.keyY = 90;
        currentGeo.doorX = 900;
        currentGeo.doorY = 360;

        currentGeo.buttonX = 2;
        currentGeo.buttonY = 270;
        currentGeo.buttonPressed = false;
        currentGeo.buttonActive = false;
        currentGeo.buttonTimer = 5;

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
        currentGeo.keyX = 350;
        currentGeo.keyY = 90;
        currentGeo.doorX = 940;
        currentGeo.doorY = 280;

        currentGeo.buttonX = 385;
        currentGeo.buttonY = 436;
        currentGeo.buttonPressed = false;
        currentGeo.buttonActive = false;
        currentGeo.buttonTimer = 5;
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
              ? "🚀 ¡VE A LA PLATAFORMA GRIS!"
              : `⏱️ IMPULSO EN: ${gameState.buttonTimer}...`}
          </p>
        )}
      </div>

      {(LEVEL_PLATFORMS[gameState.level] || []).map((plat, index) => {
        const isBoostPlatform =
          gameState.level === 1 &&
          ((plat.x === 323 && plat.y === 278) ||
            (plat.x === 886 && plat.y === 440));

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
          width: 40,
          height: 20,
          backgroundColor: gameState.buttonActive
            ? "#4caf50"
            : gameState.buttonPressed
              ? "#ff9800"
              : "#f44336",
          borderRadius: "6px 6px 0 0",
          border: "2px solid #fff",
          boxShadow: "0 4px 8px rgba(0,0,0,0.4)",
          zIndex: 3,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          color: "white",
          fontSize: 10,
          fontWeight: "bold",
        }}
      >
        {gameState.buttonPressed ? gameState.buttonTimer : "PUSH"}
      </div>

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
