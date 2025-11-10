import {
  EService,
  EServiceDescriptorPurposeTemplate,
  EServiceId,
  genericInternalError,
  ListResult,
  PurposeTemplate,
  PurposeTemplateId,
  purposeTemplateState,
  PurposeTemplateState,
  RiskAnalysisMultiAnswerId,
  RiskAnalysisSingleAnswerId,
  RiskAnalysisTemplateAnswerAnnotationDocument,
  RiskAnalysisTemplateAnswerAnnotationDocumentId,
  TenantId,
  TenantKind,
  WithMetadata,
} from "pagopa-interop-models";
import {
  aggregatePurposeTemplateEServiceDescriptor,
  aggregatePurposeTemplateEServiceDescriptorArray,
  CatalogReadModelService,
  PurposeTemplateReadModelService,
  aggregatePurposeTemplateArray,
  toPurposeTemplateAggregatorArray,
  toRiskAnalysisTemplateAnswerAnnotationDocument,
} from "pagopa-interop-readmodel";
import {
  DrizzleReturnType,
  eserviceInReadmodelCatalog,
  purposeTemplateEserviceDescriptorInReadmodelPurposeTemplate,
  purposeTemplateInReadmodelPurposeTemplate,
  purposeTemplateRiskAnalysisAnswerAnnotationDocumentInReadmodelPurposeTemplate,
  purposeTemplateRiskAnalysisAnswerAnnotationInReadmodelPurposeTemplate,
  purposeTemplateRiskAnalysisAnswerInReadmodelPurposeTemplate,
  purposeTemplateRiskAnalysisFormDocumentInReadmodelPurposeTemplate,
  purposeTemplateRiskAnalysisFormSignedDocumentInReadmodelPurposeTemplate,
  purposeTemplateRiskAnalysisFormInReadmodelPurposeTemplate,
  tenantInReadmodelTenant,
} from "pagopa-interop-readmodel-models";
import {
  and,
  eq,
  getTableColumns,
  ilike,
  inArray,
  isNull,
  ne,
  or,
  SQL,
} from "drizzle-orm";
import {
  ascLower,
  createListResult,
  escapeRegExp,
  getValidFormRulesVersions,
  M2MAdminAuthData,
  M2MAuthData,
  UIAuthData,
  withTotalCount,
} from "pagopa-interop-commons";
import { purposeTemplateApi } from "pagopa-interop-api-clients";
import { z } from "zod";
import { hasRoleToAccessDraftPurposeTemplates } from "./validators.js";

export type GetPurposeTemplatesFilters = {
  purposeTitle?: string;
  targetTenantKind?: TenantKind;
  creatorIds: TenantId[];
  eserviceIds: EServiceId[];
  states: PurposeTemplateState[];
  excludeExpiredRiskAnalysis?: boolean;
  handlesPersonalData?: boolean;
};

export type GetPurposeTemplateEServiceDescriptorsFilters = {
  purposeTemplateId: PurposeTemplateId;
  producerIds: TenantId[];
  eserviceName?: string;
};

