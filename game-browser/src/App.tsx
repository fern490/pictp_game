import { useEffect, useState } from "react";

type Player = {
  id: string;
  x: number;
  y: number;
};

export default function App() {
  const [players, setPlayers] = useState<Player[]>([]);

  useEffect(() => {
    const ws = new WebSocket("ws://10.56.2.50:3000");
    ws.onopen = () => {
      console.log("conectado al host");
    };

    ws.onmessage = (msg) => {
      const data = JSON.parse(msg.data);

      if (data.type === "state") {
        setPlayers(data.players);
      }
    };
  }, []);

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      {players.map((p) => (
        <div
          key={p.id}
          style={{
            position: "absolute",
            left: p.x,
            top: p.y,
            width: 30,
            height: 30,
            background: "red",
          }}
        />
      ))}
    </div>
  );
}
