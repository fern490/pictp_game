import { useEffect, useRef } from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import { StatusBar } from "expo-status-bar";

export default function App() {
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Conexión estable a la IP de tu PC
    ws.current = new WebSocket("ws://10.56.2.8:3000");

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

  // Función modificada para encender o apagar el movimiento
  const sendInput = (dir: "left" | "right", isPressed: boolean) => {
    ws.current?.send(
      JSON.stringify({
        input: {
          left: dir === "left" ? isPressed : false,
          right: dir === "right" ? isPressed : false,
          jump: false,
        },
      }),
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Controller Pico Park</Text>

      <View style={styles.row}>
        {/* Botón IZQUIERDA */}
        <Pressable 
          onPressIn={() => sendInput("left", true)}   // Al tocar: activa left
          onPressOut={() => sendInput("left", false)} // Al soltar: desactiva left
          style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
        >
          <Text style={styles.btnText}>◀</Text>
        </Pressable>

        {/* Botón DERECHA */}
        <Pressable 
          onPressIn={() => sendInput("right", true)}   // Al tocar: activa right
          onPressOut={() => sendInput("right", false)} // Al soltar: desactiva right
          style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
        >
          <Text style={styles.btnText}>▶</Text>
        </Pressable>
      </View>

      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#222", // Un fondo oscuro queda más profesional para un gamepad
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
  },
  title: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
  },
  row: {
    flexDirection: "row",
    gap: 40,
  },
  btn: {
    backgroundColor: "#1e90ff",
    paddingVertical: 20,
    paddingHorizontal: 40,
    borderRadius: 12,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  btnPressed: {
    backgroundColor: "#0066cc",
    transform: [{ scale: 0.95 }],
  },
  btnText: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "bold",
  },
});