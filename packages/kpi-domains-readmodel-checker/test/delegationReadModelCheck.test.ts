import { getMockDelegation } from "pagopa-interop-commons-test";
import { describe, expect, it } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import {
  generateId,
  Delegation,
  WithMetadata,
  delegationKind,
} from "pagopa-interop-models";
import { upsertDelegation } from "pagopa-interop-readmodel/testUtils";
import { compare } from "../src/utils.js";
import {
  addOneDelegation,
  readModelDB,
  readModelServiceKPI,
  readModelServiceSQL,
} from "./utils.js";

describe("Check delegation readmodels", () => {
  it("should return -1 if the postgres schema is empty", async () => {
    const delegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
    });

    await addOneDelegation({
      data: delegation,
      metadata: { version: 1 },
    });
    const delegations = await readModelServiceKPI.getAllDelegations();

    const postgresDelegations = await readModelServiceSQL.getAllDelegations();

    const res = compare({
      kpiItems: delegations,
      postgresItems: postgresDelegations,
      schema: "delegation",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(-1);
  });

  it("should detect no differences if all the items are equal", async () => {
    const delegation: WithMetadata<Delegation> = {
      data: getMockDelegation({ kind: delegationKind.delegatedConsumer }),
      metadata: { version: 1 },
    };

    await addOneDelegation(delegation);

    await upsertDelegation(
      readModelDB,
      delegation.data,
      delegation.metadata.version,
    );

    const delegations = await readModelServiceKPI.getAllDelegations();

    const postgresDelegations = await readModelServiceSQL.getAllDelegations();

    const res = compare({
      kpiItems: delegations,
      postgresItems: postgresDelegations,
      schema: "delegation",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(0);
  });

  it("should detect differences if the postgres item is not present", async () => {
    const delegation1: WithMetadata<Delegation> = {
      data: getMockDelegation({ kind: delegationKind.delegatedProducer }),
      metadata: { version: 1 },
    };

    const delegation2: WithMetadata<Delegation> = {
      data: getMockDelegation({ kind: delegationKind.delegatedProducer }),
      metadata: { version: 1 },
    };

    await addOneDelegation(delegation1);
    await addOneDelegation(delegation2);

    await upsertDelegation(
      readModelDB,
      delegation2.data,
      delegation2.metadata.version,
    );

    const delegations = await readModelServiceKPI.getAllDelegations();

    const postgresDelegations = await readModelServiceSQL.getAllDelegations();

    const res = compare({
      kpiItems: delegations,
      postgresItems: postgresDelegations,
      schema: "delegation",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(1);
  });

  it("should detect differences if the kpi item is not present", async () => {
    const delegation1: WithMetadata<Delegation> = {
      data: getMockDelegation({ kind: delegationKind.delegatedProducer }),
      metadata: { version: 1 },
    };

    const delegation2: WithMetadata<Delegation> = {
      data: getMockDelegation({ kind: delegationKind.delegatedProducer }),
      metadata: { version: 1 },
    };

    await addOneDelegation(delegation1);

    await upsertDelegation(
      readModelDB,
      delegation1.data,
      delegation1.metadata.version,
    );
    await upsertDelegation(
      readModelDB,
      delegation2.data,
      delegation2.metadata.version,
    );

    const delegations = await readModelServiceKPI.getAllDelegations();

    const postgresDelegations = await readModelServiceSQL.getAllDelegations();

    const res = compare({
      kpiItems: delegations,
      postgresItems: postgresDelegations,
      schema: "delegation",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(1);
  });

  it("should detect differences if the items are different", async () => {
    const delegation1: WithMetadata<Delegation> = {
      data: getMockDelegation({ kind: delegationKind.delegatedProducer }),
      metadata: { version: 1 },
    };

    const delegation1InPostgresDb: WithMetadata<Delegation> = {
      data: {
        ...delegation1.data,
        eserviceId: generateId(),
      },
      metadata: delegation1.metadata,
    };

    await addOneDelegation(delegation1);

    await upsertDelegation(
      readModelDB,
      delegation1InPostgresDb.data,
      delegation1InPostgresDb.metadata.version,
    );

    const delegations = await readModelServiceKPI.getAllDelegations();

    const postgresDelegations = await readModelServiceSQL.getAllDelegations();

    const res = compare({
      kpiItems: delegations,
      postgresItems: postgresDelegations,
      schema: "delegation",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(1);
  });

  it("should detect differences if the items are equal but the version is different", async () => {
    const delegation1: WithMetadata<Delegation> = {
      data: getMockDelegation({ kind: delegationKind.delegatedProducer }),
      metadata: { version: 1 },
    };
    const delegation1InPostgresDb: WithMetadata<Delegation> = {
      data: delegation1.data,
      metadata: {
        version: 3,
      },
    };

    await addOneDelegation(delegation1);

    await upsertDelegation(
      readModelDB,
      delegation1InPostgresDb.data,
      delegation1InPostgresDb.metadata.version,
    );

    const delegations = await readModelServiceKPI.getAllDelegations();

    const postgresDelegations = await readModelServiceSQL.getAllDelegations();

    const res = compare({
      kpiItems: delegations,
      postgresItems: postgresDelegations,
      schema: "delegation",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(1);
  });
});
