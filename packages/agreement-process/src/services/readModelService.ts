/* eslint-disable max-params */
import { logger, ReadModelRepository } from "pagopa-interop-commons";
import {
  EService,
  ErrorTypes,
  PersistentAgreement,
  PersistentAgreementState,
  WithMetadata,
  Tenant,
} from "pagopa-interop-models";
import { z } from "zod";
import { config } from "../utilities/config.js";

const { agreements, eservices, tenants } = ReadModelRepository.init(config);

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
        { "data.certifiedAttributes.id": { $elemMatch: { id: attributeId } } },
        { "data.declaredAttributes.id": { $elemMatch: { id: attributeId } } },
        { "data.verifiedAttributes.id": { $elemMatch: { id: attributeId } } },
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
  agreementStates: PersistentAgreementState[],
  attributeId: string | undefined
): Promise<PersistentAgreement[]> =>
  /* TODO: (Viktor-K) this method is partially implemented, it should be completed with a pagination mechanism TBD
  folding more chunks in this list in the same way of https://github.com/pagopa/interop-be-agreement-process/blob/66781549a6db2470d8c407965b7561d1fe493107/src/main/scala/it/pagopa/interop/agreementprocess/service/impl/AgreementManagementServiceImpl.scala#L78
  */
  await getAgreements(
    producerId,
    consumerId,
    eserviceId,
    descriptorId,
    agreementStates,
    attributeId,
    0,
    50
  );

const getAgreements = async (
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
      `Unable to parse eservices items: result ${JSON.stringify(
        result
      )} - data ${JSON.stringify(data)} `
    );
    throw ErrorTypes.GenericError;
  }

  return result.data;
};

export const readModelService = {
  async readAgreementById(
    agreementId: string
  ): Promise<WithMetadata<PersistentAgreement> | undefined> {
    const data = await agreements.findOne(
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
  },
  async getAgreements(
    producerId: string | undefined,
    consumerId: string | undefined,
    eserviceId: string | undefined,
    descriptorId: string | undefined,
    agreementStates: PersistentAgreementState[],
    attributeId: string | undefined
  ): Promise<PersistentAgreement[]> {
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

        throw ErrorTypes.GenericError;
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

        throw ErrorTypes.GenericError;
      }

      return {
        data: result.data.data,
        metadata: { version: result.data.metadata.version },
      };
    }
    return undefined;
  },
};
