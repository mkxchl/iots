"use client";

import { signInWithPopup } from "firebase/auth";
import { auth, provider } from "../../../lib/firebase";
import { useRouter } from "next/navigation";
import { saveUserToFirestore } from "../../../lib/authUtils";

export default function LoginPage() {
  const router = useRouter();

  const handleGoogleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, provider);
      await saveUserToFirestore(result.user); // opsional
      router.push("/dashboard");
    } catch (err: any) {
      alert("Login gagal: " + err.message);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white p-8 rounded shadow-md w-full max-w-md text-center">
        <h1 className="text-2xl font-bold mb-6">Login</h1>
        <button
          onClick={handleGoogleLogin}
          className="bg-red-500 text-white py-2 px-4 rounded hover:bg-red-600 w-full"
        >
          Login with Google
        </button>
      </div>
    </div>
  );
}
