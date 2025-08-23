// lib/authUtils.ts
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase"; // pastikan sudah ada firebase config

export async function saveUserToFirestore(user: any) {
  if (!user) return;

  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    // Kalau user baru -> set role default "dosen"
    await setDoc(userRef, {
      uid: user.uid,
      email: user.email,
      name: user.displayName,
      role: "dosen",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } else {
    // Kalau sudah ada -> update timestamp aja
    await setDoc(
      userRef,
      {
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }
}
