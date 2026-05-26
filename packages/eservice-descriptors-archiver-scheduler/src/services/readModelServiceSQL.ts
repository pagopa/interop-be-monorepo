/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { and, eq, inArray, lte, sql } from "drizzle-orm";
import {
  descriptorState,
  unsafeBrandId,
  archivingScope,
  EServiceId,
} from "pagopa-interop-models";
import {
  eserviceDescriptorInReadmodelCatalog,
  eserviceInReadmodelCatalog,
  DrizzleReturnType,
  EServiceDescriptorSQL,
  eserviceDescriptorArchivingScheduleInReadmodelCatalog,
  EServiceDescriptorArchivingScheduleSQL,
  EServiceSQL,
} from "pagopa-interop-readmodel-models";
import {
  ArchivableDescriptorRef,
  UnarchivableDescriptor,
  EServiceWithUnarchivableDescriptors,
} from "../models/models.js";

export function readModelServiceBuilderSQL(readModelDB: DrizzleReturnType) {
  return {
    /**
     * Fetches all expired archivable descriptor references from the database.
     * A descriptor is considered expired and archivable if it has a state of "archiving" or "archivingSuspended"
     * and its archivableOn date is in the past.
     *
     * @returns The array of expired archivable descriptor references
     */
    async getExpiredArchivableDescriptorRefs(): Promise<
      ArchivableDescriptorRef[]
    > {
      const queryResult: {
        descriptor: EServiceDescriptorSQL;
        archivingSchedule: EServiceDescriptorArchivingScheduleSQL | null;
      }[] = await readModelDB
        .select({
          descriptor: eserviceDescriptorInReadmodelCatalog,
          archivingSchedule:
            eserviceDescriptorArchivingScheduleInReadmodelCatalog,
        })
        .from(eserviceDescriptorInReadmodelCatalog)
        .leftJoin(
          eserviceDescriptorArchivingScheduleInReadmodelCatalog,
          eq(
            eserviceDescriptorInReadmodelCatalog.id,
            eserviceDescriptorArchivingScheduleInReadmodelCatalog.descriptorId
          )
        )
        .where(
          and(
            inArray(eserviceDescriptorInReadmodelCatalog.state, [
              descriptorState.archiving,
              descriptorState.archivingSuspended,
            ]),
            lte(
              eserviceDescriptorArchivingScheduleInReadmodelCatalog.archivableOn,
              new Date().toISOString()
            ),
            eq(
              eserviceDescriptorArchivingScheduleInReadmodelCatalog.scope,
              archivingScope.descriptor
            )
          )
        );

      const refs = queryResult.map((row) => row.descriptor);

      const ArchivableDescriptorRef: ArchivableDescriptorRef[] = refs.map(
        (descriptor) => ({
          eserviceId: unsafeBrandId(descriptor.eserviceId),
          descriptorId: unsafeBrandId(descriptor.id),
        })
      );
      return ArchivableDescriptorRef;
    },
    /**
     * Fetches all expired archivable e-service references from the database.
     * An e-service is considered expired and archivable if its descriptors have a state of "archiving" or "archivingSuspended"
     * and its archivableOn date is in the past.
     *
     * @returns The array of expired archivable e-service references
     */
    async getArchivableEserviceRefs(): Promise<EServiceId[]> {
      const queryResult: {
        eservice: EServiceSQL;
      }[] = await readModelDB
        .selectDistinct({
          eservice: eserviceInReadmodelCatalog,
        })
        .from(eserviceInReadmodelCatalog)
        .innerJoin(
          eserviceDescriptorInReadmodelCatalog,
          eq(
            eserviceInReadmodelCatalog.id,
            eserviceDescriptorInReadmodelCatalog.eserviceId
          )
        )
        .leftJoin(
          eserviceDescriptorArchivingScheduleInReadmodelCatalog,
          eq(
            eserviceDescriptorInReadmodelCatalog.id,
            eserviceDescriptorArchivingScheduleInReadmodelCatalog.descriptorId
          )
        )
        .where(
          and(
            inArray(eserviceDescriptorInReadmodelCatalog.state, [
              descriptorState.archiving,
              descriptorState.archivingSuspended,
            ]),
            lte(
              eserviceDescriptorArchivingScheduleInReadmodelCatalog.archivableOn,
              new Date().toISOString()
            ),
            eq(
              eserviceDescriptorArchivingScheduleInReadmodelCatalog.scope,
              archivingScope.eservice
            )
          )
        );
      return queryResult.map((row) => unsafeBrandId(row.eservice.id));
    },
    /**
     * This query checks that all the descriptors in a given set of e-services are in the correct state.
     * It checks that the descriptors are in 'archiving', 'archivingSuspended' or 'archived' state and
     * that their archiving scope is 'EService'.
     *
     * @returns The list of e-services with wrong descriptors
     **/
    async getEServiceWithUnarchivableDescriptors(
      eserviceIds: EServiceId[]
    ): Promise<EServiceWithUnarchivableDescriptors[]> {
      if (eserviceIds.length === 0) {
        return [];
      }
      const queryResult = await readModelDB
        .select({
          eserviceId: eserviceDescriptorInReadmodelCatalog.eserviceId,
          unarchivableDescriptors: sql<UnarchivableDescriptor[]>`
        array_agg(json_build_object(
          'id', ${eserviceDescriptorInReadmodelCatalog.id},
          'state', ${eserviceDescriptorInReadmodelCatalog.state},
          'scope', ${eserviceDescriptorArchivingScheduleInReadmodelCatalog.scope}
        ))
        filter (where ${eserviceDescriptorInReadmodelCatalog.state} not in ('Archiving', 'ArchivingSuspended', 'Archived'))
      `.as("unarchivable_descriptors"),
        })
        .from(eserviceDescriptorInReadmodelCatalog)
        .leftJoin(
          eserviceDescriptorArchivingScheduleInReadmodelCatalog,
          eq(
            eserviceDescriptorInReadmodelCatalog.id,
            eserviceDescriptorArchivingScheduleInReadmodelCatalog.descriptorId
          )
        )
        .where(
          inArray(eserviceDescriptorInReadmodelCatalog.eserviceId, eserviceIds)
        )
        .groupBy(eserviceDescriptorInReadmodelCatalog.eserviceId);

      return EServiceWithUnarchivableDescriptors.parse(queryResult).filter(
        (report) => report.unarchivableDescriptors.length > 0
      );
    },
  };
}
export type ReadModelServiceSQL = ReturnType<typeof readModelServiceBuilderSQL>;
