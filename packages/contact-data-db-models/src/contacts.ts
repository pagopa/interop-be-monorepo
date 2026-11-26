import type { ContactDataDBConfig } from "pagopa-interop-commons";

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

import { contact } from "./schema.js";

export function connectContactDB(config: ContactDataDBConfig) {
  return drizzle({
    client: new pg.Pool({
      host: config.contactDataDBHost,
      database: config.contactDataDBName,
      user: config.contactDataDBUsername,
      password: config.contactDataDBPassword,
      port: config.contactDataDBPort,
      ssl: config.contactDataDBUseSSL
        ? { rejectUnauthorized: false }
        : undefined,
      connectionTimeoutMillis: 5_000,
      statement_timeout: 5_000,
      query_timeout: 5_000,
    }),
  });
}

export type ContactDBConnection = ReturnType<typeof connectContactDB>;

export async function readContactEmail(
  db: ContactDBConnection,
  id: string
): Promise<string | undefined> {
  const [row] = await db
    .select({ email: contact.email })
    .from(contact)
    .where(eq(contact.id, id));
  return row?.email;
}

export async function insertContact(
  db: ContactDBConnection,
  id: string,
  email: string
): Promise<void> {
  // A driver error can include the bound email address.
  try {
    await db
      .insert(contact)
      .values({ id, email, createdAt: new Date().toISOString() });
  } catch {
    throw new Error("Contact creation failed");
  }
}
