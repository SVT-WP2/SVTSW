import { Type } from 'class-transformer'
import { IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator'
import {
    EpicSvtTestSetupCreateRequest,
    EpicSvtTestSetupDefaultConfigCreateRequest,
    EpicSvtTestSetupUpdateRequest,
} from 'epic-api-types'


/** `defaultConfig` of the `CreateSvtTestSetup` payload. */
export class SvtDbAgentNextSvtTestSetupDefaultConfigCreateDto implements EpicSvtTestSetupDefaultConfigCreateRequest {

    @IsString()
    name!: string

    /** Config file content as a plain text (JSON, JSON5 or any other text file format). */
    @IsString()
    configBody!: string

    @IsString()
    @IsOptional()
    note!: string

}

/** `data.create` of `CreateSvtTestSetup`. */
export class SvtDbAgentNextSvtTestSetupCreateDto implements EpicSvtTestSetupCreateRequest {

    @IsString()
    name!: string

    /** Enum value `generalLocation`. */
    @IsString()
    generalLocation!: string

    @ValidateNested()
    @Type(() => SvtDbAgentNextSvtTestSetupDefaultConfigCreateDto)
    defaultConfig!: SvtDbAgentNextSvtTestSetupDefaultConfigCreateDto

}

/** `data.update` of `UpdateSvtTestSetup`. */
export class SvtDbAgentNextSvtTestSetupUpdateDto implements EpicSvtTestSetupUpdateRequest {

    @IsNumber()
    defaultConfigId!: number

}
