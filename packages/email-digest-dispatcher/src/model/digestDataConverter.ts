import { AgreementState, EServiceId, TenantId } from "pagopa-interop-models";
import { AttributeDigest, BaseDigest } from "../services/digestDataService.js";
import {
  NewEservice,
  NewEserviceTemplate,
  PopularEserviceTemplate,
  VerifiedAssignedAttribute,
  VerifiedRevokedAttribute,
  CertifiedAssignedAttribute,
  CertifiedRevokedAttribute,
  ReadModelService,
  ReceivedAgreement,
  SentAgreement,
} from "../services/readModelService.js";

export type VerifiedAttribute =
  | VerifiedAssignedAttribute
  | VerifiedRevokedAttribute;

export type CertifiedAttribute =
  | CertifiedAssignedAttribute
  | CertifiedRevokedAttribute;

const UNKNOWN_NAME = "Unknown";

type EntityWithTenant = {
  tenantId: TenantId;
};

type EntityWithEService = {
  eserviceId: EServiceId;
};

/**
 * Enriches items with tenant names by batching tenant lookups.
 * Can be used for any tenant type (producer, consumer, action performer, etc.)
 */
async function enrichWithTenantNames<T extends EntityWithTenant>(
  items: T[],
  readModelService: ReadModelService
): Promise<Array<T & { tenantName: string }>> {
  if (items.length === 0) {
    return [];
  }

  const uniqueTenantIds = [...new Set(items.map((i) => i.tenantId))];
  const tenantNamesMap = await readModelService.getTenantsByIds(
    uniqueTenantIds
  );
  return items.map((item) => ({
    ...item,
    tenantName: tenantNamesMap.get(item.tenantId) ?? UNKNOWN_NAME,
  }));
}

/**
 * Enriches items with e-service names by batching lookups.
 */
async function enrichWithEServiceNames<T extends EntityWithEService>(
  items: T[],
  readModelService: ReadModelService
): Promise<Array<T & { eserviceName: string }>> {
  if (items.length === 0) {
    return [];
  }

  const uniqueEServiceIds = [...new Set(items.map((i) => i.eserviceId))];
  const eserviceNamesMap = await readModelService.getEServicesByIds(
    uniqueEServiceIds
  );
  return items.map((item) => ({
    ...item,
    eserviceName: eserviceNamesMap.get(item.eserviceId) ?? UNKNOWN_NAME,
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
 * Builds a link for an agreement item.
 * TODO: Replace with actual link composition logic
 */
function buildAgreementLink(): string {
  return "#";
}

/**
 * Common type for template data that can be converted to a digest.
 */
type TemplateDigestData = {
  eserviceTemplateName: string;
  totalCount: number;
};

/**
 * Generic converter for template data into a digest object.
 * Used by both eserviceTemplateToBaseDigest and popularEserviceTemplateToBaseDigest.
 */
async function templateDataToBaseDigest<T extends TemplateDigestData>(
  data: T[],
  readModelService: ReadModelService,
  getProducerId: (item: T) => TenantId
): Promise<BaseDigest> {
  if (data.length === 0) {
    return { items: [], totalCount: 0 };
  }

  const enrichedItems = await enrichWithTenantNames(
    data.map((item) => ({
      ...item,
      tenantId: getProducerId(item),
    })),
    readModelService
  );

  return {
    items: enrichedItems.map((template) => ({
      name: template.eserviceTemplateName,
      producerName: template.tenantName,
      link: buildEserviceTemplateLink(),
    })),
    totalCount: data[0].totalCount,
  };
}

/**
 * Transforms readmodel e-service template data into a digest object.
 */
export async function eserviceTemplateToBaseDigest(
  data: NewEserviceTemplate[],
  readModelService: ReadModelService
): Promise<BaseDigest> {
  return templateDataToBaseDigest(
    data,
    readModelService,
    (item) => item.eserviceTemplateProducerId
  );
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

  const enrichedItems = await enrichWithTenantNames(
    data.map((item) => ({
      ...item,
      tenantId: item.eserviceProducerId,
    })),
    readModelService
  );

  return {
    items: enrichedItems.map((eservice) => ({
      name: eservice.eserviceName,
      producerName: eservice.tenantName,
      link: buildEserviceLink(),
    })),
    totalCount: data[0].totalCount,
  };
}

/**
 * Transforms popular e-service template data into a digest object.
 */
export async function popularEserviceTemplateToBaseDigest(
  data: PopularEserviceTemplate[],
  readModelService: ReadModelService
): Promise<BaseDigest> {
  return templateDataToBaseDigest(
    data,
    readModelService,
    (item) => item.eserviceTemplateCreatorId
  );
}

/**
 * Common type for agreements that can be converted to digest
 */
type AgreementWithIds = EntityWithEService & {
  consumerId: TenantId;
  producerId: TenantId;
  totalCount: number;
};

/**
 * Transforms agreements to BaseDigest with e-service names and tenant names.
 *
 * @param data - Agreement data to transform
 * @param getTenantId - Function to extract the relevant tenant ID (producer or consumer)
 * @param readModelService - Service for fetching names
 */
async function agreementsToBaseDigest<T extends AgreementWithIds>(
  data: T[],
  getTenantId: (agreement: T) => TenantId,
  readModelService: ReadModelService
): Promise<BaseDigest> {
  if (data.length === 0) {
    return { items: [], totalCount: 0 };
  }

  // Enrich with e-service names
  const withEServiceNames = await enrichWithEServiceNames(
    data,
    readModelService
  );

  // Get tenant names (the entity that performed the action or created the request)
  const uniqueTenantIds = [...new Set(data.map(getTenantId))];
  const tenantNamesMap = await readModelService.getTenantsByIds(
    uniqueTenantIds
  );

  return {
    items: withEServiceNames.map((agreement) => ({
      name: agreement.eserviceName,
      producerName: tenantNamesMap.get(getTenantId(agreement)) ?? UNKNOWN_NAME,
      link: buildAgreementLink(),
    })),
    totalCount: data[0].totalCount,
  };
}

/**
 * Filters sent agreements by state and transforms to BaseDigest.
 * Sent agreements are in accepted/rejected/suspended states.
 * Shows e-service name and producer name (who performed the action: accepted/rejected/suspended).
 *
 * @param data - Sent agreement data to filter and transform
 * @param state - The agreement state to filter by
 * @param readModelService - Service for fetching tenant and e-service names
 */
export async function sentAgreementsToBaseDigest(
  data: SentAgreement[],
  state: AgreementState,
  readModelService: ReadModelService
): Promise<BaseDigest> {
  const filteredData = data.filter((a) => a.state === state);
  return agreementsToBaseDigest(
    filteredData,
    (agreement) => agreement.producerId,
    readModelService
  );
}

/**
 * Transforms received agreements to BaseDigest.
 * Received agreements are in waiting for approval state.
 * Shows e-service name and consumer name (who created the request).
 *
 * @param data - Received agreement data to transform
 * @param readModelService - Service for fetching tenant and e-service names
 */
export async function receivedAgreementsToBaseDigest(
  data: ReceivedAgreement[],
  readModelService: ReadModelService
): Promise<BaseDigest> {
  return agreementsToBaseDigest(
    data,
    (agreement) => agreement.consumerId,
    readModelService
  );
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

  const enrichedItems = await enrichWithTenantNames(
    data.map((item) => ({
      ...item,
      tenantId: item.actionPerformer,
    })),
    readModelService
  );

  return {
    items: enrichedItems.map((attr) => ({
      name: attr.attributeName,
      producerName: attr.tenantName,
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
