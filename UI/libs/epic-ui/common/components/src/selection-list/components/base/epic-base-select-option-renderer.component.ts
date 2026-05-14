import { Component } from '@angular/core'

import { EpicBaseContentRendererComponent } from '../../../content-renderer'
import { EpicSelectOptionRendererParams } from '../../models'


@Component({
    selector: 'epic-base-selection-list-option-renderer',
    template: '',
})
export abstract class EpicBaseSelectOptionRendererComponent<TValue = string, TData = unknown>
    extends EpicBaseContentRendererComponent<EpicSelectOptionRendererParams<TValue, TData>> {

}
