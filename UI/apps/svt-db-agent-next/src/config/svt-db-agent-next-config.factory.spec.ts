// @vitest-environment node
import {
    createSvtDbAgentNextConfig,
    getSvtDbAgentNextLogLevels,
    validateSvtDbAgentNextEnv,
} from './svt-db-agent-next-config.factory'


const COMPLETE_ENV: Record<string, string> = {
    SVT_DB_AGENT_DB_HOST: 'db.example',
    SVT_DB_AGENT_DB_PORT: '5500',
    SVT_DB_AGENT_DB_USER: 'postgres',
    SVT_DB_AGENT_DB_PASS: 'secret',
    SVT_DB_AGENT_DB_NAME: 'svt_sw_db',
    SVT_DB_AGENT_DB_SCHEMA: 'main',
    SVT_DB_AGENT_KAFKA_SERVER: 'kafka.example',
    SVT_DB_AGENT_KAFKA_PORT: '9085',
    SVT_DB_AGENT_LOGGER_FILE_PATH: '/var/log/svt-db-agent',
    SVT_DB_AGENT_LOGGER_TERM_VERBOSITY: 'VERBOSE',
    SVT_DB_AGENT_LOGGER_FILE_VERBOSITY: 'DEBUG',
    SVT_DB_AGENT_HTTP_PORT: '7777',
}

const omit = (env: Record<string, string>, ...keys: string[]): Record<string, string> =>
    Object.fromEntries(Object.entries(env).filter(([key]) => !keys.includes(key)))

describe('createSvtDbAgentNextConfig', () => {

    it('maps a complete environment onto the typed configuration', () => {
        expect(createSvtDbAgentNextConfig(COMPLETE_ENV)).toEqual({
            httpPort: 7777,
            logLevels: ['error', 'warn', 'log', 'verbose'],
            database: {
                host: 'db.example',
                port: 5500,
                user: 'postgres',
                password: 'secret',
                dbName: 'svt_sw_db',
                schema: 'main',
                debug: false,
            },
            kafka: {
                server: 'kafka.example',
                port: 9085,
                brokers: ['kafka.example:9085'],
            },
        })
    })

    it('defaults the HTTP port and the log levels when the optional variables are absent', () => {
        const env = omit(
            COMPLETE_ENV,
            'SVT_DB_AGENT_LOGGER_FILE_PATH',
            'SVT_DB_AGENT_LOGGER_TERM_VERBOSITY',
            'SVT_DB_AGENT_LOGGER_FILE_VERBOSITY',
            'SVT_DB_AGENT_HTTP_PORT',
        )
        const config = createSvtDbAgentNextConfig(env)
        expect(config.httpPort).toBe(7676)
        expect(config.logLevels).toEqual(['error', 'warn', 'log'])
    })

    it('turns SQL logging on for the DEBUG verbosity only', () => {
        expect(createSvtDbAgentNextConfig({ ...COMPLETE_ENV, SVT_DB_AGENT_LOGGER_TERM_VERBOSITY: 'DEBUG' }).database.debug).toBe(true)
        expect(createSvtDbAgentNextConfig({ ...COMPLETE_ENV, SVT_DB_AGENT_LOGGER_TERM_VERBOSITY: 'VERBOSE' }).database.debug).toBe(false)
    })

    it('accepts an empty database password', () => {
        expect(createSvtDbAgentNextConfig({ ...COMPLETE_ENV, SVT_DB_AGENT_DB_PASS: '' }).database.password).toBe('')
    })

    it('ignores variables it does not know', () => {
        expect(() => createSvtDbAgentNextConfig({ ...COMPLETE_ENV, PATH: '/usr/bin', NODE_ENV: 'test' })).not.toThrow()
    })

    it('rejects a missing database host and names the variable', () => {
        expect(() => createSvtDbAgentNextConfig(omit(COMPLETE_ENV, 'SVT_DB_AGENT_DB_HOST'))).toThrow(/SVT_DB_AGENT_DB_HOST/)
    })

    it('rejects an empty database host', () => {
        expect(() => createSvtDbAgentNextConfig({ ...COMPLETE_ENV, SVT_DB_AGENT_DB_HOST: '' })).toThrow(/SVT_DB_AGENT_DB_HOST/)
    })

    it('rejects a database port that is not a number', () => {
        expect(() => createSvtDbAgentNextConfig({ ...COMPLETE_ENV, SVT_DB_AGENT_DB_PORT: 'five' })).toThrow(/SVT_DB_AGENT_DB_PORT/)
    })

    it('rejects a port outside the TCP range', () => {
        expect(() => createSvtDbAgentNextConfig({ ...COMPLETE_ENV, SVT_DB_AGENT_KAFKA_PORT: '70000' })).toThrow(/SVT_DB_AGENT_KAFKA_PORT/)
    })

    it('rejects an unknown logger verbosity', () => {
        expect(() => createSvtDbAgentNextConfig({ ...COMPLETE_ENV, SVT_DB_AGENT_LOGGER_TERM_VERBOSITY: 'LOUD' }))
            .toThrow(/SVT_DB_AGENT_LOGGER_TERM_VERBOSITY/)
    })

    it('lists every invalid variable in one error', () => {
        const env = omit(COMPLETE_ENV, 'SVT_DB_AGENT_DB_NAME', 'SVT_DB_AGENT_KAFKA_SERVER')
        let message = ''
        try {
            createSvtDbAgentNextConfig(env)
        }
        catch (error) {
            message = (error as Error).message
        }
        expect(message).toContain('SVT_DB_AGENT_DB_NAME')
        expect(message).toContain('SVT_DB_AGENT_KAFKA_SERVER')
    })

})

describe('validateSvtDbAgentNextEnv', () => {

    it('returns the same object when the environment is valid', () => {
        expect(validateSvtDbAgentNextEnv(COMPLETE_ENV)).toBe(COMPLETE_ENV)
    })

    it('throws when the environment is invalid', () => {
        expect(() => validateSvtDbAgentNextEnv(omit(COMPLETE_ENV, 'SVT_DB_AGENT_DB_USER'))).toThrow(/SVT_DB_AGENT_DB_USER/)
    })

})

describe('getSvtDbAgentNextLogLevels', () => {

    it('maps each verbosity onto an ascending set of Nest levels', () => {
        expect(getSvtDbAgentNextLogLevels('PRODUCTION')).toEqual(['error', 'warn'])
        expect(getSvtDbAgentNextLogLevels('STANDARD')).toEqual(['error', 'warn', 'log'])
        expect(getSvtDbAgentNextLogLevels('VERBOSE')).toEqual(['error', 'warn', 'log', 'verbose'])
        expect(getSvtDbAgentNextLogLevels('DEBUG')).toEqual(['error', 'warn', 'log', 'verbose', 'debug'])
    })

    it('falls back to STANDARD for a missing or unknown verbosity', () => {
        expect(getSvtDbAgentNextLogLevels(undefined)).toEqual(['error', 'warn', 'log'])
        expect(getSvtDbAgentNextLogLevels('LOUD')).toEqual(['error', 'warn', 'log'])
    })

})
