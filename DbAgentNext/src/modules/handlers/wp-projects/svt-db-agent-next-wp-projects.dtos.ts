import { IsNumber, IsString } from 'class-validator'
import { EpicWpProjectCreateRequest } from 'svt-ts-types'


/** `data.create` of `CreateWpProject`. */
export class SvtDbAgentNextWpProjectCreateDto implements EpicWpProjectCreateRequest {

    @IsNumber()
    wpMachineId!: number

    @IsNumber()
    waferTypeId!: number

    @IsString()
    name!: string

    /** Enum value `asicFamilyType`. */
    @IsString()
    asicFamilyType!: string

    /** Enum value `waferMapOrientation`. */
    @IsString()
    orientation!: string

    @IsString()
    alignmentDie!: string

    @IsString()
    homeDie!: string

    /** Stringified JSON. */
    @IsString()
    local2GlobalMap!: string

}
