import { EpicKafkaMessage, EpicKafkaReplyMessageInfo } from 'epic-api-types/kafka'
import { Observable, Subject } from 'rxjs'


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
