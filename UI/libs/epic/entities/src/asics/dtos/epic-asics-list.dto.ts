import { ApiProperty } from '@nestjs/swagger'
import { IsArray } from 'class-validator'

import { EpicPageDataDto } from '../../common'

import { EpicAsicDto } from './epic-asic.dto'


export class EpicAsicsListDto extends EpicPageDataDto<EpicAsicDto> {

    @IsArray()
    @ApiProperty({ type: EpicAsicDto, isArray: true })
    items: EpicAsicDto[]

}
