import { NextResponse } from "next/server";

const ESP32_IP = "http://192.168.1.166"; // ganti sesuai IP ESP32 kamu

export async function GET(
  req: Request,
  { params }: { params: { lampu: string } }
) {
  try {
    const res = await fetch(`${ESP32_IP}/${params.lampu}`, { method: "GET" });
    const text = await res.text();
    return NextResponse.json({ status: text });
  } catch (error) {
    return NextResponse.json({ error: "Gagal konek ke ESP32" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: { lampu: string } }
) {
  try {
    const res = await fetch(`${ESP32_IP}/${params.lampu}`, { method: "POST" });
    const text = await res.text();
    return NextResponse.json({ status: text });
  } catch (error) {
    return NextResponse.json({ error: "Gagal konek ke ESP32" }, { status: 500 });
  }
}
