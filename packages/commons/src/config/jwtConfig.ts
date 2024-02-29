import { z } from "zod";

export const JWTSeedConfig = z
  .object({
    GENERATED_JWT_SUBJECT: z.string(),
    GENERATED_JWT_AUDIENCE: z.string().transform((v) => v.split(",")),
    GENERATED_JWT_ISSUER: z.string(),
    GENERATED_JWT_SECONDS_TO_EXPIRE: z.coerce.number(),
  })
  .transform((c) => ({
    subject: c.GENERATED_JWT_SUBJECT,
    audience: c.GENERATED_JWT_AUDIENCE,
    tokenIssuer: c.GENERATED_JWT_ISSUER,
    secondsToExpire: c.GENERATED_JWT_SECONDS_TO_EXPIRE,
  }));

export type JWTSeedConfig = z.infer<typeof JWTSeedConfig>;

export const jwtSeedConfig: () => JWTSeedConfig = () =>
  JWTSeedConfig.parse(process.env);
