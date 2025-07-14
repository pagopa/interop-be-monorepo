import {
  ascLower,
  createListResult,
  escapeRegExp,
  M2MAuthData,
  UIAuthData,
  withTotalCount,
} from "pagopa-interop-commons";
import {
  AttributeId,
  EService,
  Agreement,
  AgreementState,
  ListResult,
  DescriptorId,
  WithMetadata,
  Attribute,
  EServiceId,
  TenantId,
  Tenant,
  Delegation,
  DelegationState,
  DelegationKind,
  EServiceTemplate,
  EServiceTemplateId,
  descriptorState,
  agreementState,
  DescriptorState,
  delegationState,
  delegationKind,
} from "pagopa-interop-models";
import {
  aggregateAgreementArray,
  aggregateAttributeArray,
  aggregateDelegation,
  aggregateEserviceArray,
  CatalogReadModelService,
  EServiceTemplateReadModelService,
  TenantReadModelService,
  toAgreementAggregatorArray,
  toDelegationAggregator,
  toEServiceAggregatorArray,
} from "pagopa-interop-readmodel";
import {
  agreementAttributeInReadmodelAgreement,
  agreementConsumerDocumentInReadmodelAgreement,
  agreementContractInReadmodelAgreement,
  agreementInReadmodelAgreement,
  agreementStampInReadmodelAgreement,
  attributeInReadmodelAttribute,
  delegationContractDocumentInReadmodelDelegation,
  delegationInReadmodelDelegation,
  delegationStampInReadmodelDelegation,
  DrizzleReturnType,
  eserviceDescriptorAttributeInReadmodelCatalog,
  eserviceDescriptorDocumentInReadmodelCatalog,
  eserviceDescriptorInReadmodelCatalog,
  eserviceDescriptorInterfaceInReadmodelCatalog,
  eserviceDescriptorRejectionReasonInReadmodelCatalog,
  eserviceDescriptorTemplateVersionRefInReadmodelCatalog,
  eserviceInReadmodelCatalog,
  eserviceRiskAnalysisAnswerInReadmodelCatalog,
  eserviceRiskAnalysisInReadmodelCatalog,
  tenantInReadmodelTenant,
  eserviceTemplateInReadmodelEserviceTemplate,
} from "pagopa-interop-readmodel-models";
import {
  and,
  count,
  countDistinct,
  desc,
  eq,
  exists,
  ilike,
  inArray,
  isNull,
  notExists,
  or,
  SQL,
} from "drizzle-orm";
import { match } from "ts-pattern";
import { PgSelect } from "drizzle-orm/pg-core";
import { ApiGetEServicesFilters, Consumer } from "../model/domain/models.js";
import {
  activeDescriptorStates,
  hasRoleToAccessInactiveDescriptors,
} from "./validators.js";

