import { EpicAsic } from './epic-asic.models'


export type EpicAsicCreate = Omit<EpicAsic, 'id' | 'waferSerialNumber'>


