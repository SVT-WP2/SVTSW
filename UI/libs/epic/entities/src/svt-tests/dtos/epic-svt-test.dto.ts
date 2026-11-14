import { ApiProperty } from '@nestjs/swagger'
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator'
import { EpicSvtDutEntityName, EpicSvtTest, EpicSvtTestResultStatus, EpicSvtTestStatus } from 'svt-ts-types'


export class EpicSvtTestDto implements EpicSvtTest {

    @IsNumber()
    @ApiProperty({ type: 'number' })
    id: number

    @IsString()
    @ApiProperty({ type: 'string', description: 'Enum value dutEntityName' })
    dutEntityName: EpicSvtDutEntityName

    @IsNumber()
    @ApiProperty({ type: 'number' })
    dutId: number

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
