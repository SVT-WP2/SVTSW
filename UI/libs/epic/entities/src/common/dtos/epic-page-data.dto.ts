import { ApiProperty } from '@nestjs/swagger'
import { IsArray, IsNumber } from 'class-validator'


export class EpicPageDataDto<T> {

    @IsArray()
    @ApiProperty({ type: 'array', isArray: true })
    items: T[]

    @IsNumber()
    @ApiProperty({ type: 'number' })
    totalCount: number

}
