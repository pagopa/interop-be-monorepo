/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { catalogApi } from "pagopa-interop-api-clients";
import { AuthRole, authRole } from "pagopa-interop-commons";
import {
  generateToken,
  getMockAttribute,
  getMockDescriptor,
  getMockEService,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  Descriptor,
  DescriptorId,
  descriptorState,
  EService,
  EServiceId,
  generateId,
  operationForbidden,
} from "pagopa-interop-models";
import request from "supertest";
import { describe, it, expect, vi } from "vitest";

import { eServiceToApiEService } from "../../src/model/domain/apiConverter.js";
import {
  asyncExchangeBulkNotAllowedForSoap,
  attributeDailyCallsNotAllowed,
  attributeDiscreteConfigNotAllowed,
  attributeDuplicatedInGroup,
  attributeNotFound,
  eServiceDescriptorNotFound,
  eServiceNotFound,
  inconsistentDailyCalls,
  notValidDescriptorState,
  templateInstanceNotAllowed,
} from "../../src/model/domain/errors.js";
import { buildUpdateDescriptorSeed } from "../mockUtils.js";
import { api, catalogService } from "../vitest.api.setup.js";

describe("PUT /eservices/{eServiceId}/descriptors/{descriptorId} router test", () => {
  const descriptor: Descriptor = {
    ...getMockDescriptor(),
    state: descriptorState.draft,
  };

  const mockEService: EService = {
    ...getMockEService(),
    descriptors: [descriptor],
  };

  const serviceResponse = getMockWithMetadata(mockEService);

  const apiEservice = catalogApi.EService.parse(
    eServiceToApiEService(mockEService)
  );

  const descriptorSeed: catalogApi.UpdateEServiceDescriptorSeed = {
    ...buildUpdateDescriptorSeed(descriptor),
    dailyCallsTotal: 200,
    attributes: {
      certified: [],
      declared: [[{ id: getMockAttribute().id }]],
      verified: [],
    },
  };

  catalogService.updateDraftDescriptor = vi
    .fn()
    .mockResolvedValue(serviceResponse);

  const makeRequest = async (
    token: string,
    eServiceId: EServiceId,
    descriptorId: DescriptorId,
    body: catalogApi.UpdateEServiceDescriptorSeed = descriptorSeed
  ) =>
    request(api)
      .put(`/eservices/${eServiceId}/descriptors/${descriptorId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  const authorizedRoles: AuthRole[] = [authRole.ADMIN_ROLE, authRole.API_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token, mockEService.id, descriptor.id);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiEservice);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, mockEService.id, descriptor.id);

    expect(res.status).toBe(403);
  });

  it.each([
    {
      error: eServiceNotFound(mockEService.id),
      expectedStatus: 404,
    },
    {
      error: eServiceDescriptorNotFound(mockEService.id, descriptor.id),
      expectedStatus: 404,
    },
    {
      error: operationForbidden,
      expectedStatus: 403,
    },
    {
      error: notValidDescriptorState(descriptor.id, descriptor.state),
      expectedStatus: 400,
    },
    {
      error: inconsistentDailyCalls(),
      expectedStatus: 400,
    },
    {
      error: attributeNotFound(descriptorSeed.attributes.declared[0][0].id),
      expectedStatus: 404,
    },
    {
      error: templateInstanceNotAllowed(
        mockEService.id,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        mockEService.templateId!
      ),
      expectedStatus: 400,
    },
    {
      error: attributeDuplicatedInGroup(generateId()),
      expectedStatus: 400,
    },
    {
      error: attributeDailyCallsNotAllowed(generateId()),
      expectedStatus: 400,
    },
    {
      error: asyncExchangeBulkNotAllowedForSoap(mockEService.id, descriptor.id),
      expectedStatus: 400,
    },
    {
      error: attributeDiscreteConfigNotAllowed(generateId()),
      expectedStatus: 400,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      catalogService.updateDraftDescriptor = vi
        .fn()
        .mockRejectedValueOnce(error);

      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, mockEService.id, descriptor.id);

      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    [{}, mockEService.id, descriptor.id],
    [{ dailyCallsTotal: "invalid" }, mockEService.id, descriptor.id],
    [{ attributes: undefined }, mockEService.id, descriptor.id],
    [
      { ...descriptorSeed, dailyCallsTotal: -1 },
      mockEService.id,
      descriptor.id,
    ],
    [
      {
        ...descriptorSeed,
        asyncExchangeProperties: {
          responseTime: 1_000_000,
          resourceAvailableTime: 999_999,
          confirmation: true,
          bulk: true,
          maxResultSet: 99_999,
        },
      },
      mockEService.id,
      descriptor.id,
    ],
    [
      {
        ...descriptorSeed,
        asyncExchangeProperties: {
          responseTime: 999_999,
          resourceAvailableTime: 1_000_000,
          confirmation: true,
          bulk: true,
          maxResultSet: 99_999,
        },
      },
      mockEService.id,
      descriptor.id,
    ],
    [
      {
        ...descriptorSeed,
        asyncExchangeProperties: {
          responseTime: 999_999,
          resourceAvailableTime: 999_999,
          confirmation: true,
          bulk: true,
          maxResultSet: 100_000,
        },
      },
      mockEService.id,
      descriptor.id,
    ],
    [
      { ...descriptorSeed, attributes: { certified: [], declared: [] } },
      mockEService.id,
      descriptor.id,
    ],
    [{ ...descriptorSeed }, "invalidId", descriptor.id],
    [{ ...descriptorSeed }, mockEService.id, "invalidId"],
  ])(
    "Should return 400 if passed invalid seed or e-service id (seed #%#)",
    async (body, eServiceId, descriptorId) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        eServiceId as EServiceId,
        descriptorId as DescriptorId,
        body as catalogApi.UpdateEServiceDescriptorSeed
      );

      expect(res.status).toBe(400);
    }
  );
});
