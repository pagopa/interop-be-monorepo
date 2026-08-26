import { isAxiosError } from "axios";
import { createHash } from "crypto";
import {
  attributeRegistryApi,
  createZodiosClientEnhancedWithMetadata,
  tenantApi,
  ZodiosClientWithMetadata,
} from "pagopa-interop-api-clients";
import {
  delay,
  InteropHeaders,
  isFeatureFlagEnabled,
  Logger,
  waitForReadModelMetadataVersion,
} from "pagopa-interop-commons";
import {
  Attribute,
  attributeKind,
  ECONOMIC_ACCOUNT_COMPANIES_PUBLIC_SERVICE_IDENTIFIER,
  PUBLIC_ADMINISTRATIONS_IDENTIFIER,
  PUBLIC_SERVICES_MANAGERS,
  Tenant,
  tenantAttributeType,
} from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import { z } from "zod";

import { IPACertifiedAttributesImporterConfig } from "../config/config.js";
import {
  InternalCertifiedAttribute,
  RegistryData,
  shouldKindBeIncluded,
} from "./openDataService.js";
import { ReadModelServiceSQL } from "./readModelServiceSQL.js";

const AGENCY_CLASSIFICATION = "Agency";
const MUNICIPALITY_CODE = "L6";
// Tipologia Gestori di Pubblici Servizi
export const PUBLIC_SERVICES_MANAGERS_TYPOLOGY = "Gestori di Pubblici Servizi";

// Tipologia Società in Conto Economico Consolidato
export const ECONOMIC_ACCOUNT_COMPANIES_TYPOLOGY =
  "Societa' in Conto Economico Consolidato";

type TenantProcessClient = ZodiosClientWithMetadata<
  ReturnType<typeof tenantApi.createInternalApiClient>
>;

type PollingConfig = {
  defaultPollingMaxRetries: number;
  defaultPollingRetryDelay: number;
};

export function createTenantProcessClient(
  tenantProcessUrl: string
): TenantProcessClient {
  return createZodiosClientEnhancedWithMetadata(
    tenantApi.createInternalApiClient,
    tenantProcessUrl
  );
}

export type TenantSeed = {
  origin: string;
  originId: string;
  description: string;
  attributes: Array<{ origin: string; code: string }>;
  istatCode?: string;
};

export function toTenantKey(key: {
  origin: string | undefined;
  value: string | undefined;
}): string {
  return JSON.stringify({ origin: key.origin, value: key.value });
}

export function toAttributeKey(key: {
  origin: string | undefined;
  code: string | undefined;
}): string {
  return JSON.stringify({ origin: key.origin, code: key.code });
}

export const CERTIFIED_ATTRIBUTE_ALREADY_ASSIGNED_CODE = "005-0014";
export const EVENT_CONFLICT_CODE = "005-10034";

type PhaseReport = {
  succeeded: number;
  failed: number;
};

type ImportReport = {
  upserts: PhaseReport;
  revocations: PhaseReport;
  warnings: number;
  skipped: number;
};

type ImportPhase = "upserts" | "revocations";

type ImportState = {
  unsyncedTenants: Set<string>;
  report: ImportReport;
};

export function createImportState(): ImportState {
  return {
    unsyncedTenants: new Set<string>(),
    report: {
      upserts: { succeeded: 0, failed: 0 },
      revocations: { succeeded: 0, failed: 0 },
      warnings: 0,
      skipped: 0,
    },
  };
}

export function formatRunSummary(report: ImportReport): string {
  return `Run summary: upserts ${report.upserts.succeeded} succeeded, ${report.upserts.failed} failed; revocations ${report.revocations.succeeded} succeeded, ${report.revocations.failed} failed; ${report.warnings} warnings, ${report.skipped} skipped`;
}

export function hasFailedOperations(report: ImportReport): boolean {
  return (
    report.upserts.failed > 0 ||
    report.revocations.failed > 0 ||
    report.skipped > 0
  );
}

const ProblemResponse = z.object({
  detail: z.string().optional(),
  errors: z
    .array(z.object({ code: z.string(), detail: z.string().optional() }))
    .optional(),
});

type HttpErrorDetails = {
  status: number | undefined;
  code: string | undefined;
  detail: string | undefined;
};

