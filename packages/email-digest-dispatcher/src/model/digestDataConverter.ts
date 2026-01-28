import { AgreementState, EServiceId, TenantId } from "pagopa-interop-models";
import {
  AttributeDigest,
  BaseDigest,
  ReceivedPurposeDigest,
import {
  AgreementState,
  DelegationKind,
  DelegationState,
  DescriptorId,
  EServiceId,
  TenantId,
} from "pagopa-interop-models";
import {
  AttributeDigest,
  BaseDigest,
  DelegationDigest,
} from "../services/digestDataService.js";
import {
  buildAgreementLink,
  buildEserviceLink,
  buildPurposeLink,
  buildEserviceTemplateLinkToInstantiator,
  buildEserviceTemplateLinkToCreator,
} from "../services/deeplinkBuilder.js";
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
  SentPurpose,
  SentPurposeState,
  ReceivedPurpose,
  ReceivedPurposeState,
  SentDelegation,
  ReceivedDelegation,
} from "../services/readModelService.js";

// Module-level cache for descriptor IDs to avoid repeated readModelService calls
const descriptorIdCache = new Map<EServiceId, DescriptorId>();

/**
 * Gets the latest published descriptor IDs for e-services, using module-level cache.
 * Only calls readModelService for uncached IDs.
 */
async function getCachedDescriptorIds(
  eserviceIds: EServiceId[],
  readModelService: ReadModelService
): Promise<Map<EServiceId, DescriptorId>> {
  if (eserviceIds.length === 0) {
    return new Map();
  }

  const uncachedIds = eserviceIds.filter((id) => !descriptorIdCache.has(id));
  const cachedEntries: Array<[EServiceId, DescriptorId]> = eserviceIds
    .filter((id) => descriptorIdCache.has(id))
    .map((id) => [id, descriptorIdCache.get(id) as DescriptorId]);

  if (uncachedIds.length > 0) {
    const fetched = await readModelService.getLatestPublishedDescriptorIds(
      uncachedIds
    );
    fetched.forEach((value, key) => {
      descriptorIdCache.set(key, value);
    });
    return new Map([...cachedEntries, ...fetched.entries()]);
  }

  return new Map(cachedEntries);
}

export type VerifiedAttribute =
  | VerifiedAssignedAttribute
  | VerifiedRevokedAttribute;

export type CertifiedAttribute =
  | CertifiedAssignedAttribute
  | CertifiedRevokedAttribute;

const UNKNOWN_NAME = "Unknown";

type EntityWithProducer = {
  entityProducerId: TenantId;
};

