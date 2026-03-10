import { getMockTenant } from "pagopa-interop-commons-test";
import { describe, expect, it } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import { Tenant, WithMetadata, tenantKind } from "pagopa-interop-models";
import { upsertTenant } from "pagopa-interop-readmodel/testUtils";
import { compare } from "../src/utils.js";
import {
  addOneTenant,
  readModelServiceKPI,
  readModelServiceSQL,
  readModelDB,
} from "./utils.js";

describe("Check tenant readmodels", () => {
  it("should return -1 if the postgres schema is empty", async () => {
    const tenant = getMockTenant();

    await addOneTenant({
      data: tenant,
      metadata: { version: 1 },
    });

    const tenants = await readModelServiceKPI.getAllTenants();

    const postgresTenants = await readModelServiceSQL.getAllTenants();

    const res = compare({
      kpiItems: tenants,
      postgresItems: postgresTenants,
      schema: "tenant",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(-1);
  });

  it("should detect no differences if all the items are equal", async () => {
    const tenant: WithMetadata<Tenant> = {
      data: getMockTenant(),
      metadata: { version: 1 },
    };

    await addOneTenant(tenant);

    await upsertTenant(readModelDB, tenant.data, tenant.metadata.version);

    const tenants = await readModelServiceKPI.getAllTenants();

    const postgresTenants = await readModelServiceSQL.getAllTenants();

    const res = compare({
      kpiItems: tenants,
      postgresItems: postgresTenants,
      schema: "tenant",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(0);
  });

  it("should detect differences if the postgres item is not present", async () => {
    const tenant1: WithMetadata<Tenant> = {
      data: getMockTenant(),
      metadata: { version: 1 },
    };

    const tenant2: WithMetadata<Tenant> = {
      data: getMockTenant(),
      metadata: { version: 1 },
    };

    await addOneTenant(tenant1);
    await addOneTenant(tenant2);

    await upsertTenant(readModelDB, tenant2.data, tenant2.metadata.version);

    const tenants = await readModelServiceKPI.getAllTenants();

    const postgresTenants = await readModelServiceSQL.getAllTenants();

    const res = compare({
      kpiItems: tenants,
      postgresItems: postgresTenants,
      schema: "tenant",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(1);
  });

  it("should detect differences if the kpi item is not present", async () => {
    const tenant1: WithMetadata<Tenant> = {
      data: getMockTenant(),
      metadata: { version: 1 },
    };

    const tenant2: WithMetadata<Tenant> = {
      data: getMockTenant(),
      metadata: { version: 1 },
    };

    await addOneTenant(tenant1);

    await upsertTenant(readModelDB, tenant1.data, tenant1.metadata.version);
    await upsertTenant(readModelDB, tenant2.data, tenant2.metadata.version);

    const tenants = await readModelServiceKPI.getAllTenants();

    const postgresTenants = await readModelServiceSQL.getAllTenants();

    const res = compare({
      kpiItems: tenants,
      postgresItems: postgresTenants,
      schema: "tenant",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(1);
  });

  it("should detect differences if the items are different", async () => {
    const tenant1: WithMetadata<Tenant> = {
      data: {
        ...getMockTenant(),
        kind: tenantKind.PA,
      },
      metadata: { version: 1 },
    };

    const tenant1InPostgresDb: WithMetadata<Tenant> = {
      data: {
        ...tenant1.data,
        kind: tenantKind.GSP,
      },
      metadata: tenant1.metadata,
    };

    await addOneTenant(tenant1);

    await upsertTenant(
      readModelDB,
      tenant1InPostgresDb.data,
      tenant1InPostgresDb.metadata.version
    );

    const tenants = await readModelServiceKPI.getAllTenants();

    const postgresTenants = await readModelServiceSQL.getAllTenants();

    const res = compare({
      kpiItems: tenants,
      postgresItems: postgresTenants,
      schema: "tenant",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(1);
  });

  it("should detect differences if the items are equal but the version is different", async () => {
    const tenant1: WithMetadata<Tenant> = {
      data: getMockTenant(),
      metadata: { version: 1 },
    };

    const tenant1InPostgresDb: WithMetadata<Tenant> = {
      data: tenant1.data,
      metadata: {
        version: 3,
      },
    };

    await addOneTenant(tenant1);

    await upsertTenant(
      readModelDB,
      tenant1InPostgresDb.data,
      tenant1InPostgresDb.metadata.version
    );

    const tenants = await readModelServiceKPI.getAllTenants();

    const postgresTenants = await readModelServiceSQL.getAllTenants();

    const res = compare({
      kpiItems: tenants,
      postgresItems: postgresTenants,
      schema: "tenant",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(1);
  });
});
