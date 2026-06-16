"use client";
import { useSession, signIn, signOut } from "next-auth/react";
import { useState } from "react";

export default function OwnerDashboard() {
  const { data: session, status } = useSession();
  const [filePath, setFilePath] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [aiStatus, setAiStatus] = useState("");

  if (status === "loading") {
    return <p style={{ color: "white", textAlign: "center", marginTop: "50px" }}>Loading Aria Systems...</p>;
  }

  if (!session) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", backgroundColor: "#050505", color: "white" }}>
        <div style={{ padding: "40px", border: "1px solid #FFD700", borderRadius: "12px", textAlign: "center", boxShadow: "0 0 20px rgba(255, 215, 0, 0.2)" }}>
          <h2 style={{ color: "#FFD700" }}>Aria Admin Access</h2>
          <button
            onClick={() => signIn("credentials", { callbackUrl: "/owner" })}
            style={{ padding: "12px 24px", background: "#FFD700", color: "black", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}
          >
            Sign in as Owner
          </button>
        </div>
      </div>
    );
  }

  const pushToGitHub = async () => {
    setAiStatus("Pushing to GitHub and triggering Vercel deployment...");
    const res = await fetch("/api/github", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filePath, newCode: code, commitMessage: message, ownerApproved: true }),
    });
    const data = await res.json();
    if (data.success) {
      setAiStatus("Success! Code committed. Vercel is making it live.");
      setFilePath("");
      setCode("");
      setMessage("");
    } else {
      setAiStatus("Error: " + data.error);
    }
  };

  return (
    <div style={{ padding: "40px", backgroundColor: "#050505", color: "white", minHeight: "100vh", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #333", paddingBottom: "20px" }}>
        <h1 style={{ color: "#FFD700" }}>Welcome, Yash (Owner)</h1>
        <button onClick={signOut} style={{ background: "transparent", color: "#FFD700", border: "1px solid #FFD700", padding: "8px 16px", borderRadius: "6px", cursor: "pointer" }}>
          Sign Out
        </button>
      </div>

      <div style={{ marginTop: "30px", backgroundColor: "#111", padding: "30px", borderRadius: "12px", border: "1px solid #222" }}>
        <h2>Approve AI Code Modifications</h2>
        <p style={{ color: "#888" }}>The AI can write code, but it only goes live when you approve it here.</p>

        <div style={{ display: "flex", flexDirection: "column", maxWidth: "600px", gap: "15px", marginTop: "20px" }}>
          <input placeholder="File Path (e.g., app/page.js)" value={filePath} onChange={(e) => setFilePath(e.target.value)} style={{ padding: "12px", background: "#222", border: "1px solid #444", color: "white", borderRadius: "6px" }} />
          <textarea placeholder="Paste the AI's new code here..." rows="12" value={code} onChange={(e) => setCode(e.target.value)} style={{ padding: "12px", background: "#222", border: "1px solid #444", color: "white", borderRadius: "6px", fontFamily: "monospace" }} />
          <input placeholder="Commit Message" value={message} onChange={(e) => setMessage(e.target.value)} style={{ padding: "12px", background: "#222", border: "1px solid #444", color: "white", borderRadius: "6px" }} />
          <button onClick={pushToGitHub} style={{ padding: "14px", background: "#FFD700", color: "black", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "16px" }}>
            Approve & Push to GitHub (Go Live)
          </button>
        </div>
        {aiStatus && <p style={{ marginTop: "20px", color: "#FFD700" }}>{aiStatus}</p>}
      </div>
    </div>
  );
}
