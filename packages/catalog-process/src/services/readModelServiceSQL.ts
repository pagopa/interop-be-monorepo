import { AuthData } from "pagopa-interop-commons";
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
} from "pagopa-interop-models";
import {
  aggregateAttributeArray,
  aggregateDelegation,
  aggregateEservice,
  CatalogReadModelServiceSQL,
  TenantReadModelService,
  toDelegationAggregator,
  toEServiceAggregator,
} from "pagopa-interop-readmodel";
import {
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
} from "pagopa-interop-readmodel-models";
import { and, desc, eq, ilike, inArray } from "drizzle-orm";
import { ApiGetEServicesFilters, Consumer } from "../model/domain/models.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilderSQL(
  readmodelDB: DrizzleReturnType,
  catalogReadModelService: CatalogReadModelServiceSQL,
  tenantReadModelService: TenantReadModelService,
  eserviceTemplateReadModelService: EserviceTeamplateReadModelService
) {
  return {
    async getEServices(
      authData: AuthData,
      filters: ApiGetEServicesFilters,
      offset: number,
      limit: number
    ): Promise<ListResult<EService>> {
      /* const {
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
      const ids = await match(agreementStates.length)
        .with(0, () => eservicesIds)
        .otherwise(async () =>
          (
            await this.listAgreements({
              eservicesIds,
              consumersIds: [authData.organizationId],
              producersIds: [],
              states: agreementStates,
            })
          ).map((a) => a.eserviceId)
        );

      if (agreementStates.length > 0 && ids.length === 0) {
        return emptyListResult;
      }

      const nameFilter: ReadModelFilter<EService> = name
        ? {
            "data.name": {
              $regex: ReadModelRepository.escapeRegExp(name),
              $options: "i",
            },
          }
        : {};

      const idsFilter: ReadModelFilter<EService> =
        ReadModelRepository.arrayToFilter(ids, {
          "data.id": { $in: ids },
        });

      const delegationLookup = {
        $lookup: {
          from: "delegations",
          localField: "data.id",
          foreignField: "data.eserviceId",
          as: "delegations",
        },
      };

      const producersIdsFilter = ReadModelRepository.arrayToFilter(
        producersIds,
        {
          $or: [
            { "data.producerId": { $in: producersIds } },
            {
              "delegations.data.delegateId": { $in: producersIds },
              "delegations.data.state": { $eq: delegationState.active },
              "delegations.data.kind": {
                $eq: delegationKind.delegatedProducer,
              },
            },
          ],
        }
      );

      const descriptorsStateFilter: ReadModelFilter<EService> =
        ReadModelRepository.arrayToFilter(states, {
          "data.descriptors.state": { $in: states },
        });

      const attributesFilter: ReadModelFilter<EService> =
        ReadModelRepository.arrayToFilter(attributesIds, {
          $or: [
            {
              "data.descriptors.attributes.certified": {
                $elemMatch: {
                  $elemMatch: { id: { $in: attributesIds } },
                },
              },
            },
            {
              "data.descriptors.attributes.declared": {
                $elemMatch: {
                  $elemMatch: { id: { $in: attributesIds } },
                },
              },
            },
            {
              "data.descriptors.attributes.verified": {
                $elemMatch: {
                  $elemMatch: { id: { $in: attributesIds } },
                },
              },
            },
          ],
        });

      const visibilityFilter: ReadModelFilter<EService> = hasPermission(
        [userRoles.ADMIN_ROLE, userRoles.API_ROLE, userRoles.SUPPORT_ROLE],
        authData
      )
        ? {
            $nor: [
              {
                $and: [
                  {
                    $nor: [
                      { "data.producerId": authData.organizationId },
                      {
                        delegations: {
                          $elemMatch: {
                            "data.delegateId": authData.organizationId,
                            "data.state": delegationState.active,
                            "data.kind": delegationKind.delegatedProducer,
                          },
                        },
                      },
                    ],
                  },
                  { "data.descriptors": { $size: 0 } },
                ],
              },
              {
                $and: [
                  {
                    $nor: [
                      { "data.producerId": authData.organizationId },
                      {
                        delegations: {
                          $elemMatch: {
                            "data.delegateId": authData.organizationId,
                            "data.state": delegationState.active,
                            "data.kind": delegationKind.delegatedProducer,
                          },
                        },
                      },
                    ],
                  },
                  { "data.descriptors": { $size: 1 } },
                  {
                    "data.descriptors.state": {
                      $in: notActiveDescriptorState,
                    },
                  },
                ],
              },
            ],
          }
        : {
            $nor: [
              { "data.descriptors": { $size: 0 } },
              {
                $and: [
                  { "data.descriptors": { $size: 1 } },
                  {
                    "data.descriptors.state": {
                      $in: notActiveDescriptorState,
                    },
                  },
                ],
              },
            ],
          };

      const modeFilter: ReadModelFilter<EService> = mode
        ? { "data.mode": { $eq: mode } }
        : {};

      const isConsumerDelegableFilter: ReadModelFilter<EService> =
        isConsumerDelegable
          ? { "data.isConsumerDelegable": { $eq: isConsumerDelegable } }
          : {};

      const delegatedFilter: ReadModelFilter<EService> = match(delegated)
        .with(true, () => ({
          "delegations.data.state": {
            $in: [delegationState.active, delegationState.waitingForApproval],
          },
          "delegations.data.kind": delegationKind.delegatedProducer,
        }))
        .with(false, () => ({
          delegations: {
            $not: {
              $elemMatch: {
                "data.state": {
                  $in: [
                    delegationState.active,
                    delegationState.waitingForApproval,
                  ],
                },
                "data.kind": delegationKind.delegatedProducer,
              },
            },
          },
        }))
        .otherwise(() => ({}));

      const templatesIdsFilter =
        templatesIds.length > 0
          ? {
              "data.templateRef.id": { $in: templatesIds },
            }
          : {};

      const aggregationPipeline = [
        delegationLookup,
        { $match: nameFilter },
        { $match: idsFilter },
        { $match: producersIdsFilter },
        { $match: descriptorsStateFilter },
        { $match: attributesFilter },
        { $match: visibilityFilter },
        { $match: modeFilter },
        { $match: isConsumerDelegableFilter },
        { $match: delegatedFilter },
        { $match: templatesIdsFilter },
        {
          $project: {
            data: 1,
            computedColumn: { $toLower: ["$data.name"] },
          },
        },
        {
          $sort: { computedColumn: 1 },
        },
      ];

      const data = await eservices
        .aggregate(
          [...aggregationPipeline, { $skip: offset }, { $limit: limit }],
          { allowDiskUse: true }
        )
        .toArray();

      const result = z.array(EService).safeParse(data.map((d) => d.data));
      if (!result.success) {
        throw genericInternalError(
          `Unable to parse eservices items: result ${JSON.stringify(
            result
          )} - data ${JSON.stringify(data)} `
        );
      }

      return {
        results: result.data,
        totalCount: await ReadModelRepository.getTotalCount(
          eservices,
          aggregationPipeline
        ),
      };
      */
    },
    async getEServiceByNameAndProducerId({
      name,
      producerId,
    }: {
      name: string;
      producerId: TenantId;
    }): Promise<WithMetadata<EService> | undefined> {
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
          and(
            ilike(eserviceInReadmodelCatalog.name, name),
            eq(eserviceInReadmodelCatalog.producerId, producerId)
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
        );

      if (queryResult.length === 0) {
        return undefined;
      }

      return aggregateEservice(toEServiceAggregator(queryResult));
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
      /* const aggregationPipeline = [
        {
          $match: {
            "data.id": eserviceId,
            "data.descriptors": {
              $elemMatch: {
                state: {
                  $in: [
                    descriptorState.published,
                    descriptorState.deprecated,
                    descriptorState.suspended,
                  ],
                },
              },
            },
          } satisfies ReadModelFilter<EService>,
        },
        {
          $lookup: {
            from: "agreements",
            localField: "data.id",
            foreignField: "data.eserviceId",
            as: "agreements",
          },
        },
        {
          $unwind: "$agreements",
        },
        {
          $lookup: {
            from: "tenants",
            localField: "agreements.data.consumerId",
            foreignField: "data.id",
            as: "tenants",
          },
        },
        { $unwind: "$tenants" },
        {
          $match: {
            "agreements.data.state": {
              $in: [agreementState.active, agreementState.suspended],
            },
          },
        },
        {
          $addFields: {
            validDescriptor: {
              $filter: {
                input: "$data.descriptors",
                as: "fd",
                cond: {
                  $eq: ["$$fd.id", "$agreements.data.descriptorId"],
                },
              },
            },
          },
        },
        {
          $unwind: "$validDescriptor",
        },
        {
          $match: {
            validDescriptor: { $exists: true },
          },
        },
        {
          $project: {
            descriptorVersion: "$validDescriptor.version",
            descriptorState: "$validDescriptor.state",
            agreementState: "$agreements.data.state",
            consumerName: "$tenants.data.name",
            consumerExternalId: "$tenants.data.externalId.value",
            lowerName: { $toLower: ["$tenants.data.name"] },
          },
        },
        {
          $sort: { lowerName: 1 },
        },
      ];

      const data = await eservices
        .aggregate(
          [...aggregationPipeline, { $skip: offset }, { $limit: limit }],
          { allowDiskUse: true }
        )
        .toArray();

      const result = z.array(consumer).safeParse(data);
      if (!result.success) {
        throw genericInternalError(
          `Unable to parse consumers: result ${JSON.stringify(
            result
          )} - data ${JSON.stringify(data)} `
        );
      }

      return {
        results: result.data,
        totalCount: await ReadModelRepository.getTotalCount(
          eservices,
          aggregationPipeline
        ),
      };
    },
    async getDocumentById(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      documentId: EServiceDocumentId
    ): Promise<Document | undefined> {
      const eservice = await this.getEServiceById(eserviceId);
      return eservice?.data.descriptors
        .find((d) => d.id === descriptorId)
        ?.docs.find((d) => d.id === documentId);
    */
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
      /*
      const descriptorFilter: ReadModelFilter<Agreement> = descriptorId
        ? { "data.descriptorId": { $eq: descriptorId } }
        : {};

      const aggregationPipeline = [
        {
          $match: {
            ...ReadModelRepository.arrayToFilter(eservicesIds, {
              "data.eserviceId": { $in: eservicesIds },
            }),
            ...descriptorFilter,
            ...ReadModelRepository.arrayToFilter(consumersIds, {
              "data.consumerId": { $in: consumersIds },
            }),
            ...ReadModelRepository.arrayToFilter(producersIds, {
              "data.producerId": { $in: producersIds },
            }),
            ...ReadModelRepository.arrayToFilter(states, {
              "data.state": { $in: states },
            }),
          } satisfies ReadModelFilter<Agreement>,
        },
        {
          $project: {
            data: 1,
          },
        },
      ];

      const aggregationWithLimit = limit
        ? [...aggregationPipeline, { $limit: limit }]
        : aggregationPipeline;
      const data = await agreements
        .aggregate(aggregationWithLimit, { allowDiskUse: true })
        .toArray();
      const result = z.array(Agreement).safeParse(data.map((a) => a.data));

      if (!result.success) {
        throw genericInternalError(
          `Unable to parse agreements: result ${JSON.stringify(
            result
          )} - data ${JSON.stringify(data)} `
        );
      }

      return result.data;
      */
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
      return eserviceTemplateReadModelService.getTemplateById(id);
    },
  };
}

export type ReadModelServiceSQL = ReturnType<typeof readModelServiceBuilderSQL>;
