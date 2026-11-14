import { SvtDbAgentKafka } from 'epic-api-types/kafka'
import { map, Observable, OperatorFunction } from 'rxjs'


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
