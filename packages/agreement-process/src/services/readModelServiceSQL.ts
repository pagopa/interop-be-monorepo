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
  AgreementId,
} from "pagopa-interop-models";
import {
  AgreementReadModelService,
  AttributeReadModelService,
  CatalogReadModelService,
  TenantReadModelService,
} from "pagopa-interop-readmodel";
import { DrizzleReturnType } from "pagopa-interop-readmodel-models";
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
export function readModelServiceBuilderSQL(
  _readmodelDB: DrizzleReturnType,
  agreementReadModelServiceSQL: AgreementReadModelService,
  catalogReadModelService: CatalogReadModelService,
  tenantReadModelService: TenantReadModelService,
  attributeReadModelService: AttributeReadModelService
) {
  return {
    async getAgreements(): Promise<ListResult<Agreement>> {
      throw new Error("to implement");
    },
    async getAgreementById(
      agreementId: AgreementId
    ): Promise<WithMetadata<Agreement> | undefined> {
      return await agreementReadModelServiceSQL.getAgreementById(agreementId);
    },
    async getAllAgreements(): Promise<Array<WithMetadata<Agreement>>> {
      throw new Error("to implement");
    },
    async getEServiceById(
      eserviceId: EServiceId
    ): Promise<EService | undefined> {
      const eserviceWithMetadata =
        await catalogReadModelService.getEServiceById(eserviceId);
      return eserviceWithMetadata?.data;
    },
    async getTenantById(tenantId: TenantId): Promise<Tenant | undefined> {
      const tenantWithMetadata = await tenantReadModelService.getTenantById(
        tenantId
      );
      return tenantWithMetadata?.data;
    },
    async getAttributeById(
      attributeId: AttributeId
    ): Promise<Attribute | undefined> {
      const attributeWithMetadata =
        await attributeReadModelService.getAttributeById(attributeId);
      return attributeWithMetadata?.data;
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
