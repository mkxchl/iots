export async function POST(request) {
  try {
    const { device, action } = await request.json();

    const ESP_IP = "http://192.168.1.166"; // IP lokal ESP32
    const response = await fetch(`${ESP_IP}/${device}/${action}`, {
      method: "POST",
    });

    const text = await response.text();

    return new Response(JSON.stringify({ status: text }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  }
}
