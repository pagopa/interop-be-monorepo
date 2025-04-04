/* eslint-disable functional/no-let */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";

import {
  Descriptor,
  descriptorState,
  EService,
  EServiceId,
  EServiceTemplateId,
  generateId,
  TenantId,
} from "pagopa-interop-models";
import { createPayload, getMockAuthData } from "pagopa-interop-commons-test";
import { AuthData, userRoles } from "pagopa-interop-commons";
import { api } from "../vitest.api.setup.js";
import { catalogService } from "../../src/routers/EServiceRouter.js";
import { getMockDescriptor, getMockDocument } from "../mockUtils.js";
import { eServiceToApiEService } from "../../src/model/domain/apiConverter.js";

describe("addEServiceTemplateInstanceInterface", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("POST /templates/eservices/:eServiceId/descriptors/:descriptorId/interface/rest", () => {
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
        templateRef: {
          id: generateId<EServiceTemplateId>(),
          instanceLabel: "Mocked REST instance",
        },
        riskAnalysis: [],
        mode: "Deliver",
      };

      vi.spyOn(
        catalogService,
        "addEServiceTemplateInstanceInterface"
      ).mockResolvedValue(mockEserviceREST);
    });
    const generateToken = (authData: AuthData) =>
      jwt.sign(createPayload(authData), "test-secret");

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

    it.each([userRoles.ADMIN_ROLE, userRoles.API_ROLE])(
      "Should return 200 for user with role %s",
      async (role) => {
        const token = generateToken({
          ...getMockAuthData(),
          userRoles: [role],
        });
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
      Object.values(userRoles).filter(
        (role) => role !== userRoles.ADMIN_ROLE && role !== userRoles.API_ROLE
      )
    )("Should return 403 for user with role %s", async (role) => {
      const token = generateToken({ ...getMockAuthData(), userRoles: [role] });
      const res = await makeRequest(token, mockEserviceREST.id, descriptor.id);

      expect(res.status).toBe(403);
    });
  });

  describe("POST /templates/eservices/:eServiceId/descriptors/:descriptorId/interface/soap", () => {
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
        descriptors: [descriptor],
        templateRef: {
          id: generateId<EServiceTemplateId>(),
          instanceLabel: "Mocked SOAP instance",
        },
        riskAnalysis: [],
        mode: "Deliver",
      };

      vi.spyOn(
        catalogService,
        "addEServiceTemplateInstanceInterface"
      ).mockResolvedValue(mockEserviceSOAP);
    });
    const generateToken = (authData: AuthData) =>
      jwt.sign(createPayload(authData), "test-secret");

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

    it.each([userRoles.ADMIN_ROLE, userRoles.API_ROLE])(
      "Should return 200 for user with role %s",
      async (role) => {
        const token = generateToken({
          ...getMockAuthData(),
          userRoles: [role],
        });
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
      Object.values(userRoles).filter(
        (role) => role !== userRoles.ADMIN_ROLE && role !== userRoles.API_ROLE
      )
    )("Should return 403 for user with role %s", async (role) => {
      const token = generateToken({ ...getMockAuthData(), userRoles: [role] });
      const res = await makeRequest(token, mockEserviceSOAP.id, descriptor.id);

      expect(res.status).toBe(403);
    });
  });
});
