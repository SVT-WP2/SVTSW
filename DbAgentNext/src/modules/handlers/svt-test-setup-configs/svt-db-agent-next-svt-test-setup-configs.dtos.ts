import { IsNumber, IsString, ValidateIf } from 'class-validator'
import { EpicSvtTestSetupConfigCreateRequest } from 'svt-ts-types'


/** `data.create` of `CreateSvtTestSetupConfig`. */
export class SvtDbAgentNextSvtTestSetupConfigCreateDto implements EpicSvtTestSetupConfigCreateRequest {

    @IsNumber()
    setupId!: number

    @IsString()
    name!: string

    @IsString()
    @ValidateIf((obj) => obj.note !== null && obj.note !== '')
    note!: string

    /** Config file content as plain text: JSON or JSON5 (the agent rejects anything else). */
    @IsString()
    configBody!: string

}
