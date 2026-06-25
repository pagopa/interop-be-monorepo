/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AttributeId,
  DescriptorId,
  EServiceId,
  generateId,
} from "pagopa-interop-models";
import request from "supertest";
import { generateToken } from "pagopa-interop-commons-test/index.js";
import { authRole } from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";
import { api, clients } from "../../vitest.api.setup.js";
import {
  getMockBffApiCreatedResource,
  getMockCatalogApiUpdateEServiceDescriptorQuotasSeed,
} from "../../mockUtils.js";
import { appBasePath } from "../../../src/config/appBasePath.js";

describe("API POST /eservices/:eServiceId/descriptors/:descriptorId/update", () => {
  const mockApiUpdateEServiceDescriptorQuotas =
    getMockCatalogApiUpdateEServiceDescriptorQuotasSeed();
  const mockApiCreatedResource = getMockBffApiCreatedResource();

  beforeEach(() => {
    clients.catalogProcessClient.updateDescriptor = vi
      .fn()
      .mockResolvedValue(mockApiCreatedResource);
  });

  const makeRequest = async (
    token: string,
    eServiceId: EServiceId = generateId(),
    descriptorId: DescriptorId = generateId(),
    body: bffApi.UpdateEServiceDescriptorQuotas = mockApiUpdateEServiceDescriptorQuotas
  ) =>
    request(api)
      .post(
        `${appBasePath}/eservices/${eServiceId}/descriptors/${descriptorId}/update`
      )
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
    { body: { ...mockApiUpdateEServiceDescriptorQuotas, extraField: 1 } },
    { body: { ...mockApiUpdateEServiceDescriptorQuotas, voucherLifespan: 59 } },
    {
      body: {
        ...mockApiUpdateEServiceDescriptorQuotas,
        voucherLifespan: 86401,
      },
    },
    {
      body: {
        ...mockApiUpdateEServiceDescriptorQuotas,
        dailyCallsPerConsumer: 0,
      },
    },
    { body: { ...mockApiUpdateEServiceDescriptorQuotas, dailyCallsTotal: 0 } },
  ])(
    "Should return 400 if passed an invalid parameter: %s",
    async ({ eServiceId, descriptorId, body }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        eServiceId,
        descriptorId,
        body as bffApi.UpdateEServiceDescriptorQuotas
      );
      expect(res.status).toBe(400);
    }
  );

  it("Should forward attributes with per-certified-attribute dailyCallsPerConsumer to catalog process", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const certifiedAttributeId = generateId<AttributeId>();

    const body: bffApi.UpdateEServiceDescriptorQuotas = {
      ...mockApiUpdateEServiceDescriptorQuotas,
      attributes: {
        certified: [
          [
            {
              id: certifiedAttributeId,
              dailyCallsPerConsumer: 500,
            },
          ],
        ],
        declared: [],
        verified: [],
      },
    };

    const eServiceId = generateId<EServiceId>();
    const descriptorId = generateId<DescriptorId>();
    const res = await makeRequest(token, eServiceId, descriptorId, body);

    expect(res.status).toBe(200);
    expect(clients.catalogProcessClient.updateDescriptor).toHaveBeenCalledWith(
      expect.objectContaining({
        attributes: {
          certified: [
            [
              {
                id: certifiedAttributeId,
                dailyCallsPerConsumer: 500,
              },
            ],
          ],
          declared: [],
          verified: [],
        },
      }),
      expect.objectContaining({
        params: { eServiceId, descriptorId },
      })
    );
  });

  it("Should return 400 if attributes are malformed", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(
      token,
      generateId<EServiceId>(),
      generateId<DescriptorId>(),
      {
        ...mockApiUpdateEServiceDescriptorQuotas,
        attributes: { certified: "invalid", declared: [], verified: [] },
      } as unknown as bffApi.UpdateEServiceDescriptorQuotas
    );
    expect(res.status).toBe(400);
  });
});