function extractHttpErrorDetails(error: unknown): HttpErrorDetails {
  if (!isAxiosError(error) || !error.response) {
    return { status: undefined, code: undefined, detail: undefined };
  }

  const problem = ProblemResponse.safeParse(error.response.data);

  return {
    status: error.response.status,
    code: problem.success ? problem.data.errors?.[0]?.code : undefined,
    detail: problem.success ? problem.data.detail : undefined,
  };
}

function isWriteOutcomeUncertain(details: HttpErrorDetails): boolean {
  return details.code !== CERTIFIED_ATTRIBUTE_ALREADY_ASSIGNED_CODE;
}

function isPollingTimeout(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    error.code === "pollingMaxRetriesExceeded"
  );
}

type TenantCommandResult = { metadata?: { version: number } | undefined };
type TenantCommand = () => Promise<TenantCommandResult>;

async function runTenantOperation(params: {
  tenantKey: string;
  phase: ImportPhase;
  description: string;
  startMessage: string;
  command: TenantCommand;
  pollReadModel: (version: number) => Promise<void>;
  loggerInstance: Logger;
  state: ImportState;
}): Promise<void> {
  const {
    tenantKey,
    phase,
    description,
    startMessage,
    command,
    pollReadModel,
    loggerInstance,
    state,
  } = params;

  if (state.unsyncedTenants.has(tenantKey)) {
    loggerInstance.warn(
      `Skipping ${description}: a previous operation left the tenant out of sync`
    );
    state.report.skipped += 1;
    return;
  }

  loggerInstance.info(startMessage);

  let response: TenantCommandResult;
  try {
    response = await command();
  } catch (error: unknown) {
    const details = extractHttpErrorDetails(error);
    loggerInstance.error(
      `Failed ${description}. Status: ${details.status ?? "unknown"}, code: ${
        details.code ?? "unknown"
      }, detail: ${details.detail ?? "unknown"}`
    );
    state.report[phase].failed += 1;

    if (isWriteOutcomeUncertain(details)) {
      state.unsyncedTenants.add(tenantKey);
    }
    return;
  }

  state.report[phase].succeeded += 1;

  const metadata = response.metadata;
  if (!metadata) {
    loggerInstance.warn(
      `Missing metadata version after ${description}. Marking the tenant as out of sync`
    );
    state.report.warnings += 1;
    state.unsyncedTenants.add(tenantKey);
    return;
  }

  try {
    await pollReadModel(metadata.version);
  } catch (error: unknown) {
    if (!isPollingTimeout(error)) {
      throw error;
    }

    loggerInstance.warn(
      `Read model did not reach version ${metadata.version} after ${description}. Marking the tenant as out of sync`
    );
    state.report.warnings += 1;
    state.unsyncedTenants.add(tenantKey);
  }
}

async function checkAttributesPresence(
  readModelService: ReadModelServiceSQL,
  newAttributes: attributeRegistryApi.InternalCertifiedAttributeSeed[]
): Promise<boolean> {
  const attributes = await readModelService.getAttributes();

  const certifiedAttributeIndex = new Map(
    attributes
      .filter((a) => a.kind === attributeKind.certified && a.origin && a.code)
      .map((a) => [toAttributeKey({ origin: a.origin, code: a.code }), a])
  );

  const missingAttributes = newAttributes.filter(
    (i) =>
      !certifiedAttributeIndex.get(
        toAttributeKey({ origin: i.origin, code: i.code })
      )
  );

  return missingAttributes.length === 0;
}

