/* eslint-disable sonarjs/no-empty-collection */
/* eslint-disable functional/no-let, prefer-const */
import { describe, expect, it } from "vitest";
import {
  Agreement,
  Attribute,
  Descriptor,
  EService,
  ListResult,
  Tenant,
  WithMetadata,
} from "pagopa-interop-models";
import { generateMock } from "@anatine/zod-mock";
import { AuthData } from "pagopa-interop-commons";
import {
  ReadModelService,
  AgreementQueryFilters,
} from "../src/services/readmodel/readModelService.js";
import {
  CompactEService,
  CompactOrganization,
} from "../src/model/domain/models.js";
import { agreementQueryBuilder } from "../src/services/readmodel/agreementQuery.js";
import { tenantQueryBuilder } from "../src/services/readmodel/tenantQuery.js";
import { eserviceQueryBuilder } from "../src/services/readmodel/eserviceQuery.js";
import { createAgreementLogic } from "../src/services/agreementCreationProcessor.js";
import { ApiAgreementPayload } from "../src/model/types.js";

let agreements: Agreement[] = [];
let eServices: EService[] = [];
let tenants: Tenant[] = [];
let attributes: Attribute[] = [];

function readModelServiceMockBuilder(): ReadModelService {
  return {
    async getAgreements(
      _filters: AgreementQueryFilters,
      _limit: number,
      _offset: number
    ): Promise<ListResult<Agreement>> {
      return {
        results: agreements,
        totalCount: agreements.length,
      };
    },
    async readAgreementById(
      agreementId: string
    ): Promise<WithMetadata<Agreement> | undefined> {
      const agreement = agreements.find((a) => a.id === agreementId);
      return (
        agreement && {
          data: agreement,
          metadata: { version: 0 },
        }
      );
    },
    async getAllAgreements(
      _filters: AgreementQueryFilters
    ): Promise<Array<WithMetadata<Agreement>>> {
      return agreements.map((a) => ({ data: a, metadata: { version: 0 } }));
    },
    async getEServiceById(
      id: string
    ): Promise<WithMetadata<EService> | undefined> {
      const eService = eServices.find((es) => es.id === id);
      return (
        eService && {
          data: eService,
          metadata: { version: 0 },
        }
      );
    },

    async getTenantById(
      tenantId: string
    ): Promise<WithMetadata<Tenant> | undefined> {
      const tenant = tenants.find((t) => t.id === tenantId);
      return (
        tenant && {
          data: tenant,
          metadata: { version: 0 },
        }
      );
    },
    async getAttributeById(
      id: string
    ): Promise<WithMetadata<Attribute> | undefined> {
      const attribute = attributes.find((a) => a.id === id);
      return (
        attribute && {
          data: attribute,
          metadata: { version: 0 },
        }
      );
    },
    async listConsumers(
      _name: string | undefined,
      _limit: number,
      _offset: number
    ): Promise<ListResult<CompactOrganization>> {
      const consumerIds = agreements.map((a) => a.consumerId);
      return {
        results: tenants
          .filter((t) => consumerIds.includes(t.id))
          .map((t) => ({
            id: t.id,
            name: t.name,
          })),
        totalCount: tenants.length,
      };
    },
    async listProducers(
      _name: string | undefined,
      _limit: number,
      _offset: number
    ): Promise<ListResult<CompactOrganization>> {
      const producerIds = agreements.map((a) => a.producerId);
      return {
        results: tenants
          .filter((t) => producerIds.includes(t.id))
          .map((t) => ({
            id: t.id,
            name: t.name,
          })),
        totalCount: tenants.length,
      };
    },
    async listEServicesAgreements(
      _eServiceName: string | undefined,
      _consumerIds: string[],
      _producerIds: string[],
      _limit: number,
      _offset: number
    ): Promise<ListResult<CompactEService>> {
      return {
        results: eServices.map((es) => ({
          id: es.id,
          name: es.name,
        })),
        totalCount: eServices.length,
      };
    },
  };
}

const readModelServiceMock = readModelServiceMockBuilder();
const agreementQueryMock = agreementQueryBuilder(readModelServiceMock);
const tenantQueryMock = tenantQueryBuilder(readModelServiceMock);
const eserviceQueryMock = eserviceQueryBuilder(readModelServiceMock);

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
    it("should create an Agreement when producer and consumer are the same tenant", async () => {
      const agreementProducerAndConsumer: Tenant = generateMock(Tenant);
      const descriptor: Descriptor = {
        ...generateMock(Descriptor),
        state: "Published",
      };
      const eservice: EService = {
        ...generateMock(EService),
        producerId: agreementProducerAndConsumer.id,
        descriptors: [descriptor],
      };

      eServices = [eservice];
      tenants = [agreementProducerAndConsumer, agreementProducerAndConsumer];

      const authData: AuthData = {
        ...authDataMock,
        organizationId: agreementProducerAndConsumer.id,
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
