import { IsDateString, IsString } from 'class-validator'


/**
 * `UpdateSvtTestStart` payload's `data.update` (`SvtTestStartUpdateDto` of the Kafka contract). The message
 * has no TypeScript class in `epic/entities` yet: TestAgent is its client, not the BFF.
 */
export class SvtDbAgentNextSvtTestStartDto {

    /** ISO 8601 date-time; stored as UTC. */
    @IsDateString()
    startedAt!: string

}

/** `UpdateSvtTestFinish` payload's `data.update` (`SvtTestFinishUpdateDto` of the Kafka contract). */
export class SvtDbAgentNextSvtTestFinishDto {

    /** ISO 8601 date-time; stored as UTC. */
    @IsDateString()
    finishedAt!: string

    @IsString()
    pathToResult!: string

    /** A value of the database's `testResultStatus` enum. */
    @IsString()
    testResultStatus!: string

}
