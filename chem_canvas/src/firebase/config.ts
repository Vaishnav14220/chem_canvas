// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCQ4GQdREbmyrl5n2YGDrZMVJ5IwVO6O2Y",
  authDomain: "studiumcanvas.firebaseapp.com",
  projectId: "studiumcanvas",
  storageBucket: "studiumcanvas.firebasestorage.app",
  messagingSenderId: "58319370587",
  appId: "1:58319370587:web:ba04909d0d1ad45dda027e",
  measurementId: "G-70VXMF7PRH"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Set persistence to local storage (persists across browser sessions)
setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error('Error setting Firebase persistence:', error);
});

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

// Initialize Firebase Storage and get a reference to the service
export const storage = getStorage(app);

// Initialize Analytics (only in browser environment)
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;

export default app;

