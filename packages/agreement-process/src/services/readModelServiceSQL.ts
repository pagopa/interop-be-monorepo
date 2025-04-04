/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-constant-condition */
import {
  Agreement,
  AttributeId,
  AgreementState,
  Attribute,
  DescriptorId,
  EService,
  ListResult,
  Tenant,
  WithMetadata,
  EServiceId,
  TenantId,
  Delegation,
} from "pagopa-interop-models";
import {
  CompactEService,
  CompactOrganization,
} from "../model/domain/models.js";

export type AgreementQueryFilters = {
  producerId?: TenantId | TenantId[];
  consumerId?: TenantId | TenantId[];
  eserviceId?: EServiceId | EServiceId[];
  descriptorId?: DescriptorId | DescriptorId[];
  agreementStates?: AgreementState[];
  attributeId?: AttributeId | AttributeId[];
  showOnlyUpgradeable?: boolean;
};

export type AgreementEServicesQueryFilters = {
  eserviceName: string | undefined;
  consumerIds: TenantId[];
  producerIds: TenantId[];
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilderSQL() {
  return {
    async getAgreements(): Promise<ListResult<Agreement>> {
      throw new Error("to implement");
    },
    async getAgreementById(): Promise<WithMetadata<Agreement> | undefined> {
      throw new Error("to implement");
    },
    async getAllAgreements(): Promise<Array<WithMetadata<Agreement>>> {
      throw new Error("to implement");
    },
    async getEServiceById(): Promise<EService | undefined> {
      throw new Error("to implement");
    },
    async getTenantById(): Promise<Tenant | undefined> {
      throw new Error("to implement");
    },
    async getAttributeById(): Promise<Attribute | undefined> {
      throw new Error("to implement");
    },
    async getAgreementsConsumers(): Promise<ListResult<CompactOrganization>> {
      throw new Error("to implement");
    },
    async getAgreementsProducers(): Promise<ListResult<CompactOrganization>> {
      throw new Error("to implement");
    },
    async getAgreementsEServices(): Promise<ListResult<CompactEService>> {
      throw new Error("to implement");
    },
    async getActiveProducerDelegationByEserviceId(): Promise<
      Delegation | undefined
    > {
      throw new Error("to implement");
    },
    async getActiveConsumerDelegationsByEserviceId(): Promise<Delegation[]> {
      throw new Error("to implement");
    },
    async getActiveConsumerDelegationByAgreement(): Promise<
      Delegation | undefined
    > {
      throw new Error("to implement");
    },
  };
}

export type ReadModelServiceSQL = ReturnType<typeof readModelServiceBuilderSQL>;
