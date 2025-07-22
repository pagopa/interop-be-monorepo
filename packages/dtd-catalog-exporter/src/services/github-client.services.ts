/* eslint-disable @typescript-eslint/no-explicit-any */
import { Octokit } from "octokit";

export class GithubClient {
  private octokit: Octokit;

  constructor(accessToken: string) {
    this.octokit = new Octokit({ auth: accessToken });
  }

  public async createOrUpdateRepoFile(
    content: string,
    owner: string,
    repo: string,
    path: string,
    message?: string
  ): Promise<void> {
    // In order to update a file, we need to know its sha
    const sha = await this.getFileSha(owner, repo, path);

    await this.octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message: message ?? `Update ${path}`,
      content: Buffer.from(content).toString("base64"),
      sha,
    });
  }

  private async getFileSha(
    owner: string,
    repo: string,
    filePath: string
  ): Promise<string | undefined> {
    try {
      const response = await this.octokit.request(
        "GET /repos/{owner}/{repo}/contents/{filePath}",
        {
          owner,
          repo,
          filePath,
        }
      );

      return response.data.sha;
    } catch (error: any) {
      if (
        error.status === 404 ||
        error.response?.status === 404 ||
        error.data?.status === 404
      ) {
        return undefined;
      } else {
        throw error;
      }
    }
  }
}
