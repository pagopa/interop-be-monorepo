/* eslint-disable no-await-in-loop */
/* eslint-disable @typescript-eslint/no-non-null-assertion */

import {
  Logger,
  RefreshableInteropToken,
  InteropHeaders,
  waitForReadModelMetadataVersion,
} from "pagopa-interop-commons";
import {
  CorrelationId,
  Tenant,
  TenantAttribute,
  Attribute,
  tenantAttributeType,
  SCP,
} from "pagopa-interop-models";
import { bootstrapRegistryAttributes } from "./attributeService.js";
import { InteropClients } from "../client/client.js";
import { ReadModelServiceSQL } from "./readModelService.js";
import { config } from "../config/config.js";

const INFOCAMERE_ORIGIN_PREFIX = "PDND_INFOCAMERE";

type SyncAttributeParams = {
  tenant: Tenant;
  attribute: Attribute;
  shouldHave: boolean;
  tenantProcess: InteropClients["tenantProcessClient"];
  refreshableToken: RefreshableInteropToken;
  logger: Logger;
  correlationId: CorrelationId;
  readModel: ReadModelServiceSQL;
  pollingConfig: {
    defaultPollingMaxRetries: number;
    defaultPollingRetryDelay: number;
  };
};

export async function importAttributes(
  readModel: ReadModelServiceSQL,
  clients: InteropClients,
  refreshableToken: RefreshableInteropToken,
  logger: Logger,
  headers: InteropHeaders,
  correlationId: CorrelationId
): Promise<void> {
  logger.info("Resolving Registro Imprese attributes from Read Model...");

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

  logger.info(
    `Syncing Registro Imprese certified attributes started for ${attributeIds.length} attributes`
  );

  const infocamereTenants = await readModel.getTenantsByOriginPrefix(
    INFOCAMERE_ORIGIN_PREFIX
  );
  const alreadyAssignedTenants =
    await readModel.getTenantsWithAttributes(attributeIds);

  const tenantsToProcess = mergeTenants(
    infocamereTenants,
    alreadyAssignedTenants
  );

  logger.info(
    `Found ${infocamereTenants.length} InfoCamere tenants and ${alreadyAssignedTenants.length} tenants with existing attributes. Total unique tenants to process: ${tenantsToProcess.length}`
  );

  const pollingConfig = {
    defaultPollingMaxRetries: config.defaultPollingMaxRetries,
    defaultPollingRetryDelay: config.defaultPollingRetryDelay,
  };

  for (const tenant of tenantsToProcess) {
    const isInfocamere = tenant.externalId.origin.startsWith(
      INFOCAMERE_ORIGIN_PREFIX
    );
    const isSCP = isInfocamere && tenant.selfcareInstitutionType === SCP;

    logger.debug(
      `Processing tenant ${tenant.id} (${tenant.externalId.origin}/${tenant.externalId.value}) - isInfocamere: ${isInfocamere}, isSCP: ${isSCP}`
    );

    await syncAttribute({
      tenant,
      attribute: registryAttributes.adesione,
      shouldHave: isInfocamere,
      tenantProcess: clients.tenantProcessClient,
      refreshableToken,
      logger,
      correlationId,
      readModel,
      pollingConfig,
    });

    await syncAttribute({
      tenant,
      attribute: registryAttributes.scp,
      shouldHave: isSCP,
      tenantProcess: clients.tenantProcessClient,
      refreshableToken,
      logger,
      correlationId,
      readModel,
      pollingConfig,
    });
  }

  logger.info("Registro Imprese synchronization completed");
}

async function syncAttribute({
  tenant,
  attribute,
  shouldHave,
  tenantProcess,
  refreshableToken,
  logger,
  correlationId,
  readModel,
  pollingConfig,
}: SyncAttributeParams): Promise<void> {
  const hasAttribute = tenant.attributes.some(
    (attr: TenantAttribute) =>
      attr.type === tenantAttributeType.CERTIFIED && attr.id === attribute.id
  );

  if (shouldHave === hasAttribute) {
    logger.debug(
      `Skipping attribute ${attribute.name} for tenant ${tenant.id}: state already correct (shouldHave: ${shouldHave})`
    );
    return;
  }

  const token = await refreshableToken.get();
  const context = {
    correlationId,
    bearerToken: token.serialized,
  };

  const currentTenant = await readModel.getTenantByIdWithMetadata(tenant.id);
  if (!currentTenant) {
    logger.warn(
      `Tenant ${tenant.id} not found in ReadModel during syncAttribute`
    );
    return;
  }

  const targetVersion = currentTenant.metadata.version + 1;

  try {
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
    }

    logger.debug(
      `Waiting for ReadModel version ${targetVersion} for tenant ${tenant.id}...`
    );
    await waitForReadModelMetadataVersion(
      () => readModel.getTenantByIdWithMetadata(tenant.id),
      targetVersion,
      pollingConfig
    );
  } catch (error) {
    logger.error(
      `Error syncing attribute ${attribute.name} for tenant ${tenant.id}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    throw error;
  }
}

function mergeTenants(listA: Tenant[], listB: Tenant[]): Tenant[] {
  const map = new Map<string, Tenant>();
  [...listA, ...listB].forEach((t) => map.set(t.id, t));
  return Array.from(map.values());
}
