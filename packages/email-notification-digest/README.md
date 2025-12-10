# Email Notification Digest

A CronJob-style service that sends periodic digest emails to users who have enabled digest notification preference.

## Overview

This service:

1. Queries the notification config readmodel to find users with `emailNotificationPreference = "Digest"`
2. For each user, gathers relevant data from the readmodel (currently mockup)
3. Compiles an email using Handlebars templates
4. Produces messages to the Kafka topic (`EMAIL_DISPATCH_TOPIC`) consumed by the `email-sender` service

## Configuration

See `.env` for required environment variables.

## Running Locally

```bash
pnpm start
```

## Building

```bash
pnpm build
```
