import { z } from "zod";

export const PersonalDataDBConfig = z
  .object({
    PERSONAL_DATA_DB_HOST: z.string().default("localhost"),
    PERSONAL_DATA_DB_NAME: z.string().default("root"),
    PERSONAL_DATA_DB_USERNAME: z.string().default("root"),
    PERSONAL_DATA_DB_PASSWORD: z.string().default("root"),
    PERSONAL_DATA_DB_PORT: z.coerce.number().min(1001).max(65535).default(6010),
    PERSONAL_DATA_DB_USE_SSL: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .default("false"),
  })
  .transform((c) => ({
    personalDataDBHost: c.PERSONAL_DATA_DB_HOST,
    personalDataDBName: c.PERSONAL_DATA_DB_NAME,
    personalDataDBUsername: c.PERSONAL_DATA_DB_USERNAME,
    personalDataDBPassword: c.PERSONAL_DATA_DB_PASSWORD,
    personalDataDBPort: c.PERSONAL_DATA_DB_PORT,
    personalDataDBUseSSL: c.PERSONAL_DATA_DB_USE_SSL,
  }));

export type PersonalDataDBConfig = z.infer<typeof PersonalDataDBConfig>;
