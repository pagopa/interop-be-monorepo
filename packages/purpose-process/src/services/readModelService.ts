import {
  logger,
  ReadModelRepository,
  EServiceCollection,
  TenantCollection,
  AttributeCollection,
  PurposeCollection,
} from "pagopa-interop-commons";
import {
  EService,
  genericError,
  WithMetadata,
  EServiceId,
  TenantId,
  Tenant,
  EServiceReadModel,
  Attribute,
  AttributeReadmodel,
  AttributeId,
  Purpose,
} from "pagopa-interop-models";
import { Filter, WithId } from "mongodb";
import { z } from "zod";

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
        `Unable to parse eService item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );
      throw genericError("Unable to parse eService item");
    }
    return result.data;
  }
}

async function getEService(
  eservices: EServiceCollection,
  filter: Filter<WithId<WithMetadata<EServiceReadModel>>>
): Promise<EService | undefined> {
  const data = await eservices.findOne(filter, {
    projection: { data: true, metadata: true },
  });
  if (!data) {
    return undefined;
  } else {
    const result = EService.safeParse(data);
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
    const result = Attribute.safeParse(data);
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
    projection: { data: true, metadata: true },
  });
  if (!data) {
    return undefined;
  } else {
    const result = Tenant.safeParse(data);
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

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilder(
  readModelRepository: ReadModelRepository
) {
  const { attributes, eservices, purposes, tenants } = readModelRepository;

  return {
    async getEServiceById(id: EServiceId): Promise<EService | undefined> {
      return getEService(eservices, { "data.id": id });
    },
    async getAttributeById(id: AttributeId): Promise<Attribute | undefined> {
      return getAttribute(attributes, { "data.id": id });
    },
    async getTenantById(id: TenantId): Promise<Tenant | undefined> {
      return getTenant(tenants, { "data.id": id });
    },
    async getPurposeById(
      id: TenantId
    ): Promise<WithMetadata<Purpose> | undefined> {
      return getPurpose(purposes, { "data.id": id });
    },
  };
}

export type ReadModelService = ReturnType<typeof readModelServiceBuilder>;
