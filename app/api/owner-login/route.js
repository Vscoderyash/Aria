import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const body = await req.json();
    const username = String(body.username || "").trim();
    const password = String(body.password || "");

    const ownerUser = process.env.OWNER_USERNAME || "yash_owner";
    const ownerPass = process.env.OWNER_PASSWORD || "owner_yash123";

    if (username !== ownerUser || password !== ownerPass) {
      return NextResponse.json({ error: "Invalid owner credentials." }, { status: 401 });
    }

    const res = NextResponse.json({ success: true, redirectTo: "/owner" });
    res.cookies.set("aria_owner", "1", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24,
    });
    return res;
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
