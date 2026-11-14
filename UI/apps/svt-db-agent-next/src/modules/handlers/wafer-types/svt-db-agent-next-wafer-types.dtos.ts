import { IsString } from 'class-validator'
import { EpicWaferTypeCreateRequest } from 'epic-api-types'


/** `data.create` of `CreateWaferType`. */
export class SvtDbAgentNextWaferTypeCreateDto implements EpicWaferTypeCreateRequest {

    @IsString()
    name!: string

    /** Enum value `engineeringRun`. */
    @IsString()
    engineeringRun!: string

    /** Enum value `foundryName`. */
    @IsString()
    foundry!: string

    /** Enum value `waferTech`. */
    @IsString()
    technology!: string

    /** Stringified JSON. */
    @IsString()
    waferMap!: string

}
