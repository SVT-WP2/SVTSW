import { ApiProperty } from '@nestjs/swagger'
import { IsInt, IsOptional } from 'class-validator'
import { EpicEquipmentListQuery } from 'svt-ts-types'

import { TransformQueryNumberArray } from '../../common'


export class EpicEquipmentGetAllParamsDto implements EpicEquipmentListQuery {

    @IsInt({ each: true })
    @IsOptional()
    @TransformQueryNumberArray()
    @ApiProperty({ type: 'number', isArray: true, required: false })
    ids?: number[]

}
