import {
  ascLower,
  createListResult,
  escapeRegExp,
  M2MAdminAuthData,
  M2MAuthData,
  UIAuthData,
  withTotalCount,
} from "pagopa-interop-commons";
import {
  Attribute,
  AttributeId,
  AttributeKind,
  EServiceTemplate,
  EServiceTemplateId,
  ListResult,
  Tenant,
  TenantId,
  WithMetadata,
  eserviceTemplateVersionState,
  genericInternalError,
  CompactOrganization,
  unsafeBrandId,
} from "pagopa-interop-models";
import { z } from "zod";
import {
  attributeInReadmodelAttribute,
  DrizzleReturnType,
  eserviceInReadmodelCatalog,
  eserviceTemplateInReadmodelEserviceTemplate,
  eserviceTemplateRiskAnalysisAnswerInReadmodelEserviceTemplate,
  eserviceTemplateRiskAnalysisInReadmodelEserviceTemplate,
  eserviceTemplateVersionAttributeInReadmodelEserviceTemplate,
  eserviceTemplateVersionDocumentInReadmodelEserviceTemplate,
  eserviceTemplateVersionInReadmodelEserviceTemplate,
  eserviceTemplateVersionInterfaceInReadmodelEserviceTemplate,
  tenantInReadmodelTenant,
} from "pagopa-interop-readmodel-models";
import {
  aggregateEServiceTemplateArray,
  AttributeReadModelService,
  EServiceTemplateReadModelService,
  TenantReadModelService,
  toEServiceTemplateAggregatorArray,
} from "pagopa-interop-readmodel";
import {
  and,
  count,
  eq,
  exists,
  ilike,
  inArray,
  isNotNull,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { match } from "ts-pattern";
import { hasRoleToAccessDraftTemplateVersions } from "./validators.js";
import { GetEServiceTemplatesFilters } from "./readModelService.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilderSQL({
  readModelDB,
  eserviceTemplateReadModelServiceSQL,
  tenantReadModelServiceSQL,
  attributeReadModelServiceSQL,
}: {
  readModelDB: DrizzleReturnType;
  eserviceTemplateReadModelServiceSQL: EServiceTemplateReadModelService;
  tenantReadModelServiceSQL: TenantReadModelService;
  attributeReadModelServiceSQL: AttributeReadModelService;
}) {
  return {
    async getEServiceTemplateById(
      id: EServiceTemplateId
    ): Promise<WithMetadata<EServiceTemplate> | undefined> {
      return await eserviceTemplateReadModelServiceSQL.getEServiceTemplateById(
        id
      );
    },
    async isEServiceTemplateNameAvailable({
      name,
    }: {
      name: string;
    }): Promise<boolean> {
      const queryResult = await readModelDB
        .select({
          count: count(),
        })
        .from(eserviceTemplateInReadmodelEserviceTemplate)
        .where(
          ilike(
            eserviceTemplateInReadmodelEserviceTemplate.name,
            escapeRegExp(name)
          )
        )
        .limit(1);

      return (queryResult[0]?.count ?? 0) === 0;
    },
    async getTenantById(id: TenantId): Promise<Tenant | undefined> {
      return (await tenantReadModelServiceSQL.getTenantById(id))?.data;
    },
    async getAttributesByIds(
      attributesIds: AttributeId[],
      kind: AttributeKind
    ): Promise<Attribute[]> {
      return (
        await attributeReadModelServiceSQL.getAttributesByFilter(
          and(
            inArray(attributeInReadmodelAttribute.id, attributesIds),
            eq(attributeInReadmodelAttribute.kind, kind)
          )
        )
      ).map((a) => a.data);
    },
    async getEServiceTemplates(
      filters: GetEServiceTemplatesFilters,
      offset: number,
      limit: number,
      authData: UIAuthData | M2MAuthData | M2MAdminAuthData
    ): Promise<ListResult<EServiceTemplate>> {
      const { eserviceTemplatesIds, creatorsIds, states, name, personalData } =
        filters;

      const subquery = readModelDB
        .select(
          withTotalCount({
            eserviceTemplateId: eserviceTemplateInReadmodelEserviceTemplate.id,
          })
        )
        .from(eserviceTemplateInReadmodelEserviceTemplate)
        .leftJoin(
          eserviceTemplateVersionInReadmodelEserviceTemplate,
          eq(
            eserviceTemplateInReadmodelEserviceTemplate.id,
            eserviceTemplateVersionInReadmodelEserviceTemplate.eserviceTemplateId
          )
        )
        .where(
          and(
            // NAME FILTER
            name
              ? ilike(
                  eserviceTemplateInReadmodelEserviceTemplate.name,
                  `%${escapeRegExp(name)}%`
                )
              : undefined,
            // IDS FILTER
            eserviceTemplatesIds.length > 0
              ? inArray(
                  eserviceTemplateInReadmodelEserviceTemplate.id,
                  eserviceTemplatesIds
                )
              : undefined,
            match(personalData)
              .with("TRUE", () =>
                eq(
                  eserviceTemplateInReadmodelEserviceTemplate.personalData,
                  true
                )
              )
              .with("FALSE", () =>
                eq(
                  eserviceTemplateInReadmodelEserviceTemplate.personalData,
                  false
                )
              )
              .with("DEFINED", () =>
                isNotNull(
                  eserviceTemplateInReadmodelEserviceTemplate.personalData
                )
              )
              .with(undefined, () => undefined)
              .exhaustive(),
            // CREATORS IDS FILTER
            creatorsIds.length > 0
              ? inArray(
                  eserviceTemplateInReadmodelEserviceTemplate.creatorId,
                  creatorsIds
                )
              : undefined,
            // STATES FILTER
            states.length > 0
              ? inArray(
                  eserviceTemplateVersionInReadmodelEserviceTemplate.state,
                  states
                )
              : undefined,
            // VISIBILITY FILTER
            hasRoleToAccessDraftTemplateVersions(authData)
              ? or(
                  eq(
                    eserviceTemplateInReadmodelEserviceTemplate.creatorId,
                    authData.organizationId
                  ),
                  and(
                    ne(
                      eserviceTemplateVersionInReadmodelEserviceTemplate.state,
                      eserviceTemplateVersionState.draft
                    ),
                    isNotNull(
                      eserviceTemplateVersionInReadmodelEserviceTemplate.id
                    )
                  )
                )
              : and(
                  ne(
                    eserviceTemplateVersionInReadmodelEserviceTemplate.state,
                    eserviceTemplateVersionState.draft
                  ),
                  isNotNull(
                    eserviceTemplateVersionInReadmodelEserviceTemplate.id
                  )
                )
          )
        )
        .groupBy(eserviceTemplateInReadmodelEserviceTemplate.id)
        .orderBy(ascLower(eserviceTemplateInReadmodelEserviceTemplate.name))
        .limit(limit)
        .offset(offset)
        .as("subquery");

      const queryResult = await readModelDB
        .select({
          eserviceTemplate: eserviceTemplateInReadmodelEserviceTemplate,
          version: eserviceTemplateVersionInReadmodelEserviceTemplate,
          interface:
            eserviceTemplateVersionInterfaceInReadmodelEserviceTemplate,
          document: eserviceTemplateVersionDocumentInReadmodelEserviceTemplate,
          attribute:
            eserviceTemplateVersionAttributeInReadmodelEserviceTemplate,
          riskAnalysis: eserviceTemplateRiskAnalysisInReadmodelEserviceTemplate,
          riskAnalysisAnswer:
            eserviceTemplateRiskAnalysisAnswerInReadmodelEserviceTemplate,
          totalCount: subquery.totalCount,
        })
        .from(eserviceTemplateInReadmodelEserviceTemplate)
        .innerJoin(
          subquery,
          eq(
            subquery.eserviceTemplateId,
            eserviceTemplateInReadmodelEserviceTemplate.id
          )
        )
        .leftJoin(
          eserviceTemplateVersionInReadmodelEserviceTemplate,
          eq(
            eserviceTemplateInReadmodelEserviceTemplate.id,
            eserviceTemplateVersionInReadmodelEserviceTemplate.eserviceTemplateId
          )
        )
        .leftJoin(
          eserviceTemplateVersionInterfaceInReadmodelEserviceTemplate,
          eq(
            eserviceTemplateVersionInReadmodelEserviceTemplate.id,
            eserviceTemplateVersionInterfaceInReadmodelEserviceTemplate.versionId
          )
        )
        .leftJoin(
          eserviceTemplateVersionDocumentInReadmodelEserviceTemplate,
          eq(
            eserviceTemplateVersionInReadmodelEserviceTemplate.id,
            eserviceTemplateVersionDocumentInReadmodelEserviceTemplate.versionId
          )
        )
        .leftJoin(
          eserviceTemplateVersionAttributeInReadmodelEserviceTemplate,
          eq(
            eserviceTemplateVersionInReadmodelEserviceTemplate.id,
            eserviceTemplateVersionAttributeInReadmodelEserviceTemplate.versionId
          )
        )
        .leftJoin(
          eserviceTemplateRiskAnalysisInReadmodelEserviceTemplate,
          eq(
            eserviceTemplateInReadmodelEserviceTemplate.id,
            eserviceTemplateRiskAnalysisInReadmodelEserviceTemplate.eserviceTemplateId
          )
        )
        .leftJoin(
          eserviceTemplateRiskAnalysisAnswerInReadmodelEserviceTemplate,
          eq(
            eserviceTemplateRiskAnalysisInReadmodelEserviceTemplate.riskAnalysisFormId,
            eserviceTemplateRiskAnalysisAnswerInReadmodelEserviceTemplate.riskAnalysisFormId
          )
        )
        .orderBy(ascLower(eserviceTemplateInReadmodelEserviceTemplate.name));

      const eserviceTemplates = aggregateEServiceTemplateArray(
        toEServiceTemplateAggregatorArray(queryResult)
      );
      return createListResult(
        eserviceTemplates.map((eserviceTemplate) => eserviceTemplate.data),
        queryResult[0]?.totalCount ?? 0
      );
    },
    async hasInstanceNameConflicts(
      eserviceTemplate: EServiceTemplate,
      newName: string
    ): Promise<boolean> {
      /**
       * Checks whether renaming a template to `newName` would cause a name conflict
       * for any of its instances. For each instance, the expected new name is computed as
       * `newName - instanceLabel` (or just `newName` if the instance has no label),
       * then we verify that no other eservice by the same producer already uses that name.
       */

      const templateInstances = alias(
        eserviceInReadmodelCatalog,
        "template_instances"
      );

      const escapedNewName = escapeRegExp(newName);

      const queryResult = await readModelDB
        .select({ count: count() })
        .from(templateInstances)
        .where(
          and(
            eq(templateInstances.templateId, eserviceTemplate.id),
            exists(
              readModelDB
                .select()
                .from(eserviceInReadmodelCatalog)
                .where(
                  and(
                    eq(
                      eserviceInReadmodelCatalog.producerId,
                      templateInstances.producerId
                    ),
                    ne(eserviceInReadmodelCatalog.id, templateInstances.id),
                    sql`${eserviceInReadmodelCatalog.name} ILIKE CASE
                      WHEN ${templateInstances.instanceLabel} IS NOT NULL
                        THEN ${escapedNewName} || ' - ' || ${templateInstances.instanceLabel}
                      ELSE ${escapedNewName}
                    END`
                  )
                )
            )
          )
        );

      return queryResult.length > 0 ? queryResult[0].count > 0 : false;
    },
    async getCreators(
      name: string | undefined,
      limit: number,
      offset: number
    ): Promise<ListResult<CompactOrganization>> {
      const queryResult = await readModelDB
        .select(
          withTotalCount({
            id: tenantInReadmodelTenant.id,
            name: tenantInReadmodelTenant.name,
          })
        )
        .from(tenantInReadmodelTenant)
        .innerJoin(
          eserviceTemplateInReadmodelEserviceTemplate,
          eq(
            eserviceTemplateInReadmodelEserviceTemplate.creatorId,
            tenantInReadmodelTenant.id
          )
        )
        .innerJoin(
          eserviceTemplateVersionInReadmodelEserviceTemplate,
          eq(
            eserviceTemplateInReadmodelEserviceTemplate.id,
            eserviceTemplateVersionInReadmodelEserviceTemplate.eserviceTemplateId
          )
        )
        .where(
          // E-SERVICE TEMPLATE FILTER
          and(
            eq(
              eserviceTemplateVersionInReadmodelEserviceTemplate.state,
              eserviceTemplateVersionState.published
            ),
            // TENANT FILTER
            name
              ? ilike(tenantInReadmodelTenant.name, `%${escapeRegExp(name)}%`)
              : undefined
          )
        )
        .groupBy(tenantInReadmodelTenant.id)
        .orderBy(ascLower(tenantInReadmodelTenant.name))
        .limit(limit)
        .offset(offset);

      const data: CompactOrganization[] = queryResult.map((d) => ({
        id: unsafeBrandId(d.id),
        name: d.name,
      }));

      const result = z.array(CompactOrganization).safeParse(data);

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
