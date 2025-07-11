export interface InteropTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export type HttpDPoPHeader = {
  DPoP?: string;
};
