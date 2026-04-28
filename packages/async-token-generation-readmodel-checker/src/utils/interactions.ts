import { dateToSeconds, Logger } from "pagopa-interop-commons";
import {
  AsyncPlatformStatesCatalogEntry,
  Interaction,
  interactionState,
  makeGSIPKEServiceIdDescriptorId,
  makePlatformStatesEServiceDescriptorPK,
  PlatformStatesGenericEntry,
} from "pagopa-interop-models";
import {
  buildAsyncDescriptorMap,
  buildPurposeMaps,
  logDifference,
} from "./common.js";
import { ReadModelContext } from "./readModelContext.js";

const getInteractionRequiredTimestampFields = (
  interaction: Interaction
): Array<keyof Interaction> => {
  switch (interaction.state) {
    case interactionState.startInteraction:
      return ["startInteractionTokenIssuedAt"];
    case interactionState.callbackInvocation:
      return [
        "startInteractionTokenIssuedAt",
        "callbackInvocationTokenIssuedAt",
      ];
    case interactionState.getResource:
      return [
        "startInteractionTokenIssuedAt",
        "callbackInvocationTokenIssuedAt",
      ];
    case interactionState.confirmation:
      return [
        "startInteractionTokenIssuedAt",
        "callbackInvocationTokenIssuedAt",
        "confirmationTokenIssuedAt",
      ];
  }
};

const compareInteractionEntries = ({
  rawInteractions,
  readModelContext,
  asyncPlatformStatesByPK,
  interactionTtlEpsilonSeconds,
  logger,
}: {
  rawInteractions: Iterable<unknown>;
  readModelContext: ReadModelContext;
  asyncPlatformStatesByPK: Map<string, AsyncPlatformStatesCatalogEntry>;
  interactionTtlEpsilonSeconds: number | undefined;
  logger: Logger;
}): number => {
  const { purposesById } = buildPurposeMaps(readModelContext.purposes);
  const asyncDescriptorsByEServiceDescriptor = buildAsyncDescriptorMap(
    readModelContext.eservices
  );
  const clientsById = new Map(
    readModelContext.clients.map((client) => [client.id, client])
  );

  let differencesCount = 0;

  for (const rawInteraction of rawInteractions) {
    const parsedInteraction = Interaction.safeParse(rawInteraction);
    if (!parsedInteraction.success) {
      differencesCount += logDifference({
        logger,
        message: "Unable to parse interactions entry",
        actual: rawInteraction,
        expected: "Interaction",
      });
      continue;
    }

    const interaction = parsedInteraction.data;
    const client = clientsById.get(interaction.clientId);
    const purpose = purposesById.get(interaction.purposeId);
    const asyncDescriptor = asyncDescriptorsByEServiceDescriptor.get(
      makeGSIPKEServiceIdDescriptorId({
        eserviceId: interaction.eServiceId,
        descriptorId: interaction.descriptorId,
      })
    );
    const platformEntry = asyncPlatformStatesByPK.get(
      makePlatformStatesEServiceDescriptorPK({
        eserviceId: interaction.eServiceId,
        descriptorId: interaction.descriptorId,
      })
    );

    if (!client || !client.purposes.includes(interaction.purposeId)) {
      differencesCount += logDifference({
        logger,
        message: `Interaction ${interaction.PK} references an unknown or incoherent client`,
        actual: interaction.clientId,
        expected: `client with purpose ${interaction.purposeId}`,
      });
    }

    if (
      !purpose ||
      purpose.consumerId !== interaction.consumerId ||
      purpose.eserviceId !== interaction.eServiceId
    ) {
      differencesCount += logDifference({
        logger,
        message: `Interaction ${interaction.PK} references an unknown or incoherent purpose`,
        actual: purpose,
        expected: {
          purposeId: interaction.purposeId,
          consumerId: interaction.consumerId,
          eServiceId: interaction.eServiceId,
        },
      });
    }

    if (!asyncDescriptor) {
      differencesCount += logDifference({
        logger,
        message: `Interaction ${interaction.PK} references a non-async descriptor`,
        actual: {
          eServiceId: interaction.eServiceId,
          descriptorId: interaction.descriptorId,
        },
        expected: "async descriptor in readmodel SQL",
      });
    }

    if (!platformEntry) {
      differencesCount += logDifference({
        logger,
        message: `Interaction ${interaction.PK} references a descriptor missing from async platform-states`,
        actual: {
          eServiceId: interaction.eServiceId,
          descriptorId: interaction.descriptorId,
        },
        expected: "async platform-states catalog entry",
      });
    }

    for (const field of getInteractionRequiredTimestampFields(interaction)) {
      if (!interaction[field]) {
        differencesCount += logDifference({
          logger,
          message: `Interaction ${interaction.PK} is missing timestamp ${String(
            field
          )}`,
          actual: interaction,
          expected: `${String(field)} valued`,
        });
      }
    }

    if (interaction.ttl <= 0) {
      differencesCount += logDifference({
        logger,
        message: `Interaction ${interaction.PK} has invalid ttl`,
        actual: interaction.ttl,
        expected: "positive ttl",
      });
    }

    if (
      interactionTtlEpsilonSeconds !== undefined &&
      interaction.startInteractionTokenIssuedAt &&
      asyncDescriptor?.descriptor.asyncExchangeProperties
    ) {
      const expectedTtl =
        dateToSeconds(new Date(interaction.startInteractionTokenIssuedAt)) +
        asyncDescriptor.descriptor.asyncExchangeProperties.responseTime +
        asyncDescriptor.descriptor.asyncExchangeProperties
          .resourceAvailableTime +
        interactionTtlEpsilonSeconds;

      if (interaction.ttl !== expectedTtl) {
        differencesCount += logDifference({
          logger,
          message: `Interaction ${interaction.PK} has incoherent ttl`,
          actual: interaction.ttl,
          expected: expectedTtl,
        });
      }
    }
  }

  return differencesCount;
};

export const compareInteractions = ({
  rawInteractions,
  readModelContext,
  platformStates,
  interactionTtlEpsilonSeconds,
  logger,
}: {
  rawInteractions: unknown[];
  readModelContext: ReadModelContext;
  platformStates: PlatformStatesGenericEntry[];
  interactionTtlEpsilonSeconds: number | undefined;
  logger: Logger;
}): number => {
  const asyncPlatformStatesByPK = new Map(
    platformStates.flatMap((entry) => {
      const parsedEntry = AsyncPlatformStatesCatalogEntry.safeParse(entry);
      return parsedEntry.success
        ? [[parsedEntry.data.PK, parsedEntry.data]]
        : [];
    })
  );

  return compareInteractionEntries({
    rawInteractions,
    readModelContext,
    asyncPlatformStatesByPK,
    interactionTtlEpsilonSeconds,
    logger,
  });
};

export const compareInteractionsPages = async ({
  rawInteractionsPages,
  readModelContext,
  asyncPlatformStatesByPK,
  interactionTtlEpsilonSeconds,
  logger,
}: {
  rawInteractionsPages: AsyncGenerator<unknown[], void, void>;
  readModelContext: ReadModelContext;
  asyncPlatformStatesByPK: Map<string, AsyncPlatformStatesCatalogEntry>;
  interactionTtlEpsilonSeconds: number | undefined;
  logger: Logger;
}): Promise<number> => {
  let differencesCount = 0;

  for await (const page of rawInteractionsPages) {
    differencesCount += compareInteractionEntries({
      rawInteractions: page,
      readModelContext,
      asyncPlatformStatesByPK,
      interactionTtlEpsilonSeconds,
      logger,
    });
  }

  return differencesCount;
};
