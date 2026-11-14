// `@Type()` reads `design:type` metadata; Nest loads the polyfill in the app, the spec would not.
import 'reflect-metadata'

import { Type } from 'class-transformer'
import { IsBooleanString, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator'


/**
 * Verbosity levels of the C++ agent's logger (`SVT_DB_AGENT_LOGGER_*_VERBOSITY`), ascending.
 * The clone logs to stdout only and maps the terminal verbosity onto Nest log levels.
 */
export enum SvtDbAgentNextLoggerVerbosity {
    PRODUCTION = 'PRODUCTION',
    STANDARD = 'STANDARD',
    VERBOSE = 'VERBOSE',
    DEBUG = 'DEBUG',
}

/**
 * Environment variables of `svt-db-agent-next`, validated once at boot.
 *
 * The names are those of the C++ DB Agent container, so the compose files under `Environment/` need no
 * change. `SVT_DB_AGENT_HTTP_PORT` is the only addition: the port of the `/health` endpoint.
 * See `docs/04-runtime-and-deployment.md` §1.
 */
export class SvtDbAgentNextEnvVars {

    // PostgreSQL. All six are mandatory, as they are for the C++ agent.

    @IsString()
    @IsNotEmpty()
    SVT_DB_AGENT_DB_HOST: string

    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(65535)
    SVT_DB_AGENT_DB_PORT: number

    @IsString()
    @IsNotEmpty()
    SVT_DB_AGENT_DB_USER: string

    /** May be empty (trust authentication) but must be defined. */
    @IsString()
    SVT_DB_AGENT_DB_PASS: string

    @IsString()
    @IsNotEmpty()
    SVT_DB_AGENT_DB_NAME: string

    @IsString()
    @IsNotEmpty()
    SVT_DB_AGENT_DB_SCHEMA: string

    // Kafka. Joined into `host:port` for the broker list.

    @IsString()
    @IsNotEmpty()
    SVT_DB_AGENT_KAFKA_SERVER: string

    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(65535)
    SVT_DB_AGENT_KAFKA_PORT: number

    // Logger. Accepted for compatibility with the C++ container; only the terminal verbosity has an effect.

    @IsOptional()
    @IsString()
    SVT_DB_AGENT_LOGGER_FILE_PATH?: string

    @IsOptional()
    @IsEnum(SvtDbAgentNextLoggerVerbosity)
    SVT_DB_AGENT_LOGGER_TERM_VERBOSITY?: SvtDbAgentNextLoggerVerbosity

    @IsOptional()
    @IsEnum(SvtDbAgentNextLoggerVerbosity)
    SVT_DB_AGENT_LOGGER_FILE_VERBOSITY?: SvtDbAgentNextLoggerVerbosity

    // HTTP (new). The port `/health` listens on.

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(65535)
    SVT_DB_AGENT_HTTP_PORT?: number

    // Feature flags (new). `true`/`1` enables, anything else is rejected; absent means off.

    /**
     * Write the `ChipBlock` rows of a new chip from `AsicFamilyTypeBlockList`, named `<blockType>_<chipSN>`.
     * Off until a naming is defined (Q6, `docs/01-behaviour-decisions.md` §3 and §6.4).
     */
    @IsOptional()
    @IsBooleanString()
    SVT_DB_AGENT_FEATURE_CHIP_BLOCKS?: string

}
