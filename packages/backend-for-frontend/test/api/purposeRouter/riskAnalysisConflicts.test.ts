/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { AxiosError, AxiosHeaders } from "axios";
import { purposeApi } from "pagopa-interop-api-clients";
import { authRole } from "pagopa-interop-commons";
import {
  generateToken,
  getMockedApiPurpose,
} from "pagopa-interop-commons-test";
import { generateId, Problem } from "pagopa-interop-models";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { appBasePath } from "../../../src/config/appBasePath.js";
import { config } from "../../../src/config/config.js";
import { api, clients } from "../../vitest.api.setup.js";

const purpose = getMockedApiPurpose();
const correlationId = generateId();
const riskAnalysisForm = { version: "3.1", answers: { purpose: ["OTHER"] } };
const operations = [
  {
    name: "assignRiskAnalysisReviewer",
    method: "post",
    path: `/purposes/${purpose.id}/riskAnalysis/assign`,
    body: {
      reviewMode: "REVIEWER_WRITES_REVIEWER_SIGNS",
      reviewerIds: [generateId()],
    },
    role: authRole.ADMIN_ROLE,
    conflictCode: "004-0044",
    rejectedBlocks: false,
  },
  {
    name: "submitRiskAnalysis",
    method: "post",
    path: `/purposes/${purpose.id}/riskAnalysis/submit`,
    body: { riskAnalysisForm },
    role: authRole.ADMIN_ROLE,
    conflictCode: "004-0047",
    rejectedBlocks: false,
  },
  {
    name: "signRiskAnalysis",
    method: "post",
    path: `/purposes/${purpose.id}/riskAnalysis/sign`,
    body: { metadataVersionToSign: 1 },
    role: authRole.REVIEWER_ROLE,
    conflictCode: "004-0049",
    rejectedBlocks: true,
  },
  {
    name: "rejectRiskAnalysis",
    method: "post",
    path: `/purposes/${purpose.id}/riskAnalysis/reject`,
    body: { rejectionReason: "The risk analysis needs revision" },
    role: authRole.REVIEWER_ROLE,
    conflictCode: "004-0052",
    rejectedBlocks: true,
  },
  {
    name: "editRiskAnalysisForm",
    method: "put",
    path: `/purposes/${purpose.id}/riskAnalysis/form`,
    body: riskAnalysisForm,
    role: authRole.REVIEWER_ROLE,
    conflictCode: "004-0054",
    rejectedBlocks: true,
  },
  {
    name: "updatePurpose",
    method: "post",
    path: `/purposes/${purpose.id}`,
    body: {
      title: "title",
      description: "description",
      isFreeOfCharge: false,
      dailyCalls: 1,
      riskAnalysisForm,
    },
    role: authRole.ADMIN_ROLE,
    conflictCode: "004-0056",
    rejectedBlocks: false,
  },
  {
    name: "patchUpdatePurposeFromTemplate",
    method: "patch",
    path: `/purposeTemplates/${generateId()}/purposes/${purpose.id}`,
    body: { riskAnalysisForm },
    role: authRole.ADMIN_ROLE,
    conflictCode: "004-0056",
    rejectedBlocks: false,
  },
] as const;

const upstreamError = (
  code: string,
  status = 409,
  additionalCodes: string[] = []
) => {
  const problem: Problem = {
    type: "about:blank",
    title: "Upstream conflict",
    status,
    detail: "Original process error",
    correlationId,
    errors: [code, ...additionalCodes].map((code) => ({
      code,
      detail: "Original process error",
    })),
  };
  return new AxiosError("process error", undefined, undefined, undefined, {
    status,
    statusText: "Conflict",
    data: problem,
    headers: {},
    config: { headers: new AxiosHeaders() },
  });
};

const setPurpose = (
  signingState: purposeApi.RiskAnalysisSigningState,
  version = 1
) => {
  vi.mocked(
    clients.purposeProcessClientWithMetadata.getPurpose
  ).mockResolvedValue({
    data: {
      ...purpose,
      reviewerWorkflow: { signingState, reviewers: [] },
    },
    metadata: { version },
  });
};

const makeRequest = (
  operation: (typeof operations)[number],
  body: object = operation.body
) =>
  request(api)
    [operation.method](`${appBasePath}${operation.path}`)
    .set("Authorization", `Bearer ${generateToken(operation.role)}`)
    .set("X-Correlation-Id", correlationId)
    .send(body);

