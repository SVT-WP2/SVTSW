import { IsNumber, IsString, ValidateIf } from 'class-validator'
import { EpicSvtTestTypeConfigCreateRequest } from 'epic-api-types'


/** `data.create` of `CreateSvtTestTypeConfig`. */
export class SvtDbAgentNextSvtTestTypeConfigCreateDto implements EpicSvtTestTypeConfigCreateRequest {

    @IsNumber()
    testTypeId!: number

    @IsString()
    name!: string

    @IsString()
    @ValidateIf((obj) => obj.note !== null && obj.note !== '')
    note!: string | null

    /** Config file content as a plain text (JSON, JSON5 or any other text file format). */
    @IsString()
    configBody!: string

}
