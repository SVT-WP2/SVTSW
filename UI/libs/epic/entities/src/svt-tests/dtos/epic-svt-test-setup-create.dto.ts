import { ApiProperty } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsOptional, IsString, ValidateNested } from 'class-validator'
import { EpicSvtTestSetupCreateRequest, EpicSvtTestSetupDefaultConfigCreateRequest } from 'epic-api-types'


export class EpicSvtTestSetupDefaultConfigCreateDto implements EpicSvtTestSetupDefaultConfigCreateRequest {

    @IsString()
    @ApiProperty({ type: 'string' })
    name!: string

    @IsString()
    @ApiProperty({ type: 'string', description: 'Config file content as a plain text (JSON, JSON5 or any other text file format)' })
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


