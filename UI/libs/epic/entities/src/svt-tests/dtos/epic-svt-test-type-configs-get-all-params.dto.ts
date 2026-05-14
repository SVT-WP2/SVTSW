import { ApiProperty } from '@nestjs/swagger'
import { IsArray, IsNumber, IsOptional } from 'class-validator'


export class EpicSvtTestTypeConfigsGetAllParamsDto {

    @IsArray()
    @ApiProperty({ type: 'number', isArray: true })
    @IsOptional()
    ids?: number[]

    @IsNumber()
    @ApiProperty({ type: 'number' })
    @IsOptional()
    testTypeId?: number

}
