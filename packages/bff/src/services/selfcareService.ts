/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { UserId } from "pagopa-interop-models";
import {
  selfcareV2ClientApi,
  SelfcareV2InstitutionClient,
} from "pagopa-interop-api-clients";
import { Logger } from "pagopa-interop-commons";
import { userNotFound } from "../model/errors.js";

export function selfcareServiceBuilder(
  selfcareV2Client: SelfcareV2InstitutionClient
) {
  return {
    async getSelfcareUser(
      userId: UserId,
      userIdQuery: string,
      institutionId: string,
      logger: Logger
    ): Promise<selfcareV2ClientApi.UserResource> {
      logger.info(
        `Retrieving User with with istitution id ${institutionId}, user ${userId}`
      );
      const users = await selfcareV2Client.getInstitutionProductUsersUsingGET({
        params: { institutionId },
        queries: {
          userIdForAuth: userId,
          userId: userIdQuery,
        },
      });

      const user = users.at(0);
      if (!user) {
        throw userNotFound(userIdQuery, institutionId);
      }
      return user;
    },

    async getSelfcareInstitutionsProducts(
      userId: UserId,
      institutionId: string,
      logger: Logger
    ): Promise<selfcareV2ClientApi.ProductResource[]> {
      logger.info(
        `Retrieving Products for Institution ${institutionId} and User ${userId}`
      );
      return selfcareV2Client.getInstitutionUserProductsUsingGET({
        params: { institutionId },
        queries: { userId },
      });
    },

    async getSelfcareInstitutions(
      userId: UserId,
      logger: Logger
    ): Promise<selfcareV2ClientApi.InstitutionResource[]> {
      logger.info(`Retrieving Institutions for User ${userId}`);
      return selfcareV2Client.getInstitutionsUsingGET({
        queries: { userIdForAuth: userId },
      });
    },
  };
}

export type SelfcareService = ReturnType<typeof selfcareServiceBuilder>;
