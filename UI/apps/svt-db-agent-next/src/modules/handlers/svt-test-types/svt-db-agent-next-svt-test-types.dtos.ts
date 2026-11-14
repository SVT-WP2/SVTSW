import { Type } from 'class-transformer'
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator'
import {
    EpicSvtTestTypeCreateRequest,
    EpicSvtTestTypeDefaultConfigCreateRequest,
    EpicSvtTestTypeUpdateRequest,
} from 'epic-api-types'


/** `testTypeConfig` of the `CreateSvtTestType` payload. */
export class SvtDbAgentNextSvtTestTypeDefaultConfigCreateDto implements EpicSvtTestTypeDefaultConfigCreateRequest {

    @IsString()
    name!: string

    /** Config file content as a plain text (JSON, JSON5 or any other text file format). */
    @IsString()
    configBody!: string

    @IsString()
    @IsOptional()
    note!: string

}

/** `data.create` of `CreateSvtTestType`. */
export class SvtDbAgentNextSvtTestTypeCreateDto implements EpicSvtTestTypeCreateRequest {

    @IsString()
    name!: string

    @IsArray()
    @IsString({ each: true })
    dutTypes!: string[]

    @ValidateNested()
    @Type(() => SvtDbAgentNextSvtTestTypeDefaultConfigCreateDto)
    testTypeConfig!: SvtDbAgentNextSvtTestTypeDefaultConfigCreateDto

}

/** `data.update` of `UpdateSvtTestType`. */
export class SvtDbAgentNextSvtTestTypeUpdateDto implements EpicSvtTestTypeUpdateRequest {

    @IsArray()
    @IsString({ each: true })
    dutTypes!: string[]

}
