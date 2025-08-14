let lampuState = false;

export default function handler(req, res) {
  if (req.method === "POST") {
    const { action } = req.body;
    lampuState = action === "ON";
    return res.status(200).json({ message: `Lampu ${lampuState ? "nyala" : "mati"}` });
  }
  res.status(405).json({ error: "Method Not Allowed" });
}