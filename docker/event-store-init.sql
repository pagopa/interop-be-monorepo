create schema catalog;
create table catalog.events (
    sequence_num bigserial NOT NULL,

    stream_id uuid NOT NULL,
    version bigint NOT NULL,

    type text NOT NULL,
    data bytea NOT NULL,

    log_date timestamptz NOT NULL DEFAULT now(),

    PRIMARY KEY (sequence_num),
    UNIQUE (stream_id, version)
);

create schema agreement;
create table agreement.events (
    sequence_num bigserial NOT NULL,

    stream_id uuid NOT NULL,
    version bigint NOT NULL,

    type text NOT NULL,
    data bytea NOT NULL,

    log_date timestamptz NOT NULL DEFAULT now(),

    PRIMARY KEY (sequence_num),
    UNIQUE (stream_id, version)
);

create schema tenant;
create table tenant.events (
    sequence_num bigserial NOT NULL,

    stream_id uuid NOT NULL,
    version bigint NOT NULL,

    type text NOT NULL,
    data bytea NOT NULL,

    log_date timestamptz NOT NULL DEFAULT now(),

    PRIMARY KEY (sequence_num),
    UNIQUE (stream_id, version)
);

create schema attribute;
create table attribute.events (
    sequence_num bigserial NOT NULL,

    stream_id uuid NOT NULL,
    version bigint NOT NULL,

    type text NOT NULL,
    data bytea NOT NULL,

    log_date timestamptz NOT NULL DEFAULT now(),

    PRIMARY KEY (sequence_num),
    UNIQUE (stream_id, version)
);
