import { map, Observable, OperatorFunction } from 'rxjs'

import { SvtDbAgentKafka } from '../../kafka-messages'


export function mapSvtDbAgentEntityReplyData<TSource extends SvtDbAgentKafka.OneEntityReplyMessageData
= SvtDbAgentKafka.OneEntityReplyMessageData>()
    : OperatorFunction<TSource, TSource['entity']> {
    return (source: Observable<TSource>) => (
        source
            .pipe(
                map((replyData: TSource) => replyData.entity),
            )
    )
}
