"use client";

import { useEffect, useState } from "react";
import mqtt from "mqtt";

export default function Home() {
  const [client, setClient] = useState<any>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Ganti host dan port sesuai HiveMQ
    const options = {
      protocol: "wss",
      username: "andreas", // Ganti
      password: "Andreas1", // Ganti
      reconnectPeriod: 1000,
    };

    const mqttClient = mqtt.connect(
      "wss://508cd0cd088d413e8d35b6fcfd7ddf6f.s1.eu.hivemq.cloud:8884/mqtt", // Ganti
      options
    );

    mqttClient.on("connect", () => {
      console.log("Terhubung ke HiveMQ");
      setConnected(true);
      mqttClient.subscribe("lampu/#"); // subscribe semua topik lampu
    });

    mqttClient.on("message", (topic, message) => {
      console.log(`Pesan dari ${topic}: ${message.toString()}`);
    });

    setClient(mqttClient);

    return () => {
      mqttClient.end();
    };
  }, []);

  const sendMessage = (topic: string, msg: string) => {
    if (client) {
      client.publish(topic, msg);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Kontrol Lampu MQT</h1>
      <p>Status koneksi: {connected ? "Terhubung" : "Terputus"}</p>

      <div>
        <h3>Lampu Dapur</h3>
        <button onClick={() => sendMessage("lampu/dapur", "ON")}>ON</button>
        <button onClick={() => sendMessage("lampu/dapur", "OFF")}>OFF</button>
      </div>

      <div>
        <h3>Lampu Tamu</h3>
        <button onClick={() => sendMessage("lampu/tamu", "ON")}>ON</button>
        <button onClick={() => sendMessage("lampu/tamu", "OFF")}>OFF</button>
      </div>

      <div>
        <h3>Lampu Makan</h3>
        <button onClick={() => sendMessage("lampu/makan", "ON")}>ON</button>
        <button onClick={() => sendMessage("lampu/makan", "OFF")}>OFF</button>
      </div>
    </div>
  );
}
