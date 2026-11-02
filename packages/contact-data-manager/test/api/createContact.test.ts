/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { contactDataApi } from "pagopa-interop-api-clients";
import { authRole } from "pagopa-interop-commons";
import { generateId } from "pagopa-interop-models";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  api,
  contactService,
  createTestToken,
  spyOnLogs,
} from "../vitest.api.setup.js";

const token = await createTestToken();

describe("POST /contacts", () => {
  const email = "private-contact@example.com";
  const createdContact: contactDataApi.Contact = { id: generateId(), email };
  const makeRequest = (body: object | string, authToken = token) =>
    request(api)
      .post("/contacts")
      .set("Authorization", `Bearer ${authToken}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  beforeEach(() => {
    contactService.createContact.mockReset().mockResolvedValue(createdContact);
  });

  afterEach(() => vi.restoreAllMocks());

  it("returns 201 with the generated ID and email", async () => {
    const response = await makeRequest({ email });

    expect(response.status).toBe(201);
    expect(contactDataApi.Contact.parse(response.body)).toEqual(createdContact);
    expect(contactService.createContact).toHaveBeenCalledWith(
      { email },
      expect.any(Object)
    );
  });

  it.each([
    {},
    { email: "" },
    { email: "invalid-email" },
    { email: null },
    { email: 1 },
    { email: [email] },
    { email, id: generateId() },
    { email, createdAt: "2000-01-01T00:00:00Z" },
    { email, [email]: "unexpected field" },
  ])("rejects invalid input %# without exposing the email", async (body) => {
    const logs = spyOnLogs();
    const response = await makeRequest(body);

    expect(response.status).toBe(400);
    expect(contactDataApi.Problem.safeParse(response.body).success).toBe(true);
    expect(contactService.createContact).not.toHaveBeenCalled();
    expect(JSON.stringify(response.body)).not.toContain(email);
    expect(logs).toHaveBeenCalled();
    expect(JSON.stringify(logs.mock.calls)).not.toContain(email);
  });

  it("rejects malformed JSON without logging request fragments", async () => {
    const logs = spyOnLogs();
    const response = await request(api)
      .post("/contacts")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .set("Content-Type", "application/json")
      .send(`{"email":"${email}" invalid}`);

    expect(response.status).toBe(400);
    expect(contactService.createContact).not.toHaveBeenCalled();
    expect(JSON.stringify(response.body)).not.toContain(email);
    expect(logs).toHaveBeenCalled();
    expect(JSON.stringify(logs.mock.calls)).not.toContain(email);
  });

  it("rejects requests without authentication", async () => {
    const response = await request(api)
      .post("/contacts")
      .set("X-Correlation-Id", generateId())
      .send({ email });

    expect(response.status).toBe(400);
    expect(contactService.createContact).not.toHaveBeenCalled();
  });

  it("rejects an invalid token", async () => {
    const response = await makeRequest({ email }, "invalid.jwt.token");

    expect(response.status).toBe(401);
    expect(contactService.createContact).not.toHaveBeenCalled();
  });

  it.each(
    Object.values(authRole).filter((role) => role !== authRole.INTERNAL_ROLE)
  )("rejects a signed token with role %s", async (role) => {
    const response = await makeRequest({ email }, await createTestToken(role));

    expect(response.status).toBe(403);
    expect(contactService.createContact).not.toHaveBeenCalled();
  });

  it("sanitizes unexpected service errors before returning or logging them", async () => {
    contactService.createContact.mockRejectedValue(
      new Error(`Failed SQL query with parameter ${email}`)
    );
    const logs = spyOnLogs();
    const response = await makeRequest({ email });

    expect(response.status).toBe(500);
    expect(contactDataApi.Problem.parse(response.body).errors).toEqual([
      { code: "018-0001", detail: "Unable to create contact" },
    ]);
    expect(JSON.stringify(response.body)).not.toContain(email);
    expect(logs).toHaveBeenCalled();
    expect(JSON.stringify(logs.mock.calls)).not.toContain(email);
  });
});
