import { SvtDbAgentKafka } from 'epic-api-types/kafka'
import { map, Observable, OperatorFunction } from 'rxjs'


export function mapSvtDbAgentListReplyData<TSource extends SvtDbAgentKafka.ListReplyMessageData = SvtDbAgentKafka.ListReplyMessageData>()
    : OperatorFunction<TSource, TSource['items']> {
    return (source: Observable<TSource>) => (
        source
            .pipe(
                map((listReplyData: TSource) => listReplyData.items || []),
            )
    )
}
