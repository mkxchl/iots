// app/api/relay/route.ts
import { NextRequest, NextResponse } from "next/server";

const ESP_IP = "192.168.1.140"; // Ganti dengan IP ESP kamu

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const path = searchParams.get("path"); // Misal: "dapur", "kamar", dll

  if (!path) {
    return NextResponse.json({ error: "Path tidak ditemukan" }, { status: 400 });
  }

  try {
    const espRes = await fetch(`http://${ESP_IP}/${path}`);
    const result = await espRes.text();
    return NextResponse.json({ result });
  } catch (err) {
    return NextResponse.json({ error: "Gagal menghubungi ESP" }, { status: 500 });
  }
}
