/* eslint-disable no-constant-condition */
import { ilike, inArray, or } from "drizzle-orm";
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
  delegationKind,
  delegationState,
} from "pagopa-interop-models";
import {
  AgreementReadModelService,
  AttributeReadModelService,
  CatalogReadModelService,
  DelegationReadModelService,
  TenantReadModelService,
} from "pagopa-interop-readmodel";
import {
  agreementInReadmodelAgreement,
  delegationInReadmodelDelegation,
  DrizzleReturnType,
  eserviceInReadmodelCatalog,
  tenantInReadmodelTenant,
} from "pagopa-interop-readmodel-models";
import { and, eq, sql } from "drizzle-orm";

import { ReadModelRepository } from "pagopa-interop-commons";
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
    // TODO
    async getAgreements(): Promise<ListResult<Agreement>> {
      throw new Error("to implement");
    },
    async getAgreementById(
      agreementId: AgreementId
    ): Promise<WithMetadata<Agreement> | undefined> {
      return await agreementReadModelServiceSQL.getAgreementById(agreementId);
    },
    // TODO
    async getAllAgreements(): Promise<Array<WithMetadata<Agreement>>> {
      throw new Error("to implement");
    },
    // DONE
    async getEServiceById(
      eserviceId: EServiceId
    ): Promise<EService | undefined> {
      return (await catalogReadModelServiceSQL.getEServiceById(eserviceId))
        ?.data;
    },
    // DONE
    async getTenantById(tenantId: TenantId): Promise<Tenant | undefined> {
      return (await tenantReadModelServiceSQL.getTenantById(tenantId))?.data;
    },
    // DONE
    async getAttributeById(
      attributeId: AttributeId
    ): Promise<Attribute | undefined> {
      const attributeWithMetadata =
        await attributeReadModelServiceSQL.getAttributeById(attributeId);
      return attributeWithMetadata?.data;
    },
    /**
     * Retrieving consumers from agreements with consumer name
     * /agreements/filter/consumers
     * tenant che hanno un agreement con requesterId
     * tenant sono stati delegati ad avere un agreement con requesterId
     * tenant che hanno un agreement con il mio delegator (sono stato delegato in erogazione)
     * tenant che sono stati delegati ad avere un agreement con il mio delegator (sono stato delegato in erogazione)
     */
    // DONE BUT
    async getAgreementsConsumers(
      requesterId: TenantId,
      consumerName: string | undefined,
      limit: number,
      offset: number
    ): Promise<ListResult<CompactOrganization>> {
      const resultSet = await readmodelDB
        .selectDistinct({
          id: tenantInReadmodelTenant.id,
          name: tenantInReadmodelTenant.name,
          totalCount: sql`COUNT(*) OVER()`.mapWith(Number),
        })
        .from(tenantInReadmodelTenant)
        .innerJoin(
          agreementInReadmodelAgreement,
          and(
            eq(agreementInReadmodelAgreement.producerId, requesterId),
            eq(
              tenantInReadmodelTenant.id,
              agreementInReadmodelAgreement.consumerId
            )
          )
        )
        .where(
          consumerName
            ? ilike(
                tenantInReadmodelTenant.name,
                `%${ReadModelRepository.escapeRegExp(consumerName)}%`
              )
            : undefined
        )
        .orderBy(sql`LOWER(${tenantInReadmodelTenant.name})`)
        .limit(limit)
        .offset(offset);
      return {
        results: resultSet.map(({ id, name }) => ({ id, name })),
        totalCount: resultSet[0]?.totalCount ?? 0,
      };
    },

    // DONE BUT
    async getAgreementsProducers(
      requesterId: TenantId,
      producerName: string | undefined,
      limit: number,
      offset: number
    ): Promise<ListResult<CompactOrganization>> {
      const resultSet = await readmodelDB
        .selectDistinct({
          id: tenantInReadmodelTenant.id,
          name: tenantInReadmodelTenant.name,
          totalCount: sql`COUNT(*) OVER()`.mapWith(Number),
        })
        .from(tenantInReadmodelTenant)
        .innerJoin(
          agreementInReadmodelAgreement,
          and(
            eq(agreementInReadmodelAgreement.consumerId, requesterId),
            eq(
              tenantInReadmodelTenant.id,
              agreementInReadmodelAgreement.producerId
            )
          )
        )
        .where(
          producerName
            ? ilike(
                tenantInReadmodelTenant.name,
                `%${ReadModelRepository.escapeRegExp(producerName)}%`
              )
            : undefined
        )
        .orderBy(sql`LOWER(${tenantInReadmodelTenant.name})`)
        .limit(limit)
        .offset(offset);

      return {
        results: resultSet.map(({ id, name }) => ({ id, name })),
        totalCount: resultSet[0]?.totalCount ?? 0,
      };
    },
    // TODO

    // trovare e-service che sto erogando
    // trovare e-service per cui sono delegato in erogazione
    // ottenere quali e-service hanno un agreement
    /**
     * controlli di visibilità: requesterId  is: producer OR consumer | delegate producer | delegate consumer
     * ritorna gli eservice a partire da degli agreements:
     * è una getAgreements il cui risultato viene usato per prendere i relativi eservice
     * (Si applica il filtro per nome agli eservice da ritornare)
     * si dovrebbe controllare in tutti e 4 i punti
     * A partire da agreements il cui requesterId è in: producer OR consumer | delegate producer | delegate consumer
     */

    async getAgreementsEServices(
      requesterId: TenantId,
      filters: AgreementEServicesQueryFilters,
      limit: number,
      offset: number
    ): Promise<ListResult<CompactEService>> {
      const { consumerIds, producerIds, eserviceName } = filters;
      const resultSet = await readmodelDB
        .selectDistinctOn([eserviceInReadmodelCatalog.name], {
          id: eserviceInReadmodelCatalog.id,
          name: eserviceInReadmodelCatalog.name,
          totalCount: sql`COUNT(*) OVER()`.mapWith(Number),
        })
        .from(eserviceInReadmodelCatalog)
        .leftJoin(
          agreementInReadmodelAgreement,
          and(
            eq(
              eserviceInReadmodelCatalog.id,
              agreementInReadmodelAgreement.eserviceId
            )
          )
        )
        .leftJoin(
          delegationInReadmodelDelegation,
          and(
            eq(
              agreementInReadmodelAgreement.eserviceId,
              delegationInReadmodelDelegation.eserviceId
            )
          )
        )
        .where(
          and(
            // FILTER NAME
            eserviceName
              ? ilike(eserviceInReadmodelCatalog.name, `%${eserviceName}%`)
              : undefined,
            // FILTER PRODUCER
            producerIds.length > 0
              ? or(
                  inArray(
                    agreementInReadmodelAgreement.producerId,
                    producerIds
                  ),
                  and(
                    inArray(
                      delegationInReadmodelDelegation.delegateId,
                      producerIds
                    ),
                    eq(
                      delegationInReadmodelDelegation.state,
                      delegationState.active
                    ),
                    eq(
                      delegationInReadmodelDelegation.kind,
                      delegationKind.delegatedProducer
                    )
                  )
                )
              : undefined,
            // FILTER CONSUMER
            consumerIds.length > 0
              ? or(
                  inArray(
                    agreementInReadmodelAgreement.consumerId,
                    consumerIds
                  ),
                  and(
                    inArray(
                      delegationInReadmodelDelegation.delegateId,
                      consumerIds
                    ),
                    eq(
                      delegationInReadmodelDelegation.state,
                      delegationState.active
                    ),
                    eq(
                      delegationInReadmodelDelegation.kind,
                      delegationKind.delegatedConsumer
                    )
                  )
                )
              : undefined,
            // VISIBILITY
            or(
              // REQ IS PRODUCER
              eq(agreementInReadmodelAgreement.producerId, requesterId),
              // REQ IS CONSUMER
              eq(agreementInReadmodelAgreement.consumerId, requesterId),
              // REQ IS DELEGATE AS PRODUCER
              and(
                eq(delegationInReadmodelDelegation.delegateId, requesterId),
                eq(
                  delegationInReadmodelDelegation.kind,
                  delegationKind.delegatedProducer
                ),
                eq(
                  delegationInReadmodelDelegation.state,
                  delegationState.active
                )
              ),
              // REQ IS DELEGATE AS CONSUMER
              and(
                eq(delegationInReadmodelDelegation.delegateId, requesterId),
                eq(
                  delegationInReadmodelDelegation.kind,
                  delegationKind.delegatedConsumer
                ),
                eq(
                  delegationInReadmodelDelegation.state,
                  delegationState.active
                )
              )
            )
          )
        )
        .orderBy(eserviceInReadmodelCatalog.name)
        .groupBy(eserviceInReadmodelCatalog.id, eserviceInReadmodelCatalog.name)
        .limit(limit)
        .offset(offset);
      // .toSQL();
      // console.log("resultSet", resultSet);
      return {
        results: resultSet.map(({ id, name }) => ({ id, name })),
        totalCount: resultSet[0]?.totalCount ?? 0,
      };
    },
    // DONE
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
    // DONE
    async getActiveConsumerDelegationsByEserviceId(
      eserviceId: EServiceId
    ): Promise<Delegation[]> {
      const delegations =
        await delegationReadModelServiceSQL.getDelegationsByFilter(
          and(
            eq(delegationInReadmodelDelegation.eserviceId, eserviceId),
            eq(delegationInReadmodelDelegation.state, delegationState.active),
            eq(
              delegationInReadmodelDelegation.kind,
              delegationKind.delegatedConsumer
            )
          )
        );
      return delegations.map(({ data }) => data);
    },
    // DONE
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
  };
}

export type ReadModelServiceSQL = ReturnType<typeof readModelServiceBuilderSQL>;
