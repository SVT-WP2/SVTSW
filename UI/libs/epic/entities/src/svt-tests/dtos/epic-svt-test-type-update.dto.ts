import { ApiProperty } from '@nestjs/swagger'
import { IsArray, IsString } from 'class-validator'
import { EpicSvtTestTypeUpdateRequest } from 'svt-ts-types'


export class EpicSvtTestTypeUpdateDto implements EpicSvtTestTypeUpdateRequest {

    @IsArray()
    @IsString({ each: true })
    @ApiProperty({ type: 'string', isArray: true })
    dutTypes: string[]

}

