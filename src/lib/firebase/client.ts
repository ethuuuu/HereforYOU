/**
 * Firebase client SDK — used ONLY for sign-in in the browser (Google popup and
 * signInWithCustomToken after a passkey ceremony). No Firestore in the browser.
 */
"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import {
  browserPopupRedirectResolver,
  getAuth,
  GoogleAuthProvider,
  inMemoryPersistence,
  initializeAuth,
  type Auth,
} from "firebase/auth";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let auth: Auth | null = null;

/**
 * In-memory persistence: the browser keeps no Firebase login of its own. The
 * httpOnly session cookie is the only session, so signing out clears everything.
 */
export function clientAuth(): Auth {
  if (auth) return auth;
  const app = getApps().length ? getApp() : initializeApp(config);
  try {
    auth = initializeAuth(app, { persistence: inMemoryPersistence, popupRedirectResolver: browserPopupRedirectResolver });
  } catch {
    auth = getAuth(app); // already initialised (e.g. after hot reload)
  }
  return auth;
}

export const googleProvider = new GoogleAuthProvider();
