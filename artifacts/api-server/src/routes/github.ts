import { Router } from "express";
import { Octokit } from "octokit";

const router = Router();

function getOctokit() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN not configured");
  return new Octokit({ auth: token });
}

router.get("/github/user", async (_req, res) => {
  try {
    const octokit = getOctokit();
    const { data } = await octokit.rest.users.getAuthenticated();
    res.json({ login: data.login, name: data.name, avatarUrl: data.avatar_url });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "GitHub error" });
  }
});

router.get("/github/repos", async (_req, res) => {
  try {
    const octokit = getOctokit();
    const { data } = await octokit.rest.repos.listForAuthenticatedUser({
      sort: "updated",
      per_page: 30,
    });
    res.json(
      data.map((r) => ({
        id: r.id,
        name: r.name,
        fullName: r.full_name,
        description: r.description,
        private: r.private,
        defaultBranch: r.default_branch,
        language: r.language,
        updatedAt: r.updated_at,
        url: r.html_url,
      }))
    );
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "GitHub error" });
  }
});

router.post("/github/commit", async (req, res) => {
  const { owner, repo, branch, filename, content, message } = req.body as {
    owner: string;
    repo: string;
    branch?: string;
    filename: string;
    content: string;
    message: string;
  };

  if (!owner || !repo || !filename || !content || !message) {
    res.status(400).json({ error: "Missing required fields: owner, repo, filename, content, message" });
    return;
  }

  try {
    const octokit = getOctokit();

    const repoData = await octokit.rest.repos.get({ owner, repo });
    const effectiveBranch = branch || repoData.data.default_branch;

    let sha: string | undefined;
    try {
      const existing = await octokit.rest.repos.getContent({
        owner,
        repo,
        path: filename,
        ref: effectiveBranch,
      });
      if (!Array.isArray(existing.data) && "sha" in existing.data) {
        sha = existing.data.sha;
      }
    } catch {
    }

    const encoded = Buffer.from(content, "utf8").toString("base64");

    const result = await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: filename,
      message,
      content: encoded,
      branch: effectiveBranch,
      ...(sha ? { sha } : {}),
    });

    res.json({
      success: true,
      sha: result.data.commit.sha,
      url: result.data.commit.html_url,
      filename,
      branch: effectiveBranch,
    });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "GitHub commit failed" });
  }
});

router.post("/github/pr", async (req, res) => {
  const { owner, repo, title, body, head, base } = req.body as {
    owner: string;
    repo: string;
    title: string;
    body?: string;
    head: string;
    base?: string;
  };

  if (!owner || !repo || !title || !head) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  try {
    const octokit = getOctokit();
    const repoData = await octokit.rest.repos.get({ owner, repo });
    const { data } = await octokit.rest.pulls.create({
      owner,
      repo,
      title,
      body: body ?? "",
      head,
      base: base ?? repoData.data.default_branch,
    });
    res.json({ success: true, number: data.number, url: data.html_url, title: data.title });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "PR creation failed" });
  }
});

export default router;
