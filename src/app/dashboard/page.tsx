"use client";

import React, { useEffect, useRef, useState } from "react";
import mqtt, { MqttClient, IClientOptions } from "mqtt";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "../../lib/firebase"; // sesuaikan path jika perlu

/**
 * Single-file Next.js client component:
 * - Tailwind UI (Navbar + logout)
 * - MQTT (wss) client-side
 * - publish/subscribe ke topik lampu/dapur, lampu/tamu, lampu/makan
 *
 * Requirements:
 * - Tailwind CSS configured
 * - npm install mqtt
 * - .env.local: NEXT_PUBLIC_MQTT_URL, NEXT_PUBLIC_MQTT_USER, NEXT_PUBLIC_MQTT_PASS, NEXT_PUBLIC_MQTT_CLIENT_PREFIX (opsional)
 */

// Topics
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
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();

  // Auth state (so we can show email + logout)
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
        // jika belum login, redirect ke /login
        router.push("/login");
      }
    });
    return () => unsub();
  }, [router]);

  // MQTT connection
  useEffect(() => {
    let mounted = true;
    let client: MqttClient;

    try {
      client = createClient();
    } catch (err: any) {
      console.error(err);
      setLog((l) => [new Date().toLocaleTimeString() + " • ENV ERROR: " + err.message, ...l]);
      return;
    }

    clientRef.current = client;

    const pushLog = (s: string) => {
      setLog((l) => [new Date().toLocaleTimeString() + " • " + s, ...l].slice(0, 200));
    };

    client.on("connect", () => {
      if (!mounted) return;
      setConnected(true);
      pushLog("Connected to MQTT broker");
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
        setLog((l) => [new Date().toLocaleTimeString() + " • Publish err: " + String(err), ...l].slice(0, 200));
        console.error("Publish err", err);
      } else {
        setLog((l) => [new Date().toLocaleTimeString() + ` • Publish ${topic} -> ${message}`, ...l].slice(0, 200));
        // optimistic UI:
        if (topic === TOPICS.dapur) setStatus((s) => ({ ...s, dapur: message === "ON" ? "ON" : "OFF" }));
        if (topic === TOPICS.tamu) setStatus((s) => ({ ...s, tamu: message === "ON" ? "ON" : "OFF" }));
        if (topic === TOPICS.makan) setStatus((s) => ({ ...s, makan: message === "ON" ? "ON" : "OFF" }));
      }
    });
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/login");
    } catch (err) {
      console.error("Logout error", err);
      alert("Gagal logout");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <header className="bg-white shadow">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <div className="text-2xl font-bold text-indigo-600">IoT Dashboard</div>
              <div className="text-sm text-gray-500">MQTT • Realtime</div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-600">
                {user ? (
                  <>
                    <span className="mr-2 hidden sm:inline">Signed in as</span>
                    <span className="font-medium">{user.email}</span>
                  </>
                ) : (
                  <span className="text-gray-400">Not signed in</span>
                )}
              </div>

              <button
                onClick={handleLogout}
                className="bg-red-500 hover:bg-red-600 text-white text-sm px-3 py-1 rounded-md shadow-sm"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-800">Kontrol Lampu</h1>
            <p className="text-sm text-gray-500">Hubungkan via HiveMQ / broker MQTT (WSS)</p>
          </div>

          <div className="flex items-center gap-4">
            <div
              className={`px-3 py-1 rounded-md text-sm font-medium ${
                connected ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
              }`}
            >
              {connected ? "Connected" : "Disconnected"}
            </div>
            <button
              onClick={() => {
                // quick reconnect: end + recreate
                const c = clientRef.current;
                try {
                  c?.end(true);
                } catch {}
                // small delay to let previous end
                setTimeout(() => {
                  try {
                    const newClient = createClient();
                    clientRef.current = newClient;
                    // reuse same handlers as initial effect won't run again — but simplest is to reload page
                    // for reliability recommend reload
                    window.location.reload();
                  } catch (err) {
                    alert("Gagal reconnect (cek ENV dan console)");
                  }
                }, 300);
              }}
              className="bg-indigo-600 text-white px-3 py-1 rounded-md text-sm"
            >
              Reconnect
            </button>
          </div>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {(["dapur", "tamu", "makan"] as LampKey[]).map((k) => (
            <div key={k} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-800 capitalize">{k}</h2>
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    status[k] === "ON" ? "bg-yellow-400" : "bg-gray-200"
                  }`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-black"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path d="M10 2a1 1 0 011 1v2a1 1 0 11-2 0V3a1 1 0 011-1zM4.221 5.221a1 1 0 011.415 0l1.415 1.414a1 1 0 01-1.415 1.415L4.22 6.636a1 1 0 010-1.415zM16.364 6.636a1 1 0 010 1.415l-1.414 1.414a1 1 0 11-1.415-1.415l1.414-1.414a1 1 0 011.415 0zM5 10a5 5 0 1010 0 5 5 0 00-10 0z" />
                  </svg>
                </div>
              </div>

              <p className="mt-4 text-sm text-gray-600">
                Status: <span className="font-medium">{status[k]}</span>
              </p>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => publish(TOPICS[k], "ON")}
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 rounded-md shadow-sm"
                >
                  Nyalakan
                </button>
                <button
                  onClick={() => publish(TOPICS[k], "OFF")}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 rounded-md shadow-sm"
                >
                  Matikan
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Activity / Log */}
        <section className="mt-8 bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-700">Activity Log</h3>
            <small className="text-sm text-gray-500">Recent messages</small>
          </div>
          <div className="max-h-48 overflow-auto">
            {log.length === 0 ? (
              <div className="text-gray-500">No activity yet.</div>
            ) : (
              log.map((r, i) => (
                <div
                  key={i}
                  className="py-2 border-b last:border-b-0 text-sm text-gray-700"
                >
                  {r}
                </div>
              ))
            )}
          </div>
        </section>

        <footer className="mt-6 text-center text-sm text-gray-500">
          Note: broker credentials are read from <code className="bg-gray-100 px-1 rounded">.env.local</code> (NEXT_PUBLIC_MQTT_URL / USER / PASS).
        </footer>
      </main>
    </div>
  );
}
