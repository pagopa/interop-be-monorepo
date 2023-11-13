/* eslint-disable no-constant-condition */
/* eslint-disable functional/no-let */
/* eslint-disable max-params */
import {
  AgreementCollection,
  EServiceCollection,
  logger,
  ReadModelRepository,
  TenantCollection,
} from "pagopa-interop-commons";
import {
  EService,
  ErrorTypes,
  ListResult,
  PersistentAgreement,
  PersistentAgreementState,
  WithMetadata,
  Tenant,
  persistentAgreementState,
  descriptorState,
} from "pagopa-interop-models";
import { z } from "zod";
import { match, P } from "ts-pattern";
import { config } from "../utilities/config.js";

const listAgreementsFilters = (
  eServicesIds: string[],
  consumersIds: string[],
  producersIds: string[],
  descriptorsIds: string[],
  states: PersistentAgreementState[],
  showOnlyUpgradeable: boolean
): object => {
  const upgradeableStates = [
    persistentAgreementState.draft,
    persistentAgreementState.active,
    persistentAgreementState.suspended,
  ];
  match(states)
    .with(
      P.when((states) => states.length === 0 && showOnlyUpgradeable),
      () => upgradeableStates
    )
    .with(
      P.when((states) => states.length > 0 && showOnlyUpgradeable),
      () =>
        upgradeableStates.filter(
          (s1) => states.some((s2) => s1 === s2) !== undefined
        )
    )
    .otherwise(() => states);

  const filters = {
    ...(eServicesIds.length > 0 && {
      "data.eserviceId": { $in: eServicesIds },
    }),
    ...(consumersIds.length > 0 && {
      "data.consumerId": { $in: consumersIds },
    }),
    ...(producersIds.length > 0 && {
      "data.producerId": { $in: producersIds },
    }),
    ...(descriptorsIds.length > 0 && {
      "data.descriptorId": { $in: descriptorsIds },
    }),
    ...(states.length > 0 && {
      "data.state": {
        $in: states,
      },
    }),
  };

  return { $match: filters };
};

const getAgreementsFilters = (
  producerId: string | undefined,
  consumerId: string | undefined,
  eserviceId: string | undefined,
  descriptorId: string | undefined,
  agreementStates: PersistentAgreementState[],
  attributeId: string | undefined
): object => {
  const filters = {
    ...(producerId && { "data.producerId": producerId }),
    ...(consumerId && { "data.consumerId": consumerId }),
    ...(eserviceId && { "data.eserviceId": eserviceId }),
    ...(descriptorId && { "data.descriptorId": descriptorId }),
    ...(agreementStates.length > 0 && {
      "data.state": {
        $in: agreementStates.map((s) => s.toString()),
      },
    }),
    ...(attributeId && {
      $or: [
        { "data.certifiedAttributes": { $elemMatch: { id: attributeId } } },
        { "data.declaredAttributes": { $elemMatch: { id: attributeId } } },
        { "data.verifiedAttributes": { $elemMatch: { id: attributeId } } },
      ],
    }),
  };
  return { $match: filters };
};

const getAllAgreements = async (
  agreements: AgreementCollection,
  producerId: string | undefined,
  consumerId: string | undefined,
  eserviceId: string | undefined,
  descriptorId: string | undefined,
  agreementStates: PersistentAgreementState[],
  attributeId: string | undefined
): Promise<PersistentAgreement[]> => {
  const limit = 50;
  let offset = 0;
  let results: PersistentAgreement[] = [];

  while (true) {
    const agreementsChunk = await getAgreements(
      agreements,
      producerId,
      consumerId,
      eserviceId,
      descriptorId,
      agreementStates,
      attributeId,
      offset,
      limit
    );

    results = results.concat(agreementsChunk);

    if (agreementsChunk.length < limit) {
      break;
    }

    offset += limit;
  }

  return results;
};

const getAgreements = async (
  agreements: AgreementCollection,
  producerId: string | undefined,
  consumerId: string | undefined,
  eserviceId: string | undefined,
  descriptorId: string | undefined,
  agreementStates: PersistentAgreementState[],
  attributeId: string | undefined,
  offset: number,
  limit: number
): Promise<PersistentAgreement[]> => {
  const data = await agreements
    .aggregate([
      getAgreementsFilters(
        producerId,
        consumerId,
        eserviceId,
        descriptorId,
        agreementStates,
        attributeId
      ),
      { $skip: offset },
      { $limit: limit },
    ])
    .toArray();

  const result = z.array(PersistentAgreement).safeParse(data);

  if (!result.success) {
    logger.error(
      `Unable to parse agreements items: result ${JSON.stringify(
        result
      )} - data ${JSON.stringify(data)} `
    );
    throw ErrorTypes.GenericError;
  }

  return result.data;
};

