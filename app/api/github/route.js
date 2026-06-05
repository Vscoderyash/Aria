import { NextResponse } from "next/server";

const GITHUB_API = "https://api.github.com";
const headers = {
  Authorization: `token ${process.env.GITHUB_TOKEN}`,
  Accept: "application/vnd.github.v3+json",
};

export async function POST(req) {
  try {
    const { filePath, newCode, commitMessage, ownerApproved } = await req.json();

    if (!ownerApproved) {
      return NextResponse.json({ error: "Action denied: Owner permission required." }, { status: 403 });
    }

    const owner = process.env.GITHUB_REPO_OWNER;
    const repo = process.env.GITHUB_REPO_NAME;

    const fileRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contents/${filePath}`, { headers });
    if (!fileRes.ok) return NextResponse.json({ error: "File not found in repository." }, { status: 404 });
    const fileData = await fileRes.json();

    const commitRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contents/${filePath}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        message: `🤖 Aria AI: ${commitMessage || "Autonomous code update"}`,
        content: Buffer.from(newCode).toString("base64"),
        branch: "main",
        sha: fileData.sha,
      }),
    });

    if (!commitRes.ok) {
        const errorData = await commitRes.json();
        return NextResponse.json({ error: "GitHub commit failed", details: errorData }, { status: 500 });
    }

    const commitData = await commitRes.json();

    return NextResponse.json({
      success: true,
      message: "Code committed to main. Vercel is deploying the AI update live.",
      commitUrl: commitData.commit.html_url
    });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
