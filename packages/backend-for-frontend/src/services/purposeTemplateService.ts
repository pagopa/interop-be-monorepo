import { WithLogger, removeDuplicates } from "pagopa-interop-commons";
import { unsafeBrandId } from "pagopa-interop-models";
import { bffApi, purposeTemplateApi } from "pagopa-interop-api-clients";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { purposeTemplateNotFound } from "../model/errors.js";
import { BffAppContext } from "../utilities/context.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type, max-params
export function purposeTemplateServiceBuilder({
  purposeTemplateProcessClient,
}: PagoPAInteropBeClients) {
  return {
    async getPurposeTemplates(
      filters: {
        purposeTitle?: string | undefined;
        creatorIds?: string[] | undefined;
        states?: purposeTemplateApi.PurposeTemplateState[] | undefined;
        excludeDraft?: boolean | undefined;
      },
      offset: number,
      limit: number,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<bffApi.PurposeTemplate[]> {
      logger.info(
        `Retrieving Purpose Templates for purposeTitle ${filters.purposeTitle}, creatorIds ${filters.creatorIds}, states ${filters.states}, excludeDraft ${filters.excludeDraft}, offset ${offset}, limit ${limit}`
      );

      const queries = {
        ...filters,
        offset,
        limit,
        creatorIds: filters.creatorIds && removeDuplicates(filters.creatorIds),
        states: filters.states && removeDuplicates(filters.states),
      };

      return await purposeTemplateProcessClient.getPurposeTemplates({
        queries,
        headers,
      });
    },

    async createPurposeTemplate(
      createSeed: bffApi.PurposeTemplateSeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.PurposeTemplate> {
      logger.info(
        `Creating purpose template with targetDescription ${createSeed.targetDescription} and creatorId ${createSeed.creatorId}`
      );
      return await purposeTemplateProcessClient.createPurposeTemplate(
        createSeed,
        {
          headers,
        }
      );
    },

    async getEservices(
      filters: {
        eserviceIds?: string[] | undefined;
        purposeTemplateIds?: string[] | undefined;
      },
      offset: number,
      limit: number,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<bffApi.EserviceDescriptorVersionPurposeTemplate[]> {
      logger.info(
        `Retrieving Eservices for eserviceIds ${filters.eserviceIds}, purposeTemplateIds ${filters.purposeTemplateIds}, offset ${offset}, limit ${limit}`
      );

      const queries = {
        ...filters,
        offset,
        limit,
        eserviceIds:
          filters.eserviceIds && removeDuplicates(filters.eserviceIds),
        purposeTemplateIds:
          filters.purposeTemplateIds &&
          removeDuplicates(filters.purposeTemplateIds),
      };

      return await purposeTemplateProcessClient.getEservices({
        queries,
        headers,
      });
    },

    async getRiskAnalysis(
      filters: {
        eserviceIds?: string[] | undefined;
        purposeTemplateIds?: string[] | undefined;
      },
      offset: number,
      limit: number,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<bffApi.RiskAnalysisFormTemplate[]> {
      logger.info(
        `Retrieving Risk Analysis for eserviceIds ${filters.eserviceIds}, purposeTemplateIds ${filters.purposeTemplateIds}, offset ${offset}, limit ${limit}`
      );

      const queries = {
        ...filters,
        offset,
        limit,
        eserviceIds:
          filters.eserviceIds && removeDuplicates(filters.eserviceIds),
        purposeTemplateIds:
          filters.purposeTemplateIds &&
          removeDuplicates(filters.purposeTemplateIds),
      };

      return await purposeTemplateProcessClient.getRiskAnalysis({
        queries,
        headers,
      });
    },

    async getPurposeTemplate(
      id: string,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<bffApi.PurposeTemplate> {
      logger.info(`Retrieving Purpose Template ${id}`);

      const purposeTemplate =
        await purposeTemplateProcessClient.getPurposeTemplate({
          params: {
            id,
          },
          headers,
        });

      if (!purposeTemplate) {
        throw purposeTemplateNotFound(unsafeBrandId(id));
      }

      return purposeTemplate;
    },

    async updatePurposeTemplate(
      id: string,
      updateSeed: bffApi.PurposeTemplateUpdatePayload,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<bffApi.PurposeTemplate> {
      logger.info(`Updating Purpose Template ${id}`);

      return await purposeTemplateProcessClient.updatePurposeTemplate(
        updateSeed,
        {
          params: {
            id,
          },
          headers,
        }
      );
    },

    async deletePurposeTemplate(
      id: string,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<void> {
      logger.info(`Deleting purpose template ${id}`);

      await purposeTemplateProcessClient.deletePurposeTemplate(undefined, {
        params: {
          id,
        },
        headers,
      });
    },

    async getPurposeTemplateRiskAnalysis(
      id: string,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<bffApi.RiskAnalysisFormTemplate> {
      logger.info(`Retrieving risk analysis for purpose template ${id}`);

      return await purposeTemplateProcessClient.getPurposeTemplateRiskAnalysis({
        params: {
          id,
        },
        headers,
      });
    },

    async updatePurposeTemplateRiskAnalysis(
      id: string,
      riskAnalysisSeed: bffApi.RiskAnalysisFormTemplate,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<bffApi.RiskAnalysisFormTemplate> {
      logger.info(`Updating risk analysis for purpose template ${id}`);

      return await purposeTemplateProcessClient.updatePurposeTemplateRiskAnalysis(
        riskAnalysisSeed,
        {
          params: {
            id,
          },
          headers,
        }
      );
    },

    async getPurposeTemplateEservices(
      id: string,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<bffApi.EserviceDescriptorVersionPurposeTemplate[]> {
      logger.info(`Retrieving eservices for purpose template ${id}`);

      return await purposeTemplateProcessClient.getPurposeTemplateEservices({
        params: {
          id,
        },
        headers,
      });
    },

    async suspendPurposeTemplate(
      id: string,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<bffApi.PurposeTemplate> {
      logger.info(`Suspending purpose template ${id}`);

      return await purposeTemplateProcessClient.suspendPurposeTemplate(
        undefined,
        {
          params: {
            id,
          },
          headers,
        }
      );
    },

    async unsuspendPurposeTemplate(
      id: string,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<bffApi.PurposeTemplate> {
      logger.info(`Unsuspending purpose template ${id}`);

      return await purposeTemplateProcessClient.unsuspendPurposeTemplate(
        undefined,
        {
          params: {
            id,
          },
          headers,
        }
      );
    },

    async archivePurposeTemplate(
      id: string,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<bffApi.PurposeTemplate> {
      logger.info(`Archiving purpose template ${id}`);

      return await purposeTemplateProcessClient.archivePurposeTemplate(
        undefined,
        {
          params: {
            id,
          },
          headers,
        }
      );
    },

    async activatePurposeTemplate(
      id: string,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<bffApi.PurposeTemplate> {
      logger.info(`Activating purpose template ${id}`);

      return await purposeTemplateProcessClient.activatePurposeTemplate(
        undefined,
        {
          params: {
            id,
          },
          headers,
        }
      );
    },
  };
}

export type PurposeTemplateService = ReturnType<
  typeof purposeTemplateServiceBuilder
>;
