import { TenantId } from "pagopa-interop-models";
import { AttributeDigest, BaseDigest } from "../services/digestDataService.js";
import {
  NewEservice,
  NewEserviceTemplate,
  VerifiedAssignedAttribute,
  VerifiedRevokedAttribute,
  CertifiedAssignedAttribute,
  CertifiedRevokedAttribute,
  ReadModelService,
} from "../services/readModelService.js";

export type VerifiedAttribute =
  | VerifiedAssignedAttribute
  | VerifiedRevokedAttribute;

export type CertifiedAttribute =
  | CertifiedAssignedAttribute
  | CertifiedRevokedAttribute;

const UNKNOWN_PRODUCER_NAME = "Unknown";

type EntityWithProducer = {
  entityProducerId: TenantId;
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
 * Transforms verified attribute data (assigned or revoked) into an AttributeDigest object.
 * Works with both VerifiedAssignedAttribute and VerifiedRevokedAttribute since they share
 * the same structure with actionPerformer field.
 */
export async function verifiedAttributeToDigest(
  data: VerifiedAttribute[],
  readModelService: ReadModelService
): Promise<AttributeDigest> {
  if (data.length === 0) {
    return { items: [], totalCount: 0 };
  }

  const enrichedItems = await enrichWithProducerNames(
    data.map((item) => ({
      ...item,
      entityProducerId: item.actionPerformer,
    })),
    readModelService
  );

  return {
    items: enrichedItems.map((attr) => ({
      name: attr.attributeName,
      producerName: attr.entityProducerName,
      link: buildAttributeLink(),
      attributeKind: "verified" as const,
    })),
    totalCount: data[0].totalCount,
  };
}

/**
 * Transforms certified attribute data into an AttributeDigest object.
 * Certified attributes don't have a producer/verifier, so producerName is empty.
 */
export function certifiedAttributeToDigest(
  data: CertifiedAttribute[]
): AttributeDigest {
  if (data.length === 0) {
    return { items: [], totalCount: 0 };
  }

  return {
    items: data.map((attr) => ({
      name: attr.attributeName,
      producerName: "", // Certified attributes don't have a verifier/assigner
      link: buildAttributeLink(),
      attributeKind: "certified" as const,
    })),
    totalCount: data[0].totalCount,
  };
}

/**
 * Combines verified and certified attributes into a single AttributeDigest.
 * Limits the total to 5 items.
 */
export function combineAttributeDigests(
  verifiedDigest: AttributeDigest,
  certifiedDigest: AttributeDigest
): AttributeDigest {
  const combinedItems = [
    ...verifiedDigest.items,
    ...certifiedDigest.items,
  ].slice(0, 5);
  const totalCount = verifiedDigest.totalCount + certifiedDigest.totalCount;

  return {
    items: combinedItems,
    totalCount,
  };
}