export function getTenantUpsertData(
  registryData: RegistryData,
  platformTenants: Tenant[],
  economicAccountCompaniesAllowlist: string[]
): TenantSeed[] {
  // Create a set of all existing tenant external IDs for quick lookup.
  // This is used to filter out institutions from the registry that don't
  // have a corresponding tenant in the platform.
  const platformTenantsIndex = new Set(
    platformTenants.map((t) => toTenantKey(t.externalId))
  );

  // Filter the full list of institutions from the registry to only include those
  // that are already present as tenants on the platform.
  const institutionsAlreadyPresent = registryData.institutions.filter(
    (i) =>
      i.id.length > 0 &&
      platformTenantsIndex.has(
        toTenantKey({ origin: i.origin, value: i.originId })
      )
  );

  // Map each institution to a "TenantSeed" object, which contains all the attributes
  // that should be assigned to the corresponding tenant in the platform.
  return institutionsAlreadyPresent.map((i) => {
    const attributesWithoutKind = match(i)
      // Agency - SCEC -> Assign institution name attribute only
      .with(
        {
          category: ECONOMIC_ACCOUNT_COMPANIES_PUBLIC_SERVICE_IDENTIFIER,
          classification: AGENCY_CLASSIFICATION,
        },
        () => [
          {
            origin: i.origin,
            code: i.originId,
          },
        ]
      )
      // SCEC - AOO/UO -> Assign nothing
      .with(
        {
          category: ECONOMIC_ACCOUNT_COMPANIES_PUBLIC_SERVICE_IDENTIFIER,
          classification: P.not(AGENCY_CLASSIFICATION),
        },
        () => []
      )
      // Agency - any -> Assign institution name attribute + category attribute
      .with({ classification: AGENCY_CLASSIFICATION }, () => [
        {
          origin: i.origin,
          code: i.category,
        },
        {
          origin: i.origin,
          code: i.originId,
        },
      ])
      // AOO/UO -> Assign category attribute only
      .otherwise(() => [
        {
          origin: i.origin,
          code: i.category,
        },
      ]);

    // This block handles the assignment of the "Gestore di Pubblico Servizio" (GPS) attribute (L37).
    const forcedGPSCategory = match(i)
      .with(
        // 1. If the institution is a traditional Public Services Manager.
        { kind: PUBLIC_SERVICES_MANAGERS_TYPOLOGY },
        // 2. If the institution is a Società in Conto Economico Consolidato (SCEC) from the legacy allowlist (to be removed).
        {
          kind: ECONOMIC_ACCOUNT_COMPANIES_TYPOLOGY,
          originId: P.when((originId) =>
            economicAccountCompaniesAllowlist.includes(originId)
          ),
        },
        // 3. If the institution is a new SCEC with the S01G category from IPA.
        {
          kind: ECONOMIC_ACCOUNT_COMPANIES_TYPOLOGY,
          category: ECONOMIC_ACCOUNT_COMPANIES_PUBLIC_SERVICE_IDENTIFIER,
        },
        () => [
          {
            origin: i.origin,
            code: PUBLIC_SERVICES_MANAGERS,
          },
        ]
      )
      .otherwise(() => []);

    const attributes = [
      // Some kinds (Tipologia) are mapped to specific certified attributes
      ...(shouldKindBeIncluded(i)
        ? [
            {
              origin: i.origin,
              code: createHash("sha256").update(i.kind).digest("hex"),
            },
          ]
        : []),
      ...attributesWithoutKind,
      ...forcedGPSCategory,
    ];

    return {
      origin: i.origin,
      originId: i.originId,
      description: i.description,
      attributes,
      istatCode:
        i.category === MUNICIPALITY_CODE &&
        i.classification === AGENCY_CLASSIFICATION
          ? i.istatCode
          : undefined,
    };
  });
}

export async function createNewAttributes(
  newAttributes: InternalCertifiedAttribute[],
  readModelService: ReadModelServiceSQL,
  headers: InteropHeaders,
  loggerInstance: Logger,
  attributeRegistryUrl: string,
  attributeCreationWaitTime: number,
  maxRetries: number,
  state: ImportState
): Promise<void> {
  if (newAttributes.length === 0) {
    loggerInstance.info("No new attributes to create");
    return;
  }

  const client =
    attributeRegistryApi.createAttributeApiClient(attributeRegistryUrl);

  for (const attribute of newAttributes) {
    loggerInstance.info(
      `Creating attribute ${attribute.origin}/${attribute.code}`
    );
    await client.createInternalCertifiedAttribute(attribute, {
      headers,
    });
  }

  // wait until every event reaches the read model store
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    loggerInstance.info("Waiting for attributes to be created");
    await delay(attributeCreationWaitTime);

    if (await checkAttributesPresence(readModelService, newAttributes)) {
      return;
    }
  }

  loggerInstance.warn(
    `New attributes are not present in the read model after ${maxRetries} attempts. Continuing with the import`
  );
  state.report.warnings += 1;
}

