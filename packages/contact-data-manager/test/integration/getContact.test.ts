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

describe("contact retrieval through HTTP and PostgreSQL", () => {
  const email = "private-persisted-contact@example.com";
  const makeRequest = (id: string) =>
    request(api)
      .get(`/contacts/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  afterEach(() => vi.restoreAllMocks());

  it("retrieves a created contact without exposing internal fields or modifying it", async () => {
    const createdResponse = await request(api)
      .post("/contacts")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send({ email });
    expect(createdResponse.status).toBe(201);
    const created = contactDataApi.Contact.parse(createdResponse.body);
    const before = await db.select().from(contact);
    const logs = spyOnLogs();

    const response = await makeRequest(created.id);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(created);
    expect(response.body).not.toHaveProperty("createdAt");
    expect(await db.select().from(contact)).toEqual(before);
    expect(logs).toHaveBeenCalledWith(
      expect.objectContaining({ message: `Retrieving contact ${created.id}` })
    );
    expect(JSON.stringify(logs.mock.calls)).not.toContain(email);
  });

  it("selects the requested ID when contacts share an email", async () => {
    const first = { id: generateId(), email };
    const second = { id: generateId(), email };
    await db.insert(contact).values(
      [first, second].map((savedContact) => ({
        ...savedContact,
        createdAt: new Date().toISOString(),
      }))
    );

    const response = await makeRequest(second.id);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(second);
  });

  it("returns 404 for an absent contact", async () => {
    const response = await makeRequest(generateId());

    expect(response.status).toBe(404);
    expect(contactDataApi.Problem.parse(response.body).errors).toEqual([
      { code: "018-0002", detail: "Contact not found" },
    ]);
  });

  it("returns 400 before querying PostgreSQL for an invalid UUID", async () => {
    const logs = spyOnLogs();
    const response = await makeRequest("not-a-uuid");

    expect(response.status).toBe(400);
    expect(contactDataApi.Problem.parse(response.body).detail).toBe(
      "Invalid contact ID"
    );
    expect(logs).not.toHaveBeenCalledWith(
      expect.objectContaining({ message: "Retrieving contact not-a-uuid" })
    );
  });

  it("logs only a fixed message and contact ID when PostgreSQL cannot read", async () => {
    const id = generateId();
    await db.execute(
      sql`ALTER TABLE contact_data.contact RENAME TO unavailable_contact`
    );
    const logs = spyOnLogs();

    try {
      const response = await makeRequest(id);

      expect(response.status).toBe(500);
      expect(contactDataApi.Problem.parse(response.body).errors).toEqual([
        { code: "018-0003", detail: "Unable to retrieve contact" },
      ]);
      expect(logs).toHaveBeenCalledWith(
        expect.objectContaining({
          level: "error",
          message: `Contact retrieval failed for contact ${id}`,
        })
      );
      expect(JSON.stringify(logs.mock.calls)).not.toContain("does not exist");
      expect(JSON.stringify(response.body)).not.toContain("does not exist");
    } finally {
      await db.execute(
        sql`ALTER TABLE contact_data.unavailable_contact RENAME TO contact`
      );
    }
  });
});
