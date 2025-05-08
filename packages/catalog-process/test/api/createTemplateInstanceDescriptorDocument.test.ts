/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import {
  Descriptor,
  descriptorState,
  EService,
  generateId,
} from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";

import { authRole } from "pagopa-interop-commons";
import { api, catalogService } from "../vitest.api.setup.js";
import {
  buildDocumentSeed,
  getMockDescriptor,
  getMockEService,
} from "../mockUtils.js";

describe("API /internal/templates/eservices/{eServiceId}/descriptors/{descriptorId}/documents/update authorization test", () => {
  const mockDescriptor: Descriptor = {
    ...getMockDescriptor(descriptorState.published),
    serverUrls: [],
  };

  const mockEService: EService = {
    ...getMockEService(),
    descriptors: [mockDescriptor],
  };

  const documentSeed = buildDocumentSeed();

  catalogService.internalCreateTemplateInstanceDescriptorDocument = vi
    .fn()
    .mockResolvedValue({});

  const makeRequest = async (
    token: string,
    eServiceId: string,
    descriptorId: string
  ) =>
    request(api)
      .post(
        `/internal/templates/eservices/${eServiceId}/descriptors/${descriptorId}/documents/update`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(documentSeed);

  it("Should return 204 for user with role Internal", async () => {
    const token = generateToken(authRole.INTERNAL_ROLE);
    const res = await makeRequest(token, mockEService.id, mockDescriptor.id);

    expect(res.status).toBe(204);
  });

  it.each(
    Object.values(authRole).filter((role) => role !== authRole.INTERNAL_ROLE)
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, mockEService.id, mockDescriptor.id);

    expect(res.status).toBe(403);
  });

  it("Should return 404 not found", async () => {
    const res = await makeRequest(
      generateToken(authRole.INTERNAL_ROLE),
      "",
      ""
    );
    expect(res.status).toBe(404);
  });
});
