import { EpicSvtTestSetupCreateRequest, EpicSvtTestTypeCreateRequest } from 'svt-ts-types'


/** A pretty-printed configuration; the agent stores and returns it byte for byte. */
export const SVT_TEST_CONFIG_BODY = JSON.stringify({
    boards: [{ number: 0, type: 'enclustra', subtype: 'mts', fw_hash: '0xf19709ca' }],
    emulator: { advanced_modelling: true },
}, null, 2)

/** A JSON5 configuration (a comment, unquoted keys, single quotes, a hex number, trailing commas) that is not JSON. */
export const SVT_TEST_CONFIG_BODY_JSON5 = [
    '// SVT test setup configuration',
    '{',
    '    boards: [{ number: 0, type: \'enclustra\', subtype: \'mts\', fw_hash: 0xf19709ca, }],',
    '    emulator: { advanced_modelling: true },',
    '}',
    '',
].join('\n')

/** Text that is neither JSON nor JSON5: a checksum list, one SHA-256 per line. */
export const SVT_TEST_CONFIG_BODY_NOT_JSON5 = [
    'a2982d420b790fb2f7775569e81f30bd383bac6814e9bc9094cf5874f30645e6',
    'ea4593dc6624b20db6b0aa4f7e1bdc5123cb21de5b4e50c8d1e0d6b1d3cc6a27',
].join('\n')

/** The dev database's first test setup, as `POST /api/svt-test-setups` takes it. */
export const SVT_TEST_SETUP_CREATE: EpicSvtTestSetupCreateRequest = {
    name: 'ts_mit',
    generalLocation: 'CERN_186_R_E10',
    defaultConfig: { name: 'ts_mit_config_v0', configBody: SVT_TEST_CONFIG_BODY, note: 'default config' },
}

/** The dev database's first test type, as `POST /api/svt-test-types` takes it (DUT types deliberately out of enum order). */
export const SVT_TEST_TYPE_CREATE: EpicSvtTestTypeCreateRequest = {
    name: 'Impedance Test',
    dutTypes: ['BABYMOSAIX', 'MOSAIX'],
    testTypeConfig: { name: 'Impedance Test common', configBody: SVT_TEST_CONFIG_BODY, note: 'Impedance measurement common config' },
}

/** `createdAt` of a test: an ISO 8601 date-time in UTC with milliseconds. */
export const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
