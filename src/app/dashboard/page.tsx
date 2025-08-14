"use client";

import React, { useEffect, useRef, useState } from "react";
import mqtt, { MqttClient, IClientOptions } from "mqtt";
import { auth, db } from "../../../lib/firebase"; // sesuaikan path
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

// Topik lampu
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

  if (!url || !username || !password) throw new Error("Missing env vars");

  return mqtt.connect(url, {
    username,
    password,
    reconnectPeriod: 3000,
    clientId: `${prefix}${Math.floor(Math.random() * 10000)}`,
  });
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
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string>("guest"); // default guest

  // Auth & fetch role
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const docRef = doc(db, "users", u.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setRole(data.role ?? "guest");
        }
      }
    });
    return () => unsub();
  }, []);

  // MQTT connection
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
      if (!mounted) return;
      if (role === "admin") setLog((l) => [new Date().toLocaleTimeString() + " • " + s, ...l].slice(0, 100));
    };

    client.on("connect", () => {
      setConnected(true);
      pushLog("Connected to MQTT broker");
      client.subscribe(Object.values(TOPICS), { qos: 0 }, (err) => {
        if (err) pushLog("Subscribe error: " + String(err));
        else pushLog("Subscribed to lampu topics");
      });
    });

    client.on("reconnect", () => {
      setConnected(false);
      pushLog("Reconnecting...");
    });

    client.on("close", () => {
      setConnected(false);
      pushLog("Connection closed");
    });

    client.on("error", (err) => {
      pushLog("MQTT Error: " + String(err));
      console.error(err);
    });

    client.on("message", (topic, payload) => {
      const msg = payload.toString().trim();
      pushLog(`Recv ${topic} -> ${msg}`);
      if (topic === TOPICS.dapur) setStatus((s) => ({ ...s, dapur: msg === "ON" ? "ON" : "OFF" }));
      if (topic === TOPICS.tamu) setStatus((s) => ({ ...s, tamu: msg === "ON" ? "ON" : "OFF" }));
      if (topic === TOPICS.makan) setStatus((s) => ({ ...s, makan: msg === "ON" ? "ON" : "OFF" }));
    });

    return () => {
      mounted = false;
      client.end(true);
      clientRef.current = null;
    };
  }, [role]);

  const publish = (topic: string, message: string) => {
    const client = clientRef.current;
    if (!client || !connected) {
      alert("Belum terhubung ke broker MQTT");
      return;
    }
    client.publish(topic, message, { qos: 0 }, (err) => {
      if (err) console.error(err);
      if (role === "admin") {
        setLog((l) => [new Date().toLocaleTimeString() + ` • Publish ${topic} -> ${message}`, ...l].slice(0, 100));
      }
      // optimistic UI
      if (topic === TOPICS.dapur) setStatus((s) => ({ ...s, dapur: message === "ON" ? "ON" : "OFF" }));
      if (topic === TOPICS.tamu) setStatus((s) => ({ ...s, tamu: message === "ON" ? "ON" : "OFF" }));
      if (topic === TOPICS.makan) setStatus((s) => ({ ...s, makan: message === "ON" ? "ON" : "OFF" }));
    });
  };

  return (
    <main style={{ padding: 24 }}>
      <h1>MQTT Lampu Dashboard</h1>
      <p>Connection: <strong style={{ color: connected ? "green" : "red" }}>{connected ? "Connected" : "Disconnected"}</strong></p>

      <div style={{ display: "flex", gap: 16 }}>
        {(["dapur", "tamu", "makan"] as LampKey[]).map((k) => (
          <div key={k} style={{ border: "1px solid #ddd", padding: 12, borderRadius: 6 }}>
            <h3 style={{ textTransform: "capitalize" }}>{k}</h3>
            <p>Status: {status[k]}</p>
            <button onClick={() => publish(TOPICS[k], "ON")}>ON</button>
            <button onClick={() => publish(TOPICS[k], "OFF")}>OFF</button>
          </div>
        ))}
      </div>

      {role === "admin" && (
        <section style={{ marginTop: 24 }}>
          <h2>Activity Log (Admin only)</h2>
          <div style={{ maxHeight: 200, overflow: "auto", border: "1px solid #eee", padding: 8 }}>
            {log.length === 0 ? <p>No logs yet.</p> : log.map((r, i) => <div key={i}>{r}</div>)}
          </div>
        </section>
      )}
    </main>
  );
}
