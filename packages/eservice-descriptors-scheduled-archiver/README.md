# EService Descriptors Scheduled Archiver

This process retrieves all the descriptors and E-Services that need to be archived today because the grace period of the archiving process is completed.

The logic for the selection of the descriptor is as follows:

1. The descriptor must be in `archiving` or `archivingSuspended` state.
2. The descriptor must have a `archivableOn` date that is in the past or equal to the current date. (`archivable_on` <= `now()`)
3. The descriptor's archiving schedule must have a `scope` of `descriptor`.

The logic for the selection of the E-Service is as follows:

1. The E-Service must have at least one descriptor in `archiving` or `archivingSuspended` state.
2. The E-Service must have a `archivableOn` date that is in the past or equal to the current date. (`archivable_on` <= `now()`)
3. The E-Service's archiving schedule must have a `scope` of `eservice`.
4. All the descriptors of the E-Service must be in `archiving`, `archivingSuspended` or `archived` state. (this check is performed by the `getEServiceWithUnarchivableDescriptors` method in [readModelServiceSQL.ts](./src/services/readModelServiceSQL.ts))

After the list of references (`eserviceId`+`descriptorId` in the case of descriptors; `eserviceId` in the case of E-Services) is retrieved, the internal routes for archiving the descriptors and E-Services are called. The internal routes are in the `catalog-process`.
