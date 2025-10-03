import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockedApiEservice,
  getMockedApiEserviceDescriptor,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import { pollingMaxRetriesExceeded } from "pagopa-interop-models";
import { api, mockEserviceService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { missingMetadata } from "../../../src/model/errors.js";
import { toM2MGatewayApiEServiceDescriptor } from "../../../src/api/eserviceApiConverter.js";
import { config } from "../../../src/config/config.js";

describe("PATCH /eservices/:eserviceId/descriptors/:descriptorId/quotas router test", () => {
  const mockDescriptor = getMockedApiEserviceDescriptor();
  const mockEService = getMockedApiEservice({
    descriptors: [mockDescriptor, getMockedApiEserviceDescriptor()],
  });

  const mockSeed: m2mGatewayApi.EServiceDescriptorQuotasUpdateSeed = {
    voucherLifespan: 3600,
    dailyCallsPerConsumer: 1000,
    dailyCallsTotal: 10000,
  };

  const mockM2MEServiceDescriptor: m2mGatewayApi.EServiceDescriptor =
    toM2MGatewayApiEServiceDescriptor(mockDescriptor);

  const makeRequest = async (
    token: string,
    eserviceId: string = mockEService.id,
    descriptorId: string = mockDescriptor.id,
    body: m2mGatewayApi.EServiceDescriptorQuotasUpdateSeed = mockSeed
  ) =>
    request(api)
      .patch(
        `${appBasePath}/eservices/${eserviceId}/descriptors/${descriptorId}/quotas`
      )
      .set("Authorization", `Bearer ${token}`)
      .send(body);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockEserviceService.updatePublishedEServiceDescriptorQuotas = vi
        .fn()
        .mockResolvedValue(mockM2MEServiceDescriptor);

      const token = generateToken(role);
      const res = await makeRequest(token);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockM2MEServiceDescriptor);
      expect(
        mockEserviceService.updatePublishedEServiceDescriptorQuotas
      ).toHaveBeenCalledWith(
        mockEService.id,
        mockDescriptor.id,
        mockSeed,
        expect.any(Object) // context
      );
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it.each([
    {
      voucherLifespan: 3600,
    },
    {
      dailyCallsPerConsumer: 1000,
    },
    { dailyCallsTotal: 10000 },
    {
      voucherLifespan: 3600,
      dailyCallsPerConsumer: 1000,
    },
    {
      voucherLifespan: 3600,
      dailyCallsTotal: 10000,
    },
    {
      dailyCallsPerConsumer: 1000,
      dailyCallsTotal: 10000,
    },
    {},
  ] satisfies m2mGatewayApi.EServiceDescriptorQuotasUpdateSeed[])(
    "Should return 200 with partial seed (seed #%#)",
    async (seed) => {
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(
        token,
        mockEService.id,
        mockDescriptor.id,
        seed
      );
      expect(res.status).toBe(200);
    }
  );

  it("Should return 400 if passed an invalid eservice id", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, "invalidEServiceId");
    expect(res.status).toBe(400);
  });

  it("Should return 400 if passed an invalid descriptor id", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      mockEService.id,
      "invalidDescriptorId"
    );
    expect(res.status).toBe(400);
  });

  it.each([
    { invalidParam: "invalidValue" },
    { ...mockSeed, extraParam: -1 },
    { ...mockSeed, voucherLifespan: "invalid" },
    { ...mockSeed, dailyCallsPerConsumer: "invalid" },
  ])("Should return 400 if passed invalid seed (seed #%#)", async (seed) => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      mockEService.id,
      mockDescriptor.id,
      seed as m2mGatewayApi.EServiceDescriptorQuotasUpdateSeed
    );

    expect(res.status).toBe(400);
  });

  it.each([
    missingMetadata(),
    pollingMaxRetriesExceeded(
      config.defaultPollingMaxRetries,
      config.defaultPollingRetryDelay
    ),
  ])("Should return 500 in case of $code error", async (error) => {
    mockEserviceService.updatePublishedEServiceDescriptorQuotas = vi
      .fn()
      .mockRejectedValue(error);
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token);

    expect(res.status).toBe(500);
  });

  it.each([
    { ...mockM2MEServiceDescriptor, createdAt: undefined },
    { ...mockM2MEServiceDescriptor, id: "invalidId" },
    { ...mockM2MEServiceDescriptor, extraParam: "extraValue" },
    {},
  ])(
    "Should return 500 when API model parsing fails for response (resp #%#)",
    async (resp) => {
      mockEserviceService.updatePublishedEServiceDescriptorQuotas = vi
        .fn()
        .mockResolvedValue(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token);

      expect(res.status).toBe(500);
    }
  );
});
