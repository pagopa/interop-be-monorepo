import {
  AppContext,
  DB,
  WithLogger,
  eventRepository,
} from "pagopa-interop-commons";
import {
  CorrelationId,
  ListResult,
  StandaloneRiskAnalysis,
  TenantKind,
  generateId,
  riskAnalysisContext,
  RiskAnalysisId,
  riskAnalysisEventToBinaryData,
  unsafeBrandId,
  EServiceId,
  EServiceTemplateId,
} from "pagopa-interop-models";
import {
  RiskAnalysisValidatedForm,
  riskAnalysisValidatedFormToNewRiskAnalysisForm,
  validateRiskAnalysis,
} from "pagopa-interop-commons";
import { riskAnalysisApi } from "pagopa-interop-api-clients";
import { invalidRiskAnalysisContext, duplicateRiskAnalysisName, riskAnalysisNotFound } from "../model/domain/errors.js";
import {
  toCreateEventRiskAnalysisCreated,
  toCreateEventRiskAnalysisDeleted,
  toCreateEventRiskAnalysisUpdated,
} from "../model/domain/toEvent.js";

type InMemoryStore = {
  byId: Map<RiskAnalysisId, StandaloneRiskAnalysis>;
  versions: Map<RiskAnalysisId, number>;
};

const assertOwnerConsistency = (seed: riskAnalysisApi.RiskAnalysisSeed): void => {
  if (seed.context === riskAnalysisContext.eservice) {
    if (!seed.eserviceId || seed.templateId) {
      throw invalidRiskAnalysisContext();
    }
    return;
  }

  if (!seed.templateId || seed.eserviceId) {
    throw invalidRiskAnalysisContext();
  }
};

const isSameOwner = (
  a: StandaloneRiskAnalysis,
  b: riskAnalysisApi.RiskAnalysisSeed
): boolean =>
  (a.context === riskAnalysisContext.eservice &&
    b.context === riskAnalysisContext.eservice &&
    a.eserviceId === b.eserviceId) ||
  (a.context === riskAnalysisContext.eserviceTemplate &&
    b.context === riskAnalysisContext.eserviceTemplate &&
    a.templateId === b.templateId);

const validateAndNormalize = (
  seed: riskAnalysisApi.RiskAnalysisSeed,
  tenantKind: TenantKind
): RiskAnalysisValidatedForm => {
  const validationResult = validateRiskAnalysis(
    seed.riskAnalysisForm,
    seed.schemaOnlyValidation ?? false,
    tenantKind,
    new Date(),
    seed.personalDataInEservice
  );

  if (validationResult.type === "invalid") {
    // Keep original issues in API response via dedicated endpoint, CRUD returns generic validation error upstream.
    throw new Error("RISK_ANALYSIS_VALIDATION_FAILED");
  }

  return validationResult.value;
};

