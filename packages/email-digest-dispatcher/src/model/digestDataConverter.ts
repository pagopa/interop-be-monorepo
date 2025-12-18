import { TenantId } from "pagopa-interop-models";
import { BaseDigest } from "../services/digestDataService.js";
import {
  NewEservice,
  NewEserviceTemplate,
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
