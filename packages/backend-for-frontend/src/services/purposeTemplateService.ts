import { bffApi, purposeTemplateApi } from "pagopa-interop-api-clients";
import { WithLogger } from "pagopa-interop-commons";
import { PurposeTemplateProcessClient } from "../clients/clientsProvider.js";
import { BffAppContext } from "../utilities/context.js";
import { toBffCreatorPurposeTemplate } from "../api/purposeTemplateApiConverter.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function purposeTemplateServiceBuilder(
  purposeTemplateClient: PurposeTemplateProcessClient
) {
  return {
    async createPurposeTemplate(
      seed: bffApi.PurposeTemplateSeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.CreatedResource> {
      logger.info(`Creating purpose template`);
      const result = await purposeTemplateClient.createPurposeTemplate(seed, {
        headers,
      });

      return { id: result.id };
    },
    async getCreatorPurposeTemplates(
      purposeTitle: string | undefined,
      offset: number,
      limit: number,
      { headers, authData, logger }: WithLogger<BffAppContext>
    ): Promise<bffApi.CreatorPurposeTemplates> {
      logger.info(
        `Retrieving creator's purpose templates with title ${purposeTitle}, offset ${offset}, limit ${limit}`
      );

      const creatorPurposeTemplatesResponse: purposeTemplateApi.PurposeTemplates =
        await purposeTemplateClient.getPurposeTemplates({
          headers,
          queries: {
            purposeTitle,
            creatorIds: [authData.organizationId],
            limit,
            offset,
          },
        });

      return {
        results: creatorPurposeTemplatesResponse.results.map(
          toBffCreatorPurposeTemplate
        ),
        pagination: {
          offset,
          limit,
          totalCount: creatorPurposeTemplatesResponse.totalCount,
        },
      };
    },
  };
}

export type PurposeTemplateService = ReturnType<
  typeof purposeTemplateServiceBuilder
>;
