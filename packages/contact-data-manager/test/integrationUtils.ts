import { drizzle } from "drizzle-orm/node-postgres";
import { contact } from "pagopa-interop-contact-data-db-models";
import pg from "pg";
import { afterAll, afterEach, inject } from "vitest";

import { contactServiceBuilder } from "../src/services/contactService.js";
import { createTestApp } from "./vitest.api.setup.js";

const config = inject("contactDataDbConfig");
const pool = new pg.Pool({
  host: config.contactDataDBHost,
  database: config.contactDataDBName,
  user: config.contactDataDBUsername,
  password: config.contactDataDBPassword,
  port: config.contactDataDBPort,
});

export const db = drizzle({ client: pool });
export const api = await createTestApp(contactServiceBuilder(db));

afterEach(async () => {
  await db.delete(contact);
});

afterAll(async () => {
  await pool.end();
});
