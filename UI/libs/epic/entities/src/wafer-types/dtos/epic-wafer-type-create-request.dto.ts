import { ApiProperty } from '@nestjs/swagger'
import { IsString } from 'class-validator'


export class EpicWaferTypeCreateRequestDto {

    @ApiProperty({ type: 'string' })
    @IsString()
    name: string

    @ApiProperty({ type: 'string' })
    @IsString()
    engineeringRun: string

    @ApiProperty({ type: 'string' })
    @IsString()
    foundry: string

    @ApiProperty({ type: 'string' })
    @IsString()
    technology: string

    @ApiProperty({ type: 'string' })
    @IsString()
    waferMap: string

}