export class ReadModelService {
  private agreements: AgreementCollection;
  private eservices: EServiceCollection;
  private tenants: TenantCollection;

  constructor(
    agreements?: AgreementCollection,
    eservices?: EServiceCollection,
    tenants?: TenantCollection
  ) {
    this.agreements = agreements || ReadModelRepository.init(config).agreements;
    this.eservices = eservices || ReadModelRepository.init(config).eservices;
    this.tenants = tenants || ReadModelRepository.init(config).tenants;
  }

  public async listAgreements(
    {
      eServicesIds,
      consumersIds,
      producersIds,
      descriptorsIds,
      states,
      showOnlyUpgradeable,
    }: {
      eServicesIds: string[];
      consumersIds: string[];
      producersIds: string[];
      descriptorsIds: string[];
      states: PersistentAgreementState[];
      showOnlyUpgradeable: boolean;
    },
    limit: number,
    offset: number
  ): Promise<ListResult<PersistentAgreement>> {
    const aggregationPipeline = [
      listAgreementsFilters(
        eServicesIds,
        consumersIds,
        producersIds,
        descriptorsIds,
        states,
        showOnlyUpgradeable
      ),
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
      ...(showOnlyUpgradeable
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
                            "$$upgradable.activatedAt",
                            "$currentDescriptor.activatedAt",
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

    const data = await this.agreements
      .aggregate([...aggregationPipeline, { $skip: offset }, { $limit: limit }])
      .toArray();

    const result = z
      .array(PersistentAgreement)
      .safeParse(data.map((d) => d.data));
    if (!result.success) {
      logger.error(
        `Unable to parse agreements items: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );

      throw ErrorTypes.GenericError;
    }

    return {
      results: result.data,
      totalCount: await ReadModelRepository.getTotalCount(
        this.eservices,
        aggregationPipeline
      ),
    };
  }

  public async readAgreementById(
    agreementId: string
  ): Promise<WithMetadata<PersistentAgreement> | undefined> {
    const data = await this.agreements.findOne(
      { "data.id": agreementId },
      { projection: { data: true, metadata: true } }
    );

    if (data) {
      const result = z
        .object({
          data: PersistentAgreement,
          metadata: z.object({ version: z.number() }),
        })
        .safeParse(data);
      if (!result.success) {
        logger.error(`Agreement ${agreementId} not found`);
        throw ErrorTypes.GenericError;
      }
      return {
        data: result.data.data,
        metadata: { version: result.data.metadata.version },
      };
    }

    return undefined;
  }

  public async getAgreements(
    producerId: string | undefined,
    consumerId: string | undefined,
    eserviceId: string | undefined,
    descriptorId: string | undefined,
    agreementStates: PersistentAgreementState[],
    attributeId: string | undefined
  ): Promise<PersistentAgreement[]> {
    return getAllAgreements(
      this.agreements,
      producerId,
      consumerId,
      eserviceId,
      descriptorId,
      agreementStates,
      attributeId
    );
  }

  public async getEServiceById(
    id: string
  ): Promise<WithMetadata<EService> | undefined> {
    const data = await this.eservices.findOne(
      { "data.id": id },
      { projection: { data: true, metadata: true } }
    );

    if (data) {
      const result = z
        .object({
          metadata: z.object({ version: z.number() }),
          data: EService,
        })
        .safeParse(data);

      if (!result.success) {
        logger.error(
          `Unable to parse eservices item: result ${JSON.stringify(
            result
          )} - data ${JSON.stringify(data)} `
        );

        throw ErrorTypes.GenericError;
      }

      return {
        data: result.data.data,
        metadata: { version: result.data.metadata.version },
      };
    }

    return undefined;
  }

  public async getTenantById(
    tenantId: string
  ): Promise<WithMetadata<Tenant> | undefined> {
    const data = await this.tenants.findOne(
      { "data.id": tenantId },
      { projection: { data: true, metadata: true } }
    );

    if (data) {
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

        throw ErrorTypes.GenericError;
      }

      return {
        data: result.data.data,
        metadata: { version: result.data.metadata.version },
      };
    }
    return undefined;
  }
}
