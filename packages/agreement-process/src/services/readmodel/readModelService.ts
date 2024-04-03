/* eslint-disable no-constant-condition */
/* eslint-disable functional/no-let */
import {
  AgreementCollection,
  MongoQueryKeys,
  ReadModelFilter,
  ReadModelRepository,
  RemoveDataPrefix,
  Metadata,
  logger,
  AttributeCollection,
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
  genericError,
  EServiceId,
  AttributeReadmodel,
  TenantId,
} from "pagopa-interop-models";
import { P, match } from "ts-pattern";
import { z } from "zod";
import { Document, Filter } from "mongodb";
import {
  CompactEService,
  CompactOrganization,
} from "../../model/domain/models.js";

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
  agreeementStates: AgreementState[];
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
      "tenants.data.name": {
        $regex: new RegExp(
          ReadModelRepository.escapeRegExp(tenantName || ""),
          "i"
        ),
      },
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
    .aggregate([getAgreementsFilters(filters)])
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
    logger.error(
      `Unable to parse agreements items: result ${JSON.stringify(
        result
      )} - data ${JSON.stringify(data)} `
    );
    throw genericError("Unable to parse agreements items");
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
      logger.error(
        `Unable to parse attribute item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );
      throw genericError("Unable to parse attribute item");
    }
    return result.data;
  }
  return undefined;
}

async function searchTenantsByName(
  agreements: AgreementCollection,
  tenantName: string | undefined,
  tenantIdField: "producerId" | "consumerId",
  limit: number,
  offset: number
): Promise<ListResult<CompactOrganization>> {
  const aggregationPipeline = getTenantsByNamePipeline(
    tenantName,
    tenantIdField
  );

  const data = await agreements
    .aggregate([...aggregationPipeline, { $skip: offset }, { $limit: limit }])
    .toArray();

  const result = z
    .array(CompactOrganization)
    .safeParse(data.map((d) => d.data));
  if (!result.success) {
    logger.error(
      `Unable to parse compact organization items: result ${JSON.stringify(
        result
      )} - data ${JSON.stringify(data)} `
    );

    throw genericError("Unable to parse compact organization items");
  }

  return {
    results: result.data,
    totalCount: await ReadModelRepository.getTotalCount(
      agreements,
      aggregationPipeline
    ),
  };
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilder(
  readModelRepository: ReadModelRepository
) {
  const agreements = readModelRepository.agreements;
  const eservices = readModelRepository.eservices;
  const tenants = readModelRepository.tenants;
  const attributes = readModelRepository.attributes;
  return {
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
    async readAgreementById(
      agreementId: AgreementId
    ): Promise<WithMetadata<Agreement> | undefined> {
      const data = await agreements.findOne(
        { "data.id": agreementId },
        { projection: { data: true, metadata: true } }
      );

      if (data) {
        const result = z
          .object({
            data: Agreement,
            metadata: z.object({ version: z.number() }),
          })
          .safeParse(data);
        if (!result.success) {
          logger.error(`Agreement ${agreementId} not found`);
          throw genericError(`Agreement ${agreementId} not found`);
        }
        return {
          data: result.data.data,
          metadata: { version: result.data.metadata.version },
        };
      }

      return undefined;
    },
    async getAllAgreements(
      filters: AgreementQueryFilters
    ): Promise<Array<WithMetadata<Agreement>>> {
      return getAllAgreements(agreements, filters);
    },
    async getEServiceById(id: string): Promise<EService | undefined> {
      const data = await eservices.findOne(
        { "data.id": id },
        { projection: { data: true } }
      );

      if (data) {
        const result = EService.safeParse(data.data);

        if (!result.success) {
          logger.error(
            `Unable to parse eservices item: result ${JSON.stringify(
              result
            )} - data ${JSON.stringify(data)} `
          );

          throw genericError(`Unable to parse eservice ${id}`);
        }

        return result.data;
      }

      return undefined;
    },
    async getTenantById(tenantId: string): Promise<Tenant | undefined> {
      const data = await tenants.findOne(
        { "data.id": tenantId },
        { projection: { data: true } }
      );

      if (data) {
        const result = Tenant.safeParse(data.data);

        if (!result.success) {
          logger.error(
            `Unable to parse tenant item: result ${JSON.stringify(
              result
            )} - data ${JSON.stringify(data)} `
          );

          throw genericError(`Unable to parse tenant ${tenantId}`);
        }

        return result.data;
      }
      return undefined;
    },
    async getAttributeById(id: AttributeId): Promise<Attribute | undefined> {
      return getAttribute(attributes, { "data.id": id });
    },
    async listConsumers(
      name: string | undefined,
      limit: number,
      offset: number
    ): Promise<ListResult<CompactOrganization>> {
      return searchTenantsByName(agreements, name, "consumerId", limit, offset);
    },
    async listProducers(
      name: string | undefined,
      limit: number,
      offset: number
    ): Promise<ListResult<CompactOrganization>> {
      return searchTenantsByName(agreements, name, "producerId", limit, offset);
    },
    async listAgreementsEServices(
      filters: AgreementEServicesQueryFilters,
      limit: number,
      offset: number
    ): Promise<ListResult<CompactEService>> {
      const aggregationPipeline = [
        {
          $lookup: {
            from: "eservices",
            localField: "data.eserviceId",
            foreignField: "data.id",
            as: "eservices",
          },
        },
        {
          $unwind: {
            path: "$eservices",
            preserveNullAndEmptyArrays: false,
          },
        },
        {
          $match: {
            ...makeFilter("consumerId", filters.consumerIds),
            ...makeFilter("producerId", filters.producerIds),
            "eservices.data.name": {
              $regex: new RegExp(
                ReadModelRepository.escapeRegExp(filters.eserviceName || ""),
                "i"
              ),
            },
          },
        },
        {
          $group: {
            _id: "$data.eserviceId",
            eserviceId: { $first: "$data.eserviceId" },
            eserviceName: { $first: "$eservices.data.name" },
          },
        },
        {
          $project: {
            data: { id: "$eserviceId", name: "$eserviceName" },
            lowerName: { $toLower: "$eserviceName" },
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

      const result = z
        .array(CompactEService)
        .safeParse(data.map((d) => d.data));
      if (!result.success) {
        logger.error(
          `Unable to parse compact eservice items: result ${JSON.stringify(
            result
          )} - data ${JSON.stringify(data)} `
        );

        throw genericError("Unable to parse compact eseervice items");
      }

      return {
        results: result.data,
        totalCount: await ReadModelRepository.getTotalCount(
          agreements,
          aggregationPipeline
        ),
      };
    },
  };
}

export type ReadModelService = ReturnType<typeof readModelServiceBuilder>;