const getPurposeTemplatesFilters = (
  filters: GetPurposeTemplatesFilters,
  authData: UIAuthData | M2MAuthData | M2MAdminAuthData
): SQL | undefined => {
  const {
    purposeTitle,
    creatorIds,
    eserviceIds,
    states,
    targetTenantKind,
    excludeExpiredRiskAnalysis,
    handlesPersonalData,
  } = filters;

  const purposeTitleFilter = purposeTitle
    ? ilike(
        purposeTemplateInReadmodelPurposeTemplate.purposeTitle,
        `%${escapeRegExp(purposeTitle)}%`
      )
    : undefined;

  const creatorIdsFilter =
    creatorIds.length > 0
      ? inArray(purposeTemplateInReadmodelPurposeTemplate.creatorId, creatorIds)
      : undefined;

  const eserviceIdsFilter =
    eserviceIds.length > 0
      ? inArray(
          purposeTemplateEserviceDescriptorInReadmodelPurposeTemplate.eserviceId,
          eserviceIds
        )
      : undefined;

  const statesFilter =
    states.length > 0
      ? inArray(purposeTemplateInReadmodelPurposeTemplate.state, states)
      : undefined;

  const targetTenantKindFilter = targetTenantKind
    ? eq(
        purposeTemplateInReadmodelPurposeTemplate.targetTenantKind,
        targetTenantKind
      )
    : undefined;

  const validFormRulesByTenantKind = getValidFormRulesVersions();
  const excludeExpiredRiskAnalysisFilters = excludeExpiredRiskAnalysis
    ? or(
        ...Array.from(validFormRulesByTenantKind.entries()).map(
          ([tenantKind, versions]) =>
            and(
              eq(
                purposeTemplateInReadmodelPurposeTemplate.targetTenantKind,
                tenantKind
              ),
              inArray(
                purposeTemplateRiskAnalysisFormInReadmodelPurposeTemplate.version,
                versions
              )
            )
        ),
        isNull(
          purposeTemplateRiskAnalysisFormInReadmodelPurposeTemplate.version
        )
      )
    : undefined;

  const handlesPersonalDataFilter =
    handlesPersonalData !== undefined
      ? eq(
          purposeTemplateInReadmodelPurposeTemplate.handlesPersonalData,
          handlesPersonalData
        )
      : undefined;

  const visibilityFilter = hasRoleToAccessDraftPurposeTemplates(authData)
    ? or(
        eq(
          purposeTemplateInReadmodelPurposeTemplate.creatorId,
          authData.organizationId
        ),
        ne(
          purposeTemplateInReadmodelPurposeTemplate.state,
          purposeTemplateState.draft
        )
      )
    : ne(
        purposeTemplateInReadmodelPurposeTemplate.state,
        purposeTemplateState.draft
      );

  return and(
    purposeTitleFilter,
    creatorIdsFilter,
    eserviceIdsFilter,
    statesFilter,
    targetTenantKindFilter,
    excludeExpiredRiskAnalysisFilters,
    handlesPersonalDataFilter,
    visibilityFilter
  );
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilderSQL({
  readModelDB,
  catalogReadModelServiceSQL,
  purposeTemplateReadModelServiceSQL,
}: {
  readModelDB: DrizzleReturnType;
  catalogReadModelServiceSQL: CatalogReadModelService;
  purposeTemplateReadModelServiceSQL: PurposeTemplateReadModelService;
}) {
  return {
    async getEServiceById(id: EServiceId): Promise<EService | undefined> {
      return (await catalogReadModelServiceSQL.getEServiceById(id))?.data;
    },
    async getPurposeTemplate(
      title: string
    ): Promise<WithMetadata<PurposeTemplate> | undefined> {
      return await purposeTemplateReadModelServiceSQL.getPurposeTemplateByFilter(
        ilike(
          purposeTemplateInReadmodelPurposeTemplate.purposeTitle,
          escapeRegExp(title)
        )
      );
    },
    async getPurposeTemplates(
      filters: GetPurposeTemplatesFilters,
      { limit, offset }: { limit: number; offset: number },
      authData: UIAuthData | M2MAuthData | M2MAdminAuthData
    ): Promise<ListResult<PurposeTemplate>> {
      const subquery = readModelDB
        .select(
          withTotalCount({
            purposeTemplateId: purposeTemplateInReadmodelPurposeTemplate.id,
          })
        )
        .from(purposeTemplateInReadmodelPurposeTemplate)
        .leftJoin(
          purposeTemplateEserviceDescriptorInReadmodelPurposeTemplate,
          eq(
            purposeTemplateInReadmodelPurposeTemplate.id,
            purposeTemplateEserviceDescriptorInReadmodelPurposeTemplate.purposeTemplateId
          )
        )
        .leftJoin(
          purposeTemplateRiskAnalysisFormInReadmodelPurposeTemplate,
          eq(
            purposeTemplateInReadmodelPurposeTemplate.id,
            purposeTemplateRiskAnalysisFormInReadmodelPurposeTemplate.purposeTemplateId
          )
        )
        .where(getPurposeTemplatesFilters(filters, authData))
        .groupBy(purposeTemplateInReadmodelPurposeTemplate.id)
        .orderBy(
          ascLower(purposeTemplateInReadmodelPurposeTemplate.purposeTitle)
        )
        .limit(limit)
        .offset(offset)
        .as("subquery");

      const queryResult = await readModelDB
        .select({
          purposeTemplate: purposeTemplateInReadmodelPurposeTemplate,
          purposeRiskAnalysisFormTemplate:
            purposeTemplateRiskAnalysisFormInReadmodelPurposeTemplate,
          purposeRiskAnalysisTemplateAnswer:
            purposeTemplateRiskAnalysisAnswerInReadmodelPurposeTemplate,
          purposeRiskAnalysisTemplateAnswerAnnotation:
            purposeTemplateRiskAnalysisAnswerAnnotationInReadmodelPurposeTemplate,
          purposeRiskAnalysisTemplateAnswerAnnotationDocument:
            purposeTemplateRiskAnalysisAnswerAnnotationDocumentInReadmodelPurposeTemplate,
          purposeRiskAnalysisTemplateDocument:
            purposeTemplateRiskAnalysisFormDocumentInReadmodelPurposeTemplate,
          purposeRiskAnalysisTemplateSignedDocument:
            purposeTemplateRiskAnalysisFormSignedDocumentInReadmodelPurposeTemplate,
          totalCount: subquery.totalCount,
        })
        .from(purposeTemplateInReadmodelPurposeTemplate)
        .innerJoin(
          subquery,
          eq(
            purposeTemplateInReadmodelPurposeTemplate.id,
            subquery.purposeTemplateId
          )
        )
        .leftJoin(
          purposeTemplateRiskAnalysisFormInReadmodelPurposeTemplate,
          eq(
            purposeTemplateInReadmodelPurposeTemplate.id,
            purposeTemplateRiskAnalysisFormInReadmodelPurposeTemplate.purposeTemplateId
          )
        )
        .leftJoin(
          purposeTemplateRiskAnalysisAnswerInReadmodelPurposeTemplate,
          eq(
            purposeTemplateRiskAnalysisFormInReadmodelPurposeTemplate.id,
            purposeTemplateRiskAnalysisAnswerInReadmodelPurposeTemplate.riskAnalysisFormId
          )
        )
        .leftJoin(
          purposeTemplateRiskAnalysisAnswerAnnotationInReadmodelPurposeTemplate,
          eq(
            purposeTemplateRiskAnalysisAnswerInReadmodelPurposeTemplate.id,
            purposeTemplateRiskAnalysisAnswerAnnotationInReadmodelPurposeTemplate.answerId
          )
        )
        .leftJoin(
          purposeTemplateRiskAnalysisAnswerAnnotationDocumentInReadmodelPurposeTemplate,
          eq(
            purposeTemplateRiskAnalysisAnswerAnnotationInReadmodelPurposeTemplate.id,
            purposeTemplateRiskAnalysisAnswerAnnotationDocumentInReadmodelPurposeTemplate.annotationId
          )
        )
        .leftJoin(
          purposeTemplateRiskAnalysisFormDocumentInReadmodelPurposeTemplate,
          eq(
            purposeTemplateRiskAnalysisFormInReadmodelPurposeTemplate.id,
            purposeTemplateRiskAnalysisFormDocumentInReadmodelPurposeTemplate.riskAnalysisFormId
          )
        )
        .leftJoin(
          purposeTemplateRiskAnalysisFormSignedDocumentInReadmodelPurposeTemplate,
          eq(
            purposeTemplateRiskAnalysisFormInReadmodelPurposeTemplate.id,
            purposeTemplateRiskAnalysisFormSignedDocumentInReadmodelPurposeTemplate.riskAnalysisFormId
          )
        )
        .orderBy(
          ascLower(purposeTemplateInReadmodelPurposeTemplate.purposeTitle)
        );

      const purposeTemplates = aggregatePurposeTemplateArray(
        toPurposeTemplateAggregatorArray(queryResult)
      );
      return createListResult(
        purposeTemplates.map((purposeTemplate) => purposeTemplate.data),
        queryResult[0]?.totalCount
      );
    },
    async getPurposeTemplateById(
      purposeTemplateId: PurposeTemplateId
    ): Promise<WithMetadata<PurposeTemplate> | undefined> {
      return await purposeTemplateReadModelServiceSQL.getPurposeTemplateById(
        purposeTemplateId
      );
    },
    async getRiskAnalysisTemplateAnswerAnnotationDocument(
      purposeTemplateId: PurposeTemplateId,
      answerId: RiskAnalysisSingleAnswerId | RiskAnalysisMultiAnswerId,
      documentId: RiskAnalysisTemplateAnswerAnnotationDocumentId
    ): Promise<
      WithMetadata<RiskAnalysisTemplateAnswerAnnotationDocument> | undefined
    > {
      const queryResult = await readModelDB
        .select({
          riskAnalysisAnswerAnnotationDocument:
            purposeTemplateRiskAnalysisAnswerAnnotationDocumentInReadmodelPurposeTemplate,
        })
        .from(
          purposeTemplateRiskAnalysisAnswerAnnotationDocumentInReadmodelPurposeTemplate
        )
        .innerJoin(
          purposeTemplateRiskAnalysisAnswerAnnotationInReadmodelPurposeTemplate,
          eq(
            purposeTemplateRiskAnalysisAnswerAnnotationDocumentInReadmodelPurposeTemplate.annotationId,
            purposeTemplateRiskAnalysisAnswerAnnotationInReadmodelPurposeTemplate.id
          )
        )
        .where(
          and(
            eq(
              purposeTemplateRiskAnalysisAnswerAnnotationDocumentInReadmodelPurposeTemplate.purposeTemplateId,
              purposeTemplateId
            ),
            eq(
              purposeTemplateRiskAnalysisAnswerAnnotationDocumentInReadmodelPurposeTemplate.id,
              documentId
            ),
            eq(
              purposeTemplateRiskAnalysisAnswerAnnotationInReadmodelPurposeTemplate.answerId,
              answerId
            )
          )
        );

      if (queryResult.length === 0) {
        return undefined;
      }

      const { riskAnalysisAnswerAnnotationDocument } = queryResult[0];
      return {
        data: toRiskAnalysisTemplateAnswerAnnotationDocument(
          riskAnalysisAnswerAnnotationDocument
        ),
        metadata: {
          version: riskAnalysisAnswerAnnotationDocument.metadataVersion,
        },
      };
    },
    async getPurposeTemplateEServiceDescriptorsByPurposeTemplateIdAndEserviceId(
      purposeTemplateId: PurposeTemplateId,
      eserviceId: EServiceId
    ): Promise<EServiceDescriptorPurposeTemplate | undefined> {
      const queryResult = await readModelDB
        .select(
          getTableColumns(
            purposeTemplateEserviceDescriptorInReadmodelPurposeTemplate
          )
        )
        .from(purposeTemplateEserviceDescriptorInReadmodelPurposeTemplate)
        .where(
          and(
            eq(
              purposeTemplateEserviceDescriptorInReadmodelPurposeTemplate.purposeTemplateId,
              purposeTemplateId
            ),
            eq(
              purposeTemplateEserviceDescriptorInReadmodelPurposeTemplate.eserviceId,
              eserviceId
            )
          )
        )
        .limit(1);

      if (queryResult.length === 0) {
        return undefined;
      }

      const purposeTemplateEServiceDescriptor =
        aggregatePurposeTemplateEServiceDescriptor(queryResult[0]);

      return purposeTemplateEServiceDescriptor.data;
    },
    async getPurposeTemplateEServiceDescriptors(
      filters: GetPurposeTemplateEServiceDescriptorsFilters,
      { limit, offset }: { limit: number; offset: number }
    ): Promise<ListResult<EServiceDescriptorPurposeTemplate>> {
      const { purposeTemplateId, producerIds, eserviceName } = filters;

      const queryResult = await readModelDB
        .select(
          withTotalCount(
            getTableColumns(
              purposeTemplateEserviceDescriptorInReadmodelPurposeTemplate
            )
          )
        )
        .from(purposeTemplateEserviceDescriptorInReadmodelPurposeTemplate)
        .innerJoin(
          eserviceInReadmodelCatalog,
          eq(
            purposeTemplateEserviceDescriptorInReadmodelPurposeTemplate.eserviceId,
            eserviceInReadmodelCatalog.id
          )
        )
        .where(
          and(
            eq(
              purposeTemplateEserviceDescriptorInReadmodelPurposeTemplate.purposeTemplateId,
              purposeTemplateId
            ),
            producerIds.length > 0
              ? inArray(eserviceInReadmodelCatalog.producerId, producerIds)
              : undefined,
            eserviceName
              ? ilike(
                  eserviceInReadmodelCatalog.name,
                  `%${escapeRegExp(eserviceName)}%`
                )
              : undefined
          )
        )
        .orderBy(
          purposeTemplateEserviceDescriptorInReadmodelPurposeTemplate.createdAt
        )
        .limit(limit)
        .offset(offset);

      const purposeTemplateEServiceDescriptors =
        aggregatePurposeTemplateEServiceDescriptorArray(queryResult);

      return createListResult(
        purposeTemplateEServiceDescriptors.map(
          (eserviceDescriptor) => eserviceDescriptor.data
        ),
        queryResult[0]?.totalCount
      );
    },
    async getPublishedPurposeTemplateCreators({
      creatorName,
      offset,
      limit,
    }: {
      creatorName: string | undefined;
      offset: number;
      limit: number;
    }): Promise<ListResult<purposeTemplateApi.CompactOrganization>> {
      const queryResult = await readModelDB
        .select(
          withTotalCount({
            id: tenantInReadmodelTenant.id,
            name: tenantInReadmodelTenant.name,
          })
        )
        .from(tenantInReadmodelTenant)
        .innerJoin(
          purposeTemplateInReadmodelPurposeTemplate,
          and(
            eq(
              tenantInReadmodelTenant.id,
              purposeTemplateInReadmodelPurposeTemplate.creatorId
            )
          )
        )
        .where(
          and(
            eq(
              purposeTemplateInReadmodelPurposeTemplate.state,
              purposeTemplateState.published
            ),
            creatorName
              ? ilike(
                  tenantInReadmodelTenant.name,
                  `%${escapeRegExp(creatorName)}%`
                )
              : undefined
          )
        )
        .groupBy(tenantInReadmodelTenant.id)
        .orderBy(ascLower(tenantInReadmodelTenant.name))
        .limit(limit)
        .offset(offset);

      const data: purposeTemplateApi.CompactOrganization[] = queryResult.map(
        (d) => ({
          id: d.id,
          name: d.name,
        })
      );

      const result = z
        .array(purposeTemplateApi.CompactOrganization)
        .safeParse(data);

      if (!result.success) {
        throw genericInternalError(
          `Unable to parse compact organization items: result ${JSON.stringify(
            result
          )} - data ${JSON.stringify(data)} `
        );
      }

      return createListResult(result.data, queryResult[0]?.totalCount ?? 0);
    },
  };
}
export type ReadModelServiceSQL = ReturnType<typeof readModelServiceBuilderSQL>;
