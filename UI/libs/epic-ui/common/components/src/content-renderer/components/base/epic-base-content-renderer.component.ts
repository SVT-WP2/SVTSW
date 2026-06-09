import { Component, input, output } from '@angular/core'
import { GenericEventInfo, BaseComponent } from 'epic-ui/utils'

import { IEpicContentRendererComponent } from '../../models'


@Component({
    selector: 'epic-base-content-renderer',
    template: '',
})
export abstract class EpicBaseContentRendererComponent<TParams = unknown, TEvent extends GenericEventInfo = GenericEventInfo>
    extends BaseComponent
    implements IEpicContentRendererComponent<TParams, TEvent> {

    readonly params = input<TParams | undefined>(undefined)

    readonly event = output<TEvent>()

}
