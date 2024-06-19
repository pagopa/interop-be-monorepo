/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { UserId } from "pagopa-interop-models";
import {
  InstitutionResource,
  ProductResource,
  SelfcareV2Client,
  UserResource,
} from "pagopa-interop-selfcare-v2-client";
import { userNotFound } from "../model/domain/errors.js";

export function selfcareServiceBuilder(selfcareV2Client: SelfcareV2Client) {
  return {
    async getSelfcareUser(
      userId: UserId,
      userIdQuery: string,
      institutionId: string
    ): Promise<UserResource> {
      const users = await selfcareV2Client.getInstitutionProductUsersUsingGET({
        params: { institutionId },
        queries: {
          userIdForAuth: userId,
          userId: userIdQuery,
        },
      });

      const user = users.find((u) => u.id === userIdQuery);
      if (!user) {
        throw userNotFound(userIdQuery, institutionId);
      }
      return user;
    },

    async getSelfcareInstitutionsProducts(
      userId: UserId,
      institutionId: string
    ): Promise<ProductResource[]> {
      return selfcareV2Client.getInstitutionUserProductsUsingGET({
        params: { institutionId },
        queries: { userId },
      });
    },

    async getSelfcareInstitutions(
      userId: UserId
    ): Promise<InstitutionResource[]> {
      return selfcareV2Client.getInstitutionsUsingGET({
        queries: { userIdForAuth: userId },
      });
    },
  };
}

export type SelfcareService = ReturnType<typeof selfcareServiceBuilder>;
