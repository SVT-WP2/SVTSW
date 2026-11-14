import { EpicKafkaMessage } from './epic-kafka-message.models'
import { EpicKafkaReplyError } from './epic-kafka-reply-error.models'
import { EpicKafkaReplyStatus } from './epic-kafka-reply-status.models'


/**
 * A reply as it travels on the wire. `data` and `error` may be `null` as well as absent: `EpicKafkaReplyMessageClass`
 * always writes both keys, `null` for the one that does not apply.
 */
export type EpicKafkaReplyMessage<TData extends Record<string, any> = Record<string, any>, TType extends string = string> =
    & Omit<EpicKafkaMessage<TData, TType>, 'data'>
    &
    {
        data?: TData | null
        status: EpicKafkaReplyStatus
        error?: EpicKafkaReplyError | null
    }


export abstract class EpicKafkaReplyMessageClass<TData extends Record<string, any> = Record<string, any>, TType extends string = string>
implements EpicKafkaReplyMessage<TData, TType> {

    readonly data: TData | null
    readonly error: EpicKafkaReplyError | null
    readonly status: EpicKafkaReplyStatus

    abstract readonly type: TType

    constructor(data?: TData, status?: EpicKafkaReplyStatus, error?: EpicKafkaReplyError) {
        this.status = status || EpicKafkaReplyStatus.Success
        this.data = data || null
        this.error = error || null

    }

}
