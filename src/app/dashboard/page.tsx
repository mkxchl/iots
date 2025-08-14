"use client";

import { useEffect, useState } from "react";
import Swal from "sweetalert2";

type LampuKey = "dapur" | "tamu" | "makan";

export default function LampuDashboard() {
  const [lampu, setLampu] = useState<{ [key in LampuKey]: boolean }>({
    dapur: false,
    tamu: false,
    makan: false,
  });
  const [isToggling, setIsToggling] = useState<LampuKey | null>(null);

  const fetchLampuState = async (key: LampuKey) => {
    try {
      const res = await fetch(`/api/lampu/${key}`);
      const data = await res.json();
      setLampu((prev) => ({ ...prev, [key]: data.status === "ON" }));
    } catch {}
  };

  const fetchLampuStates = async () => {
    await fetchLampuState("dapur");
    await fetchLampuState("tamu");
    await fetchLampuState("makan");
  };

  const toggleLampu = async (key: LampuKey) => {
    setIsToggling(key);
    try {
      await fetch(`/api/lampu/${key}`, { method: "POST" });
      await fetchLampuState(key);
      Swal.fire({
        icon: "success",
        title: `Lampu ${key} ${!lampu[key] ? "dinyalakan" : "dimatikan"}`,
        timer: 1500,
        showConfirmButton: false,
      });
    } catch {
      Swal.fire({ icon: "error", title: `Gagal kontrol lampu ${key}` });
    }
    setIsToggling(null);
  };

  const nyalakanSemua = async () => {
    for (const key of ["dapur", "tamu", "makan"] as LampuKey[]) {
      await fetch(`/api/lampu/${key}`, { method: "POST" });
    }
    fetchLampuStates();
  };

  const matikanSemua = async () => {
    for (const key of ["dapur", "tamu", "makan"] as LampuKey[]) {
      await fetch(`/api/lampu/${key}`, { method: "POST" });
    }
    fetchLampuStates();
  };

  useEffect(() => {
    fetchLampuStates();
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h1>Kontrol Lampu IoT</h1>
      <div style={{ display: "flex", gap: 10 }}>
        {(["dapur", "tamu", "makan"] as LampuKey[]).map((key) => (
          <button
            key={key}
            onClick={() => toggleLampu(key)}
            disabled={isToggling === key}
            style={{
              padding: "10px 20px",
              background: lampu[key] ? "green" : "gray",
              color: "white",
              border: "none",
              borderRadius: 5,
              cursor: "pointer",
            }}
          >
            {lampu[key] ? `Matikan ${key}` : `Nyalakan ${key}`}
          </button>
        ))}
      </div>
      <div style={{ marginTop: 20 }}>
        <button onClick={nyalakanSemua} style={{ marginRight: 10 }}>
          Nyalakan Semua
        </button>
        <button onClick={matikanSemua}>Matikan Semua</button>
      </div>
    </div>
  );
}
