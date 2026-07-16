import { ApiProperty } from '@nestjs/swagger'
import { IsNumber, IsOptional, IsString, Max } from 'class-validator'


export class EpicAsicsGetAllParamsDto {

    @IsNumber()
    @ApiProperty({ type: 'number' })
    @IsOptional()
    waferId: number

    @IsNumber()
    @ApiProperty({ type: 'number' })
    @IsOptional()
    chipId: number

    @IsString()
    @IsOptional()
    @ApiProperty({ type: 'string' })
    asicQuality: string

    @IsString({ each: true })
    @IsOptional()
    @ApiProperty({isArray: true, items: { type: 'string'}})
    asicFamilyTypes: string[]

    @IsString()
    @IsOptional()
    @ApiProperty({ type: 'string' })
    serialNumber: string

    @IsNumber()
    @ApiProperty({ type: 'number', default: 40 })
    @IsOptional()
    @Max(10 * 1000)
    limit?: number = 40

    @IsNumber()
    @ApiProperty({ type: 'number', default: 20 })
    @IsOptional()
    offset?: number = 0

}
