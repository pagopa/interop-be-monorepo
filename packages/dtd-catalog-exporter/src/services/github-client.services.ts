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
    } catch (error) {
      if (this.isNotFoundError(error)) {
        return undefined;
      } else {
        throw error;
      }
    }
  }

  private isNotFoundError(error: unknown): boolean {
    if (!error || typeof error !== "object") {
      return false;
    }

    // Check for status directly on error
    if (
      "status" in error &&
      typeof (error as { status: unknown }).status === "number"
    ) {
      return (error as { status: number }).status === 404;
    }

    // Check for status in error.response
    if ("response" in error) {
      const errorWithResponse = error as { response: unknown };
      if (
        errorWithResponse.response &&
        typeof errorWithResponse.response === "object" &&
        "status" in errorWithResponse.response &&
        typeof (errorWithResponse.response as { status: unknown }).status ===
          "number"
      ) {
        return (
          (errorWithResponse.response as { status: number }).status === 404
        );
      }
    }

    // Check for status in error.response.data
    if ("response" in error) {
      const response = (error as { response: unknown }).response;
      if (response && typeof response === "object" && "data" in response) {
        const data = (response as { data: unknown }).data;
        if (data && typeof data === "object" && "status" in data) {
          const status = (data as { status: unknown }).status;
          return status === "404" || status === 404;
        }
      }
    }

    return false;
  }
}
