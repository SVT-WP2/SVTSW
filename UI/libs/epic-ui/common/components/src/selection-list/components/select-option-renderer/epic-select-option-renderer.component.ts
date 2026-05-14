import { Component, computed, input } from '@angular/core'
import { BaseComponent, SelectOptionLabelValue } from 'epic-ui/utils'

import { EpicGenericContentRendererComponent } from '../../../content-renderer'
import { EpicSelectOptionRendererFactory, EpicSelectOptionRendererParams } from '../../models'


@Component({
    selector: 'epic-select-option-renderer',
    templateUrl: './epic-select-option-renderer.component.html',
    imports: [
        EpicGenericContentRendererComponent,
    ],
})
export class EpicSelectOptionRendererComponent<TValue = unknown, TData = unknown> extends BaseComponent {

    readonly isSelected = input.required<boolean>()
    readonly option = input.required<SelectOptionLabelValue<TValue, TData>>()

    readonly factory = input.required<EpicSelectOptionRendererFactory<TValue, TData>>()

    readonly params = computed<EpicSelectOptionRendererParams<TValue, TData>>(() => ({
        isSelected: this.isSelected(),
        option: this.option(),
    }))


}
