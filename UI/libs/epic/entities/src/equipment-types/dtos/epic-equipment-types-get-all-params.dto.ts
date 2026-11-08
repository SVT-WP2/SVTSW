import { ApiProperty } from '@nestjs/swagger'
import { IsInt, IsOptional } from 'class-validator'
import { EpicEquipmentTypesListQuery } from 'svt-ts-types'

import { TransformQueryNumberArray } from '../../common'


export class EpicEquipmentTypesGetAllParamsDto implements EpicEquipmentTypesListQuery {

    @IsInt({ each: true })
    @IsOptional()
    @TransformQueryNumberArray()
    @ApiProperty({ type: 'number', isArray: true, required: false })
    ids?: number[]

}
