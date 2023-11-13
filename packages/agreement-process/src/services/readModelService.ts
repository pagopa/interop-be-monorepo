/* eslint-disable no-constant-condition */
/* eslint-disable functional/no-let */
/* eslint-disable max-params */
import { logger, ReadModelRepository } from "pagopa-interop-commons";
import {
  Agreement,
  AgreementState,
  ListResult,
  WithMetadata,
  agreementState,
  descriptorState,
  EService,
  Tenant,
  genericError,
} from "pagopa-interop-models";
import { z } from "zod";
import { match, P } from "ts-pattern";
import { config } from "../utilities/config.js";

const { agreements, eservices, tenants } = ReadModelRepository.init(config);

const listAgreementsFilters = (
  eServicesIds: string[],
  consumersIds: string[],
  producersIds: string[],
  descriptorsIds: string[],
  states: AgreementState[],
  showOnlyUpgradeable: boolean
): object => {
  const upgradeableStates = [
    agreementState.draft,
    agreementState.active,
    agreementState.suspended,
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
  agreementStates: AgreementState[],
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
  producerId: string | undefined,
  consumerId: string | undefined,
  eserviceId: string | undefined,
  descriptorId: string | undefined,
  agreementStates: AgreementState[],
  attributeId: string | undefined
): Promise<Agreement[]> => {
  const limit = 50;
  let offset = 0;
  let results: Agreement[] = [];

  while (true) {
    const agreementsChunk = await getAgreements(
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
  producerId: string | undefined,
  consumerId: string | undefined,
  eserviceId: string | undefined,
  descriptorId: string | undefined,
  agreementStates: AgreementState[],
  attributeId: string | undefined,
  offset: number,
  limit: number
): Promise<Agreement[]> => {
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

  const result = z.array(Agreement).safeParse(data);

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

export const readModelService = {
  async listAgreements(
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
      states: AgreementState[];
      showOnlyUpgradeable: boolean;
    },
    limit: number,
    offset: number
  ): Promise<ListResult<Agreement>> {
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

    const data = await agreements
      .aggregate([...aggregationPipeline, { $skip: offset }, { $limit: limit }])
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
        eservices,
        aggregationPipeline
      ),
    };
  },
  async readAgreementById(
    agreementId: string
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
  async getAgreements(
    producerId: string | undefined,
    consumerId: string | undefined,
    eserviceId: string | undefined,
    descriptorId: string | undefined,
    agreementStates: AgreementState[],
    attributeId: string | undefined
  ): Promise<Agreement[]> {
    return getAllAgreements(
      producerId,
      consumerId,
      eserviceId,
      descriptorId,
      agreementStates,
      attributeId
    );
  },
  async getEServiceById(
    id: string
  ): Promise<WithMetadata<EService> | undefined> {
    const data = await eservices.findOne(
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

        throw genericError(`Unable to parse eservice ${id}`);
      }

      return {
        data: result.data.data,
        metadata: { version: result.data.metadata.version },
      };
    }

    return undefined;
  },
  async getTenantById(
    tenantId: string
  ): Promise<WithMetadata<Tenant> | undefined> {
    const data = await tenants.findOne(
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

        throw genericError(`Unable to parse tenant ${tenantId}`);
      }

      return {
        data: result.data.data,
        metadata: { version: result.data.metadata.version },
      };
    }
    return undefined;
  },
};
