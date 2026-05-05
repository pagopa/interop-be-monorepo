/* eslint-disable max-params */
import { setupTestContainersVitest } from "pagopa-interop-commons-test";
import { inject, afterEach, expect } from "vitest";
import {
  AppContext,
  genericLogger,
  UIAuthData,
  WithLogger,
} from "pagopa-interop-commons";
import { ApiError, TenantId, UserId } from "pagopa-interop-models";
import { BffAppContext } from "../src/utilities/context.js";

const { cleanup, fileManager } = await setupTestContainersVitest(
  inject("eventStoreConfig"),
  inject("fileManagerConfig")
);

export { fileManager };

afterEach(cleanup);

export const getBffMockContext = (
  ctx: AppContext<UIAuthData>
): WithLogger<BffAppContext> => ({
  ...ctx,
  headers: {
    "X-Correlation-Id": ctx.correlationId,
    Authorization: "authorization",
    "X-Forwarded-For": "x-forwarded-for",
  },
  logger: genericLogger,
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const catalogErrorCodes = {
  eserviceTemplateInterfaceNotFound: "0035",
  eserviceTemplateInterfaceDataNotValid: "0036",
};
type CatalogErrorCodes = keyof typeof catalogErrorCodes;

export function eserviceTemplateInterfaceNotFound(
  eserviceTemplateId: string,
  eserviceTemplateVersionId: string
): ApiError<CatalogErrorCodes> {
  return new ApiError({
    detail: `EService template interface for template ${eserviceTemplateId} with version ${eserviceTemplateVersionId} not found`,
    code: "eserviceTemplateInterfaceNotFound",
    title: "EService template interface document not found",
  });
}

export function eserviceInterfaceDataNotValid(): ApiError<CatalogErrorCodes> {
  return new ApiError({
    detail: `EService template interface data not valid`,
    code: "eserviceTemplateInterfaceDataNotValid",
    title: "EService template interface data not valid",
  });
}

/* eslint-disable @typescript-eslint/explicit-function-return-type */
export const expectedOrganizationId = (organizationId: TenantId) =>
  expect.objectContaining({
    authData: expect.objectContaining({
      organizationId,
    }),
  });

/* eslint-disable @typescript-eslint/explicit-function-return-type */
export const expectedUserIdAndOrganizationId = (
  userId: UserId,
  organizationId: TenantId
) =>
  expect.objectContaining({
    authData: expect.objectContaining({
      userId,
      organizationId,
    }),
  });
