import { ApiProperty } from '@nestjs/swagger'
import { IsArray } from 'class-validator'

import { EpicPageDataDto } from '../../common'

import { EpicSvtTestDto } from './epic-svt-test.dto'


export class EpicSvtTestsListDto extends EpicPageDataDto<EpicSvtTestDto> {

    @IsArray()
    @ApiProperty({ type: EpicSvtTestDto, isArray: true })
    items: EpicSvtTestDto[]

}
