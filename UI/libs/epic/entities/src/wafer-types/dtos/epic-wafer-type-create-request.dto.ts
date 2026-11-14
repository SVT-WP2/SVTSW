import { ApiProperty } from '@nestjs/swagger'
import { IsString } from 'class-validator'
import { EpicWaferTypeCreateRequest } from 'svt-ts-types'


export class EpicWaferTypeCreateRequestDto implements EpicWaferTypeCreateRequest {

    @ApiProperty({ type: 'string' })
    @IsString()
    name: string

    @ApiProperty({ type: 'string', description: 'Enum value engineeringRun' })
    @IsString()
    engineeringRun: string

    @ApiProperty({ type: 'string', description: 'Enum value foundryName' })
    @IsString()
    foundry: string

    @ApiProperty({ type: 'string', description: 'Enum value waferTech' })
    @IsString()
    technology: string

    @ApiProperty({ type: 'string', description: 'Stringified JSON' })
    @IsString()
    waferMap: string

}
