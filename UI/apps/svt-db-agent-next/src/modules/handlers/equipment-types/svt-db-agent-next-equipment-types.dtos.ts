import { IsString } from 'class-validator'
import { EpicEquipmentTypeCreateRequest } from 'epic-api-types'


/** `data.create` of `CreateEquipmentType`. */
export class SvtDbAgentNextEquipmentTypeCreateDto implements EpicEquipmentTypeCreateRequest {

    @IsString()
    name!: string

}
