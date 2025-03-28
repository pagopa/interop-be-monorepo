/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-constant-condition */
import {
  AgreementCollection,
  MongoQueryKeys,
  ReadModelFilter,
  ReadModelRepository,
  RemoveDataPrefix,
  Metadata,
  AttributeCollection,
  DelegationCollection,
} from "pagopa-interop-commons";
import {
  Agreement,
  AttributeId,
  AgreementId,
  AgreementState,
  Attribute,
  DescriptorId,
  EService,
  ListResult,
  Tenant,
  WithMetadata,
  agreementState,
  descriptorState,
  EServiceId,
  AttributeReadmodel,
  DelegationReadModel,
  TenantId,
  genericInternalError,
  Delegation,
  delegationState,
  AgreementReadModel,
  DescriptorReadModel,
  EServiceReadModel,
  delegationKind,
} from "pagopa-interop-models";
import { P, match } from "ts-pattern";
import { z } from "zod";
import { Document, Filter } from "mongodb";
import { AgreementReadModelServiceSQL } from "pagopa-interop-readmodel";
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

type AgreementDataFields = RemoveDataPrefix<MongoQueryKeys<Agreement>>;

const makeFilter = (
  fieldName: Extract<
    AgreementDataFields,
    "producerId" | "consumerId" | "eserviceId" | "descriptorId" | "state"
  >,
  value: string | string[] | undefined
): ReadModelFilter<Agreement> | undefined =>
  match(value)
    .with(P.nullish, () => undefined)
    .with(P.string, () => ({
      [`data.${fieldName}`]: value,
    }))
    .with(P.array(P.string), (a) =>
      a.length === 0 ? undefined : { [`data.${fieldName}`]: { $in: value } }
    )
    .exhaustive();

const makeAttributesFilter = (
  fieldName: Extract<
    AgreementDataFields,
    "certifiedAttributes" | "declaredAttributes" | "verifiedAttributes"
  >,
  attributeIds: AttributeId | AttributeId[]
): ReadModelFilter<Agreement> | undefined =>
  match(attributeIds)
    .with(P.string, (id) => ({
      [`data.${fieldName}`]: { $elemMatch: { id } },
    }))
    .with(P.array(P.string), (ids) =>
      ids.length === 0
        ? undefined
        : {
            [`data.${fieldName}`]: {
              $elemMatch: { id: { $in: ids } },
            },
          }
    )
    .exhaustive();

const makeRegexFilter = (
  fieldName: string,
  value: string | undefined
): ReadModelFilter<Agreement> | undefined =>
  match(value)
    .with(P.nullish, () => undefined)
    .with("", () => undefined)
    .with(P.string, () => ({
      [fieldName]: {
        $regex: new RegExp(ReadModelRepository.escapeRegExp(value || ""), "i"),
      },
    }))
    .exhaustive();

const getAgreementsFilters = (
  filters: AgreementQueryFilters
): { $match: object } => {
  const upgradeableStates = [
    agreementState.draft,
    agreementState.active,
    agreementState.suspended,
  ];

  const {
    attributeId,
    producerId,
    consumerId,
    eserviceId,
    descriptorId,
    agreementStates,
    showOnlyUpgradeable,
  } = filters;

  const agreementStatesFilters = match(agreementStates)
    .with(P.nullish, () => (showOnlyUpgradeable ? upgradeableStates : []))
    .with(
      P.when(
        (agreementStates) => agreementStates.length === 0 && showOnlyUpgradeable
      ),
      () => upgradeableStates
    )
    .with(
      P.when(
        (agreementStates) => agreementStates.length > 0 && showOnlyUpgradeable
      ),
      (agreementStates) =>
        upgradeableStates.filter((s) => agreementStates.includes(s))
    )
    .otherwise((agreementStates) => agreementStates);

  const queryFilters = {
    ...makeFilter("producerId", producerId),
    ...makeFilter("consumerId", consumerId),
    ...makeFilter("eserviceId", eserviceId),
    ...makeFilter("descriptorId", descriptorId),
    ...makeFilter("state", agreementStatesFilters),
    ...(attributeId && {
      $or: [
        makeAttributesFilter("certifiedAttributes", attributeId),
        makeAttributesFilter("verifiedAttributes", attributeId),
        makeAttributesFilter("declaredAttributes", attributeId),
      ],
    }),
  };
  return { $match: queryFilters };
};

