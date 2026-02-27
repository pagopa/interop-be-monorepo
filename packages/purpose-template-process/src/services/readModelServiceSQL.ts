import {
  and,
  eq,
  getTableColumns,
  ilike,
  inArray,
  isNull,
  ne,
  notInArray,
  or,
  SQL,
} from "drizzle-orm";
import { purposeTemplateApi } from "pagopa-interop-api-clients";
import {
  ascLower,
  createListResult,
  escapeRegExp,
  getTableTotalCount,
  getValidFormRulesVersions,
  M2MAdminAuthData,
  M2MAuthData,
  UIAuthData,
  withTotalCount,
} from "pagopa-interop-commons";
import {
  DescriptorState,
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
  TargetTenantKind,
  unsafeBrandId,
  WithMetadata,
} from "pagopa-interop-models";
import {
  aggregatePurposeTemplateArray,
  aggregatePurposeTemplateEServiceDescriptor,
  aggregatePurposeTemplateEServiceDescriptorArray,
  CatalogReadModelService,
  PurposeTemplateReadModelService,
  toPurposeTemplateAggregatorArray,
  toRiskAnalysisTemplateAnswerAnnotationDocument,
} from "pagopa-interop-readmodel";
import {
  DrizzleReturnType,
  eserviceDescriptorInReadmodelCatalog,
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
import { z } from "zod";
import { PgSelect } from "drizzle-orm/pg-core";
import { hasRoleToAccessDraftPurposeTemplates } from "./validators.js";

export type GetPurposeTemplatesFilters = {
  purposeTitle?: string;
  targetTenantKind?: TargetTenantKind;
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
          ([targetTenantKind, versions]) =>
            and(
              eq(
                purposeTemplateInReadmodelPurposeTemplate.targetTenantKind,
                targetTenantKind
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
    async getPurposeTemplatesByTitle(
      title: string
    ): Promise<Array<WithMetadata<PurposeTemplate>>> {
      return await purposeTemplateReadModelServiceSQL.getPurposeTemplatesByFilter(
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
      const filterQuery = readModelDB
        .select({
          purposeTemplateId: purposeTemplateInReadmodelPurposeTemplate.id,
        })
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
        .$dynamic();

      const totalCountPromise = getTableTotalCount(readModelDB, filterQuery);
      const subquery = filterQuery.limit(limit).offset(offset).as("subquery");
      const queryResultPromise = readModelDB
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
      const [totalCount, queryResult] = await Promise.all([
        totalCountPromise,
        queryResultPromise,
      ]);

      const purposeTemplates = aggregatePurposeTemplateArray(
        toPurposeTemplateAggregatorArray(queryResult)
      );
      return createListResult(
        purposeTemplates.map((purposeTemplate) => purposeTemplate.data),
        totalCount
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
      documentId: RiskAnalysisTemplateAnswerAnnotationDocumentId,
      answerId?: RiskAnalysisSingleAnswerId | RiskAnalysisMultiAnswerId
    ): Promise<
      WithMetadata<RiskAnalysisTemplateAnswerAnnotationDocument> | undefined
    > {
      // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
      const addAnswerAnnotationJoin = <T extends PgSelect>(query: T) =>
        answerId
          ? query.innerJoin(
              purposeTemplateRiskAnalysisAnswerAnnotationInReadmodelPurposeTemplate,
              eq(
                purposeTemplateRiskAnalysisAnswerAnnotationDocumentInReadmodelPurposeTemplate.annotationId,
                purposeTemplateRiskAnalysisAnswerAnnotationInReadmodelPurposeTemplate.id
              )
            )
          : query;

      const queryResult = await addAnswerAnnotationJoin(
        readModelDB
          .select(
            getTableColumns(
              purposeTemplateRiskAnalysisAnswerAnnotationDocumentInReadmodelPurposeTemplate
            )
          )
          .from(
            purposeTemplateRiskAnalysisAnswerAnnotationDocumentInReadmodelPurposeTemplate
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
              answerId
                ? eq(
                    purposeTemplateRiskAnalysisAnswerAnnotationInReadmodelPurposeTemplate.answerId,
                    answerId
                  )
                : undefined
            )
          )
          .$dynamic()
      );

      if (queryResult.length === 0) {
        return undefined;
      }

      return {
        data: toRiskAnalysisTemplateAnswerAnnotationDocument(queryResult[0]),
        metadata: {
          version: queryResult[0].metadataVersion,
        },
      };
    },
    async getRiskAnalysisTemplateAnnotationDocuments(
      purposeTemplateId: PurposeTemplateId,
      { limit, offset }: { limit: number; offset: number }
    ): Promise<
      ListResult<{
        answerId: RiskAnalysisMultiAnswerId | RiskAnalysisSingleAnswerId;
        document: RiskAnalysisTemplateAnswerAnnotationDocument;
      }>
    > {
      const baseQuery = readModelDB
        .select({
          answerId:
            purposeTemplateRiskAnalysisAnswerAnnotationInReadmodelPurposeTemplate.answerId,
          ...getTableColumns(
            purposeTemplateRiskAnalysisAnswerAnnotationDocumentInReadmodelPurposeTemplate
          ),
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
              purposeTemplateRiskAnalysisAnswerAnnotationInReadmodelPurposeTemplate.id,
              purposeTemplateRiskAnalysisAnswerAnnotationDocumentInReadmodelPurposeTemplate.annotationId
            )
          )
        )
        .orderBy(
          purposeTemplateRiskAnalysisAnswerAnnotationDocumentInReadmodelPurposeTemplate.createdAt
        )
        .$dynamic();

      const [totalCount, queryResult] = await Promise.all([
        getTableTotalCount(readModelDB, baseQuery),
        baseQuery.limit(limit).offset(offset),
      ]);

      const results: Array<{
        answerId: RiskAnalysisSingleAnswerId | RiskAnalysisMultiAnswerId;
        document: RiskAnalysisTemplateAnswerAnnotationDocument;
      }> = queryResult.map((r) => {
        const { answerId, ...document } = r;
        return {
          answerId: unsafeBrandId<
            RiskAnalysisSingleAnswerId | RiskAnalysisMultiAnswerId
          >(answerId),
          document: toRiskAnalysisTemplateAnswerAnnotationDocument(document),
        };
      });

      return createListResult(results, totalCount);
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

      const baseQuery = readModelDB
        .select(
          getTableColumns(
            purposeTemplateEserviceDescriptorInReadmodelPurposeTemplate
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
        .$dynamic();

      const [totalCount, queryResult] = await Promise.all([
        getTableTotalCount(readModelDB, baseQuery),
        baseQuery.limit(limit).offset(offset),
      ]);

      const purposeTemplateEServiceDescriptors =
        aggregatePurposeTemplateEServiceDescriptorArray(queryResult);

      return createListResult(
        purposeTemplateEServiceDescriptors.map(
          (eserviceDescriptor) => eserviceDescriptor.data
        ),
        totalCount
      );
    },
    async getPurposeTemplateEServiceWithDescriptorState(
      purposeTemplateId: PurposeTemplateId,
      allowedDescriptorStates: DescriptorState[]
    ): Promise<ListResult<EServiceDescriptorPurposeTemplate>> {
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
          eserviceDescriptorInReadmodelCatalog,
          eq(
            purposeTemplateEserviceDescriptorInReadmodelPurposeTemplate.descriptorId,
            eserviceDescriptorInReadmodelCatalog.id
          )
        )
        .where(
          and(
            eq(
              purposeTemplateEserviceDescriptorInReadmodelPurposeTemplate.purposeTemplateId,
              purposeTemplateId
            ),
            notInArray(
              eserviceDescriptorInReadmodelCatalog.state,
              allowedDescriptorStates
            )
          )
        );

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
      const baseQuery = readModelDB
        .select({
          id: tenantInReadmodelTenant.id,
          name: tenantInReadmodelTenant.name,
        })
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
        .$dynamic();

      const [totalCount, queryResult] = await Promise.all([
        getTableTotalCount(readModelDB, baseQuery),
        baseQuery.limit(limit).offset(offset),
      ]);

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

      return createListResult(result.data, totalCount);
    },
  };
}
export type ReadModelServiceSQL = ReturnType<typeof readModelServiceBuilderSQL>;