export function getNewAttributes(
  registryData: RegistryData,
  tenantUpsertData: TenantSeed[],
  attributes: Attribute[]
): InternalCertifiedAttribute[] {
  // get a set with all the certified attributes in the platform
  const platformAttributesIndex = new Set(
    attributes
      .filter((a) => a.kind === attributeKind.certified && a.origin && a.code)
      .map((a) => toAttributeKey({ origin: a.origin, code: a.code }))
  );

  const newAttributesIndex = new Set(
    tenantUpsertData.flatMap((t) =>
      t.attributes.map((a) =>
        toAttributeKey({ origin: a.origin, code: a.code })
      )
    )
  );

  return registryData.attributes.filter(
    (a) =>
      newAttributesIndex.has(
        toAttributeKey({ origin: a.origin, code: a.code })
      ) &&
      !platformAttributesIndex.has(
        toAttributeKey({ origin: a.origin, code: a.code })
      )
  );
}

export async function getAttributesToAssign(
  platformTenants: Tenant[],
  platformAttributes: Attribute[],
  tenantSeeds: TenantSeed[],
  config: IPACertifiedAttributesImporterConfig,
  loggerInstance: Logger
): Promise<tenantApi.InternalTenantSeed[]> {
  const tenantsIndex = new Map(
    platformTenants.map((t) => [toTenantKey(t.externalId), t])
  );

  const certifiedAttributes = new Map(
    platformAttributes
      .filter((a) => a.kind === attributeKind.certified && a.origin && a.code)
      .map((a) => [a.id, a])
  );

  return tenantSeeds
    .map((seed): tenantApi.InternalTenantSeed | undefined => {
      const externalId = { origin: seed.origin, value: seed.originId };

      const tenant = tenantsIndex.get(toTenantKey(externalId));

      if (!tenant) {
        loggerInstance.error(`Tenant ${externalId} not found in the platform`);
        return undefined;
      }

      const remoteIds: tenantApi.TenantRemoteId[] = [];

      if (
        isFeatureFlagEnabled(config, "featureFlagAttributeCertifiedDiscrete") &&
        seed.istatCode
      ) {
        const hasIstat = tenant.remoteIds?.some(
          (r) => r.origin === "ISTAT" && r.value === seed.istatCode
        );
        if (!hasIstat) {
          remoteIds.push({
            origin: "ISTAT",
            value: seed.istatCode,
            assignmentTimestamp: new Date().toISOString(),
          });
        }
      }

      const tenantCurrentAttributes = new Map(
        tenant.attributes
          .filter(
            (attribute) =>
              attribute.type === tenantAttributeType.CERTIFIED &&
              !attribute.revocationTimestamp
          )
          .map((attribute) => certifiedAttributes.get(attribute.id))
          .filter((a): a is NonNullable<typeof a> => a !== undefined)
          .map((a) => [toAttributeKey({ origin: a.origin, code: a.code }), a])
      );

      return {
        externalId,
        name: tenant.name,
        certifiedAttributes: seed.attributes
          .filter(
            (a) =>
              !tenantCurrentAttributes.get(
                toAttributeKey({
                  origin: a.origin,
                  code: a.code,
                })
              )
          )
          .map((a) => ({
            origin: a.origin,
            code: a.code,
          })),
        remoteIds: remoteIds.length > 0 ? remoteIds : undefined,
      };
    })
    .filter(
      (t): t is tenantApi.InternalTenantSeed =>
        t !== undefined &&
        (t.certifiedAttributes.length > 0 ||
          (t.remoteIds !== undefined && t.remoteIds.length > 0))
    );
}

