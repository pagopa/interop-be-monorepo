import { AgreementV1 } from "../gen/v1/agreement/agreement.js";

export type AgreementEvent = { type: "AgreementAdded"; data: AgreementV1 };
