import { getMockDelegation } from "pagopa-interop-commons-test";
import { describe, expect, it } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import {
  generateId,
  Delegation,
  WithMetadata,
  delegationKind,
} from "pagopa-interop-models";
import { compare } from "../src/utils.js";
import {
  addOneDelegation,
  delegationReadModelServiceSQL,
  readModelService,
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

    const collectionDelegations =
      await readModelService.getAllReadModelDelegations();

    const postgresDelegations = await readModelServiceSQL.getAllDelegations();

    const res = compare({
      collectionItems: collectionDelegations,
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

    await delegationReadModelServiceSQL.upsertDelegation(delegation);

    const collectionDelegations =
      await readModelService.getAllReadModelDelegations();

    const postgresDelegations = await readModelServiceSQL.getAllDelegations();

    const res = compare({
      collectionItems: collectionDelegations,
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

    await delegationReadModelServiceSQL.upsertDelegation(delegation2);

    const collectionDelegations =
      await readModelService.getAllReadModelDelegations();

    const postgresDelegations = await readModelServiceSQL.getAllDelegations();

    const res = compare({
      collectionItems: collectionDelegations,
      postgresItems: postgresDelegations,
      schema: "delegation",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(1);
  });

  it("should detect differences if the collection item is not present", async () => {
    const delegation1: WithMetadata<Delegation> = {
      data: getMockDelegation({ kind: delegationKind.delegatedProducer }),
      metadata: { version: 1 },
    };

    const delegation2: WithMetadata<Delegation> = {
      data: getMockDelegation({ kind: delegationKind.delegatedProducer }),
      metadata: { version: 1 },
    };

    await addOneDelegation(delegation1);

    await delegationReadModelServiceSQL.upsertDelegation(delegation1);
    await delegationReadModelServiceSQL.upsertDelegation(delegation2);

    const collectionDelegations =
      await readModelService.getAllReadModelDelegations();

    const postgresDelegations = await readModelServiceSQL.getAllDelegations();

    const res = compare({
      collectionItems: collectionDelegations,
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

    const delegation1ForSQL: WithMetadata<Delegation> = {
      data: {
        ...delegation1.data,
        eserviceId: generateId(),
      },
      metadata: delegation1.metadata,
    };

    await addOneDelegation(delegation1);

    await delegationReadModelServiceSQL.upsertDelegation(delegation1ForSQL);

    const collectionDelegations =
      await readModelService.getAllReadModelDelegations();

    const postgresDelegations = await readModelServiceSQL.getAllDelegations();

    const res = compare({
      collectionItems: collectionDelegations,
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

    const delegation1ForSQL: WithMetadata<Delegation> = {
      data: delegation1.data,
      metadata: {
        version: 3,
      },
    };

    await addOneDelegation(delegation1);

    await delegationReadModelServiceSQL.upsertDelegation(delegation1ForSQL);

    const collectionDelegations =
      await readModelService.getAllReadModelDelegations();

    const postgresDelegations = await readModelServiceSQL.getAllDelegations();

    const res = compare({
      collectionItems: collectionDelegations,
      postgresItems: postgresDelegations,
      schema: "delegation",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(1);
  });
});
