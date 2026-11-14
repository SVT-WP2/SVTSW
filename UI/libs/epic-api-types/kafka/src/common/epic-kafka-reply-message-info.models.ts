import { EpicKafkaMessage } from './epic-kafka-message.models'


export type EpicKafkaReplyMessageInfo<TMessage extends EpicKafkaMessage = EpicKafkaMessage> = {
    correlationId: string
    message: TMessage
}
