import path from "path";
import { fileURLToPath } from "url";
import {
  dateAtRomeZone,
  PDFGenerator,
  timeAtRomeZone,
} from "pagopa-interop-commons";
import { Delegation, EService, Tenant } from "pagopa-interop-models";

// eslint-disable-next-line max-params
export async function generatePdfDelegation(
  today: Date,
  delegation: Delegation,
  delegator: Tenant,
  delegate: Tenant,
  eservice: EService,
  pdfGenerator: PDFGenerator
): Promise<Buffer> {
  const filename = fileURLToPath(import.meta.url);
  const dirname = path.dirname(filename);
  const templateFilePath = path.resolve(
    dirname,
    "..",
    "resources/templates",
    "delegationApprovedTemplate.html"
  );
  const todayDate = dateAtRomeZone(today);
  const todayTime = timeAtRomeZone(today);

  const submissionDate = dateAtRomeZone(delegation.stamps.submission.when);
  const submissionTime = timeAtRomeZone(delegation.stamps.submission.when);

  return await pdfGenerator.generate(templateFilePath, {
    todayDate,
    todayTime,
    delegationId: delegation.id,
    delegatorName: delegator.name,
    delegatorCode: delegator.externalId.value,
    delegateName: delegate.name,
    delegateCode: delegate.externalId.value,
    submitterId: delegation.stamps.submission.who,
    eServiceName: eservice.name,
    eServiceId: eservice.id,
    submissionDate,
    submissionTime,
    activationDate: todayDate,
    activationTime: todayTime,
    activatorId: delegate.id,
  });
}