const existsValidDescriptor = (
  readmodelDB: DrizzleReturnType
): SQL<unknown> | undefined =>
  exists(
    readmodelDB
      .select()
      .from(eserviceDescriptorInReadmodelCatalog)
      .where(
        and(
          eq(
            eserviceDescriptorInReadmodelCatalog.eserviceId,
            eserviceInReadmodelCatalog.id
          ),
          inArray(
            eserviceDescriptorInReadmodelCatalog.state,
            activeDescriptorStates
          )
        )
      )
  );

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilderSQL(
  readmodelDB: DrizzleReturnType,
  catalogReadModelService: CatalogReadModelService,
  tenantReadModelService: TenantReadModelService,
  eserviceTemplateReadModelService: EServiceTemplateReadModelService
) {
  return {
    async getEServices(
      authData: UIAuthData | M2MAuthData,
      filters: ApiGetEServicesFilters,
      offset: number,
      limit: number
    ): Promise<ListResult<EService>> {
      const {
        eservicesIds,
        producersIds,
        states,
        agreementStates,
        name,
        attributesIds,
        mode,
        isConsumerDelegable,
        delegated,
        templatesIds,
      } = filters;

      const totalCountQuery = readmodelDB
        .select({
          count: countDistinct(eserviceInReadmodelCatalog.id),
        })
        .from(eserviceInReadmodelCatalog)
        .$dynamic();

      const idsQuery = readmodelDB
        .select({
          id: eserviceInReadmodelCatalog.id,
        })
        .from(eserviceInReadmodelCatalog)
        .$dynamic();

      const agreementSubquery = readmodelDB
        .selectDistinctOn([agreementInReadmodelAgreement.eserviceId], {
          eserviceId: agreementInReadmodelAgreement.eserviceId,
        })
        .from(agreementInReadmodelAgreement)
        .where(
          //  agreement states filter
          agreementStates.length > 0
            ? and(
                inArray(agreementInReadmodelAgreement.state, agreementStates),
                eq(
                  agreementInReadmodelAgreement.consumerId,
                  authData.organizationId
                )
              )
            : undefined
        )
        .as("agreementSubquery");

      // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
      const buildQuery = <T extends PgSelect>(query: T) => {
        // eslint-disable-next-line functional/no-let
        let q: PgSelect = query;

        if (agreementStates.length > 0) {
          q = q.innerJoin(
            agreementSubquery,
            eq(eserviceInReadmodelCatalog.id, agreementSubquery.eserviceId)
          );
        }

        q = q
          .leftJoin(
            eserviceDescriptorInReadmodelCatalog,
            eq(
              eserviceInReadmodelCatalog.id,
              eserviceDescriptorInReadmodelCatalog.eserviceId
            )
          )
          .leftJoin(
            eserviceDescriptorAttributeInReadmodelCatalog,
            eq(
              eserviceDescriptorInReadmodelCatalog.id,
              eserviceDescriptorAttributeInReadmodelCatalog.descriptorId
            )
          )
          .leftJoin(
            delegationInReadmodelDelegation,
            eq(
              eserviceInReadmodelCatalog.id,
              delegationInReadmodelDelegation.eserviceId
            )
          )
          .where(
            and(
              // name filter
              name
                ? ilike(
                    eserviceInReadmodelCatalog.name,
                    `%${escapeRegExp(name)}%`
                  )
                : undefined,
              // ids filter
              eservicesIds.length > 0
                ? inArray(eserviceInReadmodelCatalog.id, eservicesIds)
                : undefined,
              // producerIds filter
              producersIds.length > 0
                ? or(
                    inArray(
                      eserviceInReadmodelCatalog.producerId,
                      producersIds
                    ),
                    and(
                      inArray(
                        delegationInReadmodelDelegation.delegateId,
                        producersIds
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
              // descriptorState filter
              states.length > 0
                ? inArray(eserviceDescriptorInReadmodelCatalog.state, states)
                : undefined,
              // attributes filter
              attributesIds.length > 0
                ? inArray(
                    eserviceDescriptorAttributeInReadmodelCatalog.attributeId,
                    attributesIds
                  )
                : undefined,
              // visibility filter
              hasRoleToAccessInactiveDescriptors(authData)
                ? or(
                    existsValidDescriptor(readmodelDB),
                    // the requester is the producer
                    eq(
                      eserviceInReadmodelCatalog.producerId,
                      authData.organizationId
                    ),
                    // the requester has producer delegation
                    exists(
                      readmodelDB
                        .select()
                        .from(delegationInReadmodelDelegation)
                        .where(
                          and(
                            eq(
                              delegationInReadmodelDelegation.eserviceId,
                              eserviceInReadmodelCatalog.id
                            ),
                            eq(
                              delegationInReadmodelDelegation.delegateId,
                              authData.organizationId
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
                    )
                  )
                : existsValidDescriptor(readmodelDB),
              // mode filter
              mode ? eq(eserviceInReadmodelCatalog.mode, mode) : undefined,
              // isConsumerDelegable filter
              match(isConsumerDelegable)
                .with(true, () =>
                  eq(eserviceInReadmodelCatalog.isConsumerDelegable, true)
                )
                .with(false, () =>
                  or(
                    isNull(eserviceInReadmodelCatalog.isConsumerDelegable),
                    eq(eserviceInReadmodelCatalog.isConsumerDelegable, false)
                  )
                )
                .with(undefined, () => undefined)
                .exhaustive(),
              // delegated filter
              match(delegated)
                .with(true, () =>
                  and(
                    eq(
                      delegationInReadmodelDelegation.kind,
                      delegationKind.delegatedProducer
                    ),
                    inArray(delegationInReadmodelDelegation.state, [
                      delegationState.active,
                      delegationState.waitingForApproval,
                    ])
                  )
                )
                .with(false, () =>
                  notExists(
                    readmodelDB
                      .select()
                      .from(delegationInReadmodelDelegation)
                      .where(
                        and(
                          eq(
                            delegationInReadmodelDelegation.eserviceId,
                            eserviceInReadmodelCatalog.id
                          ),
                          eq(
                            delegationInReadmodelDelegation.kind,
                            delegationKind.delegatedProducer
                          ),
                          inArray(delegationInReadmodelDelegation.state, [
                            delegationState.active,
                            delegationState.waitingForApproval,
                          ])
                        )
                      )
                  )
                )
                .with(undefined, () => undefined)
                .exhaustive(),
              // template filter
              templatesIds.length > 0
                ? inArray(eserviceInReadmodelCatalog.templateId, templatesIds)
                : undefined
            )
          )
          .$dynamic();

        return q;
      };

      // TODO: fix type
      const ids = (
        await buildQuery(idsQuery)
          .groupBy(eserviceInReadmodelCatalog.id)
          .orderBy(ascLower(eserviceInReadmodelCatalog.name))
          .limit(limit)
          .offset(offset)
      ).map((result) => result.id);

      const [queryResult, totalCount] = await Promise.all([
        readmodelDB
          .select({
            eservice: eserviceInReadmodelCatalog,
            descriptor: eserviceDescriptorInReadmodelCatalog,
            interface: eserviceDescriptorInterfaceInReadmodelCatalog,
            document: eserviceDescriptorDocumentInReadmodelCatalog,
            attribute: eserviceDescriptorAttributeInReadmodelCatalog,
            rejection: eserviceDescriptorRejectionReasonInReadmodelCatalog,
            riskAnalysis: eserviceRiskAnalysisInReadmodelCatalog,
            riskAnalysisAnswer: eserviceRiskAnalysisAnswerInReadmodelCatalog,
            templateVersionRef:
              eserviceDescriptorTemplateVersionRefInReadmodelCatalog,
          })
          .from(eserviceInReadmodelCatalog)
          .where(inArray(eserviceInReadmodelCatalog.id, ids))
          .leftJoin(
            eserviceDescriptorInReadmodelCatalog,
            eq(
              eserviceInReadmodelCatalog.id,
              eserviceDescriptorInReadmodelCatalog.eserviceId
            )
          )
          .leftJoin(
            eserviceDescriptorInterfaceInReadmodelCatalog,
            eq(
              eserviceDescriptorInReadmodelCatalog.id,
              eserviceDescriptorInterfaceInReadmodelCatalog.descriptorId
            )
          )
          .leftJoin(
            eserviceDescriptorDocumentInReadmodelCatalog,
            eq(
              eserviceDescriptorInReadmodelCatalog.id,
              eserviceDescriptorDocumentInReadmodelCatalog.descriptorId
            )
          )
          .leftJoin(
            eserviceDescriptorAttributeInReadmodelCatalog,
            eq(
              eserviceDescriptorInReadmodelCatalog.id,
              eserviceDescriptorAttributeInReadmodelCatalog.descriptorId
            )
          )
          .leftJoin(
            eserviceDescriptorRejectionReasonInReadmodelCatalog,
            eq(
              eserviceDescriptorInReadmodelCatalog.id,
              eserviceDescriptorRejectionReasonInReadmodelCatalog.descriptorId
            )
          )
          .leftJoin(
            eserviceDescriptorTemplateVersionRefInReadmodelCatalog,
            eq(
              eserviceDescriptorInReadmodelCatalog.id,
              eserviceDescriptorTemplateVersionRefInReadmodelCatalog.descriptorId
            )
          )
          .leftJoin(
            eserviceRiskAnalysisInReadmodelCatalog,
            eq(
              eserviceInReadmodelCatalog.id,
              eserviceRiskAnalysisInReadmodelCatalog.eserviceId
            )
          )
          .leftJoin(
            eserviceRiskAnalysisAnswerInReadmodelCatalog,
            and(
              eq(
                eserviceRiskAnalysisInReadmodelCatalog.riskAnalysisFormId,
                eserviceRiskAnalysisAnswerInReadmodelCatalog.riskAnalysisFormId
              ),
              eq(
                eserviceRiskAnalysisInReadmodelCatalog.eserviceId,
                eserviceRiskAnalysisAnswerInReadmodelCatalog.eserviceId
              )
            )
          )
          .orderBy(ascLower(eserviceInReadmodelCatalog.name)),
        buildQuery(totalCountQuery),
      ]);

      const eservices = aggregateEserviceArray(
        toEServiceAggregatorArray(queryResult)
      );

      return createListResult(
        eservices.map((e) => e.data),
        totalCount[0]?.count
      );
    },
    async isEServiceNameAvailableForProducer({
      name,
      producerId,
    }: {
      name: string;
      producerId: TenantId;
    }): Promise<boolean> {
      const result = await readmodelDB
        .select({ count: count() })
        .from(eserviceInReadmodelCatalog)
        .where(
          and(
            ilike(eserviceInReadmodelCatalog.name, escapeRegExp(name)),
            eq(eserviceInReadmodelCatalog.producerId, producerId)
          )
        )
        .limit(1);

      return (result[0]?.count ?? 0) === 0;
    },
    async isEServiceNameConflictingWithTemplate({
      name,
    }: {
      name: string;
    }): Promise<boolean> {
      const result = await readmodelDB
        .select({ count: count() })
        .from(eserviceTemplateInReadmodelEserviceTemplate)
        .where(
          ilike(
            eserviceTemplateInReadmodelEserviceTemplate.name,
            escapeRegExp(name)
          )
        )
        .limit(1);

      return (result[0]?.count ?? 0) > 0;
    },
    async getEServiceById(
      id: EServiceId
    ): Promise<WithMetadata<EService> | undefined> {
      return await catalogReadModelService.getEServiceById(id);
    },
    async getEServiceConsumers(
      eserviceId: EServiceId,
      offset: number,
      limit: number
    ): Promise<ListResult<Consumer>> {
      const res = await readmodelDB
        .selectDistinctOn(
          [tenantInReadmodelTenant.id],
          withTotalCount({
            tenant: tenantInReadmodelTenant,
            agreement: agreementInReadmodelAgreement,
            descriptor: eserviceDescriptorInReadmodelCatalog,
          })
        )
        .from(tenantInReadmodelTenant)
        .innerJoin(
          agreementInReadmodelAgreement,
          and(
            eq(
              tenantInReadmodelTenant.id,
              agreementInReadmodelAgreement.consumerId
            ),
            inArray(agreementInReadmodelAgreement.state, [
              agreementState.active,
              agreementState.suspended,
            ])
          )
        )
        .innerJoin(
          eserviceDescriptorInReadmodelCatalog,
          and(
            eq(
              agreementInReadmodelAgreement.descriptorId,
              eserviceDescriptorInReadmodelCatalog.id
            ),
            eq(eserviceDescriptorInReadmodelCatalog.eserviceId, eserviceId),
            inArray(eserviceDescriptorInReadmodelCatalog.state, [
              descriptorState.published,
              descriptorState.deprecated,
              descriptorState.suspended,
            ])
          )
        )
        .limit(limit)
        .offset(offset);

      const consumers: Consumer[] = res.map((row) => ({
        descriptorVersion: row.descriptor.version,
        descriptorState: DescriptorState.parse(row.descriptor.state),
        agreementState: AgreementState.parse(row.agreement.state),
        consumerName: row.tenant.name,
        consumerExternalId: row.tenant.externalIdValue,
      }));

      return createListResult(consumers, res[0]?.totalCount);
    },
    async listAgreements({
      eservicesIds,
      consumersIds,
      producersIds,
      states,
      limit,
      descriptorId,
    }: {
      eservicesIds: EServiceId[];
      consumersIds: TenantId[];
      producersIds: TenantId[];
      states: AgreementState[];
      limit?: number;
      descriptorId?: DescriptorId;
    }): Promise<Agreement[]> {
      const query = readmodelDB
        .select({
          agreement: agreementInReadmodelAgreement,
          stamp: agreementStampInReadmodelAgreement,
          attribute: agreementAttributeInReadmodelAgreement,
          consumerDocument: agreementConsumerDocumentInReadmodelAgreement,
          contract: agreementContractInReadmodelAgreement,
        })
        .from(agreementInReadmodelAgreement)
        .where(
          and(
            descriptorId
              ? eq(agreementInReadmodelAgreement.descriptorId, descriptorId)
              : undefined,
            eservicesIds.length > 0
              ? inArray(agreementInReadmodelAgreement.eserviceId, eservicesIds)
              : undefined,
            consumersIds.length > 0
              ? inArray(agreementInReadmodelAgreement.consumerId, consumersIds)
              : undefined,
            producersIds.length > 0
              ? inArray(agreementInReadmodelAgreement.producerId, producersIds)
              : undefined,
            states.length > 0
              ? inArray(agreementInReadmodelAgreement.state, states)
              : undefined
          )
        )
        .leftJoin(
          agreementStampInReadmodelAgreement,
          eq(
            agreementInReadmodelAgreement.id,
            agreementStampInReadmodelAgreement.agreementId
          )
        )
        .leftJoin(
          agreementAttributeInReadmodelAgreement,
          eq(
            agreementInReadmodelAgreement.id,
            agreementAttributeInReadmodelAgreement.agreementId
          )
        )
        .leftJoin(
          agreementConsumerDocumentInReadmodelAgreement,
          eq(
            agreementInReadmodelAgreement.id,
            agreementConsumerDocumentInReadmodelAgreement.agreementId
          )
        )
        .leftJoin(
          agreementContractInReadmodelAgreement,
          eq(
            agreementInReadmodelAgreement.id,
            agreementContractInReadmodelAgreement.agreementId
          )
        );

      const queryResult = limit ? await query.limit(limit) : await query;

      return aggregateAgreementArray(
        toAgreementAggregatorArray(queryResult)
      ).map((agreementWithMetadata) => agreementWithMetadata.data);
    },

    async getAttributesByIds(
      attributesIds: AttributeId[]
    ): Promise<Attribute[]> {
      const res = await readmodelDB
        .select()
        .from(attributeInReadmodelAttribute)
        .where(inArray(attributeInReadmodelAttribute.id, attributesIds))
        .orderBy(attributeInReadmodelAttribute.name);

      const attributes = aggregateAttributeArray(res);

      return attributes.map((attr) => attr.data);
    },

    async getTenantById(id: TenantId): Promise<Tenant | undefined> {
      const tenantWithMetadata = await tenantReadModelService.getTenantById(id);
      return tenantWithMetadata?.data;
    },
    async getLatestDelegation({
      eserviceId,
      kind,
      states,
      delegateId,
    }: {
      eserviceId: EServiceId;
      kind: DelegationKind;
      states?: DelegationState[];
      delegateId?: TenantId;
    }): Promise<Delegation | undefined> {
      const queryResult = await readmodelDB
        .select({
          delegation: delegationInReadmodelDelegation,
          delegationStamp: delegationStampInReadmodelDelegation,
          delegationContractDocument:
            delegationContractDocumentInReadmodelDelegation,
        })
        .from(delegationInReadmodelDelegation)
        .where(
          and(
            eq(delegationInReadmodelDelegation.eserviceId, eserviceId),
            eq(delegationInReadmodelDelegation.kind, kind),
            states && states.length > 0
              ? inArray(delegationInReadmodelDelegation.state, states)
              : undefined,
            delegateId
              ? eq(delegationInReadmodelDelegation.delegateId, delegateId)
              : undefined
          )
        )
        .leftJoin(
          delegationStampInReadmodelDelegation,
          eq(
            delegationInReadmodelDelegation.id,
            delegationStampInReadmodelDelegation.delegationId
          )
        )
        .leftJoin(
          delegationContractDocumentInReadmodelDelegation,
          eq(
            delegationInReadmodelDelegation.id,
            delegationContractDocumentInReadmodelDelegation.delegationId
          )
        )
        .orderBy(desc(delegationInReadmodelDelegation.createdAt));

      if (queryResult.length === 0) {
        return undefined;
      }

      return aggregateDelegation(toDelegationAggregator(queryResult)).data;
    },
    async getEServiceTemplateById(
      id: EServiceTemplateId
    ): Promise<EServiceTemplate | undefined> {
      const templateWithMetadata =
        await eserviceTemplateReadModelService.getEServiceTemplateById(id);
      return templateWithMetadata?.data;
    },
  };
}

export type ReadModelServiceSQL = ReturnType<typeof readModelServiceBuilderSQL>;
