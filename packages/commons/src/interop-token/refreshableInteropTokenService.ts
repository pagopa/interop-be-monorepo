/* eslint-disable sonarjs/no-duplicated-branches */
/* eslint-disable functional/immutable-data */

import { InteropTokenGenerator } from "./interopTokenService.js";
import { InteropToken } from "./models.js";

export const MAX_EXP_SECONDS_DELAY_BEFORE_REFRESH = 30;

/**
 * This class allows the use of a generated token for a long running job.
 * Instead of generating a token each time it is required to invoke a service,
 * this class caches and returns the same token, until the expiration, then
 * seemlessly refresh the token.
 *
 * The refresh happens MAX_EXP_SECONDS_DELAY_BEFORE_REFRESH seconds before the expiration.
 * This way, if the token is used in "parallel" processes, receiving the previous token would still
 * allow the application to work properly
 */
export class RefreshableInteropToken {
  private token: InteropToken | null = null;

  constructor(private tokenGenerator: InteropTokenGenerator) {}

  /**
   * If this class is used on "parallel" invocation,
   * it is suggested to initialize the token to avoid multiple generation on the first use
   */
  public async init(): Promise<InteropToken> {
    this.token = await this.tokenGenerator.generateInternalToken();
    return this.token;
  }

  /**
   * The valid token, or a new token if required.
   */
  public async get(): Promise<InteropToken> {
    if (!this.token) {
      this.token = await this.tokenGenerator.generateInternalToken();
      return this.token;
    } else if (this.shouldBeRefreshed(this.token.payload.exp)) {
      this.token = await this.tokenGenerator.generateInternalToken();
      return this.token;
    } else {
      return this.token;
    }
  }

  private shouldBeRefreshed(exp: number): boolean {
    return exp < Date.now() / 1000 + MAX_EXP_SECONDS_DELAY_BEFORE_REFRESH;
  }
}
