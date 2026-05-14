import { ApiProperty } from '@nestjs/swagger'
import { IsString } from 'class-validator'


export class EpicWaferTypeMapDto {

    @ApiProperty({ type: 'string' })
    @IsString()
    waferMap: string

}

