import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyBSxu4qeZeD00D5arqDiut0pByyn71aXsA",
    authDomain: "iotandreasss.firebaseapp.com",
    projectId: "iotandreasss",
    storageBucket: "iotandreasss.firebasestorage.app",
    messagingSenderId: "75460953447",
    appId: "1:75460953447:web:52c0d7611c8f9e70285bc2",
    measurementId: "G-JFBMQF310D"
  };
  
const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

export { auth, db, provider };