"use client";

import React, { useState, useEffect } from "react";
import { db, auth } from "../../../lib/firebase"; // sesuaikan path
import { collection, addDoc, getDocs, orderBy, query, serverTimestamp } from "firebase/firestore";
import { onAuthStateChanged, User } from "firebase/auth";

type LampKey = "dapur" | "tamu" | "makan";
type LampState = "ON" | "OFF";

const TOPICS: LampKey[] = ["dapur", "tamu", "makan"];

export default function Page() {
  const [status, setStatus] = useState<Record<LampKey, LampState>>({
    dapur: "OFF",
    tamu: "OFF",
    makan: "OFF",
  });
  const [logs, setLogs] = useState<any[]>([]);
  const [user, setUser] = useState<User | null>(null);

  // Ambil user auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsub();
  }, []);

  // Fetch logs dari Firebase
  const fetchLogs = async () => {
    const q = query(collection(db, "lampu_logs"), orderBy("timestamp", "desc"));
    const snapshot = await getDocs(q);
    setLogs(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  // Simpan log ke Firebase
  const logAction = async (key: LampKey, action: LampState) => {
    if (!user) return;
    try {
      await addDoc(collection(db, "lampu_logs"), {
        user: user.email,
        lampu: key,
        action,
        timestamp: serverTimestamp(),
      });
      fetchLogs();
    } catch (err) {
      console.error("Failed to log action:", err);
    }
  };

  const toggleLamp = async (key: LampKey) => {
    const newState: LampState = status[key] === "ON" ? "OFF" : "ON";
    setStatus((s) => ({ ...s, [key]: newState }));
    await logAction(key, newState);
  };

  return (
    <main style={{ padding: 24 }}>
      <h1>Kontrol Lampu (Firebase Logging)</h1>

      <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
        {TOPICS.map((k) => (
          <div key={k} style={{ border: "1px solid #ddd", padding: 16, borderRadius: 8 }}>
            <h3 style={{ textTransform: "capitalize" }}>{k}</h3>
            <p>Status: <strong>{status[k]}</strong></p>
            <button onClick={() => toggleLamp(k)}>
              {status[k] === "ON" ? "Matikan" : "Nyalakan"}
            </button>
          </div>
        ))}
      </div>

      <section style={{ marginTop: 24 }}>
        <h2>Activity Log</h2>
        <div style={{ maxHeight: 300, overflow: "auto", border: "1px solid #eee", padding: 10 }}>
          {logs.length === 0 ? (
            <p style={{ color: "#666" }}>No logs yet.</p>
          ) : (
            logs.map((log, i) => (
              <div key={i} style={{ fontSize: 13, padding: "4px 0", borderBottom: "1px dashed #f0f0f0" }}>
                {new Date(log.timestamp?.seconds * 1000 || Date.now()).toLocaleString()} • {log.user} • {log.lampu} {log.action}
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
