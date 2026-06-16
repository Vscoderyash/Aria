import { NextResponse } from "next/server";

export async function GET(req) {
  const isAuthed = req.cookies.get("aria_owner")?.value === "1";
  return NextResponse.json({ authenticated: isAuthed });
}
