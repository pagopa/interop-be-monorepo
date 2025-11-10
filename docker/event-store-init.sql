create schema catalog;
create table catalog.events (
    sequence_num bigserial NOT NULL,

    stream_id uuid NOT NULL,
    version bigint NOT NULL,

    correlation_id text,

    type text NOT NULL,
    event_version int NOT NULL,
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

    correlation_id text,

    type text NOT NULL,
    event_version int NOT NULL,
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

    correlation_id text,

    type text NOT NULL,
    event_version int NOT NULL,
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

    correlation_id text,

    type text NOT NULL,
    event_version int NOT NULL,
    data bytea NOT NULL,

    log_date timestamptz NOT NULL DEFAULT now(),

    PRIMARY KEY (sequence_num),
    UNIQUE (stream_id, version)
);

create schema purpose;
create table purpose.events (
    sequence_num bigserial NOT NULL,

    stream_id uuid NOT NULL,
    version bigint NOT NULL,

    correlation_id text,

    type text NOT NULL,
    event_version int NOT NULL,
    data bytea NOT NULL,

    log_date timestamptz NOT NULL DEFAULT now(),

    PRIMARY KEY (sequence_num),
    UNIQUE (stream_id, version)
);

create schema purpose_template;
create table purpose_template.events (
    sequence_num bigserial NOT NULL,

    stream_id uuid NOT NULL,
    version bigint NOT NULL,

    correlation_id text,

    type text NOT NULL,
    event_version int NOT NULL,
    data bytea NOT NULL,

    log_date timestamptz NOT NULL DEFAULT now(),

    PRIMARY KEY (sequence_num),
    UNIQUE (stream_id, version)
);


create schema "authorization";
create table "authorization".events (
    sequence_num bigserial NOT NULL,

    stream_id uuid NOT NULL,
    version bigint NOT NULL,

    correlation_id text,

    type text NOT NULL,
    event_version int NOT NULL,
    data bytea NOT NULL,

    log_date timestamptz NOT NULL DEFAULT now(),

    PRIMARY KEY (sequence_num),
    UNIQUE (stream_id, version)
);


create schema notification_event;
CREATE TABLE notification_event.producer_keys_events (
	event_id serial4 NOT NULL,
	kid varchar NOT NULL,
	event_type varchar NOT NULL
);

create schema delegation;
CREATE TABLE delegation.events(
    sequence_num bigserial NOT NULL,

    stream_id uuid NOT NULL,
    version bigint NOT NULL,

    correlation_id text,

    type text NOT NULL,
    event_version int NOT NULL,
    data bytea NOT NULL,

    log_date timestamptz NOT NULL DEFAULT now(),

    PRIMARY KEY (sequence_num),
    UNIQUE (stream_id, version)
);

create schema eservice_template;
CREATE TABLE eservice_template.events(
    sequence_num bigserial NOT NULL,

    stream_id uuid NOT NULL,
    version bigint NOT NULL,

    correlation_id text,

    type text NOT NULL,
    event_version int NOT NULL,
    data bytea NOT NULL,

    log_date timestamptz NOT NULL DEFAULT now(),

    PRIMARY KEY (sequence_num),
    UNIQUE (stream_id, version)
);

create schema notification_config;
CREATE TABLE notification_config.events(
    sequence_num bigserial NOT NULL,

    stream_id uuid NOT NULL,
    version bigint NOT NULL,

    correlation_id text,

    type text NOT NULL,
    event_version int NOT NULL,
    data bytea NOT NULL,

    log_date timestamptz NOT NULL DEFAULT now(),

    PRIMARY KEY (sequence_num),
    UNIQUE (stream_id, version)
);
