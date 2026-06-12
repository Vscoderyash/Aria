import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const { query } = await req.json();

    // Google search and external learning are disabled.
    const simulatedFacts = [
      {
        title: `Chat-only mode: ${query}`,
        snippet: "Google learning is disabled. This app now uses OpenAI chat only.",
        link: "#"
      }
    ];

    return NextResponse.json({ success: true, learned: simulatedFacts });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
