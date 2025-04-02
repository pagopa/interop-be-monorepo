import { AuthData, hasPermission, userRoles } from "pagopa-interop-commons";
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
  CatalogReadModelServiceSQL,
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
  eserviceTemplateRefInReadmodelCatalog,
  tenantInReadmodelTenant,
} from "pagopa-interop-readmodel-models";
import {
  and,
  desc,
  eq,
  exists,
  ilike,
  inArray,
  isNull,
  notExists,
  or,
  sql,
} from "drizzle-orm";
import { ApiGetEServicesFilters, Consumer } from "../model/domain/models.js";
import { activeDescriptorStates } from "./validators.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilderSQL(
  readmodelDB: DrizzleReturnType,
  catalogReadModelService: CatalogReadModelServiceSQL,
  tenantReadModelService: TenantReadModelService,
  eserviceTemplateReadModelService: EServiceTemplateReadModelService
) {
  return {
    async getEServices(
      authData: AuthData,
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

      const matchingEserviceIds = await readmodelDB
        .selectDistinct({ id: eserviceInReadmodelCatalog.id })
        .from(eserviceInReadmodelCatalog)
        .leftJoin(
          agreementInReadmodelAgreement,
          eq(
            eserviceInReadmodelCatalog.id,
            agreementInReadmodelAgreement.eserviceId
          )
        )
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
        .leftJoin(
          eserviceTemplateRefInReadmodelCatalog,
          eq(
            eserviceInReadmodelCatalog.id,
            eserviceTemplateRefInReadmodelCatalog.eserviceId
          )
        )
        .where(
          and(
            // name filter
            name
              ? ilike(eserviceInReadmodelCatalog.name, `%${name}%`)
              : undefined,
            // ids filter
            eservicesIds.length > 0
              ? inArray(eserviceInReadmodelCatalog.id, eservicesIds)
              : undefined,
            // agreement states filter
            agreementStates.length > 0
              ? and(
                  inArray(agreementInReadmodelAgreement.state, agreementStates),
                  eq(
                    agreementInReadmodelAgreement.consumerId,
                    authData.organizationId
                  )
                )
              : undefined,
            // producerIds filter
            producersIds.length > 0
              ? or(
                  inArray(eserviceInReadmodelCatalog.producerId, producersIds),
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
            hasPermission(
              [
                userRoles.ADMIN_ROLE,
                userRoles.API_ROLE,
                userRoles.SUPPORT_ROLE,
              ],
              authData
            )
              ? or(
                  // exist active descriptors for that eservice
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
                  ),
                  // it's the producer
                  eq(
                    eserviceInReadmodelCatalog.producerId,
                    authData.organizationId
                  ),
                  // has producer delegation
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
              : // exist active descriptors for that eservice
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
                ),
            // mode filter
            mode ? eq(eserviceInReadmodelCatalog.mode, mode) : undefined,
            // isConsumerDelegable filter
            isConsumerDelegable === true
              ? eq(eserviceInReadmodelCatalog.isConsumerDelegable, true)
              : isConsumerDelegable === false
              ? or(
                  isNull(eserviceInReadmodelCatalog.isConsumerDelegable),
                  eq(eserviceInReadmodelCatalog.isConsumerDelegable, false)
                )
              : undefined,
            // delegated filter
            delegated === true
              ? and(
                  eq(
                    delegationInReadmodelDelegation.kind,
                    delegationKind.delegatedProducer
                  ),
                  inArray(delegationInReadmodelDelegation.state, [
                    delegationState.active,
                    delegationState.waitingForApproval,
                  ])
                )
              : delegated === false
              ? notExists(
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
              : undefined,
            // template filter
            templatesIds.length > 0
              ? inArray(
                  eserviceTemplateRefInReadmodelCatalog.eserviceTemplateId,
                  templatesIds
                )
              : undefined
          )
        );

      const uniqueMatchingIds = matchingEserviceIds.map((row) => row.id);

      // manually retrieve eservices matching those ids but do manual pagination (example: query the first 10. etc...)
      const queryResult = await readmodelDB
        .select({
          eservice: eserviceInReadmodelCatalog,
          descriptor: eserviceDescriptorInReadmodelCatalog,
          interface: eserviceDescriptorInterfaceInReadmodelCatalog,
          document: eserviceDescriptorDocumentInReadmodelCatalog,
          attribute: eserviceDescriptorAttributeInReadmodelCatalog,
          rejection: eserviceDescriptorRejectionReasonInReadmodelCatalog,
          riskAnalysis: eserviceRiskAnalysisInReadmodelCatalog,
          riskAnalysisAnswer: eserviceRiskAnalysisAnswerInReadmodelCatalog,
          templateRef: eserviceTemplateRefInReadmodelCatalog,
          templateVersionRef:
            eserviceDescriptorTemplateVersionRefInReadmodelCatalog,
        })
        .from(eserviceInReadmodelCatalog)
        .where(
          inArray(
            eserviceInReadmodelCatalog.id,
            uniqueMatchingIds.slice(offset, offset + limit) // TODO double-check
          )
        )
        .leftJoin(
          // 1
          eserviceDescriptorInReadmodelCatalog,
          eq(
            eserviceInReadmodelCatalog.id,
            eserviceDescriptorInReadmodelCatalog.eserviceId
          )
        )
        .leftJoin(
          // 2
          eserviceDescriptorInterfaceInReadmodelCatalog,
          eq(
            eserviceDescriptorInReadmodelCatalog.id,
            eserviceDescriptorInterfaceInReadmodelCatalog.descriptorId
          )
        )
        .leftJoin(
          // 3
          eserviceDescriptorDocumentInReadmodelCatalog,
          eq(
            eserviceDescriptorInReadmodelCatalog.id,
            eserviceDescriptorDocumentInReadmodelCatalog.descriptorId
          )
        )
        .leftJoin(
          // 4
          eserviceDescriptorAttributeInReadmodelCatalog,
          eq(
            eserviceDescriptorInReadmodelCatalog.id,
            eserviceDescriptorAttributeInReadmodelCatalog.descriptorId
          )
        )
        .leftJoin(
          // 5
          eserviceDescriptorRejectionReasonInReadmodelCatalog,
          eq(
            eserviceDescriptorInReadmodelCatalog.id,
            eserviceDescriptorRejectionReasonInReadmodelCatalog.descriptorId
          )
        )
        .leftJoin(
          // 6
          eserviceDescriptorTemplateVersionRefInReadmodelCatalog,
          eq(
            eserviceDescriptorInReadmodelCatalog.id,
            eserviceDescriptorTemplateVersionRefInReadmodelCatalog.descriptorId
          )
        )
        .leftJoin(
          // 7
          eserviceRiskAnalysisInReadmodelCatalog,
          eq(
            eserviceInReadmodelCatalog.id,
            eserviceRiskAnalysisInReadmodelCatalog.eserviceId
          )
        )
        .leftJoin(
          // 8
          eserviceRiskAnalysisAnswerInReadmodelCatalog,
          eq(
            eserviceRiskAnalysisInReadmodelCatalog.riskAnalysisFormId,
            eserviceRiskAnalysisAnswerInReadmodelCatalog.riskAnalysisFormId
          )
        )
        .leftJoin(
          // 9
          eserviceTemplateRefInReadmodelCatalog,
          eq(
            eserviceInReadmodelCatalog.id,
            eserviceTemplateRefInReadmodelCatalog.eserviceId
          )
        )
        .orderBy(eserviceInReadmodelCatalog.name);

      const eservices = aggregateEserviceArray(
        toEServiceAggregatorArray(queryResult)
      );

      return {
        results: eservices.map((eservice) => eservice.data),
        totalCount: uniqueMatchingIds.length,
      };
    },
    async getEServiceByNameAndProducerId({
      name,
      producerId,
    }: {
      name: string;
      producerId: TenantId;
    }): Promise<WithMetadata<EService> | undefined> {
      return await catalogReadModelService.getEServiceByFilter(
        and(
          ilike(eserviceInReadmodelCatalog.name, name),
          eq(eserviceInReadmodelCatalog.producerId, producerId)
        )
      );
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
        .selectDistinctOn([tenantInReadmodelTenant.id], {
          tenant: tenantInReadmodelTenant,
          agreement: agreementInReadmodelAgreement,
          descriptor: eserviceDescriptorInReadmodelCatalog,
          totalCount: sql`COUNT(*) OVER()`.mapWith(Number),
        })
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

      // TODO: without the aggregators, we have to parse the entries here
      const consumers: Consumer[] = res.map((row) => ({
        descriptorVersion: row.descriptor.version,
        descriptorState: DescriptorState.parse(row.descriptor.state),
        agreementState: AgreementState.parse(row.agreement.state),
        consumerName: row.tenant.name,
        consumerExternalId: row.tenant.externalIdValue,
      }));

      return {
        results: consumers,
        totalCount: res[0]?.totalCount || 0,
      };
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
      const queryResult = await readmodelDB
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
          // 1
          agreementStampInReadmodelAgreement,
          eq(
            agreementInReadmodelAgreement.id,
            agreementStampInReadmodelAgreement.agreementId
          )
        )
        .leftJoin(
          // 2
          agreementAttributeInReadmodelAgreement,
          eq(
            agreementInReadmodelAgreement.id,
            agreementAttributeInReadmodelAgreement.agreementId
          )
        )
        .leftJoin(
          // 3
          agreementConsumerDocumentInReadmodelAgreement,
          eq(
            agreementInReadmodelAgreement.id,
            agreementConsumerDocumentInReadmodelAgreement.agreementId
          )
        )
        .leftJoin(
          // 4
          agreementContractInReadmodelAgreement,
          eq(
            agreementInReadmodelAgreement.id,
            agreementContractInReadmodelAgreement.agreementId
          )
        )
        .limit(limit || 0);

      return aggregateAgreementArray(
        toAgreementAggregatorArray(queryResult)
      ).map((agreementWithMetadata) => agreementWithMetadata.data);
    },

    async getAttributesByIds(
      attributesIds: AttributeId[]
    ): Promise<Attribute[]> {
      const condition = inArray(
        attributeInReadmodelAttribute.id,
        attributesIds
      );
      const res = await readmodelDB
        .select()
        .from(attributeInReadmodelAttribute)
        .where(condition)
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
          // 1
          delegationStampInReadmodelDelegation,
          eq(
            delegationInReadmodelDelegation.id,
            delegationStampInReadmodelDelegation.delegationId
          )
        )
        .leftJoin(
          // 2
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
