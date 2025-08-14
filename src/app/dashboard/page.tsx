"use client";

import React, { useEffect, useRef, useState } from "react";
import mqtt, { MqttClient, IClientOptions } from "mqtt";

/**
 * Single-file Next.js client component that:
 * - connects to an MQTT broker via WebSocket (wss)
 * - subscribes to topics lampu/dapur, lampu/tamu, lampu/makan
 * - allows publishing ON/OFF to each topic
 *
 * Requirements:
 * - npm install mqtt
 * - .env.local with NEXT_PUBLIC_MQTT_URL, NEXT_PUBLIC_MQTT_USER, NEXT_PUBLIC_MQTT_PASS
 */

// Topik yang dipakai
const TOPICS = {
  dapur: "lampu/dapur",
  tamu: "lampu/tamu",
  makan: "lampu/makan",
} as const;

type LampKey = keyof typeof TOPICS;
type LampState = "ON" | "OFF" | "UNKNOWN";

function createClient(): MqttClient {
  const url = process.env.NEXT_PUBLIC_MQTT_URL;
  const username = process.env.NEXT_PUBLIC_MQTT_USER;
  const password = process.env.NEXT_PUBLIC_MQTT_PASS;
  const prefix = process.env.NEXT_PUBLIC_MQTT_CLIENT_PREFIX ?? "nextjs_";

  if (!url || !username || !password) {
    throw new Error(
      "Missing env vars. Please set NEXT_PUBLIC_MQTT_URL, NEXT_PUBLIC_MQTT_USER, NEXT_PUBLIC_MQTT_PASS in .env.local"
    );
  }

  // Jangan set `protocol` di options — URL 'wss://' sudah menentukan protokol
  const options: IClientOptions = {
    username,
    password,
    reconnectPeriod: 3000,
    clientId: `${prefix}${Math.floor(Math.random() * 10000)}`,
  };

  return mqtt.connect(url, options);
}

export default function Page() {
  const clientRef = useRef<MqttClient | null>(null);
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState<Record<LampKey, LampState>>({
    dapur: "UNKNOWN",
    tamu: "UNKNOWN",
    makan: "UNKNOWN",
  });
  const [log, setLog] = useState<string[]>([]);

  useEffect(() => {
    let mounted = true;
    let client: MqttClient;

    try {
      client = createClient();
    } catch (err: any) {
      console.error(err);
      setLog((l) => [...l, `ENV ERROR: ${err.message}`]);
      return;
    }

    clientRef.current = client;

    const pushLog = (s: string) => {
      setLog((l) => [new Date().toLocaleTimeString() + " • " + s, ...l].slice(0, 100));
    };

    client.on("connect", () => {
      if (!mounted) return;
      setConnected(true);
      pushLog("Connected to MQTT broker");
      // subscribe all lamp topics
      client.subscribe(Object.values(TOPICS), { qos: 0 }, (err) => {
        if (err) pushLog("Subscribe error: " + String(err));
        else pushLog("Subscribed to lampu topics");
      });
    });

    client.on("reconnect", () => {
      if (!mounted) return;
      setConnected(false);
      pushLog("Reconnecting...");
    });

    client.on("close", () => {
      if (!mounted) return;
      setConnected(false);
      pushLog("Connection closed");
    });

    client.on("error", (err) => {
      if (!mounted) return;
      pushLog("MQTT Error: " + String(err));
      console.error("MQTT Error", err);
    });

    client.on("message", (topic, payload) => {
      if (!mounted) return;
      const msg = payload.toString().trim();
      pushLog(`Recv ${topic} -> ${msg}`);
      if (topic === TOPICS.dapur) setStatus((s) => ({ ...s, dapur: msg === "ON" ? "ON" : "OFF" }));
      if (topic === TOPICS.tamu) setStatus((s) => ({ ...s, tamu: msg === "ON" ? "ON" : "OFF" }));
      if (topic === TOPICS.makan) setStatus((s) => ({ ...s, makan: msg === "ON" ? "ON" : "OFF" }));
    });

    // cleanup
    return () => {
      mounted = false;
      try {
        client.end(true);
      } catch (e) {
        console.warn("Error closing client", e);
      }
      clientRef.current = null;
    };
  }, []);

  const publish = (topic: string, message: string) => {
    const client = clientRef.current;
    if (!client || !connected) {
      alert("Belum terhubung ke broker MQTT");
      return;
    }
    client.publish(topic, message, { qos: 0 }, (err) => {
      if (err) {
        setLog((l) => [new Date().toLocaleTimeString() + " • Publish err: " + String(err), ...l].slice(0, 100));
        console.error("Publish err", err);
      } else {
        setLog((l) => [new Date().toLocaleTimeString() + ` • Publish ${topic} -> ${message}`, ...l].slice(0, 100));
        // optimistic update
        if (topic === TOPICS.dapur) setStatus((s) => ({ ...s, dapur: message === "ON" ? "ON" : "OFF" }));
        if (topic === TOPICS.tamu) setStatus((s) => ({ ...s, tamu: message === "ON" ? "ON" : "OFF" }));
        if (topic === TOPICS.makan) setStatus((s) => ({ ...s, makan: message === "ON" ? "ON" : "OFF" }));
      }
    });
  };

  return (
    <main style={{ padding: 24, fontFamily: "system-ui, Arial" }}>
      <h1>MQTT Lampu Dashboard (Next.js single-file)</h1>
      <p>
        Connection:{" "}
        <strong style={{ color: connected ? "green" : "red" }}>{connected ? "Connected" : "Disconnected"}</strong>
      </p>

      <div style={{ display: "flex", gap: 18, marginTop: 18, flexWrap: "wrap" }}>
        {(["dapur", "tamu", "makan"] as LampKey[]).map((k) => (
          <div
            key={k}
            style={{
              border: "1px solid #ddd",
              padding: 16,
              borderRadius: 8,
              width: 220,
              textAlign: "center",
              boxShadow: "0 3px 10px rgba(0,0,0,0.04)",
            }}
          >
            <h3 style={{ textTransform: "capitalize", marginBottom: 8 }}>{k}</h3>
            <div style={{ marginBottom: 10 }}>Status: <strong>{status[k]}</strong></div>
            <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
              <button onClick={() => publish(TOPICS[k], "ON")} style={{ padding: "8px 12px" }}>
                ON
              </button>
              <button onClick={() => publish(TOPICS[k], "OFF")} style={{ padding: "8px 12px" }}>
                OFF
              </button>
            </div>
          </div>
        ))}
      </div>

      <section style={{ marginTop: 28 }}>
        <h3>Activity Log (recent)</h3>
        <div style={{ maxHeight: 220, overflow: "auto", border: "1px solid #eee", padding: 10, borderRadius: 6 }}>
          {log.length === 0 ? (
            <div style={{ color: "#666" }}>No activity yet.</div>
          ) : (
            log.map((r, i) => (
              <div key={i} style={{ fontSize: 13, padding: "6px 0", borderBottom: "1px dashed #f0f0f0" }}>
                {r}
              </div>
            ))
          )}
        </div>
      </section>

      <section style={{ marginTop: 18 }}>
        <small style={{ color: "#666" }}>
          Note: MQTT runs client-side in the browser. Keep your broker credentials safe (do not push .env.local to public repos).
        </small>
      </section>
    </main>
  );
}
