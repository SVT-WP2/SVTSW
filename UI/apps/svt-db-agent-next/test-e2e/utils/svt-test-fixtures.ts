import { EpicSvtTestSetupCreateRequest, EpicSvtTestTypeCreateRequest } from 'svt-ts-types'


/** A pretty-printed configuration; the agent must store and return it byte for byte. */
export const SVT_TEST_CONFIG_BODY = JSON.stringify({
    boards: [{ number: 0, type: 'enclustra', subtype: 'mts', fw_hash: '0xf19709ca' }],
    emulator: { advanced_modelling: true },
}, null, 2)

/** The dev database's first test setup, as `CreateSvtTestSetup` takes it. */
export const SVT_TEST_SETUP_CREATE: EpicSvtTestSetupCreateRequest = {
    name: 'ts_mit',
    generalLocation: 'CERN_186_R_E10',
    defaultConfig: { name: 'ts_mit_config_v0', configBody: SVT_TEST_CONFIG_BODY, note: 'default config' },
}

/** The dev database's first test type, as `CreateSvtTestType` takes it (DUT types deliberately out of enum order). */
export const SVT_TEST_TYPE_CREATE: EpicSvtTestTypeCreateRequest = {
    name: 'Impedance Test',
    dutTypes: ['BABYMOSAIX', 'MOSAIX'],
    testTypeConfig: { name: 'Impedance Test common', configBody: SVT_TEST_CONFIG_BODY, note: 'Impedance measurement common config' },
}
