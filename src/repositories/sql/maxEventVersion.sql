SELECT MAX("version") 
FROM "event"
WHERE
    stream_id = $(stream_id);