export async function assignNewAttributes(
  attributesToAssign: tenantApi.InternalTenantSeed[],
  tenantClient: TenantProcessClient,
  readModelServiceSQL: ReadModelServiceSQL,
  headers: InteropHeaders,
  loggerInstance: Logger,
  pollingConfig: PollingConfig,
  state: ImportState
): Promise<void> {
  for (const attributeToAssign of attributesToAssign) {
    const attributeCodes = attributeToAssign.certifiedAttributes
      .map((a) => a.code)
      .join(", ");

    await runTenantOperation({
      tenantKey: toTenantKey(attributeToAssign.externalId),
      phase: "upserts",
      description: `upsert of tenant ${attributeToAssign.externalId.value} with attributes [${attributeCodes}]`,
      startMessage: `Updating tenant ${attributeToAssign.externalId.value}. Adding attributes [${attributeCodes}]`,
      command: () =>
        tenantClient.internalUpsertTenant(attributeToAssign, {
          headers,
        }),
      pollReadModel: (version) =>
        waitForReadModelMetadataVersion(
          () =>
            readModelServiceSQL.getTenantByExternalIdWithMetadata(
              attributeToAssign.externalId
            ),
          version,
          pollingConfig
        ),
      loggerInstance,
      state,
    });
  }
}

export async function getAttributesToRevoke(
  tenantSeeds: TenantSeed[],
  platformTenants: Tenant[],
  platformAttributes: Attribute[]
): Promise<
  Array<{
    tOrigin: string;
    tExternalId: string;
    aOrigin: string;
    aCode: string;
  }>
> {
  const tenantSeedsIndex = new Map(
    tenantSeeds.map((t) => [
      toTenantKey({ origin: t.origin, value: t.originId }),
      new Set(
        t.attributes.map((a) =>
          toAttributeKey({ origin: a.origin, code: a.code })
        )
      ),
    ])
  );

  const certifiedAttributes = new Map(
    platformAttributes
      .filter((a) => a.kind === attributeKind.certified && a.origin && a.code)
      .map((a) => [a.id, a])
  );

  const canBeRevoked = (
    attribute: {
      origin: string;
      code: string;
    },
    tenantExternalId: { origin: string; value: string }
  ): boolean => {
    if (attribute.origin !== PUBLIC_ADMINISTRATIONS_IDENTIFIER) {
      return false;
    }

    const registryAttributes = tenantSeedsIndex.get(
      toTenantKey(tenantExternalId)
    );
    if (!registryAttributes) {
      return true;
    }

    return !registryAttributes.has(
      toAttributeKey({ origin: attribute.origin, code: attribute.code })
    );
  };

  return platformTenants.flatMap((t) =>
    t.attributes
      .filter(
        (attribute) =>
          attribute.type === tenantAttributeType.CERTIFIED &&
          !attribute.revocationTimestamp
      )
      .map((attribute) => certifiedAttributes.get(attribute.id))
      .filter(
        (a): a is NonNullable<typeof a & { origin: string; code: string }> =>
          a?.origin !== undefined && a?.code !== undefined
      )
      .filter((a) =>
        canBeRevoked(
          {
            origin: a.origin,
            code: a.code,
          },
          t.externalId
        )
      )
      .map((a) => ({
        tOrigin: t.externalId.origin,
        tExternalId: t.externalId.value,
        aOrigin: a.origin,
        aCode: a.code,
      }))
  );
}

export async function revokeAttributes(
  attributesToRevoke: Array<{
    tOrigin: string;
    tExternalId: string;
    aOrigin: string;
    aCode: string;
  }>,
  tenantClient: TenantProcessClient,
  readModelServiceSQL: ReadModelServiceSQL,
  headers: InteropHeaders,
  loggerInstance: Logger,
  pollingConfig: PollingConfig,
  state: ImportState
): Promise<void> {
  for (const a of attributesToRevoke) {
    await runTenantOperation({
      tenantKey: toTenantKey({ origin: a.tOrigin, value: a.tExternalId }),
      phase: "revocations",
      description: `revoke of attribute ${a.aCode} from tenant ${a.tExternalId}`,
      startMessage: `Updating tenant ${a.tExternalId}. Revoking attribute ${a.aCode}`,
      command: () =>
        tenantClient.internalRevokeCertifiedAttribute(undefined, {
          params: {
            tOrigin: a.tOrigin,
            tExternalId: a.tExternalId,
            aOrigin: a.aOrigin,
            aExternalId: a.aCode,
          },
          headers,
        }),
      pollReadModel: (version) =>
        waitForReadModelMetadataVersion(
          () =>
            readModelServiceSQL.getTenantByExternalIdWithMetadata({
              origin: a.tOrigin,
              value: a.tExternalId,
            }),
          version,
          pollingConfig
        ),
      loggerInstance,
      state,
    });
  }
}
