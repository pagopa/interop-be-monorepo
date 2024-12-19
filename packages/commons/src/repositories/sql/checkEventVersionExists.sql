SELECT "version"
FROM "events"
WHERE
    stream_id = $(stream_id)
    AND "version" = $(version)
