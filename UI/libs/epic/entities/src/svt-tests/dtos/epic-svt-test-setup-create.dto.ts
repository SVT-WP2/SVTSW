import { ApiProperty } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsOptional, IsString, ValidateNested } from 'class-validator'
import { EpicSvtTestSetupCreateRequest, EpicSvtTestSetupDefaultConfigCreateRequest } from 'svt-ts-types'


export class EpicSvtTestSetupDefaultConfigCreateDto implements EpicSvtTestSetupDefaultConfigCreateRequest {

    @IsString()
    @ApiProperty({ type: 'string' })
    name!: string

    @IsString()
    @ApiProperty({ type: 'string', description: 'Config file content as plain text: JSON or JSON5' })
    configBody!: string

    @IsString()
    @IsOptional()
    @ApiProperty({ type: 'string' })
    note: string

}

export class EpicSvtTestSetupCreateDto implements EpicSvtTestSetupCreateRequest {

    @IsString()
    @ApiProperty({ type: 'string' })
    name: string

    @IsString()
    @ApiProperty({ type: 'string', description: 'Enum value generalLocation' })
    generalLocation: string

    @ApiProperty({ type: EpicSvtTestSetupDefaultConfigCreateDto })
    @ValidateNested()
    @Type(() => EpicSvtTestSetupDefaultConfigCreateDto)
    defaultConfig!: EpicSvtTestSetupDefaultConfigCreateDto


}


