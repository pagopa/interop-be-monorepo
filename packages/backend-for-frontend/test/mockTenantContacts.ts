import { vi } from "vitest";

import type { TenantContactService } from "../src/services/tenantContactService.js";

export const mockTenantContacts: TenantContactService = {
  resolve: vi.fn().mockResolvedValue(undefined),
};
