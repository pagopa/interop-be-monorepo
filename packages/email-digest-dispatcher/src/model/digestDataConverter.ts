import { TenantId } from "pagopa-interop-models";
import { BaseDigest } from "../services/digestDataService.js";
import {
  NewEservice,
  NewEserviceTemplate,
  PopularEserviceTemplate,
  ReadModelService,
} from "../services/readModelService.js";

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

  const enrichedItems = await enrichWithProducerNames(
    data.map((item) => ({
      ...item,
      entityProducerId: getProducerId(item),
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
