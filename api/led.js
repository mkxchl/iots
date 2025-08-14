export default function handler(req, res) {
  if (req.method === "POST") {
    const { status } = req.body;

    console.log("Status lampu:", status); // bisa dihubungkan ke Firestore/DB
    return res.status(200).json({ message: "Lampu " + (status ? "nyala" : "mati") });
  }

  res.status(405).json({ error: "Method Not Allowed" });
}