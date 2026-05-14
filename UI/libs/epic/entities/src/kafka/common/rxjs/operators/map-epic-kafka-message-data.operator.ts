import { Observable, of, OperatorFunction, switchMap, throwError } from 'rxjs'

import { EpicKafkaReplyMessage } from '../../epic-kafka-reply-message.models'
import { EpicKafkaReplyStatus } from '../../epic-kafka-reply-status.models'


export function mapEpicKafkaMessageData<TSource extends EpicKafkaReplyMessage = EpicKafkaReplyMessage>()
    : OperatorFunction<TSource, TSource['data']> {
    return (source: Observable<TSource>) => (
        source
            .pipe(
                switchMap((replyMessage: TSource) => {
                    if (replyMessage.status === EpicKafkaReplyStatus.Success) {
                        return of(replyMessage.data)
                    }
                    return throwError(() => replyMessage)
                }),
            )
    )
}
