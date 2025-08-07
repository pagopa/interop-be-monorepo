import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockedApiEservice,
  getMockedApiEserviceDescriptor,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { generateId, pollingMaxRetriesExceeded } from "pagopa-interop-models";
import { catalogApi, m2mGatewayApi } from "pagopa-interop-api-clients";
import { api, mockEserviceService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { missingMetadata } from "../../../src/model/errors.js";
import { toM2MGatewayApiEService } from "../../../src/api/eserviceApiConverter.js";

describe("DELETE /eservices/:eServiceId/descriptors/:descriptorId router test", () => {
  const mockApiDescriptorPublished: catalogApi.EServiceDescriptor = {
    ...getMockedApiEserviceDescriptor(),
    state: "SUSPENDED",
  };

  const mockApiDescriptorDraft: catalogApi.EServiceDescriptor = {
    ...getMockedApiEserviceDescriptor(),
    state: "DRAFT",
  };

  const mockApiEservice = getMockedApiEservice({
    descriptors: [mockApiDescriptorPublished, mockApiDescriptorDraft],
  });

  const mockApiEserviceDeleted = getMockedApiEservice({
    descriptors: [mockApiDescriptorDraft],
  });

  const mockM2MEserviceResponseDeleted: m2mGatewayApi.EService =
    toM2MGatewayApiEService(mockApiEserviceDeleted);

  const makeRequest = async (
    token: string,
    eServiceId: string,
    descriptorId: string
  ) =>
    request(api)
      .delete(
        `${appBasePath}/eservices/${eServiceId}/descriptors/${descriptorId}`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 204 and perform service calls for user with role %s",
    async (role) => {
      mockEserviceService.deleteDraftDescriptor = vi.fn();

      const token = generateToken(role);
      const res = await makeRequest(
        token,
        mockApiEservice.id,
        mockApiDescriptorDraft.id
      );

      expect(res.status).toBe(204);
    }
  );

  it.each(authorizedRoles)(
    "Should return 204 and perform service calls for user with role %s",
    async (role) => {
      mockEserviceService.deleteDraftDescriptor = vi.fn();

      const token = generateToken(role);
      const res = await makeRequest(
        token,
        mockM2MEserviceResponseDeleted.id,
        mockApiDescriptorDraft.id
      );

      expect(res.status).toBe(204);
    }
  );

  it("Should return 400 for invalid eService id", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      "INVALID_ID",
      mockApiDescriptorDraft.id
    );
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
      mockApiDescriptorDraft.id
    );
    expect(res.status).toBe(403);
  });

  it.each([missingMetadata(), pollingMaxRetriesExceeded(3, 10)])(
    "Should return 500 in case of $code error",
    async (error) => {
      mockEserviceService.deleteDraftDescriptor = vi
        .fn()
        .mockRejectedValue(error);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(
        token,
        mockApiEservice.id,
        mockApiDescriptorDraft.id
      );

      expect(res.status).toBe(500);
    }
  );
});
