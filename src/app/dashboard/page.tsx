"use client";

import { useEffect, useState } from "react";
import Navbar from "../components/Nav";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth, db } from "../../../lib/firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import Swal from "sweetalert2";
import { LogOut } from "lucide-react";

const endpoint = "http://192.168.1.140";

type LampuKey = "dapur" | "tamu" | "makan";
type LampuState = { [key in LampuKey]: boolean };

export default function LampuDashboard() {
  const [lampu, setLampu] = useState<LampuState>({
    dapur: false,
    tamu: false,
    makan: false,
  });
  const [logs, setLogs] = useState<any[]>([]);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<"admin" | "user" | null>(null);
  const [loading, setLoading] = useState(true);
  const [isToggling, setIsToggling] = useState<LampuKey | null>(null);

  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
      } else {
        setUserEmail(user.email ?? null);
        await fetchUserRole(user.uid);
        fetchLampuStates();
        fetchLogs();
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const fetchUserRole = async (uid: string) => {
    try {
      const docRef = doc(db, "users", uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserRole(data.role === "admin" ? "admin" : "user");
      } else {
        setUserRole("user");
      }
    } catch (error) {
      console.error("Gagal mengambil role user", error);
      setUserRole("user");
    }
  };

  const fetchLampuStates = async () => {
    ["dapur", "tamu", "makan"].forEach((key) =>
      fetchLampuState(key as LampuKey)
    );
  };

  const fetchLampuState = async (key: LampuKey) => {
    try {
      const res = await fetch(`${endpoint}/${key}`);
      const state = await res.text();
      setLampu((prev) => ({ ...prev, [key]: state === "ON" }));
    } catch (err) {
      console.error(`Gagal fetch ${key}`, err);
    }
  };

  const toggleLampu = async (key: LampuKey) => {
    setIsToggling(key);
    try {
      await fetch(`${endpoint}/${key}`, { method: "POST" });
      await fetchLampuState(key);
      await logLampuAction(key, !lampu[key]);
      await fetchLogs();

      Swal.fire({
        icon: "success",
        title: `Lampu ${key} ${!lampu[key] ? "dinyalakan" : "dimatikan"}`,
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (err) {
      console.error(`Gagal toggle ${key}`, err);
      Swal.fire({
        icon: "error",
        title: `Gagal kontrol lampu ${key}`,
      });
    }
    setIsToggling(null);
  };

  const logLampuAction = async (key: LampuKey, state: boolean) => {
    if (!userEmail) return;
    try {
      await addDoc(collection(db, "lampu_logs"), {
        user: {
          email: userEmail,
        },
        lampu: key,
        action: state ? "ON" : "OFF",
        timestamp: serverTimestamp(),
      });
    } catch (error) {
      console.error("Gagal menyimpan log:", error);
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    const q = query(collection(db, "lampu_logs"), orderBy("timestamp", "desc"));
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    setLogs(data);
    setLoading(false);
  };

  const deleteLog = async (id: string) => {
    const confirm = await Swal.fire({
      icon: "warning",
      title: "Yakin hapus log?",
      showCancelButton: true,
      confirmButtonText: "Hapus",
      cancelButtonText: "Batal",
    });

    if (!confirm.isConfirmed) return;

    try {
      await deleteDoc(doc(db, "lampu_logs", id));
      await fetchLogs();
      Swal.fire("Dihapus", "Log berhasil dihapus", "success");
    } catch (err) {
      console.error("Gagal hapus log", err);
      Swal.fire("Gagal", "Tidak bisa menghapus log", "error");
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />
      <div className="p-6">
        {/* Kartu lampu */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {(["dapur", "tamu", "makan"] as LampuKey[]).map((key) => (
            <div
              key={key}
              className="bg-white rounded-lg shadow p-6 text-center"
            >
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                Lampu {key.charAt(0).toUpperCase() + key.slice(1)}
              </h2>
              <div
                className={`w-16 h-16 mx-auto rounded-full shadow flex items-center justify-center ${
                  lampu[key] ? "bg-yellow-400" : "bg-gray-300"
                }`}
              >
                <i className="bx bx-power-off text-black text-3xl"></i>
              </div>
              <p className="mt-2 text-sm text-gray-600">
                Status:{" "}
                <span
                  className={`font-semibold ${
                    lampu[key] ? "text-yellow-600" : "text-gray-500"
                  }`}
                >
                  {lampu[key] ? "Menyala" : "Mati"}
                </span>
              </p>
              <button
                  onClick={() => toggleLampu(key)}
                  disabled={isToggling === key}
                  className={`mt-4 py-2 px-4 rounded w-full flex justify-center items-center gap-2 text-white font-semibold transition duration-300 ease-in-out ${
                    lampu[key]
                      ? "bg-red-500 hover:bg-red-600 shadow-lg"
                      : "bg-green-500 hover:bg-green-600 shadow-md"
                  } ${
                    isToggling === key ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  {isToggling === key
                    ? "Proses..."
                    : lampu[key]
                    ? "Matikan "
                    : "Nyalakan "}
                </button>
            </div>
          ))}
        </div>

        {/* Tabel log */}
        {userRole === "admin" && (
          <div className="bg-white rounded shadow p-6 mt-10 overflow-x-auto">
            <h2 className="text-2xl font-semibold mb-4 text-gray-700">
              Log Kontrol Lampu
            </h2>
            <table className="w-full text-sm text-left text-gray-600">
              <thead className="text-xs text-gray-500">
                <tr>
                  <th className="py-2">Nama</th>
                  <th className="py-2">Lampu</th>
                  <th className="py-2">Aksi</th>
                  <th className="py-2">Waktu</th>
                  <th className="py-2">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b">
                    <td className="py-2">{log.user.email}</td>
                    <td className="py-2 capitalize">{log.lampu}</td>
                    <td className="py-2">{log.action}</td>
                    <td className="py-2">
                      {log.timestamp?.seconds
                        ? new Date(
                            log.timestamp.seconds * 1000
                          ).toLocaleString()
                        : "–"}
                    </td>
                    <td className="py-2">
                      <button
                        onClick={() => deleteLog(log.id)}
                        className="bg-red-500 text-xs p-2 text-white cursor-pointer rounded-4xl"
                      >
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
