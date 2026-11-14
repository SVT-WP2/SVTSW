import { ApiProperty } from '@nestjs/swagger'
import { IsString } from 'class-validator'
import { EpicWaferTypeMap } from 'svt-ts-types'


export class EpicWaferTypeMapDto implements EpicWaferTypeMap {

    @ApiProperty({ type: 'string', description: 'Stringified JSON' })
    @IsString()
    waferMap: string

}
