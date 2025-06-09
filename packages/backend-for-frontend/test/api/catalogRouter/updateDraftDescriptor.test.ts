/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DescriptorId, EServiceId, generateId } from "pagopa-interop-models";
import request from "supertest";
import { generateToken } from "pagopa-interop-commons-test/index.js";
import { authRole } from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";
import { api, clients } from "../../vitest.api.setup.js";
import {
  getMockBffApiCreatedResource,
  getMockBffApiUpdateEServiceDescriptorSeed,
} from "../../mockUtils.js";
import { appBasePath } from "../../../src/config/appBasePath.js";

describe("API PUT /eservices/:eServiceId/descriptors/:descriptorId", () => {
  const mockUpdateEServiceDescriptorSeed =
    getMockBffApiUpdateEServiceDescriptorSeed();
  const mockApiCreatedResource = getMockBffApiCreatedResource();

  beforeEach(() => {
    clients.catalogProcessClient.updateDraftDescriptor = vi
      .fn()
      .mockResolvedValue(mockApiCreatedResource);
  });

  const makeRequest = async (
    token: string,
    eServiceId: EServiceId = generateId(),
    descriptorId: DescriptorId = generateId(),
    body: bffApi.UpdateEServiceDescriptorSeed = mockUpdateEServiceDescriptorSeed
  ) =>
    request(api)
      .put(`${appBasePath}/eservices/${eServiceId}/descriptors/${descriptorId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 200 if no error is thrown", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockApiCreatedResource);
  });

  it.each([
    { eServiceId: "invalid" as EServiceId },
    { descriptorId: "invalid" as DescriptorId },
    { body: {} },
    { body: { ...mockUpdateEServiceDescriptorSeed, extraField: 1 } },
    { body: { ...mockUpdateEServiceDescriptorSeed, audience: "invalid" } },
    {
      body: { ...mockUpdateEServiceDescriptorSeed, voucherLifespan: "invalid" },
    },
    {
      body: {
        ...mockUpdateEServiceDescriptorSeed,
        dailyCallsPerConsumer: "invalid",
      },
    },
    {
      body: { ...mockUpdateEServiceDescriptorSeed, dailyCallsTotal: "invalid" },
    },
    {
      body: {
        ...mockUpdateEServiceDescriptorSeed,
        agreementApprovalPolicy: "invalid",
      },
    },
    {
      body: {
        ...mockUpdateEServiceDescriptorSeed,
        attributes: "invalid",
      },
    },
  ])(
    "Should return 400 if passed an invalid parameter",
    async ({ eServiceId, descriptorId, body }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        eServiceId,
        descriptorId,
        body as bffApi.UpdateEServiceDescriptorSeed
      );
      expect(res.status).toBe(400);
    }
  );
});
