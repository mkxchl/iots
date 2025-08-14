"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Navbar from "../components/Nav";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth, db } from "../../../lib/firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import Swal from "sweetalert2";

// ---- MQTT ----
import * as mqtt from "mqtt";

type LampuKey = "dapur" | "tamu" | "makan";
type LampuState = { [key in LampuKey]: boolean };

const MQTT_URL = "wss://broker.hivemq.com:8884/mqtt"; // WSS WAJIB untuk Vercel/HTTPS
const BASE_TOPIC = "rumah/lampu"; // => rumah/lampu/<key>/{set|status}

export default function LampuDashboard() {
  const [lampu, setLampu] = useState<LampuState>({
    dapur: false,
    tamu: false,
    makan: false,
  });
  const [logs, setLogs] = useState<any[]>([]);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<"admin" | "user" | null>(null);
  const [loading, setLoading] = useState(true);

  // MQTT states
  const [mqttReady, setMqttReady] = useState(false);
  const [mqttStatus, setMqttStatus] = useState<
    "connecting" | "connected" | "reconnecting" | "offline"
  >("connecting");
  const clientRef = useRef<mqtt.MqttClient | null>(null);

  const router = useRouter();

  // ---------- AUTH ----------
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
      } else {
        setUserEmail(user.email ?? null);
        await fetchUserRole(user.uid);
        await fetchLogs();
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const fetchUserRole = async (uid: string) => {
    try {
      const docRef = doc(db, "users", uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserRole(data.role === "admin" ? "admin" : "user");
      } else {
        setUserRole("user");
      }
    } catch {
      setUserRole("user");
    }
  };

  // ---------- MQTT CONNECT ----------
  const clientId = useMemo(
    () => `web-${Math.random().toString(16).slice(2)}`,
    []
  );

  useEffect(() => {
    // Inisialisasi MQTT client (browser)
    const c = mqtt.connect(MQTT_URL, {
      clientId,
      keepalive: 30,
      reconnectPeriod: 2000,
      clean: true,
    });

    clientRef.current = c;
    setMqttStatus("connecting");

    c.on("connect", () => {
      setMqttStatus("connected");
      setMqttReady(true);

      // Subscribe status semua lampu + minta retained
      const topics = [
        `${BASE_TOPIC}/dapur/status`,
        `${BASE_TOPIC}/tamu/status`,
        `${BASE_TOPIC}/makan/status`,
      ];
      c.subscribe(topics, { qos: 0 }, (err) => {
        if (err) console.error("MQTT subscribe error:", err);
      });

      // Minta update status (opsional, jika ESP32 mendukung topik refresh)
      // c.publish(`${BASE_TOPIC}/refresh`, "1");
    });

    c.on("reconnect", () => setMqttStatus("reconnecting"));
    c.on("close", () => setMqttStatus("offline"));
    c.on("offline", () => setMqttStatus("offline"));
    c.on("error", (err) => console.error("MQTT error:", err));

    c.on("message", (topic, payload) => {
      const msg = payload.toString().trim().toLowerCase();
      // contoh: topic = rumah/lampu/dapur/status
      const parts = topic.split("/");
      const key = parts[2] as LampuKey;
      const leaf = parts[3];

      if ((key === "dapur" || key === "tamu" || key === "makan") && leaf === "status") {
        setLampu((prev) => ({
          ...prev,
          [key]: msg === "on",
        }));
      }
    });

    return () => {
      try {
        c.end(true);
      } catch {}
    };
  }, [clientId]);

  // ---------- FIRESTORE LOG ----------
  const fetchLogs = async () => {
    const q = query(collection(db, "lampu_logs"), orderBy("timestamp", "desc"));
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    setLogs(data);
  };

  const logLampuAction = async (key: LampuKey, state: boolean) => {
    if (!userEmail) return;
    try {
      await addDoc(collection(db, "lampu_logs"), {
        user: { email: userEmail },
        lampu: key,
        action: state ? "ON" : "OFF",
        timestamp: serverTimestamp(),
      });
    } catch (e) {
      console.error(e);
    }
  };

  // ---------- ACTIONS ----------
  const publishSet = (key: LampuKey, state: boolean) => {
    const client = clientRef.current;
    if (!client || !mqttReady) {
      Swal.fire({
        icon: "error",
        title: "MQTT belum siap",
        text: "Coba lagi sebentar...",
      });
      return;
    }
    const topic = `${BASE_TOPIC}/${key}/set`;
    const payload = state ? "on" : "off";
    client.publish(topic, payload, { qos: 0, retain: false });
  };

  const toggleLampu = async (key: LampuKey) => {
    const next = !lampu[key];
    publishSet(key, next);
    await logLampuAction(key, next);
    Swal.fire({
      icon: "success",
      title: `Lampu ${key} ${next ? "dinyalakan" : "dimatikan"}`,
      timer: 1200,
      showConfirmButton: false,
    });
  };

  const nyalakanSemua = async () => {
    (["dapur", "tamu", "makan"] as LampuKey[]).forEach((k) => publishSet(k, true));
    for (const k of ["dapur", "tamu", "makan"] as LampuKey[]) {
      await logLampuAction(k, true);
    }
  };

  const matikanSemua = async () => {
    (["dapur", "tamu", "makan"] as LampuKey[]).forEach((k) => publishSet(k, false));
    for (const k of ["dapur", "tamu", "makan"] as LampuKey[]) {
      await logLampuAction(k, false);
    }
  };

  const deleteLog = async (id: string) => {
    const confirm = await Swal.fire({
      icon: "warning",
      title: "Yakin hapus log?",
      showCancelButton: true,
      confirmButtonText: "Hapus",
      cancelButtonText: "Batal",
    });
    if (!confirm.isConfirmed) return;
    try {
      await deleteDoc(doc(db, "lampu_logs", id));
      await fetchLogs();
      Swal.fire("Dihapus", "Log berhasil dihapus", "success");
    } catch {
      Swal.fire("Gagal", "Tidak bisa menghapus log", "error");
    }
  };

  const hapusSemuaLog = async () => {
    const confirm = await Swal.fire({
      title: "Hapus semua log?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Ya, hapus semua",
    });
    if (!confirm.isConfirmed) return;
    const snapshot = await getDocs(collection(db, "lampu_logs"));
    const batch = writeBatch(db);
    snapshot.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    await fetchLogs();
    Swal.fire("Berhasil", "Semua log dihapus", "success");
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  const mqttBadge =
    mqttStatus === "connected"
      ? "bg-green-600"
      : mqttStatus === "connecting" || mqttStatus === "reconnecting"
      ? "bg-yellow-500"
      : "bg-red-600";

  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />
      <div className="p-6 space-y-6">
        {/* Status bar */}
        <div className="flex items-center justify-between gap-3 bg-white rounded-lg p-4 shadow">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 text-white rounded ${mqttBadge}`}>
              MQTT: {mqttStatus}
            </span>
            <span className="text-gray-600 text-sm">Broker: broker.hivemq.com (WSS)</span>
          </div>
          <button
            onClick={handleLogout}
            className="bg-gray-800 text-white px-3 py-2 rounded-md"
          >
            Logout
          </button>
        </div>

        {/* Tombol kontrol semua */}
        <div className="flex flex-wrap gap-4 justify-center">
          <button
            onClick={nyalakanSemua}
            className="bg-green-600 cursor-pointer text-white px-4 py-2 rounded-lg shadow"
          >
            Nyalakan Semua Lampu
          </button>
          <button
            onClick={matikanSemua}
            className="bg-red-600 text-white px-4 py-2 rounded-lg shadow cursor-pointer"
          >
            Matikan Semua Lampu
          </button>
          {userRole === "admin" && (
            <button
              onClick={hapusSemuaLog}
              className="bg-gray-700 text-white px-4 py-2 rounded-lg shadow cursor-pointer"
            >
              Hapus Semua Log
            </button>
          )}
        </div>

        {/* Kartu lampu */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {(["dapur", "tamu", "makan"] as LampuKey[]).map((key) => (
            <div key={key} className="bg-white rounded-lg shadow p-6 text-center">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                Lampu {key.charAt(0).toUpperCase() + key.slice(1)}
              </h2>
              <div
                className={`w-16 h-16 mx-auto rounded-full shadow flex items-center justify-center ${
                  lampu[key] ? "bg-yellow-400" : "bg-gray-300"
                }`}
              >
                <i className="bx bx-power-off text-black text-3xl" />
              </div>
              <p className="mt-2 text-sm text-gray-600">
                Status:{" "}
                <span
                  className={`font-semibold ${
                    lampu[key] ? "text-yellow-600" : "text-gray-500"
                  }`}
                >
                  {lampu[key] ? "Menyala" : "Mati"}
                </span>
              </p>
              <button
                onClick={() => toggleLampu(key)}
                className={`mt-4 py-2 px-4 rounded w-full flex justify-center items-center gap-2 text-white font-semibold transition duration-300 ease-in-out ${
                  lampu[key]
                    ? "bg-red-500 hover:bg-red-600 shadow-lg"
                    : "bg-green-500 hover:bg-green-600 shadow-md"
                }`}
              >
                {lampu[key] ? "Matikan" : "Nyalakan"}
              </button>
            </div>
          ))}
        </div>

        {/* Tabel log */}
        {userRole === "admin" && (
          <div className="bg-white rounded shadow p-6 mt-10 overflow-x-auto">
            <h2 className="text-2xl font-semibold mb-4 text-gray-700">
              Log Kontrol Lampu
            </h2>
            <table className="w-full text-sm text-left text-gray-600">
              <thead className="text-xs text-gray-500">
                <tr>
                  <th className="py-2">Nama</th>
                  <th className="py-2">Lampu</th>
                  <th className="py-2">Aksi</th>
                  <th className="py-2">Waktu</th>
                  <th className="py-2">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b">
                    <td className="py-2">{log.user?.email ?? "-"}</td>
                    <td className="py-2 capitalize">{log.lampu}</td>
                    <td className="py-2">{log.action}</td>
                    <td className="py-2">
                      {log.timestamp?.seconds
                        ? new Date(log.timestamp.seconds * 1000).toLocaleString()
                        : "–"}
                    </td>
                    <td className="py-2">
                      <button
                        onClick={() => deleteLog(log.id)}
                        className="bg-red-500 text-xs p-2 text-white cursor-pointer rounded-4xl"
                      >
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
