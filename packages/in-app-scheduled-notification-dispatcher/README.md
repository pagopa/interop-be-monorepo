# Scheduled In-App Notification Dispatcher

One-shot K8s CronJob that drains ready rows from `scheduled_notification` for the `inApp` channel and INSERTs the in-app notifications into the existing `notification` table (read by `in-app-notification-manager`).

Recommended deployment schedule: `0 9,15 * * *` (twice daily). Concurrency is protected by `SELECT ... FOR UPDATE SKIP LOCKED` plus K8s `concurrencyPolicy: Forbid`.
