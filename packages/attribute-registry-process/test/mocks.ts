import { Tenant, TenantId, generateId } from "pagopa-interop-models";
import { AuthData } from "pagopa-interop-commons";
import { v4 as uuidv4 } from "uuid";

export const getMockTenant = (): Tenant => ({
  name: "tenant_Name",
  id: generateId(),
  createdAt: new Date(),
  attributes: [],
  externalId: {
    value: "1234",
    origin: "IPA",
  },
  features: [],
  mails: [],
});

export const getMockAuthData = (organizationId?: TenantId): AuthData => ({
  organizationId: organizationId || generateId(),
  userId: uuidv4(),
  userRoles: [],
  externalId: {
    value: "123456",
    origin: "IPA",
  },
});
