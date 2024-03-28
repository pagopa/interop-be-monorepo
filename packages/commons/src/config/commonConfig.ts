import { z } from "zod";
import { APIEndpoint } from "../model/apiEndpoint.js";

export const JWTConfig = z.preprocess(
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
export type JWTConfig = z.infer<typeof JWTConfig>;

export const LoggerConfig = z
  .object({
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]),
  })
  .transform((c) => ({
    logLevel: c.LOG_LEVEL,
  }));
export type LoggerConfig = z.infer<typeof LoggerConfig>;
export const loggerConfig = (): LoggerConfig => LoggerConfig.parse(process.env);

export const HTTPServerConfig = z
  .object({
    HOST: APIEndpoint,
    PORT: z.coerce.number().min(1001),
  })
  .transform((c) => ({
    host: c.HOST,
    port: c.PORT,
  }));
export type HTTPServerConfig = z.infer<typeof HTTPServerConfig>;

export const CommonConfig = HTTPServerConfig.and(LoggerConfig).and(JWTConfig);
export type CommonConfig = z.infer<typeof CommonConfig>;
