import { RepoFile } from "../types";

const GITHUB_API = "https://api.github.com";

export class GitHubService {
  private token: string;
  private owner: string;
  private repo: string;

  constructor(token: string, owner: string, repo: string) {
    this.token = token.trim(); // Sanitize input
    this.owner = owner.trim();
    this.repo = repo.trim();
  }

  private headers() {
    return {
      "Authorization": `Bearer ${this.token}`,
      "Content-Type": "application/json",
      "Accept": "application/vnd.github.v3+json"
    };
  }

  /**
   * Fetches the default branch name.
   */
  async getDefaultBranch(): Promise<string> {
    const url = `${GITHUB_API}/repos/${this.owner}/${this.repo}`;
    const res = await fetch(url, {
      headers: this.headers()
    });
    
    if (!res.ok) {
        if (res.status === 401) throw new Error("401 Unauthorized: Invalid API Token.");
        if (res.status === 404) throw new Error(`404 Not Found: Could not find ${this.owner}/${this.repo}. Check permissions.`);
        throw new Error(`GitHub API Error: ${res.status} ${res.statusText}`);
    }
    
    const data = await res.json();
    return data.default_branch;
  }

  /**
   * Fetches all text files from the repo (recursive, limited to small size for demo).
   */
  async fetchFiles(branch: string): Promise<RepoFile[]> {
    // 1. Get Tree
    const treeRes = await fetch(`${GITHUB_API}/repos/${this.owner}/${this.repo}/git/trees/${branch}?recursive=1`, {
      headers: this.headers()
    });
    if (!treeRes.ok) throw new Error("Failed to fetch file tree");
    const treeData = await treeRes.json();

    const files: RepoFile[] = [];
    const textExtensions = ['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.css', '.html', '.py', '.java', '.go'];

    // 2. Filter and Fetch Blobs (Limit to top 15 files to avoid rate limits in demo)
    const candidates = treeData.tree.filter((node: any) => 
      node.type === 'blob' && textExtensions.some(ext => node.path.endsWith(ext))
    ).slice(0, 15); 

    for (const node of candidates) {
      const blobRes = await fetch(node.url, { headers: this.headers() });
      if (blobRes.ok) {
        const blobData = await blobRes.json();
        // UTF-8 Safe Decoding
        try {
            const binaryString = atob(blobData.content.replace(/\n/g, ''));
            const bytes = Uint8Array.from(binaryString, c => c.charCodeAt(0));
            const content = new TextDecoder().decode(bytes);
            
            files.push({
              path: node.path,
              content: content,
              sha: node.sha
            });
        } catch (e) {
            console.warn(`Skipping binary or malformed file: ${node.path}`);
        }
      }
    }
    return files;
  }

  /**
   * Creates a new branch from the base branch.
   */
  async createBranch(newBranchName: string, baseBranch: string): Promise<void> {
    // Get SHA of base branch
    const refRes = await fetch(`${GITHUB_API}/repos/${this.owner}/${this.repo}/git/ref/heads/${baseBranch}`, {
      headers: this.headers()
    });
    const refData = await refRes.json();
    const sha = refData.object.sha;

    // Create new Ref
    const createRes = await fetch(`${GITHUB_API}/repos/${this.owner}/${this.repo}/git/refs`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        ref: `refs/heads/${newBranchName}`,
        sha: sha
      })
    });
    
    if (!createRes.ok && createRes.status !== 422) { // 422 means already exists
        throw new Error("Failed to create branch");
    }
  }

  /**
   * Creates a commit with the modified files.
   */
  async commitAndPush(branch: string, message: string, files: { path: string, content: string }[]) {
     // 1. Get latest commit SHA of the branch
     const refRes = await fetch(`${GITHUB_API}/repos/${this.owner}/${this.repo}/git/ref/heads/${branch}`, { headers: this.headers() });
     const refData = await refRes.json();
     const latestCommitSha = refData.object.sha;

     // 2. Get the tree SHA of that commit
     const commitRes = await fetch(`${GITHUB_API}/repos/${this.owner}/${this.repo}/git/commits/${latestCommitSha}`, { headers: this.headers() });
     const commitData = await commitRes.json();
     const baseTreeSha = commitData.tree.sha;

     // 3. Create a new Tree (with updated blobs)
     const treePayload = {
         base_tree: baseTreeSha,
         tree: files.map(f => ({
             path: f.path,
             mode: '100644',
             type: 'blob',
             content: f.content
         }))
     };
     
     const createTreeRes = await fetch(`${GITHUB_API}/repos/${this.owner}/${this.repo}/git/trees`, {
         method: 'POST',
         headers: this.headers(),
         body: JSON.stringify(treePayload)
     });
     const newTreeData = await createTreeRes.json();
     
     // 4. Create Commit
     const newCommitRes = await fetch(`${GITHUB_API}/repos/${this.owner}/${this.repo}/git/commits`, {
         method: 'POST',
         headers: this.headers(),
         body: JSON.stringify({
             message: message,
             tree: newTreeData.sha,
             parents: [latestCommitSha]
         })
     });
     const newCommitData = await newCommitRes.json();

     // 5. Update Ref
     await fetch(`${GITHUB_API}/repos/${this.owner}/${this.repo}/git/refs/heads/${branch}`, {
         method: 'PATCH',
         headers: this.headers(),
         body: JSON.stringify({ sha: newCommitData.sha })
     });
  }

  /**
   * Creates a Pull Request.
   */
  async createPR(title: string, body: string, head: string, base: string): Promise<string> {
      const res = await fetch(`${GITHUB_API}/repos/${this.owner}/${this.repo}/pulls`, {
          method: 'POST',
          headers: this.headers(),
          body: JSON.stringify({ title, body, head, base })
      });
      const data = await res.json();
      return data.html_url;
  }
}