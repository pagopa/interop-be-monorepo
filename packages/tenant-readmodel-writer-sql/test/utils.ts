import { inject, afterEach } from "vitest";
import { setupTestContainersVitest } from "pagopa-interop-commons-test";
import { tenantReadModelServiceBuilder } from "pagopa-interop-readmodel";
import {
  CertifiedTenantAttribute,
  DeclaredTenantAttribute,
  generateId,
  tenantAttributeType,
} from "pagopa-interop-models";
import { readModelServiceBuilder } from "../src/readModelService.js";

export const { cleanup, readModelDB } = await setupTestContainersVitest(
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  inject("readModelSQLConfig")
);

afterEach(cleanup);

export const readModelService = readModelServiceBuilder(
  readModelDB,
  tenantReadModelServiceBuilder(readModelDB)
);

export const getCustomMockDeclaredTenantAttribute =
  (): DeclaredTenantAttribute => ({
    type: tenantAttributeType.DECLARED,
    id: generateId(),
    assignmentTimestamp: new Date(),
  });

export const getCustomMockCertifiedTenantAttribute =
  (): CertifiedTenantAttribute => ({
    type: tenantAttributeType.CERTIFIED,
    id: generateId(),
    assignmentTimestamp: new Date(),
  });
