import { and, eq, inArray } from "drizzle-orm";
import {
  Delegation,
  delegationKind,
  delegationState,
  TenantNotificationConfig,
} from "pagopa-interop-models";
import { WithMetadata } from "pagopa-interop-models";
import {
  Attribute,
  AttributeId,
  Agreement,
  EService,
  EServiceId,
  NotificationConfig,
  Purpose,
  PurposeId,
  Tenant,
  TenantId,
  UserId,
  agreementState,
} from "pagopa-interop-models";
import {
  AgreementReadModelService,
  AttributeReadModelService,
  CatalogReadModelService,
  DelegationReadModelService,
  NotificationConfigReadModelService,
  PurposeReadModelService,
  TenantReadModelService,
} from "pagopa-interop-readmodel";
import {
  agreementInReadmodelAgreement,
  delegationInReadmodelDelegation,
  DrizzleReturnType,
} from "pagopa-interop-readmodel-models";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilderSQL({
  readModelDB,
  agreementReadModelServiceSQL,
  attributeReadModelServiceSQL,
  catalogReadModelServiceSQL,
  delegationReadModelServiceSQL,
  tenantReadModelServiceSQL,
  notificationConfigReadModelServiceSQL,
  purposeReadModelServiceSQL,
}: {
  readModelDB: DrizzleReturnType;
  agreementReadModelServiceSQL: AgreementReadModelService;
  attributeReadModelServiceSQL: AttributeReadModelService;
  catalogReadModelServiceSQL: CatalogReadModelService;
  delegationReadModelServiceSQL: DelegationReadModelService;
  tenantReadModelServiceSQL: TenantReadModelService;
  notificationConfigReadModelServiceSQL: NotificationConfigReadModelService;
  purposeReadModelServiceSQL: PurposeReadModelService;
}) {
  return {
    async getEServiceById(id: EServiceId): Promise<EService | undefined> {
      return (await catalogReadModelServiceSQL.getEServiceById(id))?.data;
    },
    async getTenantById(tenantId: TenantId): Promise<Tenant | undefined> {
      return (await tenantReadModelServiceSQL.getTenantById(tenantId))?.data;
    },
    async getTenantByCertifierId(
      certifierId: string
    ): Promise<Tenant | undefined> {
      return (
        await tenantReadModelServiceSQL.getTenantByCertifierId(certifierId)
      )?.data;
    },
    async getTenantsById(tenantIds: TenantId[]): Promise<Tenant[]> {
      return await readModelDB.transaction(async (tx) =>
        (
          await tenantReadModelServiceSQL.getTenantsByIds(tenantIds, tx)
        ).map((tenantWithMetadata) => tenantWithMetadata.data)
      );
    },
    async getAgreementsByEserviceId(
      eserviceId: EServiceId
    ): Promise<Agreement[] | undefined> {
      return (
        await agreementReadModelServiceSQL.getAgreementsByFilter(
          and(
            eq(agreementInReadmodelAgreement.eserviceId, eserviceId),
            inArray(agreementInReadmodelAgreement.state, [
              agreementState.active,
              agreementState.suspended,
              agreementState.pending,
            ])
          )
        )
      ).map((agreement: WithMetadata<Agreement>) => agreement.data);
    },
    async getTenantUsersWithNotificationEnabled(
      tenantIds: TenantId[],
      notificationName: keyof NotificationConfig
    ): Promise<Array<{ userId: UserId; tenantId: TenantId }>> {
      return notificationConfigReadModelServiceSQL.getTenantUsersWithNotificationEnabled(
        tenantIds,
        notificationName,
        "email"
      );
    },
    async getTenantNotificationConfigByTenantId(
      tenantId: TenantId
    ): Promise<TenantNotificationConfig | undefined> {
      const notificationConfig =
        await notificationConfigReadModelServiceSQL.getTenantNotificationConfigByTenantId(
          tenantId
        );

      return notificationConfig?.data;
    },
    async getPurposeById(purposeId: PurposeId): Promise<Purpose | undefined> {
      return (await purposeReadModelServiceSQL.getPurposeById(purposeId))?.data;
    },
    async getActiveProducerDelegation(
      eserviceId: EServiceId,
      producerId: TenantId
    ): Promise<Delegation | undefined> {
      return (
        await delegationReadModelServiceSQL.getDelegationByFilter(
          and(
            eq(delegationInReadmodelDelegation.eserviceId, eserviceId),
            eq(delegationInReadmodelDelegation.delegatorId, producerId),
            eq(
              delegationInReadmodelDelegation.kind,
              delegationKind.delegatedProducer
            ),
            eq(delegationInReadmodelDelegation.state, delegationState.active)
          )
        )
      )?.data;
    },
    async getAttributeById(
      attributeId: AttributeId
    ): Promise<Attribute | undefined> {
      const attributeWithMetadata =
        await attributeReadModelServiceSQL.getAttributeById(attributeId);

      if (!attributeWithMetadata) {
        return undefined;
      }
      return attributeWithMetadata.data;
    },
  };
}
export type ReadModelServiceSQL = ReturnType<typeof readModelServiceBuilderSQL>;
