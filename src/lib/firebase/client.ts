/**
 * Firebase client SDK — used ONLY for sign-in in the browser (Google popup and
 * signInWithCustomToken after a passkey ceremony). No Firestore in the browser.
 */
"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export function clientAuth() {
  const app = getApps().length ? getApp() : initializeApp(config);
  return getAuth(app);
}

export const googleProvider = new GoogleAuthProvider();
