import { useEffect, useRef, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import * as ScreenOrientation from "expo-screen-orientation";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import {
  GestureHandlerRootView, State, PanGestureHandler} from "react-native-gesture-handler";

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
    <PanGestureHandler
      onHandlerStateChange={(event) => {
        const { state } = event.nativeEvent;

        if (state === State.BEGAN) {
          onPressIn();
        } else if (
          state === State.END ||
          state === State.CANCELLED ||
          state === State.FAILED
        ) {
          onPressOut();
        }
      }}
    >
      <View style={style}>
        <Text style={textStyle}>{label}</Text>
      </View>
    </PanGestureHandler>
  );
}

export default function App() {
  const [ip, setIp] = useState("10.56.2.65");
  const [currentView, setCurrentView] = useState<"setup" | "gamepad">("setup");
  const [status, setStatus] = useState<
    "disconnected" | "connecting" | "connected"
  >("disconnected");

  const ws = useRef<WebSocket | null>(null);
  const inputRef = useRef({
    left: false,
    right: false,
    jump: false,
  });

  const lastSentRef = useRef("___");
  const blockedRef = useRef(false);

  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);

    return () => {
      ws.current?.close();
      deactivateKeepAwake();
    };
  }, []);

  useEffect(() => {
    if (currentView === "gamepad") {
      activateKeepAwakeAsync();
      console.log("👁️ Wake Lock ACTIVADO: La pantalla no se apagará.");
    } else {
      deactivateKeepAwake();
      console.log("💤 Wake Lock DESACTIVADO.");
    }
  }, [currentView]);

  const connect = (targetIp: string) => {
    if (!targetIp) return;

    setStatus("connecting");
    setCurrentView("gamepad");

    const socket = new WebSocket(`ws://${targetIp}:3000`);

    socket.onopen = () => {
      console.log("🟢 conectado al host");
      setStatus("connected");
    };

    socket.onclose = () => {
      if (blockedRef.current) return;

      console.log("🔴 desconectado, reconectando...");
      setStatus("disconnected");
      setTimeout(() => connect(targetIp), 1500);
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
        if (data.type === "full") {
          alert("La partida ya tiene 4 jugadores.");
          blockedRef.current = true;
          socket.close();
          return;
        }
      } catch {}
    };

    ws.current = socket;
  };

  useEffect(() => {
    if (status !== "connected") return;

    const interval = setInterval(() => {
      if (ws.current?.readyState !== 1) return;

      const payload = JSON.stringify(inputRef.current);
      if (payload === lastSentRef.current) return;

      lastSentRef.current = payload;
      ws.current.send(payload);
    }, 29);

    return () => clearInterval(interval);
  }, [status]);

  const setInput = (key: "left" | "right" | "jump", value: boolean) => {
    if (inputRef.current[key] === value) return;

    inputRef.current[key] = value;

    if (ws.current?.readyState === 1 && status === "connected") {
      ws.current.send(JSON.stringify(inputRef.current));
    }
  };

  const getLedColor = () => {
    if (status === "connected") return "#10B981";
    if (status === "connecting") return "#F59E0B";
    return "#EF4444";
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {currentView === "setup" ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.setupContainer}
        >
          <Text style={styles.setupTitle}>Configurar Servidor de Juego</Text>

          <View style={styles.inputWrapper}>
            <Text style={styles.protocolText}>ws://</Text>
            <TextInput
              style={styles.input}
              value={ip}
              onChangeText={setIp}
              placeholder="Ej: 10.56.2.65"
              placeholderTextColor="#888"
              keyboardType="numbers-and-punctuation"
            />
            <Text style={styles.portText}>:3000</Text>
          </View>

          <Pressable style={styles.connectBtn} onPress={() => connect(ip)}>
            <Text style={styles.connectBtnText}>Vincular Control</Text>
          </Pressable>
        </KeyboardAvoidingView>
      ) : (
        <View style={styles.container}>
          <View style={styles.header}>
            <Pressable
              style={styles.backBtn}
              onPress={() => {
                ws.current?.close();
                setCurrentView("setup");
              }}
            >
              <Text style={styles.backBtnText}>⚙️ Cambiar IP</Text>
            </Pressable>

            <View style={styles.statusContainer}>
              <View style={[styles.led, { backgroundColor: getLedColor() }]} />
              <Text style={styles.title}>
                {status === "connected" && `Conectado a ${ip}`}
                {status === "connecting" && "Buscando servidor..."}
                {status === "disconnected" && "Sin conexión (Reconectando)"}
              </Text>
            </View>
          </View>

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
      )}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  setupContainer: {
    flex: 1,
    backgroundColor: "#222",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  setupTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 20,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#333",
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#555",
  },
  protocolText: { color: "#888", fontSize: 18, fontWeight: "bold" },
  portText: { color: "#888", fontSize: 18, fontWeight: "bold" },
  input: {
    color: "#fff",
    fontSize: 18,
    paddingVertical: 12,
    minWidth: 180,
    textAlign: "center",
  },
  connectBtn: {
    backgroundColor: "#2563EB",
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 8,
  },
  connectBtnText: { color: "#fff", fontSize: 16, fontWeight: "bold" },

  container: {
    flex: 1,
    backgroundColor: "#676060",
    padding: 15,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    borderBottomWidth: 1,
    borderBottomColor: "#5A5454",
    paddingBottom: 8,
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  led: {
    width: 14,
    height: 14,
    borderRadius: 7,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 8,
  },
  title: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  backBtn: {
    backgroundColor: "#333",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  backBtnText: { color: "#ccc", fontSize: 12 },

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
    marginTop: 70,
  },
  right: {
    marginRight: 90,
    marginTop: 23,
  },
  btn: {
    backgroundColor: "#1e90ff",
    paddingVertical: 20,
    paddingHorizontal: 28,
    borderRadius: 14,
  },
  jumpBtn: {
    backgroundColor: "#ff3b30",
    paddingVertical: 55,
    paddingHorizontal: 45,
    borderRadius: 50,
  },
  glowWrapBlue: { alignItems: "center", justifyContent: "center" },
  glowWrapRed: { alignItems: "center", justifyContent: "center" },
  glowLayerBlue: {
    position: "absolute",
    width: 90,
    height: 90,
    borderRadius: 20,
    backgroundColor: "#1e90ff",
    opacity: 0.3,
    elevation: 20,
  },
  glowLayerRed: {
    position: "absolute",
    width: 130,
    height: 160,
    borderRadius: 50,
    backgroundColor: "#ff3b30",
    opacity: 0.3,
    elevation: 25,
  },
  btnText: { color: "#fff", fontSize: 24, fontWeight: "bold" },
  jumpText: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "bold",
  },
});
