import { IsNumber, IsString } from 'class-validator'
import { EpicAsicCreateRequest } from 'epic-api-types'


/** `data.create` of `CreateAsic`. */
export class SvtDbAgentNextAsicCreateDto implements EpicAsicCreateRequest {

    @IsString()
    serialNumber!: string

    @IsNumber()
    waferId!: number

    /** Enum value `asicFamilyType`. */
    @IsString()
    familyType!: string

    /** Stringified JSON. */
    @IsString()
    waferMapPosition!: string

    /** Enum value `asicQuality`. */
    @IsString()
    quality!: string

}
