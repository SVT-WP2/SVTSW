import { ApiProperty } from '@nestjs/swagger'
import { IsNumber, IsString } from 'class-validator'
import { EpicChipCreateRequest } from 'svt-ts-types'


export class EpicChipCreateRequestDto implements EpicChipCreateRequest {

    @IsString()
    @ApiProperty({ type: 'string' })
    serialNumber: string

    @IsNumber()
    @ApiProperty({ type: 'number' })
    asicId: number

    @IsString()
    @ApiProperty({ type: 'string', description: 'Enum value generalLocation' })
    generalLocation: string

}

