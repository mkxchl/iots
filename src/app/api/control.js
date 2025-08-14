// app/api/control/route.js
export async function POST(request) {
  try {
    const { device, action } = await request.json();

    // IP publik atau lokal ESP32 (kalau di jaringan yang sama)
    const ESP_IP = "http://192.168.1.100"; // ganti IP sesuai ESP32 kamu

    const res = await fetch(`${ESP_IP}/${device}/${action}`, {
      method: "POST",
    });

    const text = await res.text();

    return new Response(JSON.stringify({ status: text }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500 }
    );
  }
}