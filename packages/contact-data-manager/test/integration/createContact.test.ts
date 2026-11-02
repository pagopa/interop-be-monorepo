/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { sql } from "drizzle-orm";
import { contactDataApi } from "pagopa-interop-api-clients";
import { contact } from "pagopa-interop-contact-data-db-models";
import { generateId } from "pagopa-interop-models";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api, db } from "../integrationUtils.js";
import { createTestToken, spyOnLogs } from "../vitest.api.setup.js";

const token = await createTestToken();

describe("contact creation through HTTP and PostgreSQL", () => {
  const email = "private-persisted-contact@example.com";
  const makeRequest = (body: object) =>
    request(api)
      .post("/contacts")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  afterEach(() => vi.restoreAllMocks());

  it("persists the generated ID, email and server creation time", async () => {
    const logs = spyOnLogs();
    const before = Date.now();
    const response = await makeRequest({ email });
    const after = Date.now();

    expect(response.status).toBe(201);
    const created = contactDataApi.Contact.parse(response.body);
    expect(created.email).toBe(email);
    expect(response.body).not.toHaveProperty("createdAt");

    const rows = await db.select().from(contact);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject(created);
    expect(Date.parse(rows[0].createdAt)).toBeGreaterThanOrEqual(before);
    expect(Date.parse(rows[0].createdAt)).toBeLessThanOrEqual(after);
    expect(logs).toHaveBeenCalledWith(
      expect.objectContaining({ message: `Creating contact ${created.id}` })
    );
    expect(JSON.stringify(logs.mock.calls)).not.toContain(email);
  });

  it("creates distinct contacts with the same email, including concurrent requests", async () => {
    const responses = await Promise.all([
      makeRequest({ email }),
      makeRequest({ email }),
    ]);
    const created = responses.map((response) => {
      expect(response.status).toBe(201);
      return contactDataApi.Contact.parse(response.body);
    });

    expect(created[0].id).not.toBe(created[1].id);
    const rows = await db.select().from(contact);
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map(({ id }) => id))).toEqual(
      new Set(created.map(({ id }) => id))
    );
    expect(rows.every((row) => row.email === email)).toBe(true);
  });

  it.each([
    {},
    { email: "invalid-email" },
    { email: null },
    { email, id: generateId() },
    { email, createdAt: "2000-01-01T00:00:00Z" },
  ])("does not insert a row for invalid input %#", async (body) => {
    const response = await makeRequest(body);

    expect(response.status).toBe(400);
    expect(await db.select().from(contact)).toEqual([]);
    expect(JSON.stringify(response.body)).not.toContain(email);
  });

  it("does not expose SQL parameters when PostgreSQL rejects an insert", async () => {
    await db.execute(
      sql`ALTER TABLE contact_data.contact ADD CONSTRAINT reject_insert CHECK (false)`
    );
    const logs = spyOnLogs();

    try {
      const response = await makeRequest({ email });

      expect(response.status).toBe(500);
      expect(contactDataApi.Problem.parse(response.body).errors).toEqual([
        { code: "018-0001", detail: "Unable to create contact" },
      ]);
      expect(await db.select().from(contact)).toEqual([]);
      expect(JSON.stringify(response.body)).not.toContain(email);
      expect(logs).toHaveBeenCalled();
      expect(JSON.stringify(logs.mock.calls)).not.toContain(email);
    } finally {
      await db.execute(
        sql`ALTER TABLE contact_data.contact DROP CONSTRAINT reject_insert`
      );
    }
  });
});
