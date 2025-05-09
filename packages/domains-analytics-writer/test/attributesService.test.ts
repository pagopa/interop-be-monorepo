/* eslint-disable functional/no-let */
/* eslint-disable functional/immutable-data */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, expect, it, beforeEach } from "vitest";
import { getMockAttribute } from "pagopa-interop-commons-test";
import {
  AttributeEventEnvelope,
  AttributeKindV1,
  attributeKind,
  generateId,
} from "pagopa-interop-models";
import { handleAttributeMessageV1 } from "../src/handlers/attribute/consumerServiceV1.js";
import { AttributeDbTable, DeletingDbTable } from "../src/model/db.js";
import { dbContext, getAttributeFromDb } from "./utils.js";

describe("SQL Attribute Service - Events V1", () => {
  beforeEach(async () => {
    await dbContext.conn.none(
      `TRUNCATE ${AttributeDbTable.attribute} CASCADE;`,
    );
    await dbContext.conn.none(
      `TRUNCATE ${DeletingDbTable.attribute_deleting_table}`,
    );
  });

  it("AttributeAdded - certified", async () => {
    const attr = {
      ...getMockAttribute(),
      kind: AttributeKindV1.CERTIFIED,
      code: "123456",
      origin: "certifier-id",
    };

    const message: AttributeEventEnvelope = {
      sequence_num: 1,
      stream_id: attr.id,
      version: 5,
      type: "AttributeAdded",
      event_version: 1,
      data: { attribute: attr as any },
      log_date: new Date(),
    };
    await handleAttributeMessageV1([message], dbContext);
    const stored = await getAttributeFromDb(attr.id, dbContext);
    expect(stored?.length).toBe(1);
    expect(stored?.[0].id).toBe(attr.id);
    expect(stored?.[0].kind).toBe(attributeKind.certified);
    expect(stored?.[0].metadata_version).toBe(5);
  });

  it("AttributeAdded - declared", async () => {
    const attr = {
      ...getMockAttribute(),
      kind: AttributeKindV1.DECLARED,
    };

    const message: AttributeEventEnvelope = {
      sequence_num: 1,
      stream_id: attr.id,
      version: 2,
      type: "AttributeAdded",
      event_version: 1,
      data: { attribute: attr as any },
      log_date: new Date(),
    };

    await handleAttributeMessageV1([message], dbContext);
    const stored = await getAttributeFromDb(attr.id, dbContext);
    expect(stored?.length).toBe(1);
    expect(stored?.[0].kind).toBe(attributeKind.declared);
    expect(stored?.[0].metadata_version).toBe(2);
  });

  it("AttributeAdded - verified", async () => {
    const attr = {
      ...getMockAttribute(),
      kind: AttributeKindV1.VERIFIED,
    };

    const message: AttributeEventEnvelope = {
      sequence_num: 1,
      stream_id: attr.id,
      version: 3,
      type: "AttributeAdded",
      event_version: 1,
      data: { attribute: attr as any },
      log_date: new Date(),
    };

    await handleAttributeMessageV1([message], dbContext);
    const stored = await getAttributeFromDb(attr.id, dbContext);
    expect(stored?.length).toBe(1);
    expect(stored?.[0].kind).toBe(attributeKind.verified);
    expect(stored?.[0].metadata_version).toBe(3);
  });

  it("AttributeAdded - deduplicates batch by attribute ID, keeps only record with highest metadata_version", async () => {
    const attr = {
      ...getMockAttribute(),
      kind: AttributeKindV1.VERIFIED,
    };

    const olderVersionMessage: AttributeEventEnvelope = {
      sequence_num: 1,
      stream_id: attr.id,
      version: 10,
      type: "AttributeAdded",
      event_version: 1,
      data: { attribute: { ...attr } as any },
      log_date: new Date(),
    };

    const newerVersionMessage: AttributeEventEnvelope = {
      sequence_num: 2,
      stream_id: attr.id,
      version: 1,
      type: "AttributeAdded",
      event_version: 1,
      data: { attribute: { ...attr } as any },
      log_date: new Date(),
    };

    await handleAttributeMessageV1(
      [olderVersionMessage, newerVersionMessage],
      dbContext,
    );

    const stored = await getAttributeFromDb(attr.id, dbContext);
    expect(stored?.length).toBe(1);
    expect(stored?.[0].metadata_version).toBe(10);
  });
  it("AttributeAdded - batch with different attribute IDs inserts all records", async () => {
    const attr1 = {
      ...getMockAttribute(),
      id: generateId(),
      kind: AttributeKindV1.CERTIFIED,
    };

    const attr2 = {
      ...getMockAttribute(),
      id: generateId(),
      kind: AttributeKindV1.DECLARED,
    };

    const attr3 = {
      ...getMockAttribute(),
      id: generateId(),
      kind: AttributeKindV1.VERIFIED,
    };

    const messages: AttributeEventEnvelope[] = [
      {
        sequence_num: 1,
        stream_id: attr1.id,
        version: 1,
        type: "AttributeAdded",
        event_version: 1,
        data: { attribute: attr1 as any },
        log_date: new Date(),
      },
      {
        sequence_num: 2,
        stream_id: attr2.id,
        version: 1,
        type: "AttributeAdded",
        event_version: 1,
        data: { attribute: attr2 as any },
        log_date: new Date(),
      },
      {
        sequence_num: 3,
        stream_id: attr3.id,
        version: 1,
        type: "AttributeAdded",
        event_version: 1,
        data: { attribute: attr3 as any },
        log_date: new Date(),
      },
    ];

    await handleAttributeMessageV1(messages, dbContext);

    const stored1 = await getAttributeFromDb(attr1.id, dbContext);
    const stored2 = await getAttributeFromDb(attr2.id, dbContext);
    const stored3 = await getAttributeFromDb(attr3.id, dbContext);
    const allStored = [stored1, stored2, stored3].flat();
    expect(allStored.length).toBe(messages.length);
    expect(stored1?.[0]?.id).toBe(attr1.id);
    expect(stored2?.[0]?.id).toBe(attr2.id);
    expect(stored3?.[0]?.id).toBe(attr3.id);
  });
  it("MaintenanceAttributeDeleted - flags attribute as deleted", async () => {
    const attr = {
      ...getMockAttribute(),
      kind: AttributeKindV1.CERTIFIED,
    };

    const insertMessage: AttributeEventEnvelope = {
      sequence_num: 1,
      stream_id: attr.id,
      version: 1,
      type: "AttributeAdded",
      event_version: 1,
      data: { attribute: attr as any },
      log_date: new Date(),
    };
    await handleAttributeMessageV1([insertMessage], dbContext);
    const storedFirst = await getAttributeFromDb(attr.id, dbContext);
    expect(storedFirst?.length).toBe(1);

    const deleteMessage: AttributeEventEnvelope = {
      sequence_num: 2,
      stream_id: attr.id,
      version: 2,
      type: "MaintenanceAttributeDeleted",
      event_version: 1,
      data: { id: attr.id } as any,
      log_date: new Date(),
    };
    await handleAttributeMessageV1([deleteMessage], dbContext);
    const stored = await getAttributeFromDb(deleteMessage.data.id, dbContext);
    expect(stored?.[0]?.deleted).toBe(true);
  });
  describe("Merge and check on metadata_version", () => {
    it("should skip insert/update when incoming metadata_version is lower or equal", async () => {
      const attr = {
        ...getMockAttribute(),
        kind: AttributeKindV1.DECLARED,
        code: "AAA",
      };
      const first: AttributeEventEnvelope = {
        sequence_num: 1,
        stream_id: attr.id,
        version: 5,
        type: "AttributeAdded",
        event_version: 1,
        data: { attribute: { ...attr } as any },
        log_date: new Date(),
      };
      await handleAttributeMessageV1([first], dbContext);
      let stored = await getAttributeFromDb(attr.id, dbContext);
      expect(stored?.[0].metadata_version).toBe(5);

      const equal: AttributeEventEnvelope = {
        ...first,
        sequence_num: 2,
        version: 5,
      };
      await handleAttributeMessageV1([equal], dbContext);
      stored = await getAttributeFromDb(attr.id, dbContext);
      expect(stored?.[0].metadata_version).toBe(5);

      const lower: AttributeEventEnvelope = {
        ...first,
        sequence_num: 3,
        version: 4,
      };
      await handleAttributeMessageV1([lower], dbContext);
      stored = await getAttributeFromDb(attr.id, dbContext);
      expect(stored?.[0].metadata_version).toBe(5);
    });

    it("should overwrite when incoming metadata_version is greater", async () => {
      const attr = {
        ...getMockAttribute(),
        kind: AttributeKindV1.VERIFIED,
        code: "code",
      };
      const initial: AttributeEventEnvelope = {
        sequence_num: 1,
        stream_id: attr.id,
        version: 1,
        type: "AttributeAdded",
        event_version: 1,
        data: { attribute: { ...attr } as any },
        log_date: new Date(),
      };
      await handleAttributeMessageV1([initial], dbContext);

      const higher: AttributeEventEnvelope = {
        ...initial,
        sequence_num: 2,
        version: 10,
        data: { attribute: { ...attr, code: "updated code" } as any },
      };
      await handleAttributeMessageV1([higher], dbContext);

      const stored = await getAttributeFromDb(attr.id, dbContext);
      expect(stored?.[0].metadata_version).toBe(10);
      expect(stored?.[0].code).toBe("updated code");
    });
  });
});
