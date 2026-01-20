import { TenantId } from "pagopa-interop-models";
import { AttributeDigest, BaseDigest } from "../services/digestDataService.js";
import {
  NewEservice,
  NewEserviceTemplate,
  VerifiedAttribute,
  RevokedAttribute,
  ReadModelService,
} from "../services/readModelService.js";

const UNKNOWN_PRODUCER_NAME = "Unknown";

type EntityWithProducer = {
  entityProducerId: TenantId;
};

type AttributeWithTenantId = {
  attributeName: string;
  tenantId: TenantId;
  totalCount: number;
};

/**
 * Enriches items with producer names by batching tenant lookups.
 */
async function enrichWithProducerNames<T extends EntityWithProducer>(
  items: T[],
  readModelService: ReadModelService
): Promise<Array<T & { entityProducerName: string }>> {
  if (items.length === 0) {
    return [];
  }

  const uniqueProducerIds = [...new Set(items.map((i) => i.entityProducerId))];
  const tenantNamesMap = await readModelService.getTenantsByIds(
    uniqueProducerIds
  );
  return items.map((item) => ({
    ...item,
    entityProducerName:
      tenantNamesMap.get(item.entityProducerId) ?? UNKNOWN_PRODUCER_NAME,
  }));
}

/**
 * Builds a link for an e-service item.
 * TODO: Replace with actual link composition logic
 */
function buildEserviceLink(): string {
  return "#";
}

/**
 * Builds a link for an e-service template item.
 * TODO: Replace with actual link composition logic
 */
function buildEserviceTemplateLink(): string {
  return "#";
}

/**
 * Builds a link for an attribute item.
 * TODO: Replace with actual link composition logic
 */
function buildAttributeLink(): string {
  return "#";
}

/**
 * Transforms readmodel e-service template data into a digest object.
 */
export async function eserviceTemplateToBaseDigest(
  data: NewEserviceTemplate[],
  readModelService: ReadModelService
): Promise<BaseDigest> {
  if (data.length === 0) {
    return { items: [], totalCount: 0 };
  }

  const enrichedItems: Array<
    NewEserviceTemplate & { entityProducerName: string }
  > = await enrichWithProducerNames(
    data.map((item) => ({
      ...item,
      entityProducerId: item.eserviceTemplateProducerId,
    })),
    readModelService
  );

  return {
    items: enrichedItems.map((template) => ({
      name: template.eserviceTemplateName,
      producerName: template.entityProducerName,
      link: buildEserviceTemplateLink(),
    })),
    totalCount: data[0].totalCount,
  };
}

/**
 * Transforms readmodel e-service data into a digest object.
 */
export async function eserviceToBaseDigest(
  data: NewEservice[],
  readModelService: ReadModelService
): Promise<BaseDigest> {
  if (data.length === 0) {
    return { items: [], totalCount: 0 };
  }

  const enrichedItems = await enrichWithProducerNames(
    data.map((item) => ({
      ...item,
      entityProducerId: item.eserviceProducerId,
    })),
    readModelService
  );

  return {
    items: enrichedItems.map((eservice) => ({
      name: eservice.eserviceName,
      producerName: eservice.entityProducerName,
      link: buildEserviceLink(),
    })),
    totalCount: data[0].totalCount,
  };
}

/**
 * Shared helper to transform attribute data into a BaseDigest object.
 */
async function attributeToBaseDigest(
  data: AttributeWithTenantId[],
  readModelService: ReadModelService,
  attributeKind: "verified" | "certified"
): Promise<AttributeDigest> {
  if (data.length === 0) {
    return { items: [], totalCount: 0 };
  }

  const enrichedItems = await enrichWithProducerNames(
    data.map((item) => ({
      ...item,
      entityProducerId: item.tenantId,
    })),
    readModelService
  );

  return {
    items: enrichedItems.map((attr) => ({
      name: attr.attributeName,
      producerName: attr.entityProducerName,
      link: buildAttributeLink(),
      attributeKind,
    })),
    totalCount: data[0].totalCount,
  };
}

/**
 * Transforms readmodel verified attribute data into a BaseDigest object.
 */
export async function verifiedAttributeToBaseDigest(
  data: VerifiedAttribute[],
  readModelService: ReadModelService
): Promise<AttributeDigest> {
  return attributeToBaseDigest(
    data.map((item) => ({
      attributeName: item.attributeName,
      tenantId: item.verifierId,
      totalCount: item.totalCount,
    })),
    readModelService,
    "verified"
  );
}

/**
 * Transforms readmodel revoked attribute data into a BaseDigest object.
 */
export async function revokedAttributeToBaseDigest(
  data: RevokedAttribute[],
  readModelService: ReadModelService
): Promise<AttributeDigest> {
  return attributeToBaseDigest(
    data.map((item) => ({
      attributeName: item.attributeName,
      tenantId: item.revokerId,
      totalCount: item.totalCount,
    })),
    readModelService,
    "verified"
  );
}
