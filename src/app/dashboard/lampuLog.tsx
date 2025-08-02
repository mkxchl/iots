"use client";

import { useEffect, useState } from "react";
import { db } from "../../../lib/firebase";
import { collection, query, orderBy, getDocs } from "firebase/firestore";

type Log = {
  id: string;
  user: string;
  lampu: string;
  action: string;
  timestamp: any;
};

export default function LampuLogList() {
  const [logs, setLogs] = useState<Log[]>([]);

  const fetchLogs = async () => {
    const q = query(collection(db, "lampu_logs"), orderBy("timestamp", "desc"));
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Log[];
    setLogs(data);
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="bg-white rounded shadow p-6 mt-10">
      <h2 className="text-2xl font-semibold mb-4 text-gray-700">Riwayat Kontrol Lampu</h2>
      <table className="w-full text-sm text-left text-gray-600">
        <thead className="text-xs text-gray-500 uppercase border-b">
          <tr>
            <th className="py-2">Email</th>
            <th className="py-2">Lampu</th>
            <th className="py-2">Aksi</th>
            <th className="py-2">Waktu</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id} className="border-b">
              <td className="py-2">{log.user}</td>
              <td className="py-2 capitalize">{log.lampu}</td>
              <td className="py-2">{log.action}</td>
              <td className="py-2">
                {log.timestamp?.toDate?.().toLocaleString() || "–"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
