import { InputSignal, OutputEmitterRef, Type } from '@angular/core'
import { GenericEventInfo } from 'epic-ui/utils'
import { Observable } from 'rxjs'


export interface IEpicContentRendererComponent<TParams = unknown, TEvent extends GenericEventInfo = GenericEventInfo> {

    readonly params: InputSignal<TParams | undefined>
    readonly event: OutputEmitterRef<TEvent>

}

export type EpicContentRendererFactory<TParams = unknown, TEvent extends GenericEventInfo = GenericEventInfo>
    = (params: TParams) => Type<IEpicContentRendererComponent<TParams, TEvent>> | string

export type EpicContentRendererFactoryConfig<TParams = unknown, TEvent extends GenericEventInfo = GenericEventInfo> = {
    factory: EpicContentRendererFactory<TParams, TEvent>
    params?: TParams | Observable<TParams>
}
