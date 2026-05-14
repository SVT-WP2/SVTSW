import { Injectable } from '@nestjs/common'
import { EpicApiEnumsCollection } from 'epic/entities'
import { delay, map, Observable, of } from 'rxjs'


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


export function getEnumsCollection(): EpicApiEnumsCollection {
    return {
        blockType: [
            'BLOCK_TYPE_1',
            'BLOCK_TYPE_2',
            'BLOCK_TYPE_3',
        ],
        dutType: [
            'MOSS',
            'BABYMOSS',
            'NKF7',
        ],
        asicFamilyType: [
            'MOSS',
            'BABYMOSS',
            'NKF7',
            'MOSAIX',
            'BabyMOSAIX',
            'LAS',
            'Ancillary',
            'CE65_V1CG_I5U_SQ',
            'CE65_V2CG_I5U_SQ',
            'CE65_V2CG_I8U_SQ',
            'CE65_V2CG_I8U_HSQ',
            'CE65_V2CG_22U5_SQ',
            'CE65_V2CG_22U5_HSQ',
            'CE65_V2CN_I5U_SQ',
            'CE65_V2CN_I8U_SQ',
            'CE65_V2CN_18U_HSQ',
            'CE65_V2CN_22U5_SQ',
            'CE65_V2CN_22U5_HSQ',
            'AOIO_P',
            'AO_IO',
            'AOIO_8',
            'S',
            'DESY',
            'NONAME1',
            'CE65_V1CN_I5U_SQ',
            'NONAME2',
            'CE65_V1CB_I5U_SQ',
            'dPTSN',
            'dP_TS',
            'AFISP',
            'AFISB',
            'AF_IS',
            'RAL_TXRX_ER1',
            'TTS_5',
            'TTS_4',
            'CE65_V2CB_I5U_SQ',
            'CE65_V2CB_22U5_SQ',
            'CE65_V2CB_I8U_HSQ',
            'CE65_V2CB_22U5_HSQ',
            'CE65_V2CB_I8U_SQ',
            'NKF5',
            'NKF6',
            'NONAME5',
            'SEU_2_INFN_BAR_GDR',
            'SEU_1_INFN_BAR_GDR',
            'TTS_3',
            'TTS_2',
            'TTS_1',
            'NONAME4',
            'NONAME_LONG',
        ],
        engineeringRun: [
            'ER1',
            'ER2',
            'ER3',
            'LAS1',
            'Ancillary1',
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
            'CERN_186_R_E10',
            'Prague',
            'LosAlamos',
            'BNL',
            'RAL',
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
            'BabyMOSS_Korea',
            'Mosaix_Korea',
        ],
        pcModel: [
            'NKF7',
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
    }
}
