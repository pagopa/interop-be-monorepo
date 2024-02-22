import { z } from "zod";

export const JWTSeedConfig = z
  .object({
    JWT_SUBJECT: z.string(),
    JWT_AUDIENCE: z.string().transform((v) => v.split(",")),
    JWT_ISSUER: z.string(),
    JWT_SECONDS_TO_EXPIRE: z.coerce.number(),
  })
  .transform((c) => ({
    subject: c.JWT_SUBJECT,
    audience: c.JWT_AUDIENCE,
    tokenIssuer: c.JWT_ISSUER,
    secondsToExpire: c.JWT_SECONDS_TO_EXPIRE,
  }));

export type JWTSeedConfig = z.infer<typeof JWTSeedConfig>;

export const jwtSeedConfig: () => JWTSeedConfig = () =>
  JWTSeedConfig.parse(process.env);
