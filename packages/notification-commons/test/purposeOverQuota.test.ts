import { purposeWaitingForApprovalReason } from "pagopa-interop-models";
import { describe, expect, it } from "vitest";

import { purposeOverQuotaTemplate } from "../src/templates/purposeOverQuota.js";

describe("purposeOverQuotaTemplate", () => {
  it.each([
    [
      purposeWaitingForApprovalReason.dailyCallsPerConsumer,
      "Hai superato la soglia di chiamate API per fruitore",
      "con questa stima di chiamate API superi la soglia per fruitore",
    ],
    [
      purposeWaitingForApprovalReason.dailyCallsTotal,
      "Superamento soglie totali di chiamate API",
      "sono già state superate le soglie totali di chiamate API definite dall'erogatore",
    ],
    [
      purposeWaitingForApprovalReason.dailyCallsPerConsumerAndTotal,
      "Superamento soglie per fruitore e soglie totali",
      "è stata superata almeno una delle soglie di chiamate API/giorno definite dall’erogatore (per fruitore o totali)",
    ],
  ] as const)(
    "renders the approved copy for reason %s",
    (reason, title, explanation) => {
      expect(purposeOverQuotaTemplate("Finalità", "Servizio", reason)).toEqual({
        title,
        body: `La finalità Finalità associata all'e-service Servizio è in attesa di approvazione perché ${explanation}. La finalità dovrà essere approvata dall'erogatore.`,
      });
    }
  );

  it("uses generic copy for legacy reasons", () => {
    expect(purposeOverQuotaTemplate("Finalità", "Servizio", undefined)).toEqual(
      purposeOverQuotaTemplate(
        "Finalità",
        "Servizio",
        purposeWaitingForApprovalReason.dailyCallsPerConsumerAndTotal
      )
    );
  });
});
