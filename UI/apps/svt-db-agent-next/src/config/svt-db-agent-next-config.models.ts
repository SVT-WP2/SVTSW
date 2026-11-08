import { LogLevel } from '@nestjs/common'


export const SVT_DB_AGENT_NEXT_DEFAULT_HTTP_PORT = 7676

export type SvtDbAgentNextDatabaseConfig = {
    host: string
    port: number
    user: string
    password: string
    dbName: string
    /** Schema holding every table; `main` in every environment. */
    schema: string
    /** Log every SQL statement; on when the terminal verbosity is `DEBUG`. */
    debug: boolean
}

export type SvtDbAgentNextKafkaConfig = {
    server: string
    port: number
    /** `server:port`, the shape the Kafka client expects. */
    brokers: string[]
}

/** Typed configuration of the application, built once from the validated environment. */
export type SvtDbAgentNextConfig = {
    /** Port of the HTTP side (`GET /health`). */
    httpPort: number
    /** Nest log levels derived from `SVT_DB_AGENT_LOGGER_TERM_VERBOSITY`. */
    logLevels: LogLevel[]
    database: SvtDbAgentNextDatabaseConfig
    kafka: SvtDbAgentNextKafkaConfig
}
