import { ApiProperty } from '@nestjs/swagger'
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator'
import { EpicSvtDutEntityName, EpicSvtTest, EpicSvtTestResultStatus, EpicSvtTestStatus } from 'svt-ts-types'


export class EpicSvtTestDto implements EpicSvtTest {

    @IsNumber()
    @ApiProperty({ type: 'number' })
    id: number

    @IsOptional()
    @IsString()
    @ApiProperty({
        type: 'string',
        nullable: true,
        description: 'Enum value dutEntityName; null when the device rows of the test are missing',
    })
    dutEntityName: EpicSvtDutEntityName | null

    @IsOptional()
    @IsNumber()
    @ApiProperty({ type: 'number', nullable: true, description: 'null when the device rows of the test are missing' })
    dutId: number | null

    @IsNumber()
    @ApiProperty({ type: 'number' })
    testTypeConfigId: number

    @IsNumber()
    @ApiProperty({ type: 'number' })
    testSetupConfigId: number

    @IsString()
    @ApiProperty({ type: 'string', description: 'ISO 8601 date-time (UTC)' })
    createdAt: string

    @IsOptional()
    @IsString()
    @ApiProperty({ type: 'string', nullable: true, description: 'ISO 8601 date-time (UTC); null until the test is started' })
    startedAt: string | null

    @IsOptional()
    @IsString()
    @ApiProperty({ type: 'string', nullable: true, description: 'ISO 8601 date-time (UTC); null until the test has finished' })
    finishedAt: string | null

    @IsOptional()
    @IsString()
    @ApiProperty({ type: 'string', nullable: true, description: 'null until the test has finished' })
    pathToResult: string | null

    @IsOptional()
    @IsEnum(EpicSvtTestResultStatus)
    @ApiProperty({
        enum: EpicSvtTestResultStatus,
        nullable: true,
        description: 'Physical result status, stored in the DB (enum testResultStatus); null until the test has finished',
    })
    testResultStatus: EpicSvtTestResultStatus | null

    @IsEnum(EpicSvtTestStatus)
    @ApiProperty({ enum: EpicSvtTestStatus, description: 'Synthetic status, derived on the BE from testResultStatus' })
    status: EpicSvtTestStatus

}
