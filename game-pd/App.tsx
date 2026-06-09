import { useEffect, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import * as ScreenOrientation from "expo-screen-orientation";

function TouchButton({
  label,
  onPressIn,
  onPressOut,
  style,
  textStyle,
}: {
  label: string;
  onPressIn: () => void;
  onPressOut: () => void;
  style: any;
  textStyle: any;
}) {
  return (
    <View
      style={style}
      onTouchStart={() => onPressIn()}
      onTouchEnd={() => onPressOut()}
      onTouchCancel={() => onPressOut()}
    >
      <Text style={textStyle}>{label}</Text>
    </View>
  );
}

export default function App() {
  const ws = useRef<WebSocket | null>(null);

  const inputRef = useRef({
    left: false,
    right: false,
    jump: false,
  });

  const lastSentRef = useRef("___");

  useEffect(() => {
    ScreenOrientation.lockAsync(
      ScreenOrientation.OrientationLock.LANDSCAPE
    );

    const connect = () => {
      const socket = new WebSocket("ws://10.56.2.34:3000");

      socket.onopen = () => {
        console.log("🟢 conectado al host");
      };

      socket.onclose = () => {
        console.log("🔴 desconectado, reconectando...");
        setTimeout(connect, 1000);
      };

      socket.onerror = () => {
        socket.close();
      };

      socket.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data);

          if (data.type === "init") {
            console.log("🎮 ID asignado:", data.id);
          }
        } catch {}
      };

      ws.current = socket;
    };

    connect();

    return () => {
      ws.current?.close();
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (ws.current?.readyState !== 1) return;

      const payload = JSON.stringify(inputRef.current);

      if (payload === lastSentRef.current) return;

      lastSentRef.current = payload;

      ws.current.send(payload);
    }, 29);

    return () => clearInterval(interval);
  }, []);

  const setInput = (
    key: "left" | "right" | "jump",
    value: boolean
  ) => {
    if (inputRef.current[key] === value) return;

    inputRef.current[key] = value;

    if (ws.current?.readyState === 1) {
      ws.current.send(JSON.stringify(inputRef.current));
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Controller</Text>

      <View style={styles.controls}>
        <View style={styles.left}>
          <View style={styles.glowWrapBlue}>
            <View style={styles.glowLayerBlue} />

            <TouchButton
              label="◀"
              style={styles.btn}
              textStyle={styles.btnText}
              onPressIn={() => setInput("left", true)}
              onPressOut={() => setInput("left", false)}
            />
          </View>

          <View style={styles.glowWrapBlue}>
            <View style={styles.glowLayerBlue} />

            <TouchButton
              label="▶"
              style={styles.btn}
              textStyle={styles.btnText}
              onPressIn={() => setInput("right", true)}
              onPressOut={() => setInput("right", false)}
            />
          </View>
        </View>

        <View style={styles.right}>
          <View style={styles.glowWrapRed}>
            <View style={styles.glowLayerRed} />

            <TouchButton
              label="▲"
              style={styles.jumpBtn}
              textStyle={styles.jumpText}
              onPressIn={() => setInput("jump", true)}
              onPressOut={() => setInput("jump", false)}
            />
          </View>
        </View>
      </View>

      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#676060",
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
    gap: 30,
    marginLeft: 90,
    marginTop: 130,
  },

  right: {
    justifyContent: "center",
    alignItems: "center",
    marginRight: 120,
    marginTop: 50,
  },

  btn: {
    backgroundColor: "#1e90ff",
    paddingVertical: 25,
    paddingHorizontal: 30,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  jumpBtn: {
    backgroundColor: "#ff3b30",
    paddingVertical: 55,
    paddingHorizontal: 45,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
  },

  glowWrapBlue: {
    alignItems: "center",
    justifyContent: "center",
  },

  glowWrapRed: {
    alignItems: "center",
    justifyContent: "center",
  },

  glowLayerBlue: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 20,
    backgroundColor: "#1e90ff",

    opacity: 0.4,

    shadowColor: "#1e90ff",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 35,
    elevation: 30,
  },

  glowLayerRed: {
    position: "absolute",
    width: 140,
    height: 165,
    borderRadius: 60,
    backgroundColor: "#ff3b30",

    opacity: 0.35,

    shadowColor: "#ff3b30",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 45,
    elevation: 35,
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

  jumpText: {
    color: "#fff",
    fontSize: 35,
    fontWeight: "bold",
    transform: [{ scale: 1.7 }],
  },
});
