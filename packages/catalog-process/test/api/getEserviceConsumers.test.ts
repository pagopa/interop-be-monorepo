/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import {
  agreementState,
  Descriptor,
  descriptorState,
  EService,
  EServiceId,
  generateId,
} from "pagopa-interop-models";
import {
  generateToken,
  getMockTenant,
  getMockAgreement,
  getMockDescriptor,
  getMockEService,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { catalogApi } from "pagopa-interop-api-clients";
import { api, catalogService } from "../vitest.api.setup.js";
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

  const agreement = {
    ...getMockAgreement(eservice.id, tenant.id, agreementState.active),
    descriptorId: descriptor.id,
    producerId: eservice.producerId,
  };

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

  catalogService.getEServiceConsumers = vi.fn().mockResolvedValue(mockResponse);

  const queryParams = { offset: 0, limit: 10 };

  const makeRequest = async (
    token: string,
    eServiceId: EServiceId,
    query: typeof queryParams = queryParams
  ) =>
    request(api)
      .get(`/eservices/${eServiceId}/consumers`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query(query);

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.API_ROLE,
    authRole.SECURITY_ROLE,
    authRole.M2M_ROLE,
    authRole.SUPPORT_ROLE,
  ];
  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token, eservice.id);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiResponse);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, eservice.id);

    expect(res.status).toBe(403);
  });

  it.each([
    [{}, eservice.id],
    [{ ...queryParams, offset: "invalid" }, eservice.id],
    [{ ...queryParams, limit: "invalid" }, eservice.id],
    [{ ...queryParams, offset: -2 }, eservice.id],
    [{ ...queryParams, limit: 100 }, eservice.id],
    [{ ...queryParams }, "invalid"],
  ])(
    "Should return 400 if passed invalid params: %s (eserviceId: %s)",
    async (query, eserviceId) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        eserviceId as EServiceId,
        query as typeof queryParams
      );

      expect(res.status).toBe(400);
    }
  );
});
