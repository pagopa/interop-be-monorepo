/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { authRole, problemContentType } from "pagopa-interop-commons";
import { generateToken } from "pagopa-interop-commons-test";
import { DescriptorId, EServiceId, generateId } from "pagopa-interop-models";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { appBasePath } from "../../src/config/appBasePath.js";
import { eserviceDescriptorNotFound } from "../../src/model/errors.js";
import { getMockBffApiProducerEServiceDescriptor } from "../mockUtils.js";
import { api, services } from "../vitest.api.setup.js";

describe("problemContentTypeMiddleware", () => {
  const token = generateToken(authRole.ADMIN_ROLE);

  const makeRequest = async (
    eserviceId: EServiceId | string = generateId<EServiceId>(),
    descriptorId: DescriptorId | string = generateId<DescriptorId>()
  ) =>
    request(api)
      .get(
        `${appBasePath}/producers/eservices/${eserviceId}/descriptors/${descriptorId}`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

  it("Should send successful responses as application/json", async () => {
    services.catalogService.getProducerEServiceDescriptor = vi
      .fn()
      .mockResolvedValue(getMockBffApiProducerEServiceDescriptor());

    const res = await makeRequest();

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/^application\/json/);
  });

  it("Should send problems returned by route handlers as application/problem+json", async () => {
    services.catalogService.getProducerEServiceDescriptor = vi
      .fn()
      .mockRejectedValue(
        eserviceDescriptorNotFound(generateId(), generateId())
      );

    const res = await makeRequest();

    expect(res.status).toBe(404);
    expect(res.headers["content-type"]).toBe(problemContentType);
  });

  it("Should send problems returned by request validation as application/problem+json", async () => {
    const res = await makeRequest("invalid");

    expect(res.status).toBe(400);
    expect(res.headers["content-type"]).toBe(problemContentType);
  });
});
