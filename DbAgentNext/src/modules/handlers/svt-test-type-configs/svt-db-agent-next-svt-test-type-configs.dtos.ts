import { IsNumber, IsString, ValidateIf } from 'class-validator'
import { EpicSvtTestTypeConfigCreateRequest } from 'svt-ts-types'


/** `data.create` of `CreateSvtTestTypeConfig`. */
export class SvtDbAgentNextSvtTestTypeConfigCreateDto implements EpicSvtTestTypeConfigCreateRequest {

    @IsNumber()
    testTypeId!: number

    @IsString()
    name!: string

    @IsString()
    @ValidateIf((obj) => obj.note !== null && obj.note !== '')
    note!: string | null

    /** Config file content as plain text: JSON or JSON5 (the agent rejects anything else). */
    @IsString()
    configBody!: string

}
