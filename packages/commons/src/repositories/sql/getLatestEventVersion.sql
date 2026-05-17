SELECT "version"
FROM "events"
WHERE
    stream_id = $(stream_id)
ORDER BY "version" DESC
LIMIT 1
