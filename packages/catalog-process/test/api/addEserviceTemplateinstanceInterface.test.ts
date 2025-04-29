/* eslint-disable functional/no-let */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import {
  Descriptor,
  descriptorState,
  EService,
  EServiceId,
  EServiceTemplateId,
  generateId,
  TenantId,
} from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { api, catalogService } from "../vitest.api.setup.js";
import { getMockDescriptor, getMockDocument } from "../mockUtils.js";
import { eServiceToApiEService } from "../../src/model/domain/apiConverter.js";

describe("addEServiceTemplateInstanceInterface", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const authorizedRoles: AuthRole[] = [authRole.ADMIN_ROLE, authRole.API_ROLE];

  describe("POST /templates/eservices/{eServiceId}/descriptors/{descriptorId}/interface/rest", () => {
    let mockEserviceREST: EService;
    let descriptor: Descriptor;

    beforeEach(() => {
      descriptor = {
        ...getMockDescriptor(),
        interface: getMockDocument(),
        state: descriptorState.draft,
      };

      mockEserviceREST = {
        name: "Test EService Rest",
        id: generateId<EServiceId>(),
        createdAt: new Date(),
        producerId: generateId<TenantId>(),
        description: "Test description for REST",
        technology: "Rest",
        descriptors: [descriptor],
        templateId: generateId<EServiceTemplateId>(),
        riskAnalysis: [],
        mode: "Deliver",
      };

      catalogService.addEServiceTemplateInstanceInterface = vi
        .fn()
        .mockResolvedValue(mockEserviceREST);
    });

    const makeRequest = async (
      token: string,
      eServiceId: string,
      descriptorId: string
    ) =>
      request(api)
        .post(
          `/templates/eservices/${eServiceId}/descriptors/${descriptorId}/interface/rest`
        )
        .set("Authorization", `Bearer ${token}`)
        .set("X-Correlation-Id", generateId())
        .send({
          contactName: "John Doe",
          contactUrl: "https://contact.url",
          contactEmail: "john.doe@example.com",
          termsAndConditionsUrl: "https://terms.url",
          serverUrls: ["https://server1.com", "https://server2.com"],
        });

    it.each(authorizedRoles)(
      "Should return 200 for user with role %s",
      async (role) => {
        const token = generateToken(role);
        const res = await makeRequest(
          token,
          mockEserviceREST.id,
          descriptor.id
        );

        expect(res.body).toEqual(eServiceToApiEService(mockEserviceREST));
        expect(res.status).toBe(200);
      }
    );

    it.each(
      Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
    )("Should return 403 for user with role %s", async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token, mockEserviceREST.id, descriptor.id);

      expect(res.status).toBe(403);
    });
  });

  describe("POST /templates/eservices/{eServiceId}/descriptors/{descriptorId}/interface/soap", () => {
    let mockEserviceSOAP: EService;
    let descriptor: Descriptor;

    beforeEach(() => {
      descriptor = {
        ...getMockDescriptor(),
        interface: getMockDocument(),
        state: descriptorState.draft,
      };

      mockEserviceSOAP = {
        name: "Test EService SOAP",
        id: generateId<EServiceId>(),
        createdAt: new Date(),
        producerId: generateId<TenantId>(),
        description: "Test description for SOAP",
        technology: "Soap",
        templateId: generateId<EServiceTemplateId>(),
        descriptors: [descriptor],
        riskAnalysis: [],
        mode: "Deliver",
      };

      catalogService.addEServiceTemplateInstanceInterface = vi
        .fn()
        .mockResolvedValue(mockEserviceSOAP);
    });

    const makeRequest = async (
      token: string,
      eServiceId: string,
      descriptorId: string
    ) =>
      request(api)
        .post(
          `/templates/eservices/${eServiceId}/descriptors/${descriptorId}/interface/soap`
        )
        .set("Authorization", `Bearer ${token}`)
        .set("X-Correlation-Id", generateId())
        .send({
          serverUrls: ["https://soap.server1.com", "https://soap.server2.com"],
        });

    it.each(authorizedRoles)(
      "Should return 200 for user with role %s",
      async (role) => {
        const token = generateToken(role);
        const res = await makeRequest(
          token,
          mockEserviceSOAP.id,
          descriptor.id
        );

        expect(res.body).toEqual(eServiceToApiEService(mockEserviceSOAP));
        expect(res.status).toBe(200);
      }
    );

    it.each(
      Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
    )("Should return 403 for user with role %s", async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token, mockEserviceSOAP.id, descriptor.id);

      expect(res.status).toBe(403);
    });
  });
});
