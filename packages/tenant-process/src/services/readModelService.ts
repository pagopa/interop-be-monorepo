import {
  AttributeCollection,
  logger,
  MongoQueryKeys,
  ReadModelFilter,
  ReadModelRepository,
  RemoveDataPrefix,
  TenantCollection,
} from "pagopa-interop-commons";
import {
  WithMetadata,
  Tenant,
  Attribute,
  ExternalId,
  EService,
  genericError,
  ListResult,
  agreementState,
  AttributeId,
  TenantId,
  EServiceId,
  attributeKind,
  AttributeReadmodel,
  Agreement,
  AgreementState,
  DescriptorId,
  descriptorState,
} from "pagopa-interop-models";
import { z } from "zod";
import { Document, Filter, WithId } from "mongodb";
import { match, P } from "ts-pattern";
import { attributeNotFound } from "../model/domain/errors.js";
import { TenantProcessConfig } from "../utilities/config.js";
import { CertifiedAttributeQueryResult } from "../model/domain/models.js";

export type AgreementQueryFilters = {
  producerId?: string | string[];
  consumerId?: string | string[];
  eserviceId?: EServiceId | EServiceId[];
  descriptorId?: DescriptorId | DescriptorId[];
  agreementStates?: AgreementState[];
  attributeId?: AttributeId | AttributeId[];
  showOnlyUpgradeable?: boolean;
};

type AgreementDataFields = RemoveDataPrefix<MongoQueryKeys<Agreement>>;

