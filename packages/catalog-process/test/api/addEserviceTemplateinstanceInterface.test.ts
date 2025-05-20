/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable functional/no-let */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import {
  Descriptor,
  DescriptorId,
  descriptorState,
  EService,
  EServiceId,
  EServiceTemplateId,
  generateId,
  interfaceExtractingInfoError,
  invalidInterfaceContentTypeDetected,
  invalidInterfaceFileDetected,
  operationForbidden,
  Technology,
  TenantId,
} from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { api, catalogService } from "../vitest.api.setup.js";
import { getMockDescriptor, getMockDocument } from "../mockUtils.js";
import { eServiceToApiEService } from "../../src/model/domain/apiConverter.js";
import {
  documentPrettyNameDuplicate,
  eServiceDescriptorNotFound,
  eserviceInterfaceDataNotValid,
  eServiceNotAnInstance,
  eServiceNotFound,
  eserviceTemplateInterfaceNotFound,
  eServiceTemplateNotFound,
  eServiceTemplateWithoutPublishedVersion,
  interfaceAlreadyExists,
  notValidDescriptorState,
} from "../../src/model/domain/errors.js";

describe("addEServiceTemplateInstanceInterface", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const authorizedRoles: AuthRole[] = [authRole.ADMIN_ROLE, authRole.API_ROLE];

  const getMockEServiceByTechnology = (
    technology: Technology,
    descriptor: Descriptor
  ): EService => ({
    name: `Test EService ${technology.toUpperCase()}`,
    id: generateId<EServiceId>(),
    createdAt: new Date(),
    producerId: generateId<TenantId>(),
    description: `Test description for ${technology.toUpperCase()}`,
    technology: technology === "Rest" ? "Rest" : "Soap",
    descriptors: [descriptor],
    templateId: generateId<EServiceTemplateId>(),
    riskAnalysis: [],
    mode: "Deliver",
  });

  const restBody = {
    contactName: "John Doe",
    contactUrl: "https://contact.url",
    contactEmail: "john.doe@example.com",
    termsAndConditionsUrl: "https://terms.url",
    serverUrls: ["https://server1.com", "https://server2.com"],
  };

  const soapBody = {
    serverUrls: ["https://soap.server1.com", "https://soap.server2.com"],
  };

  const makeRequest = async (
    token: string,
    eServiceId: EServiceId,
    descriptorId: DescriptorId,
    technology: Technology,
    body?: typeof restBody | typeof soapBody
  ) => {
    const payload = body ?? (technology === "Rest" ? restBody : soapBody);

    return request(api)
      .post(
        `/templates/eservices/${eServiceId}/descriptors/${descriptorId}/interface/${technology}`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(payload);
  };

  (["Rest", "Soap"] as Technology[]).forEach((technology) => {
    describe(`POST /templates/eservices/{eServiceId}/descriptors/{descriptorId}/interface/${technology}`, () => {
      const descriptor: Descriptor = {
        ...getMockDescriptor(),
        interface: getMockDocument(),
        state: descriptorState.draft,
      };

      const eservice: EService = getMockEServiceByTechnology(
        technology,
        descriptor
      );

      beforeEach(() => {
        catalogService.addEServiceTemplateInstanceInterface = vi
          .fn()
          .mockResolvedValue(eservice);
      });

      it.each(authorizedRoles)(
        `Should return 200 for user with role %s`,
        async (role) => {
          const token = generateToken(role);
          const res = await makeRequest(
            token,
            eservice.id,
            descriptor.id,
            technology
          );

          expect(res.body).toEqual(eServiceToApiEService(eservice));
          expect(res.status).toBe(200);
        }
      );

      it.each(
        Object.values(authRole).filter(
          (role) => !authorizedRoles.includes(role)
        )
      )("Should return 403 for user with role %s", async (role) => {
        const token = generateToken(role);
        const res = await makeRequest(
          token,
          eservice.id,
          descriptor.id,
          technology
        );
        expect(res.status).toBe(403);
      });

      it.each([
        { error: eServiceNotAnInstance(eservice.id), expectedStatus: 409 },
        {
          error: eServiceTemplateWithoutPublishedVersion(eservice.templateId!),
          expectedStatus: 409,
        },
        {
          error: invalidInterfaceFileDetected(eservice.id),
          expectedStatus: 409,
        },
        { error: interfaceAlreadyExists(descriptor.id), expectedStatus: 409 },
        { error: eServiceNotFound(eservice.id), expectedStatus: 404 },
        {
          error: eServiceDescriptorNotFound(eservice.id, descriptor.id),
          expectedStatus: 404,
        },
        {
          error: eServiceTemplateNotFound(eservice.templateId!),
          expectedStatus: 404,
        },
        {
          error: eserviceTemplateInterfaceNotFound(eservice.templateId!, "1"),
          expectedStatus: 403,
        },
        { error: interfaceExtractingInfoError(), expectedStatus: 403 },
        { error: operationForbidden, expectedStatus: 403 },
        { error: eserviceInterfaceDataNotValid(), expectedStatus: 400 },
        {
          error: invalidInterfaceContentTypeDetected(
            eservice.id,
            "invalid",
            eservice.technology
          ),
          expectedStatus: 400,
        },
        {
          error: documentPrettyNameDuplicate("test", descriptor.id),
          expectedStatus: 400,
        },
        {
          error: notValidDescriptorState(descriptor.id, descriptor.state),
          expectedStatus: 400,
        },
      ])(
        "Should return $expectedStatus for $error.code",
        async ({ error, expectedStatus }) => {
          catalogService.addEServiceTemplateInstanceInterface = vi
            .fn()
            .mockRejectedValue(error);

          const token = generateToken(authRole.ADMIN_ROLE);
          const res = await makeRequest(
            token,
            eservice.id,
            descriptor.id,
            technology
          );
          expect(res.status).toBe(expectedStatus);
        }
      );

      const defaultBodies = {
        Rest: restBody,
        Soap: soapBody,
      };

      type InvalidCase = [
        body: unknown,
        eServiceId: EServiceId | string,
        descriptorId: DescriptorId | string
      ];

      const invalidCases: InvalidCase[] = [
        [{}, eservice.id, descriptor.id],
        [defaultBodies[technology], "invalidId", descriptor.id],
        [defaultBodies[technology], eservice.id, "invalidId"],
      ];

      if (technology === "Rest") {
        invalidCases.push([
          { ...restBody, contactName: 123 },
          eservice.id,
          descriptor.id,
        ]);
        invalidCases.push([
          { ...restBody, contactUrl: 123 },
          eservice.id,
          descriptor.id,
        ]);
        invalidCases.push([
          { ...restBody, contactEmail: 123 },
          eservice.id,
          descriptor.id,
        ]);
        invalidCases.push([
          { ...restBody, termsAndConditionsUrl: 123 },
          eservice.id,
          descriptor.id,
        ]);
        invalidCases.push([
          { ...restBody, serverUrls: "not-an-array" },
          eservice.id,
          descriptor.id,
        ]);
      }

      if (technology === "Soap") {
        invalidCases.push([
          { serverUrls: "not-an-array" },
          eservice.id,
          descriptor.id,
        ]);
      }

      it.each(invalidCases)(
        "Should return 400 if passed invalid params: %s (eserviceId: %s, descriptorId: %s)",
        async (body, eServiceId, descriptorId) => {
          const token = generateToken(authRole.ADMIN_ROLE);

          const res = await makeRequest(
            token,
            eServiceId as EServiceId,
            descriptorId as DescriptorId,
            technology,
            body as typeof restBody | typeof soapBody
          );

          expect(res.status).toBe(400);
        }
      );
    });
  });
});
