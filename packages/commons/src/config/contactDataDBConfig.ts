import { z } from "zod";

export const ContactDataDBConfig = z
  .object({
    CONTACT_DATA_DB_HOST: z.string().default("localhost"),
    CONTACT_DATA_DB_NAME: z.string().default("root"),
    CONTACT_DATA_DB_USERNAME: z.string().default("root"),
    CONTACT_DATA_DB_PASSWORD: z.string().default("root"),
    CONTACT_DATA_DB_PORT: z.coerce.number().min(1001).max(65535).default(6010),
    CONTACT_DATA_DB_USE_SSL: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .default("false"),
  })
  .transform((c) => ({
    contactDataDBHost: c.CONTACT_DATA_DB_HOST,
    contactDataDBName: c.CONTACT_DATA_DB_NAME,
    contactDataDBUsername: c.CONTACT_DATA_DB_USERNAME,
    contactDataDBPassword: c.CONTACT_DATA_DB_PASSWORD,
    contactDataDBPort: c.CONTACT_DATA_DB_PORT,
    contactDataDBUseSSL: c.CONTACT_DATA_DB_USE_SSL,
  }));

export type ContactDataDBConfig = z.infer<typeof ContactDataDBConfig>;
