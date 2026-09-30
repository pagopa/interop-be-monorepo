import {
  PurposeWaitingForApprovalReason,
  purposeWaitingForApprovalReason,
} from "pagopa-interop-models";
import { match } from "ts-pattern";

// The reason describes the quota check at event creation time. Do not recompute
// it from the current read model when dispatching the notification.
export function purposeOverQuotaTemplate(
  purposeName: string,
  eserviceName: string,
  reason: PurposeWaitingForApprovalReason | undefined
): { title: string; body: string } {
  const { title, explanation } = match(reason)
    .with(purposeWaitingForApprovalReason.dailyCallsPerConsumer, () => ({
      title: "Hai superato la soglia di chiamate API per fruitore",
      explanation:
        "con questa stima di chiamate API superi la soglia per fruitore",
    }))
    .with(purposeWaitingForApprovalReason.dailyCallsTotal, () => ({
      title: "Superamento soglie totali di chiamate API",
      explanation:
        "sono già state superate le soglie totali di chiamate API definite dall'erogatore",
    }))
    // Both quotas, legacy events without a reason, and unknown future values
    // use the generic copy: it does not claim that both quotas were exceeded.
    .otherwise(() => ({
      title: "Superamento soglie per fruitore e soglie totali",
      explanation:
        "è stata superata almeno una delle soglie di chiamate API/giorno definite dall’erogatore (per fruitore o totali)",
    }));

  return {
    title,
    body: `La finalità ${purposeName} associata all'e-service ${eserviceName} è in attesa di approvazione perché ${explanation}. La finalità dovrà essere approvata dall'erogatore.`,
  };
}
