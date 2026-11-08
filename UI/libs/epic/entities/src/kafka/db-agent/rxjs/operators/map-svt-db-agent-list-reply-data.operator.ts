import { map, Observable, OperatorFunction } from 'rxjs'
import { SvtDbAgentKafka } from 'svt-ts-types/kafka'


export function mapSvtDbAgentListReplyData<TSource extends SvtDbAgentKafka.ListReplyMessageData = SvtDbAgentKafka.ListReplyMessageData>()
    : OperatorFunction<TSource, TSource['items']> {
    return (source: Observable<TSource>) => (
        source
            .pipe(
                map((listReplyData: TSource) => listReplyData.items || []),
            )
    )
}
