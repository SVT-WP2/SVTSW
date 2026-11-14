import { IsString } from 'class-validator'
import { EpicEquipmentTypeCreateRequest } from 'svt-ts-types'


/** `data.create` of `CreateEquipmentType`. */
export class SvtDbAgentNextEquipmentTypeCreateDto implements EpicEquipmentTypeCreateRequest {

    @IsString()
    name!: string

}
