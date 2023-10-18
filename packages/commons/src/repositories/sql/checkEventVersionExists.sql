SELECT 1
FROM "events"
WHERE
    stream_id = $(stream_id)
    AND "version" = $(version)
