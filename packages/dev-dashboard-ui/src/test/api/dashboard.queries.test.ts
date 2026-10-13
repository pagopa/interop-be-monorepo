import { useQuery } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DashboardQueries } from "../../api/dashboard/dashboard.queries";
import { useRuntimeStatus } from "../../hooks/useRuntimeStatus";
import { identitiesFixture, statusFixture } from "../fixtures";
import { createTestWrapper } from "../utils";

describe("dashboard query lifecycle", () => {
  it("keeps identities cached across seed preparation status updates and refreshes them for a new seed revision", async () => {
    let status = statusFixture();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(async (input) =>
        Response.json(
          String(input).endsWith("/identities") ? identitiesFixture : status
        )
      );
    vi.stubGlobal("fetch", fetchMock);
    const { result, rerender } = renderHook(
      (revision) => ({
        runtime: useRuntimeStatus(),
        identities: useQuery(DashboardQueries.identities(revision)),
      }),
      { initialProps: "seed-complete", wrapper: createTestWrapper() }
    );
    await waitFor(() => expect(result.current.identities.data).toBeDefined());
    const identityRequests = () =>
      fetchMock.mock.calls.filter(([input]) =>
        String(input).endsWith("/identities")
      );
    expect(identityRequests()).toHaveLength(1);
    status = {
      ...status,
      operations: [
        {
          id: "prepare",
          kind: "seed.prepare",
          state: "passed",
          startedAt: "2026-10-08T12:00:00Z",
          phases: [],
        },
      ],
    };
    await act(() => result.current.runtime.refresh());
    await waitFor(() =>
      expect(result.current.runtime.status?.operations[0]?.id).toBe("prepare")
    );
    expect(identityRequests()).toHaveLength(1);
    rerender("new-seed-complete");
    await waitFor(() => expect(identityRequests()).toHaveLength(2));
  });
});
