import { Observable, Subject } from 'rxjs'

import { EpicKafkaMessage } from './epic-kafka-message.models'
import { EpicKafkaReplyMessageInfo } from './epic-kafka-reply-message-info.models'


export abstract class EpicKafkaReplyMessageBusService<TMessage extends EpicKafkaMessage = EpicKafkaMessage> {

    readonly replyMessage$: Observable<EpicKafkaReplyMessageInfo<TMessage>>

    protected readonly _replyMessage$ = new Subject<EpicKafkaReplyMessageInfo<TMessage>>()

    constructor() {
        this.replyMessage$ = this._replyMessage$
    }

    emit(messageInfo: EpicKafkaReplyMessageInfo<TMessage>): void {
        this._replyMessage$.next(messageInfo)
    }

}