describe("risk analysis mutation conflicts", () => {
  beforeEach(() => {
    config.featureFlagNewOperators = true;
    for (const operation of operations) {
      clients.purposeProcessClient[operation.name] = vi
        .fn()
        .mockRejectedValue(upstreamError(operation.conflictCode));
    }
    clients.purposeProcessClientWithMetadata.getPurpose = vi.fn();
    setPurpose("SIGNED");
  });

  it.each(operations)(
    "returns already approved for $name and preserves correlation id",
    async (operation) => {
      const res = await makeRequest(operation);
      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({
        status: 409,
        correlationId: res.headers["x-correlation-id"],
        errors: [{ code: "008-0052" }],
      });
      expect(
        clients.purposeProcessClient[operation.name]
      ).toHaveBeenCalledTimes(1);
      expect(
        clients.purposeProcessClientWithMetadata.getPurpose
      ).toHaveBeenCalledWith({
        params: { id: purpose.id },
        headers: expect.objectContaining({
          "X-Correlation-Id": res.headers["x-correlation-id"],
        }),
      });
    }
  );

  it.each(operations)(
    "classifies rejected only when it blocks $name",
    async (operation) => {
      setPurpose("REJECTED");
      const res = await makeRequest(operation);
      expect(res.status).toBe(409);
      expect(res.body.errors[0].code).toBe(
        operation.rejectedBlocks ? "008-0053" : operation.conflictCode
      );
    }
  );

  it.each(operations)(
    "classifies event-store conflicts for $name without retry",
    async (operation) => {
      vi.mocked(clients.purposeProcessClient[operation.name]).mockRejectedValue(
        upstreamError("004-10034")
      );
      const res = await makeRequest(operation);
      expect(res.status).toBe(409);
      expect(res.body.errors[0].code).toBe("008-0052");
      expect(
        clients.purposeProcessClient[operation.name]
      ).toHaveBeenCalledTimes(1);
    }
  );

  it.each(operations)(
    "preserves the original $name conflict when diagnostic read fails",
    async (operation) => {
      vi.mocked(
        clients.purposeProcessClientWithMetadata.getPurpose
      ).mockRejectedValue(new Error("diagnostic unavailable"));
      const res = await makeRequest(operation);
      expect(res.status).toBe(409);
      expect(res.body).toEqual(
        upstreamError(operation.conflictCode).response?.data
      );
      expect(
        clients.purposeProcessClient[operation.name]
      ).toHaveBeenCalledTimes(1);
    }
  );

  it.each(operations)(
    "preserves unrelated conflicts for $name without reading purpose",
    async (operation) => {
      const error = upstreamError("004-0016");
      vi.mocked(clients.purposeProcessClient[operation.name]).mockRejectedValue(
        error
      );
      const res = await makeRequest(operation);
      expect(res.status).toBe(409);
      expect(res.body).toEqual(error.response?.data);
      expect(
        clients.purposeProcessClientWithMetadata.getPurpose
      ).not.toHaveBeenCalled();
    }
  );

  it.each(operations)(
    "preserves an unconfirmed event conflict for $name when the readmodel is unchanged",
    async (operation) => {
      vi.mocked(clients.purposeProcessClient[operation.name]).mockRejectedValue(
        upstreamError("004-10034")
      );
      setPurpose("ASSIGNED");
      const res = await makeRequest(operation);
      expect(res.status).toBe(409);
      expect(res.body.errors[0].code).toBe("004-10034");
      expect(
        clients.purposeProcessClient[operation.name]
      ).toHaveBeenCalledTimes(1);
    }
  );

  const sign = operations[2];

  it("preserves mixed risk analysis and unrelated errors without diagnostic reads", async () => {
    const error = upstreamError("004-0049", 409, ["004-0016"]);
    vi.mocked(clients.purposeProcessClient.signRiskAnalysis).mockRejectedValue(
      error
    );
    const res = await makeRequest(sign);
    expect(res.status).toBe(409);
    expect(res.body).toEqual(error.response?.data);
    expect(
      clients.purposeProcessClientWithMetadata.getPurpose
    ).not.toHaveBeenCalled();
  });

  it("prioritizes a rejected state when multiple relevant conflicts include a version mismatch", async () => {
    vi.mocked(clients.purposeProcessClient.signRiskAnalysis).mockRejectedValue(
      upstreamError("004-0049", 409, ["004-0064"])
    );
    setPurpose("REJECTED", 2);
    const res = await makeRequest(sign);
    expect(res.status).toBe(409);
    expect(res.body.errors[0].code).toBe("008-0053");
  });

  it.each([
    { state: "SIGNED", expected: "008-0052" },
    { state: "REJECTED", expected: "008-0053" },
    { state: "ASSIGNED", expected: "008-0054" },
  ] as const)(
    "prioritizes $state over a known signing version mismatch",
    async ({ state, expected }) => {
      vi.mocked(
        clients.purposeProcessClient.signRiskAnalysis
      ).mockRejectedValue(upstreamError("004-0064"));
      setPurpose(state, 2);
      const res = await makeRequest(sign);
      expect(res.status).toBe(409);
      expect(res.body.errors[0].code).toBe(expected);
    }
  );

  it("keeps a known signing version mismatch when diagnostic read fails", async () => {
    vi.mocked(clients.purposeProcessClient.signRiskAnalysis).mockRejectedValue(
      upstreamError("004-0064")
    );
    vi.mocked(
      clients.purposeProcessClientWithMetadata.getPurpose
    ).mockRejectedValue(new Error("unavailable"));
    const res = await makeRequest(sign);
    expect(res.status).toBe(409);
    expect(res.body.errors[0].code).toBe("008-0054");
  });

  it.each([
    { original: "004-10034", expected: "004-10034" },
    { original: "004-0064", expected: "008-0054" },
  ])(
    "preserves the certain cause if diagnostic purpose has no metadata ($original)",
    async ({ original, expected }) => {
      vi.mocked(
        clients.purposeProcessClient.signRiskAnalysis
      ).mockRejectedValue(upstreamError(original));
      vi.mocked(
        clients.purposeProcessClientWithMetadata.getPurpose
      ).mockResolvedValue({
        data: {
          ...purpose,
          reviewerWorkflow: { signingState: "ASSIGNED", reviewers: [] },
        },
        metadata: undefined,
      });
      const res = await makeRequest(sign);
      expect(res.status).toBe(409);
      expect(res.body.errors[0].code).toBe(expected);
    }
  );

  it.each([
    { version: 0, expected: "004-10034" },
    { version: 1, expected: "004-10034" },
    { version: 2, expected: "008-0054" },
  ])(
    "checks signing version after event conflict (readmodel version $version)",
    async ({ version, expected }) => {
      vi.mocked(
        clients.purposeProcessClient.signRiskAnalysis
      ).mockRejectedValue(upstreamError("004-10034"));
      setPurpose("ASSIGNED", version);
      const res = await makeRequest(sign);
      expect(res.status).toBe(409);
      expect(res.body.errors[0].code).toBe(expected);
      expect(
        clients.purposeProcessClient.signRiskAnalysis
      ).toHaveBeenCalledExactlyOnceWith(
        { metadataVersionToSign: 1 },
        expect.objectContaining({ params: { purposeId: purpose.id } })
      );
    }
  );

  it.each([400, 403, 404, 500])(
    "preserves status %s without diagnostic reads",
    async (status) => {
      vi.mocked(
        clients.purposeProcessClient.signRiskAnalysis
      ).mockRejectedValue(upstreamError("004-0049", status));
      const res = await makeRequest(sign);
      expect(res.status).toBe(status);
      expect(
        clients.purposeProcessClientWithMetadata.getPurpose
      ).not.toHaveBeenCalled();
    }
  );

  it.each([
    { operation: operations[1], code: "004-0048" },
    { operation: operations[3], code: "004-0051" },
    { operation: operations[4], code: "004-0053" },
  ])(
    "preserves mode conflicts for $operation.name",
    async ({ operation, code }) => {
      vi.mocked(clients.purposeProcessClient[operation.name]).mockRejectedValue(
        upstreamError(code)
      );
      const res = await makeRequest(operation);
      expect(res.status).toBe(409);
      expect(res.body.errors[0].code).toBe(code);
      expect(
        clients.purposeProcessClientWithMetadata.getPurpose
      ).not.toHaveBeenCalled();
    }
  );

  it("does not retry or diagnose a network error", async () => {
    vi.mocked(clients.purposeProcessClient.signRiskAnalysis).mockRejectedValue(
      new AxiosError("network failure")
    );
    const res = await makeRequest(sign);
    expect(res.status).toBe(500);
    expect(clients.purposeProcessClient.signRiskAnalysis).toHaveBeenCalledTimes(
      1
    );
    expect(
      clients.purposeProcessClientWithMetadata.getPurpose
    ).not.toHaveBeenCalled();
  });

  it("does not read purpose or change the signing seed on success", async () => {
    vi.mocked(clients.purposeProcessClient.signRiskAnalysis).mockResolvedValue(
      purpose
    );
    const res = await makeRequest(sign);
    expect(res.status).toBe(204);
    expect(
      clients.purposeProcessClient.signRiskAnalysis
    ).toHaveBeenCalledExactlyOnceWith(
      sign.body,
      expect.objectContaining({ params: { purposeId: purpose.id } })
    );
    expect(
      clients.purposeProcessClientWithMetadata.getPurpose
    ).not.toHaveBeenCalled();
  });

  it.each([operations[5], operations[6]])(
    "preserves event conflicts in $name when no form was edited",
    async (operation) => {
      vi.mocked(clients.purposeProcessClient[operation.name]).mockRejectedValue(
        upstreamError("004-10034")
      );
      const body = { ...operation.body, riskAnalysisForm: undefined };
      const res = await makeRequest(operation, body);
      expect(res.status).toBe(409);
      expect(res.body.errors[0].code).toBe("004-10034");
      expect(
        clients.purposeProcessClientWithMetadata.getPurpose
      ).not.toHaveBeenCalled();
    }
  );

  it.each([operations[5], operations[6]])(
    "preserves event conflicts in $name when the supplied form is unchanged",
    async (operation) => {
      vi.mocked(clients.purposeProcessClient[operation.name]).mockRejectedValue(
        upstreamError("004-10034")
      );
      vi.mocked(
        clients.purposeProcessClientWithMetadata.getPurpose
      ).mockResolvedValue({
        data: {
          ...purpose,
          riskAnalysisForm,
          reviewerWorkflow: { signingState: "SIGNED", reviewers: [] },
        },
        metadata: { version: 2 },
      });
      const res = await makeRequest(operation);
      expect(res.status).toBe(409);
      expect(res.body.errors[0].code).toBe("004-10034");
    }
  );
});