const makeFilter = (
  fieldName: Extract<
    AgreementDataFields,
    "producerId" | "consumerId" | "eserviceId" | "descriptorId"
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
    ...(agreementStatesFilters &&
      agreementStatesFilters.length > 0 && {
        "data.state": {
          $in: agreementStatesFilters.map((s) => s.toString()),
        },
      }),
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

function listTenantsFilters(
  name: string | undefined
): Filter<{ data: Tenant }> {
  const nameFilter = name
    ? {
        "data.name": {
          $regex: ReadModelRepository.escapeRegExp(name),
          $options: "i",
        },
      }
    : {};

  const withSelfcareIdFilter = {
    "data.selfcareId": {
      $exists: true,
    },
  };

  return {
    ...nameFilter,
    ...withSelfcareIdFilter,
  };
}

export const getTenants = async ({
  tenants,
  aggregationPipeline,
  offset,
  limit,
  allowDiskUse = false,
}: {
  tenants: TenantCollection;
  aggregationPipeline: Array<Filter<Tenant>>;
  offset: number;
  limit: number;
  allowDiskUse?: boolean;
}): Promise<{
  results: Tenant[];
  totalCount: number;
}> => {
  const data = await tenants
    .aggregate([...aggregationPipeline, { $skip: offset }, { $limit: limit }], {
      allowDiskUse,
    })
    .toArray();

  const result = z.array(Tenant).safeParse(data.map((d) => d.data));

  if (!result.success) {
    logger.error(
      `Unable to parse tenants items: result ${JSON.stringify(
        result
      )} - data ${JSON.stringify(data)} `
    );
    throw genericError("Unable to parse tenants items");
  }
  return {
    results: result.data,
    totalCount: await ReadModelRepository.getTotalCount(
      tenants,
      aggregationPipeline,
      allowDiskUse
    ),
  };
};

async function getAttribute(
  attributes: AttributeCollection,
  filter: Filter<WithId<WithMetadata<AttributeReadmodel>>>
): Promise<Attribute | undefined> {
  const data = await attributes.findOne(filter, {
    projection: { data: true, metadata: true },
  });
  if (!data) {
    return undefined;
  } else {
    const result = Attribute.safeParse(data.data);
    if (!result.success) {
      logger.error(
        `Unable to parse attribute item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );
      throw genericError("Unable to parse attribute item");
    }
    return result.data;
  }
}

async function getTenant(
  tenants: TenantCollection,
  filter: Filter<WithId<WithMetadata<Tenant>>>
): Promise<WithMetadata<Tenant> | undefined> {
  const data = await tenants.findOne(filter, {
    projection: { data: true, metadata: true },
  });
  if (!data) {
    return undefined;
  } else {
    const result = z
      .object({
        metadata: z.object({ version: z.number() }),
        data: Tenant,
      })
      .safeParse(data);
    if (!result.success) {
      logger.error(
        `Unable to parse tenant item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );

      throw genericError("Unable to parse tenant item");
    }

    return {
      data: result.data.data,
      metadata: { version: result.data.metadata.version },
    };
  }
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilder(config: TenantProcessConfig) {
  const { attributes, eservices, tenants, agreements } =
    ReadModelRepository.init(config);
  return {
    async getTenantsByName({
      name,
      offset,
      limit,
    }: {
      name: string | undefined;
      offset: number;
      limit: number;
    }): Promise<ListResult<Tenant>> {
      const query = listTenantsFilters(name);
      const aggregationPipeline = [
        { $match: query },
        { $project: { data: 1, lowerName: { $toLower: "$data.name" } } },
        { $sort: { lowerName: 1 } },
      ];

      return getTenants({
        tenants,
        aggregationPipeline,
        offset,
        limit,
      });
    },

    async getTenantById(
      id: TenantId
    ): Promise<WithMetadata<Tenant> | undefined> {
      return getTenant(tenants, { "data.id": id });
    },

    async getTenantByName(
      name: string
    ): Promise<WithMetadata<Tenant> | undefined> {
      return getTenant(tenants, {
        "data.name": {
          $regex: `^${ReadModelRepository.escapeRegExp(name)}$$`,
          $options: "i",
        },
      });
    },

    async getTenantByExternalId(
      externalId: ExternalId
    ): Promise<WithMetadata<Tenant> | undefined> {
      return getTenant(tenants, {
        "data.externalId.value": externalId.value,
        "data.externalId.origin": externalId.origin,
      });
    },

    async getTenantBySelfcareId(
      selfcareId: string
    ): Promise<WithMetadata<Tenant> | undefined> {
      return getTenant(tenants, { "data.selfcareId": selfcareId });
    },

    async getConsumers({
      consumerName,
      producerId,
      offset,
      limit,
    }: {
      consumerName: string | undefined;
      producerId: string;
      offset: number;
      limit: number;
    }): Promise<ListResult<Tenant>> {
      const query = listTenantsFilters(consumerName);

      const aggregationPipeline = [
        { $match: query },
        {
          $lookup: {
            from: "agreements",
            localField: "data.id",
            foreignField: "data.consumerId",
            as: "agreements",
          },
        },
        {
          $match: {
            $and: [
              { "agreements.data.producerId": producerId },
              {
                "agreements.data.state": {
                  $in: [agreementState.active, agreementState.suspended],
                },
              },
            ],
          },
        },
        { $project: { data: 1, lowerName: { $toLower: "$data.name" } } },
        { $sort: { lowerName: 1 } },
      ];

      return getTenants({
        tenants,
        aggregationPipeline,
        offset,
        limit,
        allowDiskUse: true,
      });
    },

    async getProducers({
      producerName,
      offset,
      limit,
    }: {
      producerName: string | undefined;
      offset: number;
      limit: number;
    }): Promise<ListResult<Tenant>> {
      const query = listTenantsFilters(producerName);
      const aggregationPipeline = [
        { $match: query },
        {
          $lookup: {
            from: "eservices",
            localField: "data.id",
            foreignField: "data.producerId",
            as: "eservices",
          },
        },
        { $match: { eservices: { $not: { $size: 0 } } } },
        { $project: { data: 1, lowerName: { $toLower: "$data.name" } } },
        { $sort: { lowerName: 1 } },
      ];

      return getTenants({
        tenants,
        aggregationPipeline,
        offset,
        limit,
        allowDiskUse: true,
      });
    },
    async getAttributesByExternalIds(
      externalIds: ExternalId[]
    ): Promise<Attribute[]> {
      const fetchAttributeByExternalId = async (
        externalId: ExternalId
      ): Promise<Attribute> => {
        const data = await getAttribute(attributes, {
          "data.origin": externalId.origin,
          "data.code": externalId.value,
        });
        if (!data) {
          throw attributeNotFound(`${externalId.origin}/${externalId.value}`);
        }
        return data;
      };

      const attributesPromises = externalIds.map(fetchAttributeByExternalId);
      return Promise.all(attributesPromises);
    },

    async getAttributesById(attributeIds: AttributeId[]): Promise<Attribute[]> {
      const fetchAttributeById = async (
        id: AttributeId
      ): Promise<Attribute> => {
        const data = await getAttribute(attributes, { "data.id": id });
        if (!data) {
          throw attributeNotFound(id);
        }
        return data;
      };

      const attributePromises = attributeIds.map(fetchAttributeById);
      return Promise.all(attributePromises);
    },

    async getAttributeById(attributeId: AttributeId): Promise<Attribute> {
      const data = await getAttribute(attributes, { "data.id": attributeId });
      if (!data) {
        throw attributeNotFound(attributeId);
      }
      return data;
    },

    async getEServiceById(id: EServiceId): Promise<EService | undefined> {
      const data = await eservices.findOne(
        { "data.id": id },
        { projection: { data: true, metadata: true } }
      );

      if (!data) {
        return undefined;
      } else {
        const result = EService.safeParse(data);

        if (!result.success) {
          logger.error(
            `Unable to parse eservices item: result ${JSON.stringify(
              result
            )} - data ${JSON.stringify(data)} `
          );

          throw genericError("Unable to parse eservices item");
        }

        return result.data;
      }
    },

    async getAgreements(
      filters: AgreementQueryFilters,
      limit: number,
      offset: number
    ): Promise<ListResult<Agreement>> {
      const aggregationPipeline = [
        getAgreementsFilters(filters),
        {
          $lookup: {
            from: "eservices",
            localField: "data.eserviceId",
            foreignField: "data.id",
            as: "eservices",
          },
        },
        {
          $unwind: "$eservices",
        },
        ...(filters.showOnlyUpgradeable
          ? [
              {
                $addFields: {
                  currentDescriptor: {
                    $filter: {
                      input: "$eservices.data.descriptors",
                      as: "descr",
                      cond: {
                        $eq: ["$$descr.id", "$data.descriptorId"],
                      },
                    },
                  },
                },
              },
              {
                $unwind: "$currentDescriptor",
              },
              {
                $addFields: {
                  upgradableDescriptor: {
                    $filter: {
                      input: "$eservices.data.descriptors",
                      as: "upgradable",
                      cond: {
                        $and: [
                          {
                            $gt: [
                              "$$upgradable.publishedAt",
                              "$currentDescriptor.publishedAt",
                            ],
                          },
                          {
                            $in: [
                              "$$upgradable.state",
                              [
                                descriptorState.published,
                                descriptorState.suspended,
                              ],
                            ],
                          },
                        ],
                      },
                    },
                  },
                },
              },
              {
                $match: {
                  upgradableDescriptor: { $ne: [] },
                },
              },
            ]
          : []),
        {
          $project: {
            data: 1,
            eservices: 1,
            lowerName: { $toLower: "$eservices.data.name" },
          },
        },
        {
          $sort: { lowerName: 1 },
        },
      ];

      const data = await agreements
        .aggregate([
          ...aggregationPipeline,
          { $skip: offset },
          { $limit: limit },
        ])
        .toArray();

      const result = z.array(Agreement).safeParse(data.map((d) => d.data));
      if (!result.success) {
        logger.error(
          `Unable to parse agreements items: result ${JSON.stringify(
            result
          )} - data ${JSON.stringify(data)} `
        );

        throw genericError("Unable to parse agreements items");
      }

      return {
        results: result.data,
        totalCount: await ReadModelRepository.getTotalCount(
          agreements,
          aggregationPipeline
        ),
      };
    },

    async getCertifiedAttributes({
      certifierId,
      offset,
      limit,
    }: {
      certifierId: string;
      offset: number;
      limit: number;
    }): Promise<ListResult<CertifiedAttributeQueryResult>> {
      const aggregationPipeline: Document[] = [
        {
          $match: {
            "data.kind": attributeKind.certified,
            "data.origin": certifierId,
          },
        },
        {
          $lookup: {
            from: "tenants",
            localField: "data.id",
            foreignField: "data.attributes.id",
            as: "tenants",
          },
        },
        { $unwind: "$tenants" },
        { $unwind: "$tenants.data.attributes" },
        {
          $addFields: {
            notRevoked: {
              $cond: {
                if: {
                  $and: [
                    { $eq: ["$tenants.data.attributes.id", "$data.id"] },
                    { $not: ["$tenants.data.attributes.revocationTimestamp"] },
                  ],
                },
                then: true,
                else: false,
              },
            },
          },
        },
        {
          $match: {
            notRevoked: true,
          },
        },
        {
          $project: {
            _id: 0,
            id: "$tenants.data.id",
            name: "$tenants.data.name",
            attributeId: "$data.id",
            attributeName: "$data.name",
            lowerName: { $toLower: "$tenants.data.name" },
          },
        },
        {
          $sort: {
            lowerName: 1,
          },
        },
      ];

      const data = await attributes
        .aggregate(
          [...aggregationPipeline, { $skip: offset }, { $limit: limit }],
          { allowDiskUse: true }
        )
        .toArray();

      const result = z.array(CertifiedAttributeQueryResult).safeParse(data);

      if (!result.success) {
        logger.error(
          `Unable to parse attributes items: result ${JSON.stringify(
            result
          )} - data ${JSON.stringify(data)} `
        );

        throw genericError("Unable to parse attributes items");
      }

      return {
        results: result.data,
        totalCount: await ReadModelRepository.getTotalCount(
          attributes,
          aggregationPipeline
        ),
      };
    },
  };
}

export type ReadModelService = ReturnType<typeof readModelServiceBuilder>;
