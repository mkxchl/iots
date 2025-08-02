import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import { User } from "firebase/auth";

export const saveUserToFirestore = async (user: User) => {
  if (!user.email) return;

  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    // Saat register user baru atau login pertama kali
    await setDoc(userRef, {
      uid: user.uid,
      name: user.displayName || "",
      email: user.email,
      photoURL: user.photoURL || "",
      createdAt: new Date().toISOString(),
      role: "user", // default role
    });

  }
  
};
