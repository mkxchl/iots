let lampuState = false; // false = mati, true = nyala

export default function handler(req, res) {
  res.status(200).json({ state: lampuState ? "ON" : "OFF" });
}