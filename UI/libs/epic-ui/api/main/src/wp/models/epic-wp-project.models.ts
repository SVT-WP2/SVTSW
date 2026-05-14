import { EpicWaferType } from '../../wafers'

import { EpicWpMachine } from './epic-wp-machine.models'


export type EpicWpProject = {
    id: number
    wpMachineId: number
    waferTypeId: number
    name: string
    asicFamilyType: string
    orientation: string
    alignmentDie: string
    homeDie: string
    local2GlobalMap: string // JSON string
    wpMachine?: EpicWpMachine
    waferType?: EpicWaferType
}

export type EpicWpProjectCreate = {
    wpMachineId: number
    waferTypeId: number
    name: string
    asicFamilyType: string
    orientation: string
    alignmentDie: string
    homeDie: string
    local2GlobalMap: string // JSON string
}

