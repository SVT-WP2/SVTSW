import { EpicInstFilter, EpicInstFilterIntegrationTimeFactor } from '../../instruments'


export type EpicIvMntSettings = {
    voltageStart: number
    voltageStop: number
    voltageStep: number
    sweepDelayInMs?: number
    initDelayInMs?: number
    complianceInA?: number
    filter?: EpicInstFilter
    integrationTimeFactor?: EpicInstFilterIntegrationTimeFactor
}
