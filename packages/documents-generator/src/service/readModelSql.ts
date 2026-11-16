import { and, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  EServiceId,
  WithMetadata,
  EService,
  TenantId,
  Tenant,
  Agreement,
  agreementState,
  Attribute,
  AttributeId,
  Delegation,
  delegationKind,
  delegationState,
  DelegationId,
  ParentTenant,
} from "pagopa-interop-models";
import {
  CatalogReadModelService,
  TenantReadModelService,
  AgreementReadModelService,
  AttributeReadModelService,
  DelegationReadModelService,
  toParentTenants,
} from "pagopa-interop-readmodel";
import {
  DrizzleReturnType,
  agreementInReadmodelAgreement,
  delegationInReadmodelDelegation,
  tenantInReadmodelTenant,
} from "pagopa-interop-readmodel-models";

const parentTenantTable = alias(tenantInReadmodelTenant, "parentTenantTable");
const rootTenantTable = alias(tenantInReadmodelTenant, "rootTenantTable");

async function getParentTenantsByTenantId(
  readModelDB: DrizzleReturnType,
  tenantId: TenantId
): Promise<ParentTenant[] | undefined> {
  const [hierarchy] = await readModelDB
    .select({
      parentTenantId: parentTenantTable.id,
      parentTenantName: parentTenantTable.name,
      parentTenantSubUnitType: parentTenantTable.subUnitType,
      rootTenantId: rootTenantTable.id,
      rootTenantName: rootTenantTable.name,
    })
    .from(tenantInReadmodelTenant)
    .leftJoin(
      parentTenantTable,
      eq(tenantInReadmodelTenant.parentTenantId, parentTenantTable.id)
    )
    .leftJoin(
      rootTenantTable,
      eq(tenantInReadmodelTenant.rootTenantId, rootTenantTable.id)
    )
    .where(eq(tenantInReadmodelTenant.id, tenantId));
  return hierarchy && toParentTenants(hierarchy);
}

// `<ente>`, `<sotto-unità> - <ente>` or `<UO> - <AOO> - <ente>`
export const formatTenantNameWithHierarchy = (
  name: string,
  parentTenants: ParentTenant[] | undefined
): string => [name, ...(parentTenants ?? []).map((p) => p.name)].join(" - ");

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilderSQL({
  readModelDB,
  catalogReadModelServiceSQL,
  tenantReadModelServiceSQL,
  agreementReadModelServiceSQL,
  attributeReadModelServiceSQL,
  delegationReadModelServiceSQL,
}: {
  readModelDB: DrizzleReturnType;
  catalogReadModelServiceSQL: CatalogReadModelService;
  tenantReadModelServiceSQL: TenantReadModelService;
  agreementReadModelServiceSQL: AgreementReadModelService;
  attributeReadModelServiceSQL: AttributeReadModelService;
  delegationReadModelServiceSQL: DelegationReadModelService;
}) {
  return {
    async getEServiceById(
      id: EServiceId
    ): Promise<WithMetadata<EService> | undefined> {
      return await catalogReadModelServiceSQL.getEServiceById(id);
    },
    async getTenantById(tenantId: TenantId): Promise<Tenant | undefined> {
      const [tenant, parentTenants] = await Promise.all([
        tenantReadModelServiceSQL.getTenantById(tenantId),
        getParentTenantsByTenantId(readModelDB, tenantId),
      ]);
      return (
        tenant && {
          ...tenant.data,
          name: formatTenantNameWithHierarchy(tenant.data.name, parentTenants),
        }
      );
    },
    async getDelegationRelatedAgreement(
      eserviceId: EServiceId,
      consumerId: TenantId
    ): Promise<Agreement | null> {
      return (
        (
          await agreementReadModelServiceSQL.getAgreementByFilter(
            and(
              eq(agreementInReadmodelAgreement.eserviceId, eserviceId),
              eq(agreementInReadmodelAgreement.consumerId, consumerId),
              inArray(agreementInReadmodelAgreement.state, [
                agreementState.active,
                agreementState.suspended,
                agreementState.pending,
              ])
            )
          )
        )?.data || null
      );
    },
    async getAttributeById(
      attributeId: AttributeId
    ): Promise<Attribute | undefined> {
      return (await attributeReadModelServiceSQL.getAttributeById(attributeId))
        ?.data;
    },
    async getActiveProducerDelegationByEserviceId(
      eserviceId: EServiceId
    ): Promise<Delegation | undefined> {
      const delegation =
        await delegationReadModelServiceSQL.getDelegationByFilter(
          and(
            eq(delegationInReadmodelDelegation.eserviceId, eserviceId),
            eq(delegationInReadmodelDelegation.state, delegationState.active),
            eq(
              delegationInReadmodelDelegation.kind,
              delegationKind.delegatedProducer
            )
          )
        );
      return delegation?.data;
    },

    async getActiveConsumerDelegationByAgreement(
      agreement: Pick<Agreement, "consumerId" | "eserviceId">
    ): Promise<Delegation | undefined> {
      const delegation =
        await delegationReadModelServiceSQL.getDelegationByFilter(
          and(
            eq(
              delegationInReadmodelDelegation.eserviceId,
              agreement.eserviceId
            ),
            eq(
              delegationInReadmodelDelegation.delegatorId,
              agreement.consumerId
            ),
            eq(delegationInReadmodelDelegation.state, delegationState.active),
            eq(
              delegationInReadmodelDelegation.kind,
              delegationKind.delegatedConsumer
            )
          )
        );
      return delegation?.data;
    },
    async getConsumerDelegationByDelegationId(
      delegationId: DelegationId
    ): Promise<Delegation | undefined> {
      return (
        await delegationReadModelServiceSQL.getDelegationByFilter(
          and(
            eq(delegationInReadmodelDelegation.id, delegationId),
            eq(
              delegationInReadmodelDelegation.kind,
              delegationKind.delegatedConsumer
            )
          )
        )
      )?.data;
    },
  };
}

export type ReadModelServiceSQL = ReturnType<typeof readModelServiceBuilderSQL>;
