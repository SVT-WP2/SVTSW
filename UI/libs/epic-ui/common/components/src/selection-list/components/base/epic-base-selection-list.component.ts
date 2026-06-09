import { SelectionModel } from '@angular/cdk/collections'
import { Component, Input, OnInit } from '@angular/core'
import { BaseFormControlComponent, SelectOptionLabelValue } from 'epic-ui/utils'
import { compact } from 'lodash-es'


@Component({
    selector: 'epic-base-selection-list',
    template: '',
})
export abstract class EpicBaseSelectionListComponent<TValue = unknown, TData = unknown>
    extends BaseFormControlComponent<TValue | TValue[]>
    implements OnInit {

    @Input() trackBy: ((value: TValue) => string | number) | undefined
    @Input() multiple = true
    @Input() selectionModel: SelectionModel<TValue>

    get value(): TValue[] | TValue {
        return this.multiple ? this.selectionModel.selected : this.selectionModel.selected[0]
    }

    set value(value: TValue[] | TValue) {
        if (this.selectionModel) {
            const selectionValue = this.multiple
                ? (value as TValue[]) ?? []
                : compact([value as TValue])

            this.selectionModel.setSelection(...(selectionValue ?? []))
        }
    }

    ngOnInit(): void {
        if (!this.selectionModel) {
            this.selectionModel = new SelectionModel<TValue>(this.multiple)
        }
    }

    trackByFn = (index: number, option: SelectOptionLabelValue<TValue, TData>) => {
        return this.trackBy
            ? this.trackBy(option.value)
            : option.value as unknown as string
    }

    onSelectionChanged(value: TValue[]): void {
        this.selectionModel.setSelection(...value)
        this.onChange(this.value)
    }

    onOptionSelectionChanged(value: TValue, isSelected: boolean): void {
        if (!this.multiple && !isSelected) {
            return
        }

        if ((isSelected !== this.selectionModel.isSelected(value))) {
            this.selectionModel.toggle(value)
            this.onChange(this.value)
        }
    }

}
