// pages/api/lampu/[lampu].ts
import type { NextApiRequest, NextApiResponse } from "next";

// Ganti IP ini sesuai IP lokal ESP32
const ESP_IP = "http://192.168.1.166";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { lampu } = req.query; // dapur, tamu, makan

  if (!lampu || typeof lampu !== "string") {
    return res.status(400).json({ error: "Lampu tidak valid" });
  }

  try {
    if (req.method === "GET") {
      const response = await fetch(`${ESP_IP}/${lampu}`);
      const text = await response.text();
      return res.status(200).json({ status: text });
    }

    if (req.method === "POST") {
      const response = await fetch(`${ESP_IP}/${lampu}`, { method: "POST" });
      const text = await response.text();
      return res.status(200).json({ status: text });
    }

    return res.status(405).json({ error: "Metode tidak diizinkan" });
  } catch (error) {
    return res.status(500).json({ error: "Tidak bisa terhubung ke ESP" });
  }
}
