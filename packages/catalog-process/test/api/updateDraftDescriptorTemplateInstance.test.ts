/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { catalogApi } from "pagopa-interop-api-clients";
import { AuthRole, authRole } from "pagopa-interop-commons";
import {
  generateToken,
  getMockEServiceTemplate,
  getMockDescriptor,
  getMockEService,
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
import { beforeEach, describe, it, expect, vi } from "vitest";

import { eServiceToApiEService } from "../../src/model/domain/apiConverter.js";
import {
  attributeNotFound,
  eServiceDescriptorNotFound,
  eServiceNotAnInstance,
  eServiceNotFound,
  inconsistentDailyCalls,
  notValidDescriptorState,
  templateInstanceNotAllowed,
} from "../../src/model/domain/errors.js";
import { api, catalogService } from "../setup/apiSetup.js";

describe("API /templates/eservices/{eServiceId}/descriptors/{descriptorId} authorization test", () => {
  const descriptor: Descriptor = {
    ...getMockDescriptor(),
    state: descriptorState.draft,
  };

  const mockEService: EService = {
    ...getMockEService(),
    descriptors: [descriptor],
    templateId: getMockEServiceTemplate().id,
  };

  const apiEservice = catalogApi.EService.parse(
    eServiceToApiEService(mockEService)
  );

  const descriptorSeed: catalogApi.UpdateEServiceDescriptorTemplateInstanceSeed =
    {
      audience: descriptor.audience,
      dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer,
      dailyCallsTotal: 200,
      agreementApprovalPolicy: "AUTOMATIC",
    };

  beforeEach(() => {
    catalogService.updateDraftDescriptorTemplateInstance = vi
      .fn()
      .mockResolvedValue(mockEService);
  });

  const makeRequest = async (
    token: string,
    eServiceId: EServiceId,
    descriptorId: DescriptorId,
    body: catalogApi.UpdateEServiceDescriptorTemplateInstanceSeed = descriptorSeed
  ) =>
    request(api)
      .post(`/templates/eservices/${eServiceId}/descriptors/${descriptorId}`)
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
      error: attributeNotFound(generateId()),
      expectedStatus: 400,
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
      error: eServiceNotAnInstance(mockEService.id),
      expectedStatus: 400,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      catalogService.updateDraftDescriptorTemplateInstance = vi
        .fn()
        .mockRejectedValue(error);

      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, mockEService.id, descriptor.id);

      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    [{}, mockEService.id, descriptor.id],
    [{ dailyCallsTotal: "invalid" }, mockEService.id, descriptor.id],
    [{ audience: "invalidType" }, mockEService.id, descriptor.id],
    [{ dailyCallsPerConsumer: -1 }, mockEService.id, descriptor.id],
    [{ agreementApprovalPolicy: null }, mockEService.id, descriptor.id],
    [
      { ...descriptorSeed, dailyCallsTotal: -1 },
      mockEService.id,
      descriptor.id,
    ],
    [{ ...descriptorSeed }, "invalidId", descriptor.id],
    [{ ...descriptorSeed }, mockEService.id, "invalidId"],
  ])(
    "Should return 400 if passed invalid template descriptor update params: %s (eserviceId: %s, descriptorId: %s)",
    async (body, eServiceId, descriptorId) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        eServiceId as EServiceId,
        descriptorId as DescriptorId,
        body as catalogApi.UpdateEServiceDescriptorTemplateInstanceSeed
      );

      expect(res.status).toBe(400);
    }
  );
});
