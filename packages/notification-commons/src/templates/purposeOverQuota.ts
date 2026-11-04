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
  reason: PurposeWaitingForApprovalReason
): { title: string; body: string } {
  const { title, explanation } = match(reason)
    .with(purposeWaitingForApprovalReason.dailyCallsPerConsumer, () => ({
      title: "Hai superato la soglia di chiamate API per fruitore",
      explanation: "è stata superata la soglia per fruitore di chiamate API",
    }))
    .with(purposeWaitingForApprovalReason.dailyCallsTotal, () => ({
      title: "Superamento soglie totali di chiamate API",
      explanation: "è stata superata la soglia totale di chiamate API",
    }))
    .with(
      purposeWaitingForApprovalReason.dailyCallsPerConsumerAndTotal,
      () => ({
        title: "Superamento soglie per fruitore e soglie totali",
        explanation:
          "sono state superate sia la soglia di chiamate API per fruitore sia la soglia totale",
      })
    )
    .exhaustive();

  return {
    title,
    body: `La finalità ${purposeName} associata all'e-service ${eserviceName} è in attesa di approvazione perché ${explanation}. La finalità dovrà essere approvata dall'erogatore.`,
  };
}
