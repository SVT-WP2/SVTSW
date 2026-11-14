import { IsDateString } from 'class-validator'
import { EpicSvtTestStartUpdate } from 'svt-ts-types/kafka'


/** `data.update` of `UpdateSvtTestStart` (`SvtTestStartUpdateDto` of the Kafka contract). */
export class EpicSvtTestStartUpdateDto implements EpicSvtTestStartUpdate {

    @IsDateString()
    startedAt: string

}
