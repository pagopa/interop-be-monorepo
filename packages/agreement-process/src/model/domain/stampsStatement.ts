import { agreementApi } from "pagopa-interop-api-clients";
import {
  TenantId,
  AgreementStamps,
  unsafeBrandId,
  UserId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";

const draftStatement = (
  apiAgreement: agreementApi.Agreement,
  consumerId: TenantId,
  producerId: TenantId
): AgreementStamps => {
  if (apiAgreement.suspendedByConsumer) {
    return {
      suspensionByConsumer: {
        who: unsafeBrandId(consumerId),
        when: new Date(),
      },
    };
  } else if (apiAgreement.suspendedByProducer) {
    return {
      suspensionByProducer: {
        who: unsafeBrandId(producerId),
        when: new Date(),
      },
    };
  } else {
    return {};
  }
};

const suspendedStatement = (
  apiAgreement: agreementApi.Agreement,
  userId: UserId,
  consumerId: TenantId,
  producerId: TenantId
): AgreementStamps => {
  if (apiAgreement.suspendedByProducer && apiAgreement.suspendedByConsumer) {
    return {
      submission: {
        who: userId,
        when: new Date(),
      },
      activation: {
        who: userId,
        when: new Date(),
      },
      suspensionByProducer: {
        who: unsafeBrandId(producerId),
        when: new Date(),
      },
      suspensionByConsumer: {
        who: unsafeBrandId(consumerId),
        when: new Date(),
      },
    };
  } else if (apiAgreement.suspendedByConsumer) {
    return {
      submission: {
        who: userId,
        when: new Date(),
      },
      activation: {
        who: userId,
        when: new Date(),
      },
      suspensionByConsumer: {
        who: unsafeBrandId(consumerId),
        when: new Date(),
      },
    };
  } else if (apiAgreement.suspendedByProducer) {
    return {
      submission: {
        who: userId,
        when: new Date(),
      },
      activation: {
        who: userId,
        when: new Date(),
      },
      suspensionByProducer: {
        who: unsafeBrandId(producerId),
        when: new Date(),
      },
    };
  } else {
    return {};
  }
};

const activatedStatement = (
  apiAgreement: agreementApi.Agreement,
  userId: UserId,
  consumerId: TenantId,
  producerId: TenantId
): AgreementStamps => {
  if (apiAgreement.suspendedByProducer && apiAgreement.suspendedByConsumer) {
    return {
      submission: {
        who: userId,
        when: new Date(),
      },
      activation: {
        who: userId,
        when: new Date(),
      },
      suspensionByProducer: {
        who: unsafeBrandId(producerId),
        when: new Date(),
      },
      suspensionByConsumer: {
        who: unsafeBrandId(consumerId),
        when: new Date(),
      },
    };
  } else if (apiAgreement.suspendedByConsumer) {
    return {
      submission: {
        who: userId,
        when: new Date(),
      },
      activation: {
        who: userId,
        when: new Date(),
      },
      suspensionByConsumer: {
        who: unsafeBrandId(consumerId),
        when: new Date(),
      },
    };
  } else if (apiAgreement.suspendedByProducer) {
    return {
      submission: {
        who: userId,
        when: new Date(),
      },
      activation: {
        who: userId,
        when: new Date(),
      },
      suspensionByProducer: {
        who: unsafeBrandId(producerId),
        when: new Date(),
      },
    };
  } else {
    return {
      submission: {
        who: userId,
        when: new Date(),
      },
      activation: {
        who: userId,
        when: new Date(),
      },
    };
  }
};

const pendingStatement = (
  apiAgreement: agreementApi.Agreement,
  userId: UserId,
  consumerId: TenantId,
  producerId: TenantId
): AgreementStamps => {
  if (apiAgreement.suspendedByProducer && apiAgreement.suspendedByConsumer) {
    return {
      submission: {
        who: userId,
        when: new Date(),
      },
      suspensionByProducer: {
        who: unsafeBrandId(producerId),
        when: new Date(),
      },
      suspensionByConsumer: {
        who: unsafeBrandId(consumerId),
        when: new Date(),
      },
    };
  } else if (apiAgreement.suspendedByConsumer) {
    return {
      suspensionByConsumer: {
        who: unsafeBrandId(consumerId),
        when: new Date(),
      },
      submission: {
        who: userId,
        when: new Date(),
      },
    };
  } else if (apiAgreement.suspendedByProducer) {
    return {
      suspensionByProducer: {
        who: unsafeBrandId(producerId),
        when: new Date(),
      },
      submission: {
        who: userId,
        when: new Date(),
      },
    };
  } else {
    return {
      submission: {
        who: userId,
        when: new Date(),
      },
    };
  }
};

export const agreementStamps = (
  apiAgreement: agreementApi.Agreement,
  userId: UserId,
  consumerId: TenantId,
  producerId: TenantId
): AgreementStamps =>
  match(apiAgreement.state)
    .with("DRAFT", () => draftStatement(apiAgreement, consumerId, producerId))
    .with("ACTIVE", () =>
      activatedStatement(apiAgreement, userId, consumerId, producerId)
    )
    .with("REJECTED", () => ({
      submission: {
        who: userId,
        when: new Date(),
      },
      rejection: {
        who: userId,
        when: new Date(),
      },
    }))
    .with("ARCHIVED", () => ({
      submission: {
        who: userId,
        when: new Date(),
      },
      archiving: {
        who: userId,
        when: new Date(),
      },
    }))
    .with("SUSPENDED", () =>
      suspendedStatement(apiAgreement, userId, consumerId, producerId)
    )
    .with("PENDING", () =>
      pendingStatement(apiAgreement, userId, consumerId, producerId)
    )
    .otherwise(() => ({}));
