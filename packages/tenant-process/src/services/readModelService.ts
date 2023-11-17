/* eslint-disable @typescript-eslint/no-unused-vars */
import { logger, ReadModelRepository } from "pagopa-interop-commons";
import {
  ErrorTypes,
  WithMetadata,
  Tenant,
  TenantAttribute,
  Attribute,
  ExternalId,
  AttributeNotFound,
  AgreementState,
  Agreement,
  ListResult,
  EService,
} from "pagopa-interop-models";
import { z } from "zod";
import { config } from "../utilities/config.js";

const { tenants, attributes, agreements, eservices } =
  ReadModelRepository.init(config);

async function listAgreements({
  consumerId,
  producerId,
  states,
}: {
  consumerId: string;
  producerId: string;
  states: AgreementState[];
}): Promise<ListResult<Agreement>> {
  const aggregationPipeline = [
    {
      "data.consumerId": consumerId,
    },
    {
      "data.producerId": producerId,
    },
    {
      ...(states.length > 0 && {
        "data.state": {
          $in: states,
        },
      }),
    },
  ];

  const data = await agreements.aggregate([...aggregationPipeline]).toArray();

  const result = z.array(Agreement).safeParse(data.map((d) => d.data));
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
      eservices,
      aggregationPipeline
    ),
  };
}

async function getAgreements(filters: {
  consumerId: string;
  producerId: string;
  states: AgreementState[];
}): Promise<ListResult<Agreement>> {
  logger.info("Retrieving agreements in tenant process");
  return await listAgreements(filters);
}

async function getEServiceById(
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
}

async function getAttributeByExternalCode(
  code: string,
  origin: string
): Promise<WithMetadata<Attribute>> {
  const data = await attributes.findOne(
    { "data.code": code, "data.origin": origin },
    { projection: { data: true, metadata: true } }
  );

  if (data) {
    const result = z
      .object({
        metadata: z.object({ version: z.number() }),
        data: Attribute,
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
  } else {
    throw AttributeNotFound(`${origin}/${code}`);
  }

  async function assertVerifiedAttributeOperationAllowed(
    producerId: string,
    consumerId: string,
    attributeId: string,
    states: AgreementState[]
  ): Promise<void> {
    const agreements = await getAgreements({ producerId, consumerId, states });
    const descriptorIds = agreements.results.map(
      (agreement) => agreement.descriptorId
    );
    const eServices = await Promise.all(
      agreements.results.map((agreement) => {
        const eService = getEServiceById(agreement.eserviceId);
        if (eService === undefined) {
          throw ErrorTypes.GenericError;
        } else {
          return eService;
        }
      })
    );

    const attributeIds = new Set<string>(
      eServices.flatMap((eService) => {
        if (eService === undefined) {
          throw ErrorTypes.GenericError;
        } else {
          return eService.data.descriptors
            .filter((descriptor) => descriptorIds.includes(descriptor.id))
            .flatMap((descriptor) => descriptor.attributes.verified)
            .flatMap((attributes) =>
              attributes.map((attribute) => attribute.id)
            );
        }
      })
    );

    if (!attributeIds.has(attributeId)) {
      throw ErrorTypes.GenericError;
    } else {
      return Promise.resolve();
    }
  }
}
export const readModelService = {
  async getAttributes(
    attributes: ExternalId[]
  ): Promise<Array<WithMetadata<Attribute>>> {
    const promiseAttribute = attributes.map((attribute) =>
      getAttributeByExternalCode(attribute.origin, attribute.value)
    );
    return Promise.all(promiseAttribute);
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

  async getAttributeById(
    attributeId: string
  ): Promise<WithMetadata<TenantAttribute> | undefined> {
    const data = await tenants.findOne(
      { "data.id": attributeId },
      { projection: { data: true, metadata: true } }
    );

    if (data) {
      const result = z
        .object({
          metadata: z.object({ version: z.number() }),
          data: TenantAttribute,
        })
        .safeParse(data);

      if (!result.success) {
        logger.error(
          `Unable to parse attribute item: result ${JSON.stringify(
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
