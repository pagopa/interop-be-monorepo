import { drizzle } from "drizzle-orm/node-postgres";
import { getMockTenant } from "pagopa-interop-commons-test";
import { contact, ContactDB } from "pagopa-interop-contact-data-db-models";
import { ContactId, generateId, unsafeBrandId } from "pagopa-interop-models";
import { tenantInReadmodelTenant } from "pagopa-interop-readmodel-models";
import { upsertTenant } from "pagopa-interop-readmodel/testUtils";
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

const readModelSQLConfig = inject("readModelSQLConfig");
if (readModelSQLConfig === undefined) {
  throw new Error("Readmodel SQL config not provided by the global setup");
}
const readmodelPool = new pg.Pool({
  host: readModelSQLConfig.readModelSQLDbHost,
  database: readModelSQLConfig.readModelSQLDbName,
  user: readModelSQLConfig.readModelSQLDbUsername,
  password: readModelSQLConfig.readModelSQLDbPassword,
  port: readModelSQLConfig.readModelSQLDbPort,
});

export const readmodelDB = drizzle({ client: readmodelPool });

afterEach(async () => {
  await db.delete(contact);
  // The tenant child tables are deleted on cascade.
  await readmodelDB.delete(tenantInReadmodelTenant);
});

afterAll(async () => {
  await pool.end();
  await readmodelPool.end();
});

/**
 * Adds a tenant to the readmodel, referencing the given contact if any.
 */
export const addTenant = async (contactId?: ContactDB["id"]): Promise<void> => {
  await upsertTenant(
    readmodelDB,
    {
      ...getMockTenant(),
      ...(contactId === undefined
        ? {}
        : { contactId: unsafeBrandId<ContactId>(contactId) }),
    },
    0
  );
};

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

export const getContactIds = async (): Promise<Array<ContactDB["id"]>> =>
  (await db.select({ id: contact.id }).from(contact)).map(({ id }) => id);

export const addMilliseconds = (date: Date, milliseconds: number): Date =>
  new Date(date.getTime() + milliseconds);
