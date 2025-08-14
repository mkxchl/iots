"use client";
import { useState } from "react";

export default function Dashboard() {
  const [loading, setLoading] = useState(false);

  async function controlLamp(device: string, action: "on" | "off") {
    setLoading(true);
    const res = await fetch("/api/control", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device, action }),
    });
    const data = await res.json();
    console.log(data);
    setLoading(false);
  }

  return (
    <div>
      <button onClick={() => controlLamp("dapur", "on")}>Dapur ON</button>
      <button onClick={() => controlLamp("dapur", "off")}>Dapur OFF</button>

      <button onClick={() => controlLamp("tamu", "on")}>Tamu ON</button>
      <button onClick={() => controlLamp("tamu", "off")}>Tamu OFF</button>

      <button onClick={() => controlLamp("makan", "on")}>Makan ON</button>
      <button onClick={() => controlLamp("makan", "off")}>Makan OFF</button>

      {loading && <p>Processing...</p>}
    </div>
  );
}
