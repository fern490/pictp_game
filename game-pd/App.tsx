import { useEffect, useRef } from "react";
import { StyleSheet, Text, View, Button } from "react-native";
import { StatusBar } from "expo-status-bar";

export default function App() {
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    ws.current = new WebSocket("ws://10.56.2.50:3000");

    ws.current.onopen = () => {
      console.log("conectado al host");
    };

    ws.current.onmessage = (msg) => {
      console.log("server:", msg.data);
    };

    return () => {
      ws.current?.close();
    };
  }, []);

  const send = (dir: string) => {
    ws.current?.send(
      JSON.stringify({
        id: "player1",
        input: {
          left: dir === "left",
          right: dir === "right",
          jump: false,
        },
      }),
    );
  };

  return (
    <View style={styles.container}>
      <Text>Controller</Text>

      <Button title="LEFT" onPress={() => send("left")} />
      <Button title="RIGHT" onPress={() => send("right")} />

      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
});
