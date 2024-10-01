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

    /* If JWKS_CACHE_MAX_AGE not provided using 10 minute like default value: 
       https://github.com/auth0/node-jwks-rsa/blob/master/EXAMPLES.md#configuration 
    */
    JWKS_CACHE_MAX_AGE: z.coerce.number().optional().default(600000),
  })
  .transform((c) => ({
    wellKnownUrls: c.WELL_KNOWN_URLS,
    acceptedAudiences: c.ACCEPTED_AUDIENCES,
    jwksCacheMaxAge: c.JWKS_CACHE_MAX_AGE, // milliseconds
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
