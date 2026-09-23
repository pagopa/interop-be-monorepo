/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { authRole, problemContentType } from "pagopa-interop-commons";
import {
  generateToken,
  getMockEService,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { generateId } from "pagopa-interop-models";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { eServiceNotFound } from "../../src/model/domain/errors.js";
import { api, catalogService } from "../vitest.api.setup.js";

describe("problemContentTypeMiddleware", () => {
  const eservice = getMockEService();
  const token = generateToken(authRole.ADMIN_ROLE);

  const makeRequest = async () =>
    request(api)
      .get(`/eservices/${eservice.id}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

  it("Should send successful responses as application/json", async () => {
    catalogService.getEServiceById = vi
      .fn()
      .mockResolvedValue(getMockWithMetadata(eservice));

    const res = await makeRequest();

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/^application\/json/);
  });

  it("Should send problems returned by route handlers as application/problem+json", async () => {
    catalogService.getEServiceById = vi
      .fn()
      .mockRejectedValue(eServiceNotFound(eservice.id));

    const res = await makeRequest();

    expect(res.status).toBe(404);
    expect(res.headers["content-type"]).toBe(problemContentType);
  });

  it("Should send problems returned by the body parser as application/problem+json", async () => {
    // rejected by the json body parser zodiosCtx.app() registers before the wrapper
    const res = await request(api)
      .post("/eservices")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .set("Content-Type", "application/json")
      .send('{"name":');

    expect(res.status).toBe(400);
    expect(res.headers["content-type"]).toBe(problemContentType);
  });

  it("Should send problems returned by middlewares as application/problem+json", async () => {
    const res = await request(api)
      .get(`/eservices/${eservice.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send();

    expect(res.status).toBe(400);
    expect(res.headers["content-type"]).toBe(problemContentType);
  });
});
