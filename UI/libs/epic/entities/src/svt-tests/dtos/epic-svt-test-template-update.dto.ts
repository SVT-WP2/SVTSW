import { ApiProperty } from '@nestjs/swagger'
import { IsBoolean } from 'class-validator'
import { EpicSvtTestTemplateUpdateRequest } from 'epic-api-types'


export class EpicSvtTestTemplateUpdateDto implements EpicSvtTestTemplateUpdateRequest {

    @IsBoolean()
    @ApiProperty({ type: 'boolean' })
    isEnabled: boolean

}

