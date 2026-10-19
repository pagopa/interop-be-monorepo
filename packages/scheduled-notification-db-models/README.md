# Scheduled Notification DB Models

Drizzle schema and helpers for the `scheduled_notification` work-queue table used by the WI 10.3 scheduled-reminder pipeline.

The table holds one row per `(channel, event_type, entity_id, send_at)` tuple, where `entity_id` is the concatenated `<eserviceId>/<descriptorId>` (helpers: `composeEntityId`, `parseEntityId`).
