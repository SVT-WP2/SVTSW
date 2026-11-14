import { IsNumber, IsString, ValidateIf } from 'class-validator'
import { EpicSvtTestSetupConfigCreateRequest } from 'epic-api-types'


/** `data.create` of `CreateSvtTestSetupConfig`. */
export class SvtDbAgentNextSvtTestSetupConfigCreateDto implements EpicSvtTestSetupConfigCreateRequest {

    @IsNumber()
    setupId!: number

    @IsString()
    name!: string

    @IsString()
    @ValidateIf((obj) => obj.note !== null && obj.note !== '')
    note!: string

    /** Config file content as a plain text (JSON, JSON5 or any other text file format). */
    @IsString()
    configBody!: string

}
