"use client";

import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyDGBhNJtYegqnDya7EEyD-V8wpbTz-VuAc",
  authDomain: "chrono-a1f8d.firebaseapp.com",
  databaseURL: "https://chrono-a1f8d-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "chrono-a1f8d",
  storageBucket: "chrono-a1f8d.firebasestorage.app",
  messagingSenderId: "514930791311",
  appId: "1:514930791311:web:abf26188980488a5be71fa",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const db = getDatabase(app);
export const googleProvider = new GoogleAuthProvider();
