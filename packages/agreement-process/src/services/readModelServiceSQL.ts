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
  DelegationReadModelService,
  TenantReadModelService,
} from "pagopa-interop-readmodel";
import {
  DrizzleReturnType,
  tenantInReadmodelTenant,
} from "pagopa-interop-readmodel-models";
import { sql } from "drizzle-orm";
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

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type, max-params
export function readModelServiceBuilderSQL(
  readmodelDB: DrizzleReturnType,
  agreementReadModelServiceSQL: AgreementReadModelService,
  catalogReadModelServiceSQL: CatalogReadModelService,
  tenantReadModelServiceSQL: TenantReadModelService,
  attributeReadModelServiceSQL: AttributeReadModelService,
  delegationReadModelServiceSQL: DelegationReadModelService
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
        await catalogReadModelServiceSQL.getEServiceById(eserviceId);
      return eserviceWithMetadata?.data;
    },
    async getTenantById(tenantId: TenantId): Promise<Tenant | undefined> {
      const tenantWithMetadata = await tenantReadModelServiceSQL.getTenantById(
        tenantId
      );
      return tenantWithMetadata?.data;
    },
    async getAttributeById(
      attributeId: AttributeId
    ): Promise<Attribute | undefined> {
      const attributeWithMetadata =
        await attributeReadModelServiceSQL.getAttributeById(attributeId);
      return attributeWithMetadata?.data;
    },
    /**
     * Retrieving consumers from agreements with consumer name`
     */
    async getAgreementsConsumers(
      requesterId: TenantId,
      consumerName: string | undefined,
      limit: number,
      offset: number
    ): Promise<ListResult<CompactOrganization>> {
      const resultSet = await readmodelDB
        .selectDistinctOn([tenantInReadmodelTenant.id], {
          tenant: tenantInReadmodelTenant,
          totalCount: sql`COUNT(*) OVER()`.mapWith(Number),
        })
        .from(tenantInReadmodelTenant);
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
    async getActiveConsumerDelegationsByEserviceId(
      eserviceId: EServiceId
    ): Promise<Delegation[]> {
      const result = await delegationReadModelServiceSQL.getDelegationByFilter(
        and(
          eq(delegationInReadmodelDelegation.eserviceId, eserviceId),
          eq(delegationInReadmodelDelegation.delegatorId, consumerId),
          eq(delegationInReadmodelDelegation.state, delegationState.active),
          eq(
            delegationInReadmodelDelegation.kind,
            delegationKind.delegatedConsumer
          )
        )
      );
      return result?.data;
    },
    async getActiveConsumerDelegationByAgreement(): Promise<
      Delegation | undefined
    > {
      throw new Error("to implement");
    },
  };
}

export type ReadModelServiceSQL = ReturnType<typeof readModelServiceBuilderSQL>;
