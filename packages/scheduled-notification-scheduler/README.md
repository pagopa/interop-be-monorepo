# Scheduled Notification Scheduler

Long-running Kafka consumer on `catalogTopic`. For each archiving lifecycle event it materializes (or removes) reminder rows in the `scheduled_notification` work-queue table.

The two scheduled dispatchers (in-app and email) drain that table on a cron schedule and deliver the reminders.
