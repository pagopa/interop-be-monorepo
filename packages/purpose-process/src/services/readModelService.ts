import {
  logger,
  ReadModelRepository,
  EServiceCollection,
  TenantCollection,
  PurposeCollection,
  ReadModelFilter,
  AgreementCollection,
  MongoQueryKeys,
  RemoveDataPrefix,
} from "pagopa-interop-commons";
import {
  EService,
  genericError,
  WithMetadata,
  EServiceId,
  TenantId,
  Tenant,
  EServiceReadModel,
  Purpose,
  PurposeId,
  ListResult,
  purposeVersionState,
  Agreement,
  AgreementState,
  AttributeId,
  DescriptorId,
  agreementState,
} from "pagopa-interop-models";
import { Filter, WithId } from "mongodb";
import { z } from "zod";
import { match, P } from "ts-pattern";
import { ApiGetPurposesFilters } from "../model/domain/models.js";

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

const getAllAgreementsConst = async (
  agreements: AgreementCollection,
  filters: AgreementQueryFilters
): Promise<Agreement[]> => {
  const data = await agreements
    .aggregate([getAgreementsFilters(filters)])
    .toArray();

  const result = z
    .array(
      z.object({
        data: Agreement,
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
  return result.data.map((d) => d.data);
};

async function getPurpose(
  purposes: PurposeCollection,
  filter: Filter<WithId<WithMetadata<Purpose>>>
): Promise<WithMetadata<Purpose> | undefined> {
  const data = await purposes.findOne(filter, {
    projection: { data: true, metadata: true },
  });
  if (!data) {
    return undefined;
  } else {
    const result = z
      .object({
        data: Purpose,
        metadata: z.object({ version: z.number() }),
      })
      .safeParse(data);
    if (!result.success) {
      logger.error(
        `Unable to parse purpose item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );
      throw genericError("Unable to parse purpose item");
    }
    return result.data;
  }
}

async function getEService(
  eservices: EServiceCollection,
  filter: Filter<WithId<WithMetadata<EServiceReadModel>>>
): Promise<EService | undefined> {
  const data = await eservices.findOne(filter, {
    projection: { data: true },
  });
  if (!data) {
    return undefined;
  } else {
    const result = EService.safeParse(data.data);
    if (!result.success) {
      logger.error(
        `Unable to parse eService item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );
      throw genericError("Unable to parse eService item");
    }
    return result.data;
  }
}

async function getTenant(
  tenants: TenantCollection,
  filter: Filter<WithId<WithMetadata<Tenant>>>
): Promise<Tenant | undefined> {
  const data = await tenants.findOne(filter, {
    projection: { data: true },
  });
  if (!data) {
    return undefined;
  } else {
    const result = Tenant.safeParse(data.data);
    if (!result.success) {
      logger.error(
        `Unable to parse tenant item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );
      throw genericError("Unable to parse tenant item");
    }
    return result.data;
  }
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilder(
  readModelRepository: ReadModelRepository
) {
  const { eservices, purposes, tenants, agreements } = readModelRepository;

  return {
    async getEServiceById(id: EServiceId): Promise<EService | undefined> {
      return getEService(eservices, { "data.id": id });
    },
    async getTenantById(id: TenantId): Promise<Tenant | undefined> {
      return getTenant(tenants, { "data.id": id });
    },
    async getPurposeById(
      id: PurposeId
    ): Promise<WithMetadata<Purpose> | undefined> {
      return getPurpose(purposes, { "data.id": id });
    },
    async getAllAgreements(
      agreements: AgreementCollection,
      filters: AgreementQueryFilters
    ): Promise<Agreement[]> {
      return getAllAgreementsConst(agreements, filters);
    },
    async getPurposes(
      filters: ApiGetPurposesFilters,
      offset: number,
      limit: number
    ): Promise<ListResult<Purpose>> {
      const {
        name,
        eservicesIds,
        consumersIds,
        producersIds,
        states,
        excludeDraft,
      } = filters;

      const nameFilter: ReadModelFilter<Purpose> = name
        ? {
            "data.title": {
              $regex: ReadModelRepository.escapeRegExp(name),
              $options: "i",
            },
          }
        : {};

      const eservicesIdsFilter: ReadModelFilter<Purpose> =
        ReadModelRepository.arrayToFilter(eservicesIds, {
          "data.eserviceId": { $in: eservicesIds },
        });

      const consumersIdsFilter: ReadModelFilter<Purpose> =
        ReadModelRepository.arrayToFilter(consumersIds, {
          "data.consumerId": { $in: consumersIds },
        });

      const versionStateFilter: ReadModelFilter<Purpose> =
        ReadModelRepository.arrayToFilter(states, {
          "data.versions.state": { $in: states },
        });

      const draftFilter: ReadModelFilter<Purpose> = excludeDraft
        ? {
            $nor: [
              { "data.versions": { $size: 0 } },
              {
                $and: [
                  { "data.versions": { $size: 1 } },
                  {
                    "data.versions.state": {
                      $eq: purposeVersionState.draft,
                    },
                  },
                ],
              },
            ],
          }
        : {};

      const aggregationPipeline = [
        {
          $match: {
            ...nameFilter,
            ...eservicesIdsFilter,
            ...consumersIdsFilter,
            ...versionStateFilter,
            ...draftFilter,
          } satisfies ReadModelFilter<Purpose>,
        },
        ...(producersIds.length > 0
          ? [
              {
                $lookup: {
                  from: "eservices",
                  localField: "data.eserviceId",
                  foreignField: "data.id",
                  as: "eservices",
                },
              },
              { $unwind: "$eservices" },
              {
                $match: {
                  "eservices.data.producerId": { $in: producersIds },
                },
              },
            ]
          : []),
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

      const data = await purposes
        .aggregate([
          ...aggregationPipeline,
          { $skip: offset },
          { $limit: limit },
        ])
        .toArray();

      const result = z.array(Purpose).safeParse(data.map((d) => d.data));
      if (!result.success) {
        logger.error(
          `Unable to parse purposes items: result ${JSON.stringify(
            result
          )} - data ${JSON.stringify(data)} `
        );

        throw genericError("Unable to parse purposes items");
      }

      return {
        results: result.data,
        totalCount: await ReadModelRepository.getTotalCount(
          purposes,
          aggregationPipeline
        ),
      };
    },
  };
}

export type ReadModelService = ReturnType<typeof readModelServiceBuilder>;
