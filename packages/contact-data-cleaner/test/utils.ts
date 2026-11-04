import { drizzle } from "drizzle-orm/node-postgres";
import { contact, ContactDB } from "pagopa-interop-contact-data-db-models";
import { generateId } from "pagopa-interop-models";
import pg from "pg";
import { afterAll, afterEach, inject } from "vitest";

const config = inject("contactDataDbConfig");
const pool = new pg.Pool({
  host: config.contactDataDBHost,
  database: config.contactDataDBName,
  user: config.contactDataDBUsername,
  password: config.contactDataDBPassword,
  port: config.contactDataDBPort,
});

export const db = drizzle({ client: pool });

afterEach(async () => {
  await db.delete(contact);
});

afterAll(async () => {
  await pool.end();
});

export const TEST_EMAIL_DOMAIN = "contact-data-cleaner.example.com";

export const addContacts = async (
  creationDates: Date[]
): Promise<Array<ContactDB["id"]>> => {
  const contacts: ContactDB[] = creationDates.map((createdAt, index) => ({
    id: generateId(),
    email: `contact-${index}@${TEST_EMAIL_DOMAIN}`,
    createdAt: createdAt.toISOString(),
  }));
  if (contacts.length > 0) {
    await db.insert(contact).values(contacts);
  }
  return contacts.map(({ id }) => id);
};

export const addMilliseconds = (date: Date, milliseconds: number): Date =>
  new Date(date.getTime() + milliseconds);