export type RiskAnalysisService = ReturnType<typeof riskAnalysisServiceBuilder>;

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function riskAnalysisServiceBuilder(dbInstance: DB) {
  const repository = eventRepository(dbInstance, riskAnalysisEventToBinaryData);
  const store: InMemoryStore = {
    byId: new Map<RiskAnalysisId, StandaloneRiskAnalysis>(),
    versions: new Map<RiskAnalysisId, number>(),
  };

  return {
    validateRiskAnalysis: async (
      seed: riskAnalysisApi.ValidateRiskAnalysisSeed,
      { logger }: WithLogger<AppContext>
    ): Promise<riskAnalysisApi.RiskAnalysisValidationResponse> => {
      logger.info("Validating risk analysis form");

      const parsedKind = TenantKind.safeParse(seed.tenantKind);
      if (!parsedKind.success) {
        return {
          valid: false,
          issues: [
            {
              code: "invalidTenantKind",
              detail: `Unsupported tenant kind: ${seed.tenantKind}`,
            },
          ],
        };
      }

      const validationResult = validateRiskAnalysis(
        seed.riskAnalysisForm,
        seed.schemaOnlyValidation ?? false,
        parsedKind.data,
        new Date(),
        seed.personalDataInEservice
      );

      if (validationResult.type === "invalid") {
        return {
          valid: false,
          issues: validationResult.issues.map((i) => ({
            code: i.code,
            detail: i.detail,
          })),
        };
      }

      return {
        valid: true,
        issues: [],
        normalizedForm: {
          ...riskAnalysisValidatedFormToNewRiskAnalysisForm(validationResult.value),
          id: generateId(),
        },
      };
    },

    createRiskAnalysis: async (
      seed: riskAnalysisApi.RiskAnalysisSeed,
      correlationId: CorrelationId,
      { logger }: WithLogger<AppContext>
    ): Promise<StandaloneRiskAnalysis> => {
      logger.info(`Creating risk analysis ${seed.name}`);

      assertOwnerConsistency(seed);

      const parsedKind = TenantKind.safeParse(
        seed.tenantKind ?? (seed.context === riskAnalysisContext.eservice ? "PA" : undefined)
      );
      const tenantKind = parsedKind.success ? parsedKind.data : undefined;

      const duplicate = Array.from(store.byId.values()).find(
        (ra) => ra.name.toLowerCase() === seed.name.toLowerCase() && isSameOwner(ra, seed)
      );
      if (duplicate) {
        throw duplicateRiskAnalysisName(
          seed.name,
          seed.context,
          seed.eserviceId ?? seed.templateId ?? "unknown"
        );
      }

      const validatedForm = validateAndNormalize(seed, tenantKind ?? "PA");

      const riskAnalysis: StandaloneRiskAnalysis = {
        id: generateId<RiskAnalysisId>(),
        name: seed.name,
        context: seed.context,
        eserviceId: seed.eserviceId ? unsafeBrandId<EServiceId>(seed.eserviceId) : undefined,
        templateId: seed.templateId ? unsafeBrandId<EServiceTemplateId>(seed.templateId) : undefined,
        tenantKind,
        createdAt: new Date(),
        riskAnalysisForm: riskAnalysisValidatedFormToNewRiskAnalysisForm(validatedForm),
      };

      const { newVersion } = await repository.createEvent(
        toCreateEventRiskAnalysisCreated(riskAnalysis, correlationId)
      );

      store.byId.set(riskAnalysis.id, riskAnalysis);
      store.versions.set(riskAnalysis.id, newVersion);

      return riskAnalysis;
    },

    getRiskAnalysisById: async (
      riskAnalysisId: RiskAnalysisId,
      { logger }: WithLogger<AppContext>
    ): Promise<StandaloneRiskAnalysis> => {
      logger.info(`Retrieving risk analysis ${riskAnalysisId}`);
      const riskAnalysis = store.byId.get(riskAnalysisId);
      if (!riskAnalysis) {
        throw riskAnalysisNotFound(riskAnalysisId);
      }
      return riskAnalysis;
    },

    getRiskAnalyses: async (
      {
        context,
        eserviceId,
        templateId,
        offset,
        limit,
      }: {
        context?: riskAnalysisApi.RiskAnalysisContext;
        eserviceId?: string;
        templateId?: string;
        offset: number;
        limit: number;
      },
      { logger }: WithLogger<AppContext>
    ): Promise<ListResult<StandaloneRiskAnalysis>> => {
      logger.info("Listing risk analyses");

      const filtered = Array.from(store.byId.values()).filter((ra) => {
        if (context && ra.context !== context) {
          return false;
        }
        if (eserviceId && ra.eserviceId !== eserviceId) {
          return false;
        }
        if (templateId && ra.templateId !== templateId) {
          return false;
        }
        return true;
      });

      return {
        results: filtered.slice(offset, offset + limit),
        totalCount: filtered.length,
      };
    },

    updateRiskAnalysis: async (
      riskAnalysisId: RiskAnalysisId,
      seed: riskAnalysisApi.RiskAnalysisSeed,
      correlationId: CorrelationId,
      { logger }: WithLogger<AppContext>
    ): Promise<StandaloneRiskAnalysis> => {
      logger.info(`Updating risk analysis ${riskAnalysisId}`);

      assertOwnerConsistency(seed);

      const current = store.byId.get(riskAnalysisId);
      if (!current) {
        throw riskAnalysisNotFound(riskAnalysisId);
      }

      const parsedKind = TenantKind.safeParse(seed.tenantKind ?? current.tenantKind ?? "PA");
      const tenantKind = parsedKind.success ? parsedKind.data : ("PA" as TenantKind);
      const validatedForm = validateAndNormalize(seed, tenantKind);

      const updated: StandaloneRiskAnalysis = {
        ...current,
        name: seed.name,
        context: seed.context,
        eserviceId: seed.eserviceId ? unsafeBrandId<EServiceId>(seed.eserviceId) : undefined,
        templateId: seed.templateId ? unsafeBrandId<EServiceTemplateId>(seed.templateId) : undefined,
        tenantKind,
        riskAnalysisForm: riskAnalysisValidatedFormToNewRiskAnalysisForm(validatedForm),
      };

      const currentVersion = store.versions.get(riskAnalysisId) ?? 0;
      const { newVersion } = await repository.createEvent(
        toCreateEventRiskAnalysisUpdated(updated, currentVersion, correlationId)
      );

      store.byId.set(riskAnalysisId, updated);
      store.versions.set(riskAnalysisId, newVersion);
      return updated;
    },

    deleteRiskAnalysis: async (
      riskAnalysisId: RiskAnalysisId,
      correlationId: CorrelationId,
      { logger }: WithLogger<AppContext>
    ): Promise<void> => {
      logger.info(`Deleting risk analysis ${riskAnalysisId}`);

      const current = store.byId.get(riskAnalysisId);
      if (!current) {
        throw riskAnalysisNotFound(riskAnalysisId);
      }

      const currentVersion = store.versions.get(riskAnalysisId) ?? 0;
      const { newVersion } = await repository.createEvent(
        toCreateEventRiskAnalysisDeleted(current, currentVersion, correlationId)
      );

      store.versions.set(riskAnalysisId, newVersion);
      store.byId.delete(riskAnalysisId);
    },
  };
}
