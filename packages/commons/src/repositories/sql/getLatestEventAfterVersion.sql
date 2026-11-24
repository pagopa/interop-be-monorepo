SELECT "version", "type", "event_version", "data"
FROM "events"
WHERE stream_id = $(stream_id) AND "version" > $(version)
ORDER BY "version" DESC
LIMIT 1
