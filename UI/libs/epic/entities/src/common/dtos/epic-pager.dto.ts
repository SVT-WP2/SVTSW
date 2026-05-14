import { ApiProperty } from '@nestjs/swagger'
import { IsNumber, IsOptional } from 'class-validator'


export class EpicPagerDto {

    @IsNumber()
    @IsOptional()
    @ApiProperty({ type: 'number', default: 100 })
    limit?: number = 100

    @IsNumber()
    @IsOptional()
    @ApiProperty({ type: 'number', default: 0 })
    offset?: number = 0

}
