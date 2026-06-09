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
};

type Platform = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const COLORS = ["#FF5733", "#33FF57", "#3357FF", "#F3FF33"];

// MAPA COMPACTO: Todo cabe dentro de una pantalla estándar sin scroll horizontal
const LEVEL_PLATFORMS: Record<number, Platform[]> = {
  1: [
    // --- Zona Izquierda de Inicio ---
    { x: 30, y: 520, width: 180, height: 40 },  // Base de aparición
    { x: 120, y: 390, width: 140, height: 40 }, // Escalón de subida izquierdo
    
    // --- Mecanismo Central (Botón e Impulso) ---
    { x: 260, y: 290, width: 200, height: 40 }, // Plataforma alta del botón
    { x: 320, y: 460, width: 160, height: 40 }, // Apoyo bajo el botón
    
    // --- Camino Fluyente hacia la Derecha ---
    { x: 520, y: 410, width: 150, height: 40 }, // Escalón central derecho
    { x: 780, y: 450, width: 160, height: 40 }, // Escalón previo a la meta
    { x: 1140, y: 340, width: 180, height: 40 }, // ¡Plataforma final de la puerta!
  ],
  2: [
    // --- Nivel 2 Compacto ---
    { x: 30, y: 540, width: 160, height: 40 },
    { x: 120, y: 420, width: 140, height: 40 },
    { x: 280, y: 310, width: 180, height: 40 }, // Botón Nivel 2
    { x: 480, y: 440, width: 150, height: 40 },
    { x: 660, y: 350, width: 140, height: 40 },
    { x: 840, y: 420, width: 180, height: 40 }, // Plataforma final Nivel 2
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
    keyY: 90,     
    doorX: 1220, 
    doorY: 280,   
    keyCarrierId: null,
    buttonX: 340,
    buttonY: 270, 
    buttonPressed: false,
    buttonTimer: 3,
    buttonActive: false,
  });

  const playersRef = useRef<Player[]>([]);
  const gameStateRef = useRef<GameState>(gameState);
  const wsRef = useRef<WebSocket | null>(null);
  const timerIntervalRef = useRef<any>(null); 

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
              // Los jugadores aparecen de forma segura en la nueva plataforma izquierda
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
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

  const pressButton = () => {
    if (gameStateRef.current.buttonPressed) return;

    gameStateRef.current.buttonPressed = true;
    gameStateRef.current.buttonTimer = 3;
    setGameState({ ...gameStateRef.current });

    timerIntervalRef.current = setInterval(() => {
      let currentGeo = { ...gameStateRef.current };
      if (currentGeo.buttonTimer > 0) {
        currentGeo.buttonTimer -= 1;
      } else if (currentGeo.buttonTimer === 0 && !currentGeo.buttonActive) {
        currentGeo.buttonActive = true;
        
        setTimeout(() => {
          let resetGeo = { ...gameStateRef.current };
          resetGeo.buttonPressed = false;
          resetGeo.buttonActive = false;
          resetGeo.buttonTimer = 3;
          gameStateRef.current = resetGeo;
          setGameState(resetGeo);
        }, 1000);

        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      }
      gameStateRef.current = currentGeo;
      setGameState(currentGeo);
    }, 1000);
  };

  const updatePhysics = () => {
    let currentPlayers = [...playersRef.current];
    let currentGeo = { ...gameStateRef.current };

    if (currentPlayers.length === 0) return;

    const platforms = LEVEL_PLATFORMS[currentGeo.level] || [];
    const PLAYER_SIZE = 30;
    const BUTTON_WIDTH = 40;

    currentPlayers = currentPlayers.map((player) => {
      if (!velocitiesRef.current[player.id]) {
        velocitiesRef.current[player.id] = { vy: 0, isGrounded: false };
      }

      const physics = velocitiesRef.current[player.id];
      let nextX = player.x;
      let nextY = player.y;

      if (player.input.left) nextX -= 5;
      if (player.input.right) nextX += 5;

      const JUMP_FORCE = currentGeo.buttonActive ? -22 : -14;
      
      if (player.input.jump && physics.isGrounded) {
        physics.vy = JUMP_FORCE;
        physics.isGrounded = false;
      }

      const GRAVITY = 0.8;
      const TERMINAL_VELOCITY = 12;
      physics.vy += GRAVITY;
      if (physics.vy > TERMINAL_VELOCITY) physics.vy = TERMINAL_VELOCITY;

      nextY += physics.vy;
      
      // Bloqueamos los bordes de la pantalla física para que nadie se salga de lo visible
      nextX = Math.max(0, Math.min(window.innerWidth - PLAYER_SIZE, nextX));

      // Caída al vacío: Regresan al inicio (plataforma izquierda)
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

      const matchButtonX = nextX + PLAYER_SIZE > currentGeo.buttonX && nextX < currentGeo.buttonX + BUTTON_WIDTH;
      if (matchButtonX) {
        if (player.y + PLAYER_SIZE <= currentGeo.buttonY && nextY + PLAYER_SIZE >= currentGeo.buttonY) {
          nextY = currentGeo.buttonY - PLAYER_SIZE;
          physics.vy = 0;
          groundedThisFrame = true;

          if (!currentGeo.buttonPressed) {
            pressButton();
          }
        }
      }

      for (const plat of platforms) {
        const matchX = nextX + PLAYER_SIZE > plat.x && nextX < plat.x + plat.width;

        if (matchX) {
          if (player.y + PLAYER_SIZE <= plat.y && nextY + PLAYER_SIZE >= plat.y) {
            nextY = plat.y - PLAYER_SIZE;
            physics.vy = 0;
            groundedThisFrame = true;
          } else if (player.y >= plat.y + plat.height && nextY <= plat.y + plat.height) {
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

    // Lógica de recolección de llave
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
      const carrier = currentPlayers.find((p) => p.id === currentGeo.keyCarrierId);
      if (carrier) {
        currentGeo.keyX = carrier.x + 5;
        currentGeo.keyY = carrier.y - 25;
      } else {
        currentGeo.keyCollected = false;
        currentGeo.keyCarrierId = null;
      }
    }

    // Puerta de salida
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
          currentGeo.keyX = 350; 
          currentGeo.keyY = 90;
          currentGeo.doorX = 900; // Puerta nivel 2 compacta también
          currentGeo.doorY = 360;
        } else {
          alert("¡Ganaron el juego completo!");
          currentGeo.level = 1;
          currentGeo.keyCollected = false;
          currentGeo.keyCarrierId = null;
          currentGeo.keyX = 350;
          currentGeo.keyY = 90;
          currentGeo.doorX = 940;
          currentGeo.doorY = 280;
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
        background: "linear-gradient(to bottom, #0b101e 0%, #1a2540 100%)",
        overflow: "hidden", // <-- ELIMINADAS LAS BARRAS DE DESPLAZAMIENTO COMPLETAMENTE
        fontFamily: "sans-serif",
      }}
    >
      {/* Estrellas */}
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

      {/* Interfaz / HUD */}
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
          {gameState.keyCollected ? "🔑 ¡Llave obtenida! Vayan a la puerta de la derecha" : ""}
        </p>
        {gameState.buttonPressed && (
          <p style={{ margin: "4px 0 0 0", color: gameState.buttonActive ? "#4caf50" : "#ff9800", fontSize: 16, fontWeight: "bold" }}>
            {gameState.buttonActive ? "🚀 ¡SUPER SALTO LISTO! ¡SALTA!" : `⏱️ IMPULSO EN: ${gameState.buttonTimer}...`}
          </p>
        )}
      </div>

      {/* Plataformas */}
      {(LEVEL_PLATFORMS[gameState.level] || []).map((plat, index) => (
        <div
          key={index}
          style={{
            position: "absolute",
            left: plat.x,
            top: plat.y,
            width: plat.width,
            height: plat.height,
            background: "linear-gradient(to bottom, #a1d974 0%, #7cb64b 25%, #634631 30%, #4a3222 100%)",
            borderRadius: "12px",
            boxShadow: "0 12px 0px rgba(0,0,0,0.3), inset 0 4px 0 rgba(255,255,255,0.1)",
            borderBottom: "6px solid #23160e",
            zIndex: 2,
          }}
        />
      ))}

      {/* Botón Físico */}
      <div
        style={{
          position: "absolute",
          left: gameState.buttonX,
          top: gameState.buttonY,
          height: 20,
          backgroundColor: gameState.buttonActive ? "#4caf50" : (gameState.buttonPressed ? "#ff9800" : "#f44336"),
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

      {/* Puerta a la Derecha Visible */}
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
          boxShadow: "0 8px 16px rgba(0,0,0,0.5)",
          zIndex: 3,
          opacity: gameState.keyCollected ? 1 : 0.6
        }}
      >
        <div style={{ color: "white", fontSize: 9, textAlign: "center", marginTop: 20, fontWeight: "bold" }}>
          {gameState.keyCollected ? "OPEN" : "LOCK"}
        </div>
      </div>

      {/* Llave Alta */}
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

      {/* Jugadores */}
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