const getTenantsByNamePipeline = (
  tenantName: string | undefined,
  tenantIdField: Extract<AgreementDataFields, "producerId" | "consumerId">
): Document[] => [
  {
    $lookup: {
      from: "tenants",
      localField: `data.${tenantIdField}`,
      foreignField: "data.id",
      as: "tenants",
    },
  },
  {
    $unwind: {
      path: "$tenants",
      preserveNullAndEmptyArrays: false,
    },
  },
  {
    $match: {
      ...makeRegexFilter("tenants.data.name", tenantName),
    },
  },
  {
    $group: {
      _id: `$data.${tenantIdField}`,
      tenantId: { $first: `$data.${tenantIdField}` },
      tenantName: { $first: "$tenants.data.name" },
    },
  },
  {
    $project: {
      data: { id: "$tenantId", name: "$tenantName" },
      lowerName: { $toLower: "$tenantName" },
    },
  },
  {
    $sort: { lowerName: 1 },
  },
];

const getAllAgreements = async (
  agreements: AgreementCollection,
  filters: AgreementQueryFilters
): Promise<Array<WithMetadata<Agreement>>> => {
  const data = await agreements
    .aggregate([getAgreementsFilters(filters)], { allowDiskUse: true })
    .toArray();

  const result = z
    .array(
      z.object({
        data: Agreement,
        metadata: Metadata,
      })
    )
    .safeParse(data);

  if (!result.success) {
    throw genericInternalError(
      `Unable to parse agreements items: result ${JSON.stringify(
        result
      )} - data ${JSON.stringify(data)} `
    );
  }

  return result.data;
};

async function getAttribute(
  attributes: AttributeCollection,
  filter: Filter<{ data: AttributeReadmodel }>
): Promise<Attribute | undefined> {
  const data = await attributes.findOne(filter, {
    projection: { data: true },
  });
  if (data) {
    const result = Attribute.safeParse(data.data);
    if (!result.success) {
      throw genericInternalError(
        `Unable to parse attribute item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );
    }
    return result.data;
  }
  return undefined;
}

async function getDelegation(
  delegations: DelegationCollection,
  filter: Filter<{ data: DelegationReadModel }>
): Promise<Delegation | undefined> {
  const data = await delegations.findOne(filter, {
    projection: { data: true },
  });
  if (data) {
    const result = Delegation.safeParse(data.data);
    if (!result.success) {
      throw genericInternalError(
        `Unable to parse delegation item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );
    }
    return result.data;
  }
  return undefined;
}

// eslint-disable-next-line max-params
async function searchTenantsByName(
  requesterId: TenantId,
  agreements: AgreementCollection,
  tenantName: string | undefined,
  tenantIdField: "producerId" | "consumerId",
  limit: number,
  offset: number
): Promise<ListResult<CompactOrganization>> {
  const aggregationPipeline = [
    ...getAgreementsPipeline(requesterId),
    ...getTenantsByNamePipeline(tenantName, tenantIdField),
  ];

  const data = await agreements
    .aggregate([...aggregationPipeline, { $skip: offset }, { $limit: limit }], {
      allowDiskUse: true,
    })
    .toArray();

  const result = z
    .array(CompactOrganization)
    .safeParse(data.map((d) => d.data));
  if (!result.success) {
    throw genericInternalError(
      `Unable to parse compact organization items: result ${JSON.stringify(
        result
      )} - data ${JSON.stringify(data)} `
    );
  }

  return {
    results: result.data,
    totalCount: await ReadModelRepository.getTotalCount(
      agreements,
      aggregationPipeline
    ),
  };
}

const addProducerDelegationData: Document = {
  $addFields: {
    activeProducerDelegations: {
      $filter: {
        input: "$delegations",
        as: "delegation",
        cond: {
          $and: [
            {
              $eq: ["$$delegation.data.kind", delegationKind.delegatedProducer],
            },
            {
              $eq: ["$$delegation.data.state", agreementState.active],
            },
            {
              $eq: ["$$delegation.data.delegatorId", "$data.producerId"],
            },
          ],
        },
      },
    },
  },
};

const addConsumerDelegationData: Document = {
  $addFields: {
    activeConsumerDelegations: {
      $filter: {
        input: "$delegations",
        as: "delegation",
        cond: {
          $and: [
            {
              $eq: ["$$delegation.data.kind", delegationKind.delegatedConsumer],
            },
            { $eq: ["$$delegation.data.state", delegationState.active] },
            {
              $eq: ["$$delegation.data.delegatorId", "$data.consumerId"],
            },
          ],
        },
      },
    },
  },
};

