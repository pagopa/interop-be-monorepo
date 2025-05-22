import { z } from "zod";
export interface InteropTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}
export const tokenType = {
  bearer: "Bearer",
  dPoP: "DPoP",
} as const;
export const TokenType = z.enum([
  Object.values(tokenType)[0],
  ...Object.values(tokenType).slice(1),
]);
export type TokenType = z.infer<typeof TokenType>;
