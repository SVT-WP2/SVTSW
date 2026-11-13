import { ApiProperty } from '@nestjs/swagger'
import { IsNumber, IsOptional } from 'class-validator'
import { EpicEquipmentTypesListQuery } from 'epic-api-types'


export class EpicEquipmentTypesGetAllParamsDto implements EpicEquipmentTypesListQuery {

    @IsNumber({}, { each: true })
    @IsOptional()
    @ApiProperty({ type: 'number', isArray: true, required: false })
    ids?: number[]

}
