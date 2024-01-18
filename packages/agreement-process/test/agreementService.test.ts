/* eslint-disable functional/immutable-data */
import { describe, expect, it } from "vitest";
import {
  Descriptor,
  EService,
  EServiceAttribute,
  Tenant,
  TenantAttribute,
} from "pagopa-interop-models";
import { generateMock } from "@anatine/zod-mock";
import { AuthData } from "pagopa-interop-commons";
import { agreementQueryBuilder } from "../src/services/readmodel/agreementQuery.js";
import { tenantQueryBuilder } from "../src/services/readmodel/tenantQuery.js";
import { eserviceQueryBuilder } from "../src/services/readmodel/eserviceQuery.js";
import { createAgreementLogic } from "../src/services/agreementCreationProcessor.js";
import { ApiAgreementPayload } from "../src/model/types.js";
import { ReadModelServiceMock } from "./utils/readModelServiceMock.js";

const readModelServiceMock = new ReadModelServiceMock();
const agreementQueryMock = agreementQueryBuilder(
  readModelServiceMock.queryFunctions()
);
const tenantQueryMock = tenantQueryBuilder(
  readModelServiceMock.queryFunctions()
);
const eserviceQueryMock = eserviceQueryBuilder(
  readModelServiceMock.queryFunctions()
);

const authDataMock: AuthData = {
  organizationId: "organizationId",
  userId: "userId",
  userRoles: ["ADMIN"],
  externalId: {
    origin: "IPA",
    value: "123456",
  },
};

describe("AgreementService", () => {
  describe("createAgreement", () => {
    it("should create an Agreement when eService producer and Agreement consumer are the same tenant", async () => {
      const eserviceProducer: Tenant = generateMock(Tenant);
      const descriptor: Descriptor = {
        ...generateMock(Descriptor),
        state: "Published",
      };
      const eservice: EService = {
        ...generateMock(EService),
        producerId: eserviceProducer.id,
        descriptors: [descriptor],
      };
      readModelServiceMock.eServices = [eservice];
      readModelServiceMock.tenants = [eserviceProducer];

      const authData: AuthData = {
        ...authDataMock,
        organizationId: eserviceProducer.id,
      };
      const apiAgreementPayload: ApiAgreementPayload = {
        eserviceId: eservice.id,
        descriptorId: eservice.descriptors[0].id,
      };

      const createEvent = await createAgreementLogic(
        apiAgreementPayload,
        authData,
        agreementQueryMock,
        eserviceQueryMock,
        tenantQueryMock
      );
      expect(createEvent.event.type).toBe("AgreementAdded");
      expect(createEvent.event.data).toMatchObject({
        agreement: {
          id: createEvent.streamId,
          eserviceId: apiAgreementPayload.eserviceId,
          descriptorId: apiAgreementPayload.descriptorId,
          producerId: eservice.producerId,
          consumerId: authData.organizationId,
        },
      });
    });

    it("should create an Agreement when eService producer and Agreement consumer are different tenants", async () => {
      const eserviceProducer: Tenant = generateMock(Tenant);

      // In this case, the consumer must have a not revoked certified attribute
      const certifiedTenantAttribute: TenantAttribute = {
        ...generateMock(TenantAttribute),
        type: "certified",
        revocationTimestamp: undefined,
      };
      const consumer: Tenant = {
        ...generateMock(Tenant),
        attributes: [certifiedTenantAttribute],
      };

      // The same attribute must be present in the eService Descriptor certified attributes
      const certifiedDescriptorAttribute: EServiceAttribute = {
        ...generateMock(EServiceAttribute),
        id: certifiedTenantAttribute.id,
      };
      const descriptor: Descriptor = {
        ...generateMock(Descriptor),
        state: "Published",
        attributes: {
          certified: [[certifiedDescriptorAttribute]],
          declared: [],
          verified: [],
        },
      };
      const eservice: EService = {
        ...generateMock(EService),
        producerId: eserviceProducer.id,
        descriptors: [descriptor],
      };
      readModelServiceMock.eServices = [eservice];
      readModelServiceMock.tenants = [eserviceProducer, consumer];

      const authData: AuthData = {
        ...authDataMock,
        organizationId: consumer.id, // different from eserviceProducer
      };
      const apiAgreementPayload: ApiAgreementPayload = {
        eserviceId: eservice.id,
        descriptorId: eservice.descriptors[0].id,
      };
      const createEvent = await createAgreementLogic(
        apiAgreementPayload,
        authData,
        agreementQueryMock,
        eserviceQueryMock,
        tenantQueryMock
      );
      expect(createEvent.event.type).toBe("AgreementAdded");
      expect(createEvent.event.data).toMatchObject({
        agreement: {
          id: createEvent.streamId,
          eserviceId: apiAgreementPayload.eserviceId,
          descriptorId: apiAgreementPayload.descriptorId,
          producerId: eservice.producerId,
          consumerId: authData.organizationId,
        },
      });
    });
  });
});
