import { IsBoolean, IsNumber, IsString } from 'class-validator'
import { EpicSvtTestTemplateCreateRequest, EpicSvtTestTemplateUpdateRequest } from 'epic-api-types'


/** `data.create` of `CreateSvtTestTemplate`. */
export class SvtDbAgentNextSvtTestTemplateCreateDto implements EpicSvtTestTemplateCreateRequest {

    @IsBoolean()
    isEnabled!: boolean

    @IsString()
    dutType!: string

    @IsNumber()
    testTypeConfigId!: number

}

/** `data.update` of `UpdateSvtTestTemplate`. */
export class SvtDbAgentNextSvtTestTemplateUpdateDto implements EpicSvtTestTemplateUpdateRequest {

    @IsBoolean()
    isEnabled!: boolean

}
