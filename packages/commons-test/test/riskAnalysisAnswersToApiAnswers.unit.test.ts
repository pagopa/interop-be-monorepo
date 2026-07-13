import { riskAnalysisAnswersToApiAnswers } from "pagopa-interop-commons";
import { describe, it, expect } from "vitest";

describe("riskAnalysisAnswersToApiAnswers", () => {
  it("should merge single and multi answers into a single key-value map, wrapping single answer values in an array", () => {
    expect(
      riskAnalysisAnswersToApiAnswers(
        [
          { key: "purpose", value: "INSTITUTIONAL" },
          { key: "legalBasis", value: "LEGAL_OBLIGATION" },
        ],
        [
          {
            key: "personalDataTypes",
            values: ["OTHER", "WITH_NON_IDENTIFYING"],
          },
        ]
      )
    ).toEqual({
      purpose: ["INSTITUTIONAL"],
      legalBasis: ["LEGAL_OBLIGATION"],
      personalDataTypes: ["OTHER", "WITH_NON_IDENTIFYING"],
    });
  });

  it("should skip single answers with no value", () => {
    expect(
      riskAnalysisAnswersToApiAnswers(
        [
          { key: "answered", value: "YES" },
          { key: "undefinedValue", value: undefined },
          { key: "missingValue" },
          { key: "emptyValue", value: "" },
        ],
        []
      )
    ).toEqual({ answered: ["YES"] });
  });

  it("should skip multi answers with no values", () => {
    expect(
      riskAnalysisAnswersToApiAnswers(
        [],
        [
          { key: "answered", values: ["A", "B"] },
          { key: "emptyValues", values: [] },
        ]
      )
    ).toEqual({ answered: ["A", "B"] });
  });

  it("should return an empty map when there are no answers", () => {
    expect(riskAnalysisAnswersToApiAnswers([], [])).toEqual({});
  });
});
