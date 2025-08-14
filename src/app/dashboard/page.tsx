"use client";

import { useState } from "react";

export default function DashboardPage() {
  const [lampu, setLampu] = useState({
    dapur: "OFF",
    tamu: "OFF",
    makan: "OFF",
  });

  async function toggleLampu(nama: "dapur" | "tamu" | "makan") {
    const res = await fetch(`/api/lampu/${nama}`, { method: "POST" });
    const data = await res.json();
    setLampu((prev) => ({ ...prev, [nama]: data.status }));
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Kontrol Lampu</h1>

      {Object.keys(lampu).map((key) => (
        <div key={key} style={{ marginBottom: 10 }}>
          <span style={{ marginRight: 10 }}>
            Lampu {key} : {lampu[key as keyof typeof lampu]}
          </span>
          <button onClick={() => toggleLampu(key as any)}>Toggle</button>
        </div>
      ))}
    </div>
  );
}
