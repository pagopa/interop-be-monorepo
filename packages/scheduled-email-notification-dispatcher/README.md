# Scheduled Email Notification Dispatcher

One-shot K8s CronJob that drains ready rows from `scheduled_notification` for the `email` channel and produces `EmailNotificationMessagePayload` events on `emailDispatchTopic`. The existing `notification-email-sender` consumes that topic and performs the actual SES delivery.

Recommended deployment schedule: `0 9,15 * * *` (twice daily). Concurrency is protected by `SELECT ... FOR UPDATE SKIP LOCKED` plus K8s `concurrencyPolicy: Forbid`.
