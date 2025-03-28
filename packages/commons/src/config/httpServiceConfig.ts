import { z } from "zod";
import { APIEndpoint } from "../model/apiEndpoint.js";
import { LoggerConfig } from "./loggerConfig.js";

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

    JWKS_CACHE_MAX_AGE_MILLIS: z.coerce.number().optional(),
  })
  .transform((c) => ({
    wellKnownUrls: c.WELL_KNOWN_URLS,
    acceptedAudiences: c.ACCEPTED_AUDIENCES,
    jwksCacheMaxAge: c.JWKS_CACHE_MAX_AGE_MILLIS, // milliseconds
  }));
export type JWTConfig = z.infer<typeof JWTConfig>;

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

export const KeepAliveConfig = z
  .object({
    KEEP_ALIVE_TIMEOUT_MILLIS: z.coerce.number(),
  })
  .transform((c) => ({
    keepAliveTimeout: c.KEEP_ALIVE_TIMEOUT_MILLIS,
  }));

export type KeepAliveConfig = z.infer<typeof KeepAliveConfig>;
