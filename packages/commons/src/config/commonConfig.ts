import { z } from "zod";
import { APIEndpoint } from "../model/apiEndpoint.js";

export const JWTConfig = z
  .object({
    WELL_KNOWN_URLS: z
      .string()
      .transform((s) => s.split(","))
      .pipe(z.array(APIEndpoint)),

    ACCEPTED_AUDIENCES: z
      .string()
      .transform((s) => s.split(","))
      .pipe(z.array(z.string())),
  })
  .transform((c) => ({
    wellKnownUrls: c.WELL_KNOWN_URLS,
    acceptedAudiences: c.ACCEPTED_AUDIENCES,
  }));
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

export const CommonHTTPServiceConfig =
  HTTPServerConfig.and(LoggerConfig).and(JWTConfig);
export type CommonHTTPServiceConfig = z.infer<typeof CommonHTTPServiceConfig>;
