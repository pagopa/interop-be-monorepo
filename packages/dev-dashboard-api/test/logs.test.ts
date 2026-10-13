import { describe, expect, it } from "vitest";

import type { LogQuery } from "../src/model/domain/models.js";

import { logServiceBuilder } from "../src/services/logService.js";

describe("incremental logs", () => {
  it("retains cursor scope and resets malformed cursors in buffer order", () => {
    const logs = logServiceBuilder();
    logs.append("first", "INFO first");
    logs.append("second", "WARN second");
    logs.append("excluded", "ERROR excluded");
    const initial = logs.read({});
    const generation = initial.cursors.second.split(":")[0];

    const result = logs.read({
      sources: ["second", "first"],
      cursors: {
        first: "old-generation:1",
        second: `${generation}:invalid`,
        excluded: initial.cursors.excluded,
        unknown: "retained:1",
      },
    });

    expect(result.resetSources).toEqual(["first", "second"]);
    expect(result.entries.map((entry) => entry.source)).toEqual([
      "first",
      "second",
    ]);
    expect(result.cursors).toEqual({
      first: initial.cursors.first,
      second: initial.cursors.second,
    });
    expect(logs.read({ sources: [], cursors: initial.cursors })).toEqual({
      entries: [],
      cursors: {},
      resetSources: [],
    });
  });

  it("parses prefixed structured logs and normalizes supported level aliases", () => {
    const logs = logServiceBuilder();
    logs.append(
      "infra:db",
      'prefix {"level":"FATAL","message":"failure","cid":"request"}'
    );
    logs.append("text", "WARNING plain line");
    logs.append("text", '["INFO"]');
    logs.append("text", '{"level":"custom","message":"unknown"}');
    logs.append("text", "   ");

    expect(
      logs.read({}).entries.map(({ service, level, message, cid }) => ({
        service,
        level,
        message,
        cid,
      }))
    ).toEqual([
      { service: "db", level: "error", message: "failure", cid: "request" },
      {
        service: "text",
        level: "warn",
        message: "WARNING plain line",
        cid: undefined,
      },
      { service: "text", level: "info", message: '["INFO"]', cid: undefined },
      { service: "text", level: "unknown", message: "unknown", cid: undefined },
    ]);
  });

  it("isolates buffers, cursor generations, capacity and entry order between service instances", () => {
    const first = logServiceBuilder(2);
    const second = logServiceBuilder(20);

    first.append("shared", "first-1");
    first.append("shared", "first-2");
    first.append("shared", "first-3");
    second.append("shared", "second-1");

    expect(
      first.read({}).entries.map(({ id, message }) => ({ id, message }))
    ).toEqual([
      { id: "2", message: "first-2" },
      { id: "3", message: "first-3" },
    ]);
    const before = second.read({});
    expect(before.entries.map(({ id, message }) => ({ id, message }))).toEqual([
      { id: "1", message: "second-1" },
    ]);

    first.reset("shared");
    first.append("shared", "first-reset");
    second.append("shared", "second-2");

    const delta = second.read({ cursors: before.cursors });
    expect(delta.resetSources).toEqual([]);
    expect(delta.entries.map(({ id, message }) => ({ id, message }))).toEqual([
      { id: "2", message: "second-2" },
    ]);
  });

  it.each(["correlationId", "correlation_id", "cid"])(
    "searches separate %s metadata with the same case-insensitive substring semantics as messages",
    (field) => {
      const logs = logServiceBuilder();
      logs.append(
        "a",
        JSON.stringify({
          level: "info",
          message: "Request completed",
          [field]: "ABC-123-XYZ",
        })
      );
      logs.append("a", '{"level":"info","message":"Unrelated request"}');
      expect(
        logs
          .read({ search: "123-x" })
          .entries.map((entry) => ({ message: entry.message, cid: entry.cid }))
      ).toEqual([{ message: "Request completed", cid: "ABC-123-XYZ" }]);
    }
  );
  it("matches Search against either message text or CID metadata without requiring both", () => {
    const logs = logServiceBuilder();
    logs.append(
      "a",
      '{"level":"info","message":"Client SENT a request","correlationId":"other-id"}'
    );
    logs.append(
      "b",
      '{"level":"info","message":"Request completed","correlationId":"SENT-ID"}'
    );
    logs.append("c", "Unrelated message");
    expect(
      logs.read({ search: "sEnT" }).entries.map((entry) => entry.source)
    ).toEqual(["a", "b"]);
  });
  it("preserves source, level, pagination and reset while Search matches metadata-only CIDs", () => {
    const logs = logServiceBuilder();
    logs.append("a", "Initial line");
    const initial = logs.read({});
    logs.append(
      "a",
      '{"level":"error","message":"First match","correlationId":"shared-ID-1"}'
    );
    logs.append(
      "b",
      '{"level":"error","message":"Other source","correlationId":"shared-ID-2"}'
    );
    logs.append(
      "a",
      '{"level":"info","message":"Other level","correlationId":"shared-ID-3"}'
    );
    logs.append(
      "a",
      '{"level":"error","message":"Second match","correlationId":"shared-ID-4"}'
    );
    const query = {
      source: "a",
      level: "error",
      search: "SHARED-id",
      limit: 1,
    } satisfies LogQuery;
    const first = logs.read({ ...query, cursors: initial.cursors });
    expect(first.entries.map((entry) => entry.message)).toEqual([
      "First match",
    ]);
    const next = logs.read({ ...query, cursors: first.cursors });
    expect(next.entries.map((entry) => entry.message)).toEqual([
      "Second match",
    ]);
    logs.reset("a");
    logs.append(
      "a",
      '{"level":"error","message":"After rotation","cid":"shared-ID-5"}'
    );
    const reset = logs.read({ ...query, cursors: next.cursors });
    expect(reset.resetSources).toEqual(["a"]);
    expect(reset.entries.map((entry) => entry.message)).toEqual([
      "After rotation",
    ]);
  });
  it("filters a quiet service before taking the latest aggregate page", () => {
    const logs = logServiceBuilder(1000);
    logs.append("quiet", "wanted diagnostic");
    for (let index = 0; index < 600; index++)
      logs.append("busy", `noise ${index}`);
    expect(
      logs
        .read({ limit: 500 })
        .entries.some((entry) => entry.service === "quiet")
    ).toBe(false);
    expect(
      logs
        .read({ service: "quiet", limit: 500 })
        .entries.map((entry) => entry.message)
    ).toEqual(["wanted diagnostic"]);
  });
  it("keeps independent cursors without losing paginated messages from other services", () => {
    const logs = logServiceBuilder(20);
    logs.append(
      "a",
      '{"level":"info","message":"one","correlationId":"cid-1"}'
    );
    const first = logs.read({ limit: 1 });
    logs.append("b", "ERROR two");
    logs.append("a", "three");
    expect(first.entries).toHaveLength(1);
    const next = logs.read({ cursors: first.cursors, limit: 10 });
    expect(next.entries.map((e) => e.message)).toEqual(["ERROR two", "three"]);
    expect(logs.read({ cid: "cid-1" }).entries[0]?.message).toBe("one");
    expect(logs.read({ level: "error" }).entries).toHaveLength(1);
  });
  it("signals source reset after rotation or cursor expiry", () => {
    const logs = logServiceBuilder(2);
    logs.append("a", "one");
    const first = logs.read({});
    logs.append("a", "two");
    logs.append("a", "three");
    logs.append("a", "four");
    expect(logs.read({ cursors: first.cursors }).resetSources).toContain("a");
    logs.reset("a");
    logs.append("a", "new process");
    const next = logs.read({ cursors: first.cursors });
    expect(next.resetSources).toContain("a");
    expect(next.entries.map((e) => e.message)).toEqual(["new process"]);
  });
  it("filters source/text/cid without advancing past other matching pages", () => {
    const logs = logServiceBuilder(20);
    logs.append("a", "ignore");
    const initial = logs.read({});
    logs.append("a", "WARN wanted 1");
    logs.append("a", "WARN wanted 2");
    const first = logs.read({
      source: "a",
      search: "wanted",
      cursors: initial.cursors,
      limit: 1,
    });
    const next = logs.read({
      source: "a",
      search: "wanted",
      cursors: first.cursors,
      limit: 1,
    });
    expect(next.entries[0]?.message).toBe("WARN wanted 2");
  });
  it("returns the newest initial aggregate batch, then only subsequent messages", () => {
    const logs = logServiceBuilder(20);
    logs.append("a", "old 1");
    logs.append("b", "old 2");
    logs.append("a", "latest 1");
    logs.append("b", "latest 2");
    const initial = logs.read({ cursors: {}, limit: 2 });
    expect(initial.entries.map((e) => e.message)).toEqual([
      "latest 1",
      "latest 2",
    ]);
    logs.append("a", "new message");
    expect(
      logs.read({ cursors: initial.cursors }).entries.map((e) => e.message)
    ).toEqual(["new message"]);
    const restarted = logServiceBuilder(20);
    restarted.append("a", "new runtime");
    expect(restarted.read({ cursors: initial.cursors }).resetSources).toContain(
      "a"
    );
  });
});
