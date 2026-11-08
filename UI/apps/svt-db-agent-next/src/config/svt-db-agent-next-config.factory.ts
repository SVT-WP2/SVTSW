import { LogLevel } from '@nestjs/common'
import { ConfigFactory } from '@nestjs/config'
import { plainToInstance } from 'class-transformer'
import { validateSync, ValidationError } from 'class-validator'

import { SVT_DB_AGENT_NEXT_DEFAULT_HTTP_PORT, SvtDbAgentNextConfig } from './svt-db-agent-next-config.models'
import { SvtDbAgentNextEnvVars, SvtDbAgentNextLoggerVerbosity } from './svt-db-agent-next-env.models'


const LOG_LEVELS_BY_VERBOSITY: Record<SvtDbAgentNextLoggerVerbosity, LogLevel[]> = {
    [SvtDbAgentNextLoggerVerbosity.PRODUCTION]: ['error', 'warn'],
    [SvtDbAgentNextLoggerVerbosity.STANDARD]: ['error', 'warn', 'log'],
    [SvtDbAgentNextLoggerVerbosity.VERBOSE]: ['error', 'warn', 'log', 'verbose'],
    [SvtDbAgentNextLoggerVerbosity.DEBUG]: ['error', 'warn', 'log', 'verbose', 'debug'],
}

/**
 * Nest log levels for a C++-style verbosity. A missing or unknown value falls back to `STANDARD`, so the
 * logger can be configured from the raw environment before it has been validated.
 */
export function getSvtDbAgentNextLogLevels(verbosity: string | undefined): LogLevel[] {
    const level = isLoggerVerbosity(verbosity) ? verbosity : SvtDbAgentNextLoggerVerbosity.STANDARD
    return [...LOG_LEVELS_BY_VERBOSITY[level]]
}

/**
 * Parses and validates a raw environment (`process.env` or a test double).
 * Throws a single `Error` whose message lists every invalid variable.
 */
export function parseSvtDbAgentNextEnv(source: Record<string, unknown>): SvtDbAgentNextEnvVars {
    const env = plainToInstance(SvtDbAgentNextEnvVars, source)
    const errors = validateSync(env, { forbidUnknownValues: false })
    if (errors.length) {
        throw new Error(`Invalid svt-db-agent-next environment:\n${errors.map(formatValidationError).join('\n')}`)
    }
    return env
}

/**
 * `validate` hook of `ConfigModule.forRoot`: fails the boot on an invalid environment and otherwise
 * returns it unchanged (the ConfigModule copies the result into `process.env`).
 */
export function validateSvtDbAgentNextEnv(source: Record<string, unknown>): Record<string, unknown> {
    parseSvtDbAgentNextEnv(source)
    return source
}

/** The typed configuration for a raw environment. Throws like {@link parseSvtDbAgentNextEnv}. */
export function createSvtDbAgentNextConfig(source: Record<string, unknown>): SvtDbAgentNextConfig {
    const env = parseSvtDbAgentNextEnv(source)
    return {
        httpPort: env.SVT_DB_AGENT_HTTP_PORT ?? SVT_DB_AGENT_NEXT_DEFAULT_HTTP_PORT,
        logLevels: getSvtDbAgentNextLogLevels(env.SVT_DB_AGENT_LOGGER_TERM_VERBOSITY),
        database: {
            host: env.SVT_DB_AGENT_DB_HOST,
            port: env.SVT_DB_AGENT_DB_PORT,
            user: env.SVT_DB_AGENT_DB_USER,
            password: env.SVT_DB_AGENT_DB_PASS,
            dbName: env.SVT_DB_AGENT_DB_NAME,
            schema: env.SVT_DB_AGENT_DB_SCHEMA,
            debug: env.SVT_DB_AGENT_LOGGER_TERM_VERBOSITY === SvtDbAgentNextLoggerVerbosity.DEBUG,
        },
        kafka: {
            server: env.SVT_DB_AGENT_KAFKA_SERVER,
            port: env.SVT_DB_AGENT_KAFKA_PORT,
            brokers: [`${env.SVT_DB_AGENT_KAFKA_SERVER}:${env.SVT_DB_AGENT_KAFKA_PORT}`],
        },
    }
}

/** `load` entry of `ConfigModule.forRoot`: the typed configuration built from `process.env`. */
export function getSvtDbAgentNextConfigFactory(): ConfigFactory<SvtDbAgentNextConfig> {
    return () => createSvtDbAgentNextConfig(process.env)
}

function isLoggerVerbosity(value: string | undefined): value is SvtDbAgentNextLoggerVerbosity {
    return value !== undefined && (Object.values(SvtDbAgentNextLoggerVerbosity) as string[]).includes(value)
}

function formatValidationError(error: ValidationError): string {
    const constraints = Object.values(error.constraints ?? {}).join('; ')
    return `  - ${error.property}: ${constraints || 'invalid value'}`
}
