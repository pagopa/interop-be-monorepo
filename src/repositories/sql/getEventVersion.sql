SELECT "version" 
FROM "event"
WHERE
    stream_id = $(stream_id)
    AND "version" = $(version)
