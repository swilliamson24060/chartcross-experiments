import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Public client config - safe to commit. Access is controlled by Firestore
// security rules (see firestore.rules at the repo root), not by hiding this.
const firebaseConfig = {
  apiKey: "AIzaSyBoqfzwzup_YbDuBRgBQuQfG6cf9HaN7t0",
  authDomain: "chartcross-92857.firebaseapp.com",
  projectId: "chartcross-92857",
  storageBucket: "chartcross-92857.firebasestorage.app",
  messagingSenderId: "1076214976465",
  appId: "1:1076214976465:web:982111f5ce860f2eec1af0",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
