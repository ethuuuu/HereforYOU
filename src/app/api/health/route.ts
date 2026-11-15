import { NextResponse } from "next/server";
import { integrationStatus } from "@/lib/env";

/** Setup check: which integrations have their env vars present. Never returns values. */
export function GET() {
  return NextResponse.json({ ok: true, integrations: integrationStatus() });
}
