import { Injectable } from '@nestjs/common'
import { delay, map, Observable, of } from 'rxjs'
import { EpicApiEnumsCollection } from 'svt-ts-types/kafka'


@Injectable()
export class EpicDbAgentEnumsService {

    getCollection(enumNames?: string[]): Observable<Partial<EpicApiEnumsCollection>> {
        return of(getEnumsCollection())
            .pipe(
                map((collection => {
                    if (enumNames?.length) {
                        return enumNames.reduce<Partial<EpicApiEnumsCollection>>(
                            (acc, key) => ({ ...acc, [key]: collection[key] ?? [] }),
                            {},
                        )
                    }
                    return collection
                })),
                delay(50),
            )
    }

}


// Enum values copied from the production database (Dev/db-example/2026-11-08-backup_prod.dump), in declaration order.
// Regenerate rather than edit: see DbAgent/docs/03-database-schema.md §6.
export function getEnumsCollection(): EpicApiEnumsCollection {
    return {
        asicFamilyType: [
            'MOST',
            'MOSS',
            'BABYMOSS',
            'BABYMOST',
            'NKF7',
            'MOSAIX',
            'BABYMOSAIX',
            'LAS',
            'AncMPW1',
            'AncMPW2',
            'AncMPW3',
            'AncBrain',
            'AncASIC',
            'CE65_V1CG_15U_SQ',
            'CE65_V2CG_15U_SQ',
            'CE65_V2CG_18U_SQ',
            'CE65_V2CG_18U_HSQ',
            'CE65_V2CG_22U5_SQ',
            'CE65_V2CG_22U5_HSQ',
            'CE65_V2CN_15U_SQ',
            'CE65_V2CN_18U_SQ',
            'CE65_V2CN_18U_HSQ',
            'CE65_V2CN_22U5_SQ',
            'CE65_V2CN_22U5_HSQ',
            'AO10P',
            'AO10',
            'AO10B',
            'S',
            'DESY',
            'NONAME1',
            'CE65_V1CN_15U_SQ',
            'NONAME2',
            'CE65_V1CB_15U_SQ',
            'dPTSN',
            'dPTS',
            'AF15P',
            'AF15B',
            'AF15',
            'RAL_TXRX_ER1',
            'TTS_5',
            'TTS_4',
            'CE65_V2CB_15U_SQ',
            'CE65_V2CB_22U5_SQ',
            'CE65_V2CB_18U_HSQ',
            'CE65_V2CB_22U5_HSQ',
            'CE65_V2CB_18U_SQ',
            'NKF5',
            'NKF6',
            'NONAME5',
            'SEU_2_INFN_BAR_GDR',
            'SEU_1_INFN_BAR_GDR',
            'TTS_3',
            'TTS_2',
            'TTS_1',
            'ER2_APTS_OA_10_G',
            'ER2_APTS_OA_10_P3',
            'ER2_APTS_OA_10_P4',
            'ER2_APTS_OA_10_P5',
            'ER2_APTS_SF_10_G',
            'ER2_APTS_SF_10_P3',
            'ER2_APTS_SF_10_P4',
            'ER2_APTS_SF_10_P5',
            'ER2_APTS_SF_12_G',
            'ER2_APTS_SF_15_S',
            'ER2_APTS_SF_15_M',
            'ER2_APTS_SF_15_G',
            'ER2_APTS_SF_30_G',
            'ER2_APTS_SF_40_G',
            'ER2_APTS_SF_50_G',
            'ER2_APTS_SF_50_NW',
            'ER2_APTS_SF_MOSAIX',
            'ER2_BNL_ADC',
            'ER2_BNL_DATATR',
            'ER2_BG_TMON',
            'ER2_DPTS',
            'ER2_DPTS_P3',
            'ER2_DPTS_P5',
            'ER2_NAPA_v2',
            'ER2_RING_OSC_v1',
            'ER2_RING_OSC_v2',
            'ER2_SEU3',
            'ER2_SERIALIZER',
            'ER2_SPARC',
            'ER2_TDC_HEID',
            'ER2_TTS1',
            'ER2_TTS2',
        ],
        engineeringRun: [
            'ER1',
            'ER2',
            'ER3',
            'LAS1',
            'AncMPW1',
            'AncMPW2',
        ],
        foundryName: [
            'TowerSemiconductor',
            'Xfab',
        ],
        waferTech: [
            'TPSCo65',
            'Xfab110',
        ],
        waferMapOrientation: [
            'North',
            'South',
            'East',
            'West',
        ],
        wpGeneralLocation: [
            'CERN',
            'CERN_186_R_E10',
            'Prague',
            'LosAlamos',
            'BNL',
            'RAL',
            'Darsburry',
            'Brunel',
            'Birmingham',
            'Liverpool',
            'LBL',
        ],
        wpConnectionType: [
            'TCPIP',
            'GPIB',
            'RS232',
            'USB',
            'Ethernet',
            'Modbus',
            'LAN',
        ],
        wpVendor: [
            'MPI',
            'CascadeMicrotech',
            'FormFactor',
        ],
        wpSwType: [
            'Sentio',
            'VeloxCascade',
        ],
        waferInMachineStatus: [
            'Loaded',
            'Unloaded',
        ],
        asicQuality: [
            'MechanicallyDamaged',
            'MechanicallyInteger',
            'CoveredByGreenLayer',
        ],
        pcVendor: [
            'MPI',
            'Korea',
            'Synergie',
            'FormFactorPC',
        ],
        pcName: [
            'NKF7_MPI',
            'MOSAIX_LEC',
            'BabyMOSS_Korea',
            'Mosaix_Korea',
        ],
        pcModel: [
            'NKF7-TS3500-CABLEOUT-MLO(EVS-P)',
            'MOSAIX-LEC-TS3500-CABLEOUT-OTHERS-MLOO-EVS-P-VY540',
            'MosaixLeft',
            'MosaixRight',
            'LAS',
            'BabyMOSS',
            'Ancillary',
        ],
        pcLocation: [
            'CERN',
            'Prague',
            'LosAlamos',
            'BNL',
            'RAL',
        ],
        pcType: [
            'Vertical',
            'Cantilever',
        ],
        dutType: [
            'MOSAIX',
            'BABYMOSAIX',
            'AncMPW2_SLDO',
        ],
        blockType: [
            'AncMPW1_SLDO',
            'AncMPW1_NVBG',
            'AncMPW1_CML_TRANSCEIVER',
            'AncMPW2_SLDO',
            'AncMPW2_NVBG',
            'AncMPW2_CML_TRANSCEIVER',
        ],
    }
}
