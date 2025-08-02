'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  collection,
  getDocs,
  doc,
  deleteDoc,
  updateDoc,
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../../../lib/firebase';

interface UserData {
  id: string;
  email: string;
  displayName?: string;
  role?: string;
  photoURL?: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [currentUserId, setCurrentUserId] = useState('');
  const router = useRouter();

  // Cek login & role
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDoc = await getDocs(collection(db, 'users'));
        const current = userDoc.docs.find((d) => d.id === user.uid)?.data();
        const role = current?.role || 'user';

        if (role !== 'admin') {
          setAccessDenied(true);
        } else {
          setCurrentUserId(user.uid);
        }
      } else {
        setAccessDenied(true);
      }
    });

    return () => unsubscribe();
  }, []);

  // Ambil data user
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'users'));
        const userList: UserData[] = [];

        querySnapshot.forEach((doc) => {
          userList.push({ id: doc.id, ...doc.data() } as UserData);
        });

        setUsers(userList);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching users:', error);
        setLoading(false);
      }
    };

    if (!accessDenied) fetchUsers();
  }, [accessDenied]);

  // Hapus user
  const handleDelete = async (id: string) => {
    if (confirm('Yakin ingin menghapus user ini?')) {
      await deleteDoc(doc(db, 'users', id));
      setUsers(users.filter((user) => user.id !== id));
    }
  };

  // Edit role user (toggle)
  const toggleRole = async (id: string, currentRole: string = 'user') => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    await updateDoc(doc(db, 'users', id), { role: newRole });
    setUsers(
      users.map((user) =>
        user.id === id ? { ...user, role: newRole } : user
      )
    );
  };

  // Cek akses
  if (accessDenied) {
    return (
      <div className="p-6 text-center text-red-600 font-semibold">
        Akses ditolak. Halaman ini hanya dapat diakses oleh Admin.
      </div>
    );
  }

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Daftar Pengguna</h1>

      <div className="overflow-x-auto">
        <table className="min-w-full border border-gray-200 rounded shadow-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-2 text-left">Foto</th>
              <th className="px-4 py-2 text-left">Nama</th>
              <th className="px-4 py-2 text-left">Email</th>
              <th className="px-4 py-2 text-left">Role</th>
              <th className="px-4 py-2 text-left">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-2">
                  <img
                    src={user.photoURL || '/default-avatar.png'}
                    alt="foto"
                    className="w-10 h-10 rounded-full object-cover border"
                  />
                </td>
                <td className="px-4 py-2">{user.displayName || '-'}</td>
                <td className="px-4 py-2">{user.email}</td>
                <td className="px-4 py-2 uppercase text-sm text-gray-600">
                  {user.role || '-'}
                </td>
                <td className="px-4 py-2 flex gap-2">
                  {user.id !== currentUserId && (
                    <>
                      <button
                        onClick={() => toggleRole(user.id, user.role)}
                        className="px-3 py-1 bg-yellow-500 text-white rounded text-sm hover:bg-yellow-600"
                      >
                        Toggle Role
                      </button>
                      <button
                        onClick={() => handleDelete(user.id)}
                        className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
                      >
                        Hapus
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
