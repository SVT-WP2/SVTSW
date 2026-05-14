import { Directive, Input, TemplateRef } from '@angular/core'
import { SelectOptionLabelValue } from 'epic-ui/utils'


export type EpicSelectionListOptionContext<TValue = string, TData = unknown> = {
    option: SelectOptionLabelValue<TValue, TData>
    isSelected: boolean
    index: number
}

@Directive({
    selector: '[epicSelectionListOption]ng-template',
})
export class EpicSelectionListOptionDirective<TValue = string, TData = unknown> {

    @Input() valueType: TValue
    @Input() dataType: TData
    @Input() optionType: SelectOptionLabelValue<TValue, TData>

    constructor(
        readonly templateRef: TemplateRef<EpicSelectionListOptionContext<TValue, TData>>,
    ) {
    }

    static ngTemplateContextGuard<TValue = string, TData = unknown>(
        dir: EpicSelectionListOptionDirective,
        ctx: unknown): ctx is EpicSelectionListOptionContext<TValue, TData> {
        return true
    }

}

