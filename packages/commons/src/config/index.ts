import { z } from "zod";
import { APIEndpoint } from "./../model/apiEndpoint.js";

const JWTConfig = z.preprocess(
  (c) =>
    (c as { SKIP_JWT_VERIFICATION: string | undefined })
      .SKIP_JWT_VERIFICATION === undefined
      ? { ...(c as object), SKIP_JWT_VERIFICATION: "false" }
      : c,

  z
    .discriminatedUnion("SKIP_JWT_VERIFICATION", [
      z.object({
        SKIP_JWT_VERIFICATION: z.literal("true"),
      }),
      z.object({
        SKIP_JWT_VERIFICATION: z.literal("false"),
        WELL_KNOWN_URLS: z
          .string()
          .transform((s) => s.split(","))
          .pipe(z.array(APIEndpoint)),
      }),
    ])
    .transform((c) =>
      c.SKIP_JWT_VERIFICATION === "false"
        ? {
            skipJWTVerification: false as const,
            wellKnownUrls: c.WELL_KNOWN_URLS,
          }
        : {
            skipJWTVerification: true as const,
          }
    )
);
type JWTConfig = z.infer<typeof JWTConfig>;

const RequiredConfig = z
  .object({
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]),
  })
  .transform((c) => ({
    logLevel: c.LOG_LEVEL,
  }));

const Config = RequiredConfig.and(JWTConfig);

export type Config = z.infer<typeof Config>;
export const config = Config.parse(process.env);
