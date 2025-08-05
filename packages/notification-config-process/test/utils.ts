import { expect } from "vitest";
import { TenantId, UserId } from "pagopa-interop-models";

export const expectedOrganizationId = (organizationId: TenantId) =>
  expect.objectContaining({
    authData: expect.objectContaining({
      organizationId,
    }),
  });

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
