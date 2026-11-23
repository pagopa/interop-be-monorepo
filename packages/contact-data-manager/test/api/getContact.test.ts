/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { contactDataApi } from "pagopa-interop-api-clients";
import { authRole } from "pagopa-interop-commons";
import { generateId } from "pagopa-interop-models";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  contactNotFound,
  contactRetrievalFailed,
} from "../../src/model/errors.js";
import {
  api,
  contactService,
  createTestToken,
  spyOnLogs,
} from "../vitest.api.setup.js";

const token = await createTestToken();

describe("GET /contacts/:contactId", () => {
  const email = "private-contact@example.com";
  const savedContact: contactDataApi.Contact = { id: generateId(), email };
  const makeRequest = (id = savedContact.id, authToken = token) =>
    request(api)
      .get(`/contacts/${encodeURIComponent(id)}`)
      .set("Authorization", `Bearer ${authToken}`)
      .set("X-Correlation-Id", generateId());

  beforeEach(() => {
    contactService.getContact.mockReset().mockResolvedValue(savedContact);
  });

  afterEach(() => vi.restoreAllMocks());

  it("returns the contact identified by its ID", async () => {
    const logs = spyOnLogs();
    const response = await makeRequest();

    expect(response.status).toBe(200);
    expect(contactDataApi.Contact.parse(response.body)).toEqual(savedContact);
    expect(response.body).not.toHaveProperty("createdAt");
    expect(contactService.getContact).toHaveBeenCalledWith(
      savedContact.id,
      expect.any(Object)
    );
    expect(logs).toHaveBeenCalled();
    expect(JSON.stringify(logs.mock.calls)).not.toContain(email);
  });

  it.each(["not-a-uuid", email])(
    "rejects invalid contact IDs without logging their value %#",
    async (id) => {
      const logs = spyOnLogs();
      const response = await makeRequest(id);

      expect(response.status).toBe(400);
      expect(contactDataApi.Problem.parse(response.body).detail).toBe(
        "Invalid contact ID"
      );
      expect(contactService.getContact).not.toHaveBeenCalled();
      expect(JSON.stringify(response.body)).not.toContain(email);
      expect(logs).toHaveBeenCalled();
      expect(JSON.stringify(logs.mock.calls)).not.toContain(email);
      expect(JSON.stringify(logs.mock.calls)).not.toContain(
        encodeURIComponent(email)
      );
    }
  );

  it("does not log unexpected query parameters", async () => {
    const logs = spyOnLogs();
    const response = await makeRequest().query({ email });

    expect(response.status).toBe(200);
    expect(logs).toHaveBeenCalled();
    expect(JSON.stringify(logs.mock.calls)).not.toContain(email);
    expect(JSON.stringify(logs.mock.calls)).not.toContain(
      encodeURIComponent(email)
    );
  });

  it("rejects requests without authentication", async () => {
    const response = await request(api)
      .get(`/contacts/${savedContact.id}`)
      .set("X-Correlation-Id", generateId());

    expect(response.status).toBe(400);
    expect(contactService.getContact).not.toHaveBeenCalled();
  });

  it("rejects invalid tokens", async () => {
    const response = await makeRequest(savedContact.id, "invalid.jwt.token");

    expect(response.status).toBe(401);
    expect(contactService.getContact).not.toHaveBeenCalled();
  });

  it.each(
    Object.values(authRole).filter((role) => role !== authRole.INTERNAL_ROLE)
  )("rejects signed tokens with role %s", async (role) => {
    const response = await makeRequest(
      savedContact.id,
      await createTestToken(role)
    );

    expect(response.status).toBe(403);
    expect(contactService.getContact).not.toHaveBeenCalled();
  });

  it("returns 404 when no contact exists for the valid UUID", async () => {
    contactService.getContact.mockRejectedValue(contactNotFound());
    const response = await makeRequest();

    expect(response.status).toBe(404);
    expect(contactDataApi.Problem.parse(response.body).errors).toEqual([
      { code: "018-0002", detail: "Contact not found" },
    ]);
  });

  it("maps database failures to a safe 500 response", async () => {
    contactService.getContact.mockRejectedValue(contactRetrievalFailed());
    const response = await makeRequest();

    expect(response.status).toBe(500);
    expect(contactDataApi.Problem.parse(response.body).errors).toEqual([
      { code: "018-0003", detail: "Unable to retrieve contact" },
    ]);
  });

  it.each([new Error(email), new TypeError(email), new SyntaxError(email)])(
    "hides unexpected service error details %#",
    async (error) => {
      contactService.getContact.mockRejectedValue(error);
      const logs = spyOnLogs();
      const response = await makeRequest();

      expect(response.status).toBe(500);
      expect(contactDataApi.Problem.parse(response.body).errors).toEqual([
        { code: "018-9991", detail: "Unexpected error" },
      ]);
      expect(JSON.stringify(response.body)).not.toContain(email);
      expect(logs).toHaveBeenCalledWith(
        expect.objectContaining({
          level: "error",
          message: "Contact request failed",
        })
      );
      expect(JSON.stringify(logs.mock.calls)).not.toContain(email);
    }
  );
});
