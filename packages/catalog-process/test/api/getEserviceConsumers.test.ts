/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import {
  Descriptor,
  descriptorState,
  EService,
  generateId,
} from "pagopa-interop-models";
import {
  createPayload,
  getMockAuthData,
  getMockTenant,
} from "pagopa-interop-commons-test";
import { userRoles, AuthData } from "pagopa-interop-commons";
import { catalogApi } from "pagopa-interop-api-clients";
import { api } from "../vitest.api.setup.js";
import {
  getMockAgreement,
  getMockDescriptor,
  getMockEService,
} from "../mockUtils.js";
import { catalogService } from "../../src/routers/EServiceRouter.js";
import {
  agreementStateToApiAgreementState,
  descriptorStateToApiEServiceDescriptorState,
} from "../../src/model/domain/apiConverter.js";

describe("API /eservices/{eServiceId}/consumers authorization test", () => {
  const descriptor: Descriptor = {
    ...getMockDescriptor(),
    state: descriptorState.published,
  };
  const eservice: EService = {
    ...getMockEService(),
    descriptors: [descriptor],
  };

  const tenant = getMockTenant();

  const agreement = getMockAgreement({
    eserviceId: eservice.id,
    descriptorId: descriptor.id,
    producerId: eservice.producerId,
    consumerId: tenant.id,
  });

  const mockResponse = {
    results: [
      {
        descriptorVersion: descriptor.version,
        descriptorState: descriptor.state,
        agreementState: agreement.state,
        consumerName: tenant.name,
        consumerExternalId: tenant.externalId.value,
      },
    ],
    totalCount: 1,
  };

  const apiResponse = catalogApi.EServiceConsumers.parse({
    results: mockResponse.results.map((c) => ({
      descriptorVersion: parseInt(c.descriptorVersion, 10),
      descriptorState: descriptorStateToApiEServiceDescriptorState(
        c.descriptorState
      ),
      agreementState: agreementStateToApiAgreementState(c.agreementState),
      consumerName: c.consumerName,
      consumerExternalId: c.consumerExternalId,
    })),
    totalCount: mockResponse.totalCount,
  });

  vi.spyOn(catalogService, "getEServiceConsumers").mockResolvedValue(
    mockResponse
  );

  const generateToken = (authData: AuthData) =>
    jwt.sign(createPayload(authData), "test-secret");

  const makeRequest = async (token: string, eServiceId: string) =>
    request(api)
      .get(`/eservices/${eServiceId}/consumers`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query({ offset: 0, limit: 10 });

  it.each([
    userRoles.ADMIN_ROLE,
    userRoles.API_ROLE,
    userRoles.SECURITY_ROLE,
    userRoles.M2M_ROLE,
    userRoles.SUPPORT_ROLE,
  ])("Should return 200 for user with role %s", async (role) => {
    const token = generateToken({
      ...getMockAuthData(),
      userRoles: [role],
    });
    const res = await makeRequest(token, eservice.id);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(apiResponse);
  });

  it.each([userRoles.INTERNAL_ROLE, userRoles.MAINTENANCE_ROLE])(
    "Should return 403 for user with role %s",
    async (role) => {
      const token = generateToken({
        ...getMockAuthData(),
        userRoles: [role],
      });
      const res = await makeRequest(token, eservice.id);

      expect(res.status).toBe(403);
    }
  );

  it("Should return 404 not found", async () => {
    const res = await makeRequest(generateToken(getMockAuthData()), "");
    expect(res.status).toBe(404);
  });
});
