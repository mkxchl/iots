"use client";

import React, { useEffect, useRef, useState } from "react";
import mqtt, { MqttClient, IClientOptions } from "mqtt";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "../../../lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import Swal from "sweetalert2";

const TOPICS = {
  dapur: "lampu/dapur",
  tamu: "lampu/tamu",
  makan: "lampu/makan",
  sensor: "sensor/distance",
  servo: "servo/control",
} as const;

type LampKey = "dapur" | "tamu" | "makan";
type LampState = "ON" | "OFF" | "UNKNOWN";

function createClient(): MqttClient {
  const url = process.env.NEXT_PUBLIC_MQTT_URL;
  const username = process.env.NEXT_PUBLIC_MQTT_USER;
  const password = process.env.NEXT_PUBLIC_MQTT_PASS;
  const prefix = process.env.NEXT_PUBLIC_MQTT_CLIENT_PREFIX ?? "nextjs_";

  if (!url || !username || !password) {
    throw new Error("Missing MQTT env vars");
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
  const [sensorOn, setSensorOn] = useState(true);
  const [status, setStatus] = useState<Record<LampKey, LampState>>({
    dapur: "OFF",
    tamu: "OFF",
    makan: "OFF",
  });

  const [servoStatus, setServoStatus] = useState<"OPEN" | "CLOSE" | "UNKNOWN">(
    "UNKNOWN"
  );

  const [sensorData, setSensorData] = useState<string>("Belum ada data");
  const [log, setLog] = useState<string[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const router = useRouter();

  // 🔑 Firebase Auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u) {
        router.push("/login");
        return;
      }

      try {
        const snap = await getDoc(doc(db, "users", u.uid));
        setIsAdmin(snap.exists() && snap.data().role === "admin");

        // ✅ Alert hanya sekali saat login
        const hasShown = sessionStorage.getItem("loginAlertShown");
        if (!hasShown) {
          const Toast = Swal.mixin({
            toast: true,
            position: "top-end",
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true,
            didOpen: (toast) => {
              toast.onmouseenter = Swal.stopTimer;
              toast.onmouseleave = Swal.resumeTimer;
            },
          });

          Toast.fire({
            icon: "success",
            title: `Selamat datang ${u.displayName || "User"} 👋`,
          });

          sessionStorage.setItem("loginAlertShown", "true");
        }
      } catch {
        setIsAdmin(false);
      }
    });
    return () => unsub();
  }, [router]);

  // 🔌 MQTT Client Setup
  useEffect(() => {
    let mounted = true;
    let client: MqttClient;
    try {
      client = createClient();
    } catch (err: any) {
      console.error(err);
      return;
    }

    clientRef.current = client;

    const pushLog = (s: string) => {
      setLog((l) =>
        [new Date().toLocaleTimeString() + " • " + s, ...l].slice(0, 200)
      );
    };

    client.on("connect", () => {
      if (!mounted) return;
      setConnected(true);
      pushLog("Connected to MQTT broker");
      client.subscribe(Object.values(TOPICS), { qos: 0 }, (err) => {
        if (err) pushLog("Subscribe error: " + String(err));
        else pushLog("Subscribed to all topics");
      });
    });

    client.on("close", () => {
      if (!mounted) return;
      setConnected(false);
      pushLog("Connection closed");
    });

    client.on("message", (topic, payload) => {
      if (!mounted) return;
      const msg = payload.toString().trim();
      pushLog(`Recv ${topic} -> ${msg}`);

      if (topic === TOPICS.dapur)
        setStatus((s) => ({ ...s, dapur: msg === "ON" ? "ON" : "OFF" }));
      if (topic === TOPICS.tamu)
        setStatus((s) => ({ ...s, tamu: msg === "ON" ? "ON" : "OFF" }));
      if (topic === TOPICS.makan)
        setStatus((s) => ({ ...s, makan: msg === "ON" ? "ON" : "OFF" }));
      if (topic === TOPICS.sensor) setSensorData(msg);
      if (topic === TOPICS.servo)
        setServoStatus(msg === "OPEN" ? "OPEN" : "CLOSE");
    });

    return () => {
      mounted = false;
      client.end(true);
      clientRef.current = null;
    };
  }, []);

  const publish = (topic: string, message: string) => {
    const client = clientRef.current;
    if (!client || !connected) {
      alert("Belum terhubung ke broker MQTT");
      return;
    }
    client.publish(topic, message);
  };

  // ✅ Logout dengan konfirmasi
  const handleLogout = async () => {
    const result = await Swal.fire({
      title: "Yakin mau logout?",
      text: "Kamu akan keluar dari aplikasi.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Ya, logout",
      cancelButtonText: "Batal",
    });

    if (result.isConfirmed) {
      try {
        await signOut(auth);
        sessionStorage.removeItem("loginAlertShown"); // reset supaya bisa muncul lagi nanti
        Swal.fire({
          icon: "success",
          title: "Berhasil Logout",
          timer: 1500,
          showConfirmButton: false,
        });
        router.push("/login");
      } catch {
        Swal.fire("Error", "Gagal logout", "error");
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="text-2xl font-bold text-indigo-600">IoT App</div>

            <div className="flex items-center space-x-4">
              <img
                src={user?.photoURL || "/default-avatar.png"}
                alt="User Profile"
                className="w-8 h-8 rounded-full border"
              />

              {/* kalau role admin, munculkan icon setting */}
              {isAdmin && (
                <button
                  onClick={() => router.push("../admin")}
                  className="text-gray-600 hover:text-black"
                  title="Admin Settings"
                >
                  <i className="bx bx-cog text-2xl"></i>
                </button>
              )}

              <button
                onClick={handleLogout}
                className="text-black text-sm px-3 py-1 border-none rounded hover:bg-red-500 hover:text-white transition-colors cursor-pointer"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-black">
        <h1 className="text-2xl font-semibold mb-4">Kontrol IoT</h1>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {(["dapur", "tamu", "makan"] as LampKey[]).map((k) => (
            <div key={k} className="bg-white p-6 rounded-lg shadow">
              <div className="flex justify-between">
                <h2 className="text-lg font-semibold capitalize">{k}</h2>
                <div
                  className={`w-6 h-6 rounded-full ${
                    status[k] === "ON" ? "bg-yellow-400" : "bg-gray-200"
                  }`}
                />
              </div>
              <p className="mt-2">Status: {status[k]}</p>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => publish(TOPICS[k], "ON")}
                  className="flex-1 bg-green-500 text-white py-2 rounded"
                >
                  Nyalakan
                </button>
                <button
                  onClick={() => publish(TOPICS[k], "OFF")}
                  className="flex-1 bg-red-500 text-white py-2 rounded"
                >
                  Matikan
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Kontrol Servo</h2>
          <p className="mb-2">Status: {servoStatus}</p>
          <div className="flex gap-4">
            <button
              onClick={() => publish(TOPICS.servo, "OPEN")}
              className="bg-blue-500 text-white px-4 py-2 rounded"
            >
              Buka
            </button>
            <button
              onClick={() => publish(TOPICS.servo, "CLOSE")}
              className="bg-gray-600 text-white px-4 py-2 rounded"
            >
              Tutup
            </button>
          </div>
        </div>

        {isAdmin && (
          <>
            <div className="mt-8 bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-2">Data Sensor</h2>
              <p>{sensorData} CM</p>
            </div>

            <div className="mt-8 bg-white rounded-lg shadow p-4 max-h-48 overflow-auto text-sm">
              <h3 className="font-semibold mb-2">Activity Log</h3>
              {log.map((r, i) => (
                <div key={i} className="border-b last:border-none py-1">
                  {r}
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
