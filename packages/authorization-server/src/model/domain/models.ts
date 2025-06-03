import { IncomingHttpHeaders } from "http";
import { authorizationServerApi } from "pagopa-interop-api-clients";

export interface InteropTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export type TokenRequest = {
  headers: IncomingHttpHeaders & { DPoP?: string };
  body: authorizationServerApi.AccessTokenRequest;
};