type EntityWithEService = {
  eserviceId: EServiceId;
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
      tenantNamesMap.get(item.entityProducerId) ?? UNKNOWN_NAME,
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
 * Common type for template data that can be converted to a digest.
 */
type TemplateDigestData = {
  eserviceTemplateName: string;
  totalCount: number;
};

/**
 * Generic converter for template data into a digest object.
 */
async function templateDataToBaseDigest<
  T extends TemplateDigestData & {
    eserviceTemplateId: string;
    eserviceTemplateVersionId: string;
  }
>(
  data: T[],
  readModelService: ReadModelService,
  getProducerId: (item: T) => TenantId,
  buildLink: (
    eserviceTemplateId: string,
    eserviceTemplateVersionId: string
  ) => string
): Promise<BaseDigest> {
  if (data.length === 0) {
    return { items: [], totalCount: 0 };
  }

  const enrichedItems = await enrichWithProducerNames(
    data.map((item) => ({
      ...item,
      entityProducerId: getProducerId(item),
    })),
    readModelService
  );

  return {
    items: enrichedItems.map((template) => ({
      id: template.eserviceTemplateId,
      name: template.eserviceTemplateName,
      producerName: template.entityProducerName,
      link: buildLink(
        template.eserviceTemplateId,
        template.eserviceTemplateVersionId
      ),
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
    (item) => item.eserviceTemplateProducerId,
    buildEserviceTemplateLinkToCreator
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

  const enrichedItems = await enrichWithProducerNames(
    data.map((item) => ({
      ...item,
      entityProducerId: item.eserviceProducerId,
    })),
    readModelService
  );

  return {
    items: enrichedItems.map((eservice) => ({
      id: eservice.eserviceId,
      name: eservice.eserviceName,
      producerName: eservice.entityProducerName,
      link: buildEserviceLink(
        eservice.eserviceId,
        eservice.eserviceDescriptorId
      ),
    })),
    totalCount: data[0].totalCount,
  };
}

/**
 * Transforms popular e-service template data into a digest object.
 * Note: producerName is not retrieved as the creator is the digest recipient.
 */
export async function popularEserviceTemplateToBaseDigest(
  data: PopularEserviceTemplate[],
  readModelService: ReadModelService
): Promise<BaseDigest> {
  return templateDataToBaseDigest(
    data,
    readModelService,
    (item) => item.eserviceTemplateCreatorId,
    buildEserviceTemplateLinkToInstantiator
  );
}

/**
 * Common type for agreements that can be converted to digest
 */
type AgreementWithIds = EntityWithEService & {
  agreementId: string;
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
      link: buildAgreementLink(
        agreement.agreementId,
        getTenantId(agreement) === agreement.producerId
      ),
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
 * Filters sent purposes by state and transforms to BaseDigest.
 * Sent purposes are in Active/Rejected/WaitingForApproval states.
 * Shows only purpose title (no tenant name needed per Figma design).
 *
 * @param data - Sent purpose data to filter and transform
 * @param state - The purpose version state to filter by
 */
export function sentPurposesToBaseDigest(
  data: SentPurpose[],
  state: SentPurposeState
): BaseDigest {
  const filteredData = data.filter((p) => p.state === state);

  if (filteredData.length === 0) {
    return { items: [], totalCount: 0 };
  }

  return {
    items: filteredData.map((purpose) => ({
      name: purpose.purposeTitle,
      producerName: "",
      link: buildPurposeLink(purpose.purposeId, false),
    })),
    totalCount: filteredData[0].totalCount,
  };
}

/**
 * Filters received purposes by state and transforms to BaseDigest.
 * Received purposes are in Active/WaitingForApproval states.
 * Shows purpose title and consumer name (who created the purpose).
 * Consumer name is already included from the SQL join - no additional DB query needed.
 *
 * @param data - Received purpose data to filter and transform
 * @param state - The purpose version state to filter by
 */
export function receivedPurposesToBaseDigest(
  data: ReceivedPurpose[],
  state: ReceivedPurposeState
): ReceivedPurposeDigest {
  const filteredData = data.filter((p) => p.state === state);

  if (filteredData.length === 0) {
    return { items: [], totalCount: 0 };
  }

  return {
    items: filteredData.map((purpose) => ({
      name: purpose.purposeTitle,
      producerName: purpose.consumerName,
      consumerName: purpose.consumerName,
      link: buildPurposeLink(purpose.purposeId, true),
    })),
    totalCount: filteredData[0].totalCount,
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
      link: "",
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
      link: "#",
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

/**
 * Converts DelegationKind to Italian labels for the digest email.
 * - DelegatedProducer -> "erogazione"
 * - DelegatedConsumer -> "fruizione"
 */
function delegationKindToDigest(
  kind: DelegationKind
): "erogazione" | "fruizione" {
  return kind === "DelegatedProducer" ? "erogazione" : "fruizione";
}

/**
 * Common type for delegation data that can be converted to a digest.
 */
type DelegationWithIds = {
  eserviceId: EServiceId;
  delegationName: string;
  delegationKind: DelegationKind;
  state: DelegationState;
  totalCount: number;
};

/**
 * Transforms delegations to DelegationDigest with tenant names and e-service links.
 *
 * @param data - Delegation data to filter and transform
 * @param state - The delegation state to filter by
 * @param getCounterpartyId - Function to extract the relevant tenant ID (delegate or delegator)
 * @param readModelService - Service for fetching tenant names and descriptor IDs
 */
async function delegationsToDigest<T extends DelegationWithIds>(
  data: T[],
  state: DelegationState,
  getCounterpartyId: (delegation: T) => TenantId,
  readModelService: ReadModelService
): Promise<DelegationDigest> {
  const filteredData = data.filter((d) => d.state === state);

  if (filteredData.length === 0) {
    return { items: [], totalCount: 0 };
  }

  const uniqueCounterpartyIds = [
    ...new Set(filteredData.map(getCounterpartyId)),
  ];
  const tenantNamesMap = await readModelService.getTenantsByIds(
    uniqueCounterpartyIds
  );

  const uniqueEServiceIds = [...new Set(filteredData.map((d) => d.eserviceId))];
  const descriptorIdsMap = await getCachedDescriptorIds(
    uniqueEServiceIds,
    readModelService
  );

  return {
    items: filteredData.map((delegation) => {
      const descriptorId = descriptorIdsMap.get(delegation.eserviceId);
      return {
        name: delegation.delegationName,
        producerName:
          tenantNamesMap.get(getCounterpartyId(delegation)) ?? UNKNOWN_NAME,
        link: descriptorId
          ? buildEserviceLink(delegation.eserviceId, descriptorId)
          : "",
        delegationKind: delegationKindToDigest(delegation.delegationKind),
      };
    }),
    totalCount: filteredData[0].totalCount,
  };
}

/**
 * Filters sent delegations by state and transforms to DelegationDigest.
 * Sent delegations show e-service name with link, and delegate name as producerName.
 *
 * @param data - Sent delegation data to filter and transform
 * @param state - The delegation state to filter by
 * @param readModelService - Service for fetching tenant names and descriptor IDs
 */
export async function sentDelegationsToDigest(
  data: SentDelegation[],
  state: DelegationState,
  readModelService: ReadModelService
): Promise<DelegationDigest> {
  return delegationsToDigest(
    data,
    state,
    (delegation) => delegation.delegateId,
    readModelService
  );
}

/**
 * Filters received delegations by state and transforms to DelegationDigest.
 * Received delegations show e-service name with link, and delegator name as producerName.
 *
 * @param data - Received delegation data to filter and transform
 * @param state - The delegation state to filter by
 * @param readModelService - Service for fetching tenant names and descriptor IDs
 */
export async function receivedDelegationsToDigest(
  data: ReceivedDelegation[],
  state: DelegationState,
  readModelService: ReadModelService
): Promise<DelegationDigest> {
  return delegationsToDigest(
    data,
    state,
    (delegation) => delegation.delegatorId,
    readModelService
  );
}
