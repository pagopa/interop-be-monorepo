import { vi } from "vitest";

import { getLatestTenantContactEmail } from "../src/model/modelMappingUtils.js";

export const mockTenantContacts = {
  create: vi.fn<(address: string, correlationId: string) => Promise<string>>(),
  resolve: vi.fn(
    async (tenant: Parameters<typeof getLatestTenantContactEmail>[0]) =>
      getLatestTenantContactEmail(tenant)
  ),
};
