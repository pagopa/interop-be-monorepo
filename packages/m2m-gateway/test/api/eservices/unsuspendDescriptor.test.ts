import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockedApiEservice,
  getMockedApiEserviceDescriptor,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { pollingMaxRetriesExceeded } from "pagopa-interop-models";
import { catalogApi, m2mGatewayApi } from "pagopa-interop-api-clients";
import { api, mockEserviceService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { missingMetadata } from "../../../src/model/errors.js";
import { toM2MGatewayApiEServiceDescriptor } from "../../../src/api/eserviceApiConverter.js";
import { config } from "../../../src/config/config.js";

describe("POST /eservices/:eServiceId/descriptors/:descriptorId/unsuspend router test", () => {
  const mockApiDescriptor: catalogApi.EServiceDescriptor = {
    ...getMockedApiEserviceDescriptor(),
    state: "SUSPENDED",
  };

  const mockApiEservice: catalogApi.EService = getMockedApiEservice({
    descriptors: [mockApiDescriptor],
  });

  const mockM2MEserviceDescriptorResponse: m2mGatewayApi.EServiceDescriptor =
    toM2MGatewayApiEServiceDescriptor(mockApiDescriptor);

  const makeRequest = async (
    token: string,
    eServiceId: string,
    descriptorId: string
  ) =>
    request(api)
      .post(
        `${appBasePath}/eservices/${eServiceId}/descriptors/${descriptorId}/unsuspend`
      )
      .set("Authorization", `Bearer ${token}`)
      .send(mockApiEservice);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockEserviceService.unsuspendDescriptor = vi
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

  it("Should return 400 for invalid eService id", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, "INVALID_ID", mockApiDescriptor.id);
    expect(res.status).toBe(400);
  });

  it("Should return 400 for invalid descriptor id", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, mockApiEservice.id, "INVALID_ID");
    expect(res.status).toBe(400);
  });

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
    mockEserviceService.unsuspendDescriptor = vi.fn().mockRejectedValue(error);
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      mockApiEservice.id,
      mockApiDescriptor.id
    );

    expect(res.status).toBe(500);
  });
});