const addDelegationDataPipeline: Document[] = [
  {
    $lookup: {
      from: "delegations",
      localField: "data.eserviceId",
      foreignField: "data.eserviceId",
      as: "delegations",
    },
  },
  addConsumerDelegationData,
  addProducerDelegationData,
];

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function getProducerOrDelegateFilter(producerIds: TenantId[]) {
  return producerIds && producerIds.length > 0
    ? [
        {
          $match: {
            $or: [
              {
                "data.producerId": {
                  $in: producerIds,
                },
              },
              {
                activeProducerDelegations: {
                  $elemMatch: {
                    "data.delegateId": { $in: producerIds },
                  },
                },
              },
            ],
          },
        },
      ]
    : [];
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function getConsumerOrDelegateFilter(consumerIds: TenantId[]) {
  return consumerIds && consumerIds.length > 0
    ? [
        {
          $match: {
            $or: [
              {
                "data.consumerId": {
                  $in: consumerIds,
                },
              },
              {
                activeConsumerDelegations: {
                  $elemMatch: {
                    "data.delegateId": {
                      $in: consumerIds,
                    },
                  },
                },
              },
            ],
          },
        },
      ]
    : [];
}

function applyVisibilityToAgreements(requesterId: TenantId): Document {
  return {
    $match: {
      $or: [
        {
          "data.producerId": requesterId,
        },
        {
          "data.consumerId": requesterId,
        },
        {
          activeProducerDelegations: {
            $elemMatch: {
              "data.delegateId": requesterId,
            },
          },
        },
        {
          activeConsumerDelegations: {
            $elemMatch: {
              "data.delegateId": requesterId,
            },
          },
        },
      ],
    },
  };
}

const getAgreementsPipeline = (
  requesterId: TenantId,
  producerIds: TenantId[] = [],
  consumerIds: TenantId[] = []
): Document[] => [
  ...addDelegationDataPipeline,
  ...getProducerOrDelegateFilter(producerIds),
  ...getConsumerOrDelegateFilter(consumerIds),
  applyVisibilityToAgreements(requesterId),
];

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilderSQL(
  readmodelDB: DrizzleReturnType,
  agreementReadModelService: AgreementReadModelServiceSQL
) {
  return {
    async getAgreements(
      requesterId: TenantId,
      filters: AgreementQueryFilters,
      limit: number,
      offset: number
    ): Promise<ListResult<Agreement>> {
      throw new Error("to implement");
    },
    async getAgreementById(
      agreementId: AgreementId
    ): Promise<WithMetadata<Agreement> | undefined> {
      throw new Error("to implement");
    },
    async getAllAgreements(
      filters: AgreementQueryFilters
    ): Promise<Array<WithMetadata<Agreement>>> {
      throw new Error("to implement");
    },
    async getEServiceById(id: string): Promise<EService | undefined> {
      throw new Error("to implement");
    },
    async getTenantById(tenantId: string): Promise<Tenant | undefined> {
      throw new Error("to implement");
    },
    async getAttributeById(id: AttributeId): Promise<Attribute | undefined> {
      throw new Error("to implement");
    },
    async getAgreementsConsumers(
      requesterId: TenantId,
      name: string | undefined,
      limit: number,
      offset: number
    ): Promise<ListResult<CompactOrganization>> {
      throw new Error("to implement");
    },
    async getAgreementsProducers(
      requesterId: TenantId,
      name: string | undefined,
      limit: number,
      offset: number
    ): Promise<ListResult<CompactOrganization>> {
      throw new Error("to implement");
    },
    async getAgreementsEServices(
      requesterId: TenantId,
      filters: AgreementEServicesQueryFilters,
      limit: number,
      offset: number
    ): Promise<ListResult<CompactEService>> {
      throw new Error("to implement");
    },
    async getActiveProducerDelegationByEserviceId(
      eserviceId: EServiceId
    ): Promise<Delegation | undefined> {
      throw new Error("to implement");
    },
    async getActiveConsumerDelegationsByEserviceId(
      eserviceId: EServiceId
    ): Promise<Delegation[]> {
      throw new Error("to implement");
    },
    async getActiveConsumerDelegationByAgreement(
      agreement: Pick<Agreement, "consumerId" | "eserviceId">
    ): Promise<Delegation | undefined> {
      throw new Error("to implement");
    },
  };
}

export type ReadModelServiceSQL = ReturnType<typeof readModelServiceBuilderSQL>;
