"use client";

import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../../lib/firebase";
import { ArrowLeft } from "lucide-react";

interface UserData {
  uid: string;
  email: string;
  name: string;
  role: string;
  photoURL?: string;
}

export default function AdminSettings() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const router = useRouter();

  // ✅ Cek login & role admin
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        router.replace("/login");
        return;
      }
      setIsAuthenticated(true);

      const snap = await getDocs(collection(db, "users"));
      const me = snap.docs.find((d) => d.id === u.uid);
      if (!me || me.data().role !== "admin") {
        alert("Akses ditolak. Hanya admin yang bisa masuk.");
        router.replace("/");
        return;
      }
      setCurrentUserRole("admin");
    });
    return () => unsub();
  }, [router]);

  // ✅ Ambil semua user dari Firestore
  const fetchUsers = async () => {
    setLoading(true);
    const querySnapshot = await getDocs(collection(db, "users"));
    const list: UserData[] = querySnapshot.docs.map((docSnap) => ({
      uid: docSnap.id,
      ...(docSnap.data() as Omit<UserData, "uid">),
    }));
    setUsers(list);
    setLoading(false);
  };

  useEffect(() => {
    if (currentUserRole === "admin") fetchUsers();
  }, [currentUserRole]);

  // ✅ Update role user
  const handleRoleChange = async (uid: string, newRole: string) => {
    await updateDoc(doc(db, "users", uid), { role: newRole });
    fetchUsers();
  };

  // ✅ Hapus user
  const handleDelete = async (uid: string) => {
    if (!confirm("Yakin ingin menghapus user ini?")) return;
    await deleteDoc(doc(db, "users", uid));
    fetchUsers();
  };

  if (!isAuthenticated) return null;
  if (loading)
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );

  return (
    <div className="min-h-screen p-6 text-gray-800 bg-gray-50 w-full">
      {/* 🔙 Button Back */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 mb-6 transition-colors cursor-pointer"
      >
        <ArrowLeft size={20} />
        <span className="font-medium">Kembali</span>
      </button>

      <h1 className="text-3xl font-bold mb-8 text-indigo-700">
        Admin Panel
      </h1>

      {/* Grid Cards */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {users.map((u) => (
          <div
            key={u.uid}
            className="bg-white shadow-md rounded-lg p-5 flex flex-col items-center text-center hover:shadow-lg transition"
          >
            <img
              src={u.photoURL || "/default-avatar.png"}
              alt={u.name || "User"}
              className="w-20 h-20 rounded-full border mb-4 object-cover"
            />
            <h2 className="font-semibold text-lg">{u.name || "Tanpa Nama"}</h2>
            <p className="text-gray-500 text-sm mb-3">{u.email}</p>

            {/* 🎨 Styled Select */}
            <select
              value={u.role}
              onChange={(e) => handleRoleChange(u.uid, e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 shadow-sm hover:bg-white transition mb-3"
            >
              <option value="dosen">👨‍🏫 Dosen</option>
              <option value="mahasiswa">🎓 Mahasiswa</option>
              <option value="admin">⭐ Admin</option>
            </select>

            <button
              onClick={() => handleDelete(u.uid)}
              className="bg-red-500 text-white px-4 py-1.5 rounded-full hover:bg-white hover:text-black transition-colors text-sm shadow cursor-pointer w-full"
            >
              Hapus
            </button>
          </div>
        ))}

        {users.length === 0 && (
          <div className="col-span-full text-center py-10 text-gray-500 italic">
            Tidak ada user
          </div>
        )}
      </div>
    </div>
  );
}
