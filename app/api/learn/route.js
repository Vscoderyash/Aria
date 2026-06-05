import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const { query } = await req.json();

    // If Google API Keys are provided in Vercel, it will search the real internet.
    // If not, it safely simulates the learning process.
    if (process.env.GOOGLE_API_KEY && process.env.GOOGLE_CX) {
      const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${process.env.GOOGLE_API_KEY}&cx=${process.env.GOOGLE_CX}&q=${encodeURIComponent(query)}`;
      const searchRes = await fetch(searchUrl);
      const searchData = await searchRes.json();

      if (!searchData.items) return NextResponse.json({ error: "No results found" });

      const learnedFacts = searchData.items.map(item => ({
        title: item.title, snippet: item.snippet, link: item.link
      }));

      return NextResponse.json({ success: true, learned: learnedFacts });
    } else {
      // Simulation Mode (Works without API keys for now)
      const simulatedFacts = [
        { title: `Simulated Learning: ${query}`, snippet: "Aria is currently in simulation mode. Add Google API keys to Vercel to enable real internet learning.", link: "#" }
      ];
      return NextResponse.json({ success: true, learned: simulatedFacts });
    }
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
