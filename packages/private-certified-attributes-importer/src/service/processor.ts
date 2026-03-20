/* eslint-disable no-await-in-loop */
import {
  Logger,
  RefreshableInteropToken,
  InteropHeaders,
} from "pagopa-interop-commons";
import {
  CorrelationId,
  Tenant,
  TenantAttribute,
  Attribute,
  tenantAttributeType,
  SCP,
} from "pagopa-interop-models";
import { InteropContext } from "../model/interopContextModel.js";
import { bootstrapRegistryAttributes } from "./attributeService.js";
import { InteropClients } from "../client/client.js";
import { ReadModelServiceSQL } from "./readModelService.js";

const INFOCAMERE_ORIGIN_PREFIX = "PDND_INFOCAMERE";

export async function importAttributes(
  readModel: ReadModelServiceSQL,
  clients: InteropClients,
  refreshableToken: RefreshableInteropToken,
  logger: Logger,
  headers: InteropHeaders,
  correlationId: CorrelationId
): Promise<void> {
  logger.info("Resolving Registry Imprese attributes from Read Model...");

  const registryAttributes = await bootstrapRegistryAttributes(
    readModel,
    clients.attributeRegistryClient,
    logger,
    headers
  );

  const attributeIds = [
    registryAttributes.adesione.id,
    registryAttributes.scp.id,
  ];

  logger.info("Syncing Registry Imprese certified attributes started");

  const infocamereTenants = await readModel.getTenantsByOriginPrefix(
    INFOCAMERE_ORIGIN_PREFIX
  );
  const alreadyAssignedTenants =
    await readModel.getTenantsWithAttributes(attributeIds);

  const tenantsToProcess = mergeTenants(
    infocamereTenants,
    alreadyAssignedTenants
  );

  for (const tenant of tenantsToProcess) {
    const isInfocamere = tenant.externalId.origin.startsWith(
      INFOCAMERE_ORIGIN_PREFIX
    );
    const isSCP = isInfocamere && tenant.selfcareInstitutionType === SCP;

    await syncAttribute(
      tenant,
      registryAttributes.adesione,
      isInfocamere,
      clients.tenantProcessClient,
      refreshableToken,
      logger,
      correlationId
    );

    await syncAttribute(
      tenant,
      registryAttributes.scp,
      isSCP,
      clients.tenantProcessClient,
      refreshableToken,
      logger,
      correlationId
    );
  }

  logger.info("Registry Imprese synchronization completed");
}

async function syncAttribute(
  tenant: Tenant,
  attribute: Attribute,
  shouldHave: boolean,
  tenantProcess: InteropClients["tenantProcessClient"],
  refreshableToken: RefreshableInteropToken,
  logger: Logger,
  correlationId: CorrelationId
): Promise<void> {
  const hasAttribute = tenant.attributes.some(
    (attr: TenantAttribute) =>
      attr.type === tenantAttributeType.CERTIFIED && attr.id === attribute.id
  );

  const token = await refreshableToken.get();
  const context: InteropContext = {
    correlationId,
    bearerToken: token.serialized,
  };

  if (shouldHave && !hasAttribute) {
    logger.info(
      `Assigning attribute ${attribute.name} (${attribute.id}) to tenant ${tenant.id}`
    );
    await tenantProcess.internalAssignCertifiedAttribute(undefined, {
      params: {
        tOrigin: tenant.externalId.origin,
        tExternalId: tenant.externalId.value,
        aOrigin: attribute.origin!,
        aExternalId: attribute.code!,
      },
      headers: {
        "X-Correlation-Id": context.correlationId,
        Authorization: `Bearer ${context.bearerToken}`,
        "Content-Type": false,
      },
    });
    await pollReadModel();
  } else if (!shouldHave && hasAttribute) {
    logger.info(
      `Revoking attribute ${attribute.name} (${attribute.id}) from tenant ${tenant.id}`
    );
    await tenantProcess.internalRevokeCertifiedAttribute(undefined, {
      params: {
        tOrigin: tenant.externalId.origin,
        tExternalId: tenant.externalId.value,
        aOrigin: attribute.origin!,
        aExternalId: attribute.code!,
      },
      headers: {
        "X-Correlation-Id": context.correlationId,
        Authorization: `Bearer ${context.bearerToken}`,
        "Content-Type": false,
      },
    });
    await pollReadModel();
  }
}

function mergeTenants(listA: Tenant[], listB: Tenant[]): Tenant[] {
  const map = new Map<string, Tenant>();
  [...listA, ...listB].forEach((t) => map.set(t.id, t));
  return Array.from(map.values());
}

async function pollReadModel(): Promise<void> {
  // TODO
}
