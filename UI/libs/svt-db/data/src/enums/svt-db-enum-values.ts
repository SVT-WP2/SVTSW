/**
 * Native enum types of schema `main` and their labels, in declaration order (the order Postgres reports and
 * the C++ agent returned).
 *
 * GENERATED on 2026-11-08 from `Dev/db-example/2026-11-08-backup_prod.dump` (`pg_restore --schema-only`), plus the
 * two dev-only types migration 1 adds (`dutEntityName`, `testResultStatus`) and the `CANCELLED` value migration 2
 * adds to `testResultStatus`. Prod, dev and the schema doc agree on every other value. Regenerate rather than
 * edit: see `docs/db-agent-clone/dev-plan/02-mikro-orm.md`, step 4 (a regeneration must run after the migrations).
 *
 * These are the values the entities declare for `@Enum({ nativeEnumName })`; at runtime `GetAllEnums` reads the
 * live catalog (`pg_enum`), so a value added with `ALTER TYPE ... ADD VALUE` works without a rebuild.
 */
export type SvtDbEnumName =
    | 'asicFamilyType'
    | 'asicQuality'
    | 'blockType'
    | 'dutEntityName'
    | 'dutType'
    | 'engineeringRun'
    | 'foundryName'
    | 'moduleType'
    | 'pcLocation'
    | 'pcModel'
    | 'pcName'
    | 'pcType'
    | 'pcVendor'
    | 'testResultStatus'
    | 'waferInMachineStatus'
    | 'waferMapOrientation'
    | 'waferTech'
    | 'wpConnectionType'
    | 'wpGeneralLocation'
    | 'wpSwType'
    | 'wpVendor'

export const SVT_DB_ENUM_VALUES: Record<SvtDbEnumName, string[]> = {
    asicFamilyType: [
        'MOST', 'MOSS', 'BABYMOSS', 'BABYMOST', 'NKF7', 'MOSAIX', 'BABYMOSAIX', 'LAS', 'AncMPW1', 'AncMPW2',
        'AncMPW3', 'AncBrain', 'AncASIC', 'CE65_V1CG_15U_SQ', 'CE65_V2CG_15U_SQ', 'CE65_V2CG_18U_SQ',
        'CE65_V2CG_18U_HSQ', 'CE65_V2CG_22U5_SQ', 'CE65_V2CG_22U5_HSQ', 'CE65_V2CN_15U_SQ', 'CE65_V2CN_18U_SQ',
        'CE65_V2CN_18U_HSQ', 'CE65_V2CN_22U5_SQ', 'CE65_V2CN_22U5_HSQ', 'AO10P', 'AO10', 'AO10B', 'S', 'DESY',
        'NONAME1', 'CE65_V1CN_15U_SQ', 'NONAME2', 'CE65_V1CB_15U_SQ', 'dPTSN', 'dPTS', 'AF15P', 'AF15B', 'AF15',
        'RAL_TXRX_ER1', 'TTS_5', 'TTS_4', 'CE65_V2CB_15U_SQ', 'CE65_V2CB_22U5_SQ', 'CE65_V2CB_18U_HSQ',
        'CE65_V2CB_22U5_HSQ', 'CE65_V2CB_18U_SQ', 'NKF5', 'NKF6', 'NONAME5', 'SEU_2_INFN_BAR_GDR',
        'SEU_1_INFN_BAR_GDR', 'TTS_3', 'TTS_2', 'TTS_1', 'ER2_APTS_OA_10_G', 'ER2_APTS_OA_10_P3', 'ER2_APTS_OA_10_P4',
        'ER2_APTS_OA_10_P5', 'ER2_APTS_SF_10_G', 'ER2_APTS_SF_10_P3', 'ER2_APTS_SF_10_P4', 'ER2_APTS_SF_10_P5',
        'ER2_APTS_SF_12_G', 'ER2_APTS_SF_15_S', 'ER2_APTS_SF_15_M', 'ER2_APTS_SF_15_G', 'ER2_APTS_SF_30_G',
        'ER2_APTS_SF_40_G', 'ER2_APTS_SF_50_G', 'ER2_APTS_SF_50_NW', 'ER2_APTS_SF_MOSAIX', 'ER2_BNL_ADC',
        'ER2_BNL_DATATR', 'ER2_BG_TMON', 'ER2_DPTS', 'ER2_DPTS_P3', 'ER2_DPTS_P5', 'ER2_NAPA_v2', 'ER2_RING_OSC_v1',
        'ER2_RING_OSC_v2', 'ER2_SEU3', 'ER2_SERIALIZER', 'ER2_SPARC', 'ER2_TDC_HEID', 'ER2_TTS1', 'ER2_TTS2',
    ],
    asicQuality: ['MechanicallyDamaged', 'MechanicallyInteger', 'CoveredByGreenLayer'],
    blockType: [
        'AncMPW1_SLDO', 'AncMPW1_NVBG', 'AncMPW1_CML_TRANSCEIVER', 'AncMPW2_SLDO', 'AncMPW2_NVBG',
        'AncMPW2_CML_TRANSCEIVER',
    ],
    dutEntityName: ['Asic', 'Chip', 'ChipBlock'],
    dutType: ['MOSAIX', 'BABYMOSAIX', 'AncMPW2_SLDO'],
    engineeringRun: ['ER1', 'ER2', 'ER3', 'LAS1', 'AncMPW1', 'AncMPW2'],
    foundryName: ['TowerSemiconductor', 'Xfab'],
    moduleType: ['IB0', 'IB1', 'IB2'],
    pcLocation: ['CERN', 'Prague', 'LosAlamos', 'BNL', 'RAL'],
    pcModel: [
        'NKF7-TS3500-CABLEOUT-MLO(EVS-P)', 'MOSAIX-LEC-TS3500-CABLEOUT-OTHERS-MLOO-EVS-P-VY540', 'MosaixLeft',
        'MosaixRight', 'LAS', 'BabyMOSS', 'Ancillary',
    ],
    pcName: ['NKF7_MPI', 'MOSAIX_LEC', 'BabyMOSS_Korea', 'Mosaix_Korea'],
    pcType: ['Vertical', 'Cantilever'],
    pcVendor: ['MPI', 'Korea', 'Synergie', 'FormFactorPC'],
    testResultStatus: ['SUCCESS', 'PARTIAL_SUCCESS', 'FAILURE', 'ERROR', 'CANCELLED'],
    waferInMachineStatus: ['Loaded', 'Unloaded'],
    waferMapOrientation: ['North', 'South', 'East', 'West'],
    waferTech: ['TPSCo65', 'Xfab110'],
    wpConnectionType: ['TCPIP', 'GPIB', 'RS232', 'USB', 'Ethernet', 'Modbus', 'LAN'],
    wpGeneralLocation: [
        'CERN', 'CERN_186_R_E10', 'Prague', 'LosAlamos', 'BNL', 'RAL', 'Darsburry', 'Brunel', 'Birmingham',
        'Liverpool', 'LBL',
    ],
    wpSwType: ['Sentio', 'VeloxCascade'],
    wpVendor: ['MPI', 'CascadeMicrotech', 'FormFactor'],
}
