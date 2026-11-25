import { purposeWaitingForApprovalReason } from "pagopa-interop-models";
import { describe, expect, it } from "vitest";

import { purposeOverQuotaTemplate } from "../src/templates/purposeOverQuota.js";

describe("purposeOverQuotaTemplate", () => {
  it.each([
    [
      purposeWaitingForApprovalReason.dailyCallsPerConsumer,
      "Hai superato la soglia di chiamate API per fruitore",
      "è stata superata la soglia per fruitore di chiamate API",
    ],
    [
      purposeWaitingForApprovalReason.dailyCallsTotal,
      "Superamento soglie totali di chiamate API",
      "è stata superata la soglia totale di chiamate API",
    ],
    [
      purposeWaitingForApprovalReason.dailyCallsPerConsumerAndTotal,
      "Superamento soglie per fruitore e soglie totali",
      "sono state superate sia la soglia di chiamate API per fruitore sia la soglia totale",
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
});
