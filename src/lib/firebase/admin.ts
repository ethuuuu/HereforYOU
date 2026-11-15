/**
 * Firebase Admin SDK (server only). All Firestore access goes through here —
 * the browser never talks to Firestore directly (see firestore.rules).
 */
import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { serverEnv } from "@/lib/env";

let app: App | null = null;

function adminApp(): App {
  if (app) return app;
  const existing = getApps()[0];
  if (existing) {
    app = existing;
    return app;
  }
  const json = Buffer.from(serverEnv().FIREBASE_SERVICE_ACCOUNT_BASE64, "base64").toString("utf8");
  app = initializeApp({ credential: cert(JSON.parse(json)) });
  return app;
}

export function db() {
  return getFirestore(adminApp());
}

export function adminAuth() {
  return getAuth(adminApp());
}
