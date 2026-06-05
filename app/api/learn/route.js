import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const { query } = await req.json();
    const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${process.env.GOOGLE_API_KEY}&cx=${process.env.GOOGLE_CX}&q=${encodeURIComponent(query)}`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();

    if (!searchData.items) return NextResponse.json({ error: "No results found" });

    const learnedFacts = searchData.items.map(item => ({
      title: item.title, snippet: item.snippet, link: item.link
    }));

    return NextResponse.json({ success: true, learned: learnedFacts });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
