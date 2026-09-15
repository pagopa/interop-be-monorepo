import { describe, expect, it } from "vitest";
import { Problem } from "pagopa-interop-models";
import { applyErrorCopy, errorCopy } from "../src/model/errorCopy.js";

const endpoint = "GET /catalog/:eserviceId";

const processProblem: Problem = {
  type: "about:blank",
  status: 404,
  title: "EService not found",
  detail: "EService 123 not found",
  correlationId: "test-correlation-id",
  errors: [{ code: "001-0007", detail: "EService 123 not found" }],
};

describe("applyErrorCopy", () => {
  it("returns the problem unchanged when the endpoint has no copy", () => {
    expect(applyErrorCopy(processProblem, undefined)).toEqual(processProblem);
    expect(
      applyErrorCopy(processProblem, "GET /producers/eservices/:eserviceId")
    ).toEqual(processProblem);
  });

  it("returns the problem unchanged when the code has no copy for that endpoint", () => {
    const problem: Problem = {
      ...processProblem,
      errors: [{ code: "001-9999", detail: "EService 123 not found" }],
    };
    expect(applyErrorCopy(problem, endpoint)).toEqual(problem);
  });

  it("sets the error code as type and returns the copy in every available language", () => {
    const { messages } = errorCopy[endpoint]["001-0007"];

    expect(applyErrorCopy(processProblem, endpoint)).toEqual({
      ...processProblem,
      type: "eserviceNotFound",
      detail: messages.it,
      userMessages: messages,
      errors: [{ code: "001-0007", detail: messages.it }],
    });
  });

  it("uses a distinct copy for each error the same endpoint can return", () => {
    const submitEndpoint = "POST /agreements/:agreementId/submit";
    const alreadySubmitted = {
      key: "agreementAlreadySubmitted",
      messages: {
        it: "La richiesta di fruizione è già stata inviata",
        en: "The agreement has already been submitted",
        fr: "L'accord a déjà été soumis",
      },
    };
    const missingAttributes = {
      key: "missingRequiredAttributes",
      messages: {
        it: "Mancano alcuni attributi richiesti",
        en: "Some required attributes are missing",
        fr: "Certains attributs requis sont manquants",
      },
    };
    // eslint-disable-next-line functional/immutable-data
    errorCopy[submitEndpoint] = {
      "002-0011": alreadySubmitted,
      "002-0016": missingAttributes,
    };

    try {
      const problemOf = (code: string): Problem => ({
        ...processProblem,
        errors: [{ code, detail: "process detail" }],
      });

      expect(
        applyErrorCopy(problemOf("002-0011"), submitEndpoint)
      ).toMatchObject({
        type: alreadySubmitted.key,
        userMessages: alreadySubmitted.messages,
      });
      expect(
        applyErrorCopy(problemOf("002-0016"), submitEndpoint)
      ).toMatchObject({
        type: missingAttributes.key,
        userMessages: missingAttributes.messages,
      });
    } finally {
      // eslint-disable-next-line functional/immutable-data
      delete errorCopy[submitEndpoint];
    }
  });
});
