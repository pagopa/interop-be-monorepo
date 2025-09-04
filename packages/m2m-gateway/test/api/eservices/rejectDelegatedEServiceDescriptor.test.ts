import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockedApiEservice,
  getMockedApiEserviceDescriptor,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import {
  DescriptorId,
  EServiceId,
  pollingMaxRetriesExceeded,
} from "pagopa-interop-models";
import { catalogApi, m2mGatewayApi } from "pagopa-interop-api-clients";
import { api, mockEserviceService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { missingMetadata } from "../../../src/model/errors.js";
import { toM2MGatewayApiEServiceDescriptor } from "../../../src/api/eserviceApiConverter.js";
import { config } from "../../../src/config/config.js";

describe("POST /eservices/:eserviceId/descriptors/:descriptorId/reject router test", () => {
  const mockApiDescriptor: catalogApi.EServiceDescriptor = {
    ...getMockedApiEserviceDescriptor(),
    state: "DRAFT",
  };

  const mockApiEservice = getMockedApiEservice({
    descriptors: [mockApiDescriptor],
  });

  const mockM2MEserviceDescriptorResponse: m2mGatewayApi.EServiceDescriptor =
    toM2MGatewayApiEServiceDescriptor(mockApiDescriptor);

  const mockRejectionReason: catalogApi.RejectDelegatedEServiceDescriptorSeed =
    {
      rejectionReason: "reason",
    };

  const makeRequest = async (
    token: string,
    eServiceId: string,
    descriptorId: string,
    body: catalogApi.RejectDelegatedEServiceDescriptorSeed = mockRejectionReason
  ) =>
    request(api)
      .post(
        `${appBasePath}/eservices/${eServiceId}/descriptors/${descriptorId}/reject`
      )
      .set("Authorization", `Bearer ${token}`)
      .send(body);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockEserviceService.rejectDelegatedEServiceDescriptor = vi
        .fn()
        .mockResolvedValue(mockM2MEserviceDescriptorResponse);

      const token = generateToken(role);
      const res = await makeRequest(
        token,
        mockApiEservice.id,
        mockApiDescriptor.id
      );

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockM2MEserviceDescriptorResponse);
    }
  );

  it.each([
    [{}, mockApiEservice.id, mockApiDescriptor.id],
    [{ rejectionReason: 123 }, mockApiEservice.id, mockApiDescriptor.id],
    [{ ...mockRejectionReason }, mockApiEservice.id, "invalidId"],
    [{ ...mockRejectionReason }, "invalidId", mockApiDescriptor.id],
  ])(
    "Should return 400 if passed invalid params: %s (eserviceId: %s, descriptorId: %s)",
    async (body, eServiceId, descriptorId) => {
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(
        token,
        eServiceId as EServiceId,
        descriptorId as DescriptorId,
        body as catalogApi.RejectDelegatedEServiceDescriptorSeed
      );

      expect(res.status).toBe(400);
    }
  );
  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(
      token,
      mockApiEservice.id,
      mockApiDescriptor.id
    );
    expect(res.status).toBe(403);
  });

  it.each([
    missingMetadata(),
    pollingMaxRetriesExceeded(
      config.defaultPollingMaxRetries,
      config.defaultPollingRetryDelay
    ),
  ])("Should return 500 in case of $code error", async (error) => {
    mockEserviceService.rejectDelegatedEServiceDescriptor = vi
      .fn()
      .mockRejectedValue(error);
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      mockApiEservice.id,
      mockApiDescriptor.id
    );

    expect(res.status).toBe(500);
  });
});
