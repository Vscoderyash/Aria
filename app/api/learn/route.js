import { NextResponse } from "next/server";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");
const LEARN_FILE = path.join(DATA_DIR, "learn-history.json");

async function readLearnHistory() {
  try {
    const raw = await fs.readFile(LEARN_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeLearnHistory(entries) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(LEARN_FILE, JSON.stringify(entries, null, 2), "utf8");
}

export async function POST(req) {
  try {
    const body = await req.json();
    const query = String(body.query || body.mistake || body.lesson || "").trim();
    const correction = String(body.correction || body.answer || "").trim();
    const context = String(body.context || body.note || "").trim();

    if (!query) {
      return NextResponse.json({ error: "Missing query or lesson text." }, { status: 400 });
    }

    const entry = {
      id: crypto.randomUUID(),
      query,
      correction,
      context,
      createdAt: new Date().toISOString(),
      source: "local-feedback",
    };

    const history = await readLearnHistory();
    history.unshift(entry);
    await writeLearnHistory(history.slice(0, 500));

    return NextResponse.json({
      success: true,
      learned: entry,
      message: "Lesson stored locally. Google learning is disabled in this build.",
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
