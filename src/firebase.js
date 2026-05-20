import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyAuEXUQT99SdJ1YZMhQOU-C0DGjQ1aIWXY",
    authDomain: "controlcheque-19226.firebaseapp.com",
    projectId: "controlcheque-19226",
    storageBucket: "controlcheque-19226.firebasestorage.app",
    messagingSenderId: "659933757076",
    appId: "1:659933757076:web:28d285726e6cb9560fbe81"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
