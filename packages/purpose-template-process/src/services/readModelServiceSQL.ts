import {
  EService,
  EServiceId,
  ListResult,
  PurposeTemplate,
  PurposeTemplateId,
  purposeTemplateState,
  PurposeTemplateState,
  Tenant,
  TenantId,
  WithMetadata,
} from "pagopa-interop-models";
import {
  CatalogReadModelService,
  TenantReadModelService,
  PurposeTemplateReadModelService,
  aggregatePurposeTemplateArray,
  toPurposeTemplateAggregatorArray,
} from "pagopa-interop-readmodel";

import {
  DrizzleReturnType,
  purposeTemplateEserviceDescriptorInReadmodelPurposeTemplate,
  purposeTemplateInReadmodelPurposeTemplate,
  purposeTemplateRiskAnalysisAnswerAnnotationDocumentInReadmodelPurposeTemplate,
  purposeTemplateRiskAnalysisAnswerAnnotationInReadmodelPurposeTemplate,
  purposeTemplateRiskAnalysisAnswerInReadmodelPurposeTemplate,
  purposeTemplateRiskAnalysisFormInReadmodelPurposeTemplate,
} from "pagopa-interop-readmodel-models";
import { and, eq, exists, ilike, inArray, ne, SQL } from "drizzle-orm";
import {
  ascLower,
  createListResult,
  escapeRegExp,
  withTotalCount,
} from "pagopa-interop-commons";

export type GetPurposeTemplatesFilters = {
  purposeTitle?: string;
  creatorIds: TenantId[];
  eserviceIds: EServiceId[];
  states: PurposeTemplateState[];
  excludeDraft: boolean | undefined;
};

// TODO: delete if function is used once
const getVisibilityFilter = (requesterId: TenantId): SQL | undefined =>
  eq(purposeTemplateInReadmodelPurposeTemplate.creatorId, requesterId);

const getPurposeTemplatesFilters = (
  readModelDB: DrizzleReturnType,
  filters: GetPurposeTemplatesFilters
): Array<SQL | undefined> => {
  const { purposeTitle, creatorIds, eserviceIds, states, excludeDraft } =
    filters;

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

  // TODO: better solution?
  const eserviceIdsFilter =
    eserviceIds.length > 0
      ? exists(
          readModelDB
            .select()
            .from(purposeTemplateEserviceDescriptorInReadmodelPurposeTemplate)
            .where(
              inArray(
                purposeTemplateEserviceDescriptorInReadmodelPurposeTemplate.eserviceId,
                eserviceIds
              )
            )
        )
      : undefined;

  const statesFilter =
    states.length > 0
      ? inArray(purposeTemplateInReadmodelPurposeTemplate.state, states)
      : undefined;

  const draftFilter = excludeDraft
    ? ne(
        purposeTemplateInReadmodelPurposeTemplate.state,
        purposeTemplateState.draft
      )
    : undefined;

  return [
    purposeTitleFilter,
    creatorIdsFilter,
    eserviceIdsFilter,
    statesFilter,
    draftFilter,
  ];
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilderSQL({
  readModelDB,
  catalogReadModelServiceSQL,
  tenantReadModelServiceSQL,
  purposeTemplateReadModelServiceSQL,
}: {
  readModelDB: DrizzleReturnType;
  catalogReadModelServiceSQL: CatalogReadModelService;
  tenantReadModelServiceSQL: TenantReadModelService;
  purposeTemplateReadModelServiceSQL: PurposeTemplateReadModelService;
}) {
  return {
    async checkPurposeTemplateName(): Promise<boolean> {
      return false;
    },
    async getEServiceById(id: EServiceId): Promise<EService | undefined> {
      return (await catalogReadModelServiceSQL.getEServiceById(id))?.data;
    },
    async getPurposeTemplate(
      title: string
    ): Promise<WithMetadata<PurposeTemplate> | undefined> {
      return await purposeTemplateReadModelServiceSQL.getPurposeTemplateByFilter(
        and(
          ilike(
            purposeTemplateInReadmodelPurposeTemplate.purposeTitle,
            escapeRegExp(title)
          )
        )
      );
    },
    async getPurposeTemplates(
      requesterId: TenantId,
      filters: GetPurposeTemplatesFilters,
      { limit, offset }: { limit: number; offset: number }
    ): Promise<ListResult<PurposeTemplate>> {
      const subquery = readModelDB
        .select(
          withTotalCount({
            purposeTemplateId: purposeTemplateInReadmodelPurposeTemplate.id,
          })
        )
        .from(purposeTemplateInReadmodelPurposeTemplate)
        .innerJoin(
          purposeTemplateEserviceDescriptorInReadmodelPurposeTemplate,
          eq(
            purposeTemplateInReadmodelPurposeTemplate.id,
            purposeTemplateEserviceDescriptorInReadmodelPurposeTemplate.purposeTemplateId
          )
        )
        .where(
          and(
            getVisibilityFilter(requesterId),
            ...getPurposeTemplatesFilters(readModelDB, filters)
          )
        )
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
          and(
            eq(
              purposeTemplateRiskAnalysisFormInReadmodelPurposeTemplate.id,
              purposeTemplateRiskAnalysisAnswerInReadmodelPurposeTemplate.riskAnalysisFormId
            )
          )
        )
        .leftJoin(
          purposeTemplateRiskAnalysisAnswerAnnotationInReadmodelPurposeTemplate,
          and(
            eq(
              purposeTemplateRiskAnalysisAnswerInReadmodelPurposeTemplate.id,
              purposeTemplateRiskAnalysisAnswerAnnotationInReadmodelPurposeTemplate.answerId
            )
          )
        )
        .leftJoin(
          purposeTemplateRiskAnalysisAnswerAnnotationDocumentInReadmodelPurposeTemplate,
          and(
            eq(
              purposeTemplateRiskAnalysisAnswerAnnotationInReadmodelPurposeTemplate.id,
              purposeTemplateRiskAnalysisAnswerAnnotationDocumentInReadmodelPurposeTemplate.annotationId
            )
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async getPurposeTemplateById(
      _id: PurposeTemplateId
    ): Promise<WithMetadata<PurposeTemplate> | undefined> {
      // TO DO: this is a placeholder function Replace with actual implementation to fetch the purpose template by ID
      return undefined;
    },
    async getTenantById(id: TenantId): Promise<Tenant | undefined> {
      return (await tenantReadModelServiceSQL.getTenantById(id))?.data;
    },
  };
}
export type ReadModelServiceSQL = ReturnType<typeof readModelServiceBuilderSQL>;
