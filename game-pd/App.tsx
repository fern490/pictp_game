import { useEffect, useRef } from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import { StatusBar } from "expo-status-bar";
import * as ScreenOrientation from "expo-screen-orientation";

export default function App() {
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    // 🔥 Forzar modo horizontal (landscape)
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);

    ws.current = new WebSocket("ws://10.56.2.64:3000");

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

  const sendInput = (dir: "left" | "right" | "jump", isPressed: boolean) => {
    ws.current?.send(
      JSON.stringify({
        input: {
          left: dir === "left" ? isPressed : false,
          right: dir === "right" ? isPressed : false,
          jump: dir === "jump" ? isPressed : false,
        },
      }),
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pico Park Controller</Text>

      <View style={styles.controls}>
        {/* IZQUIERDA */}
        <View style={styles.left}>
          <Pressable
            onPressIn={() => sendInput("left", true)}
            onPressOut={() => sendInput("left", false)}
            style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
          >
            <Text style={styles.btnText}>◀</Text>
          </Pressable>

          <Pressable
            onPressIn={() => sendInput("right", true)}
            onPressOut={() => sendInput("right", false)}
            style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
          >
            <Text style={styles.btnText}>▶</Text>
          </Pressable>
        </View>

        {/* SALTO (derecha estilo clásico) */}
        <View style={styles.right}>
          <Pressable
            onPressIn={() => sendInput("jump", true)}
            onPressOut={() => sendInput("jump", false)}
            style={({ pressed }) => [
              styles.jumpBtn,
              pressed && styles.btnPressed,
            ]}
          >
            <Text style={styles.btnText}>JUMP</Text>
          </Pressable>
        </View>
      </View>

      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111",
    justifyContent: "space-between",
    padding: 20,
  },

  title: {
    color: "#fff",
    fontSize: 18,
    textAlign: "center",
    fontWeight: "bold",
  },

  controls: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  left: {
    flexDirection: "row",
    gap: 20,
    marginLeft: 30,
    marginTop: 10
  },

  right: {
    justifyContent: "center",
    alignItems: "center",
  },

  btn: {
    backgroundColor: "#1e90ff",
    paddingVertical: 25,
    paddingHorizontal: 30,
    borderRadius: 14,
  },

  jumpBtn: {
    backgroundColor: "#ff3b30",
    paddingVertical: 55,
    paddingHorizontal: 45,
    borderRadius: 60,
  },

  btnPressed: {
    transform: [{ scale: 0.92 }],
    opacity: 0.7,
  },

  btnText: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "bold",
  },
});
