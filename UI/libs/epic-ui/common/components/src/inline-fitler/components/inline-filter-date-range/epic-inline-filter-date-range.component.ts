import { Component, computed, forwardRef, input, signal } from '@angular/core'
import { FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms'
import { DateRange, MatDatepickerModule } from '@angular/material/datepicker'
import { BaseFormValueControlComponent } from 'epic-ui/utils'
import moment, { Moment } from 'moment'

import { EpicSelectionToggleComponent } from '../../../selection-toggle'
import { EpicInlineFilterWithOverlayComponent } from '../filter-with-overlay'

import { EpicInlineFilterDateRange } from './epic-inline-filter-date-range.models'


@Component({
    selector: 'epic-inline-filter-date-range',
    templateUrl: './epic-inline-filter-date-range.component.html',
    imports: [
        FormsModule,
        MatDatepickerModule,
        EpicInlineFilterWithOverlayComponent,
        EpicSelectionToggleComponent,
    ],
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => EpicInlineFilterDateRangeComponent),
            multi: true,
        },
    ],
})
export class EpicInlineFilterDateRangeComponent extends BaseFormValueControlComponent<EpicInlineFilterDateRange.Value | null> {

    // INPUTS
    readonly icon = input<string>()
    readonly isIconOnly = input<boolean>(false)
    readonly label = input<string>()
    readonly isActive = input<boolean | undefined>(undefined)
    readonly width = input<string>('300px')

    /** The range being picked in the overlay — it only becomes the value once Apply is pressed. */
    readonly draftRange = signal<DateRange<Moment> | null>(null)

    readonly draftRangeLabel = computed<string>(() => {
        const draftRange = this.draftRange()

        if (!draftRange?.start) {
            return ''
        }

        const from = draftRange.start.format(EpicInlineFilterDateRange.DATE_FORMAT)

        return draftRange.end
            ? `${from} - ${draftRange.end.format(EpicInlineFilterDateRange.DATE_FORMAT)}`
            : from
    })

    get hasValue(): boolean {
        return !EpicInlineFilterDateRange.isEmpty(this.value)
    }

    onDateSelected(date: Moment | null): void {
        if (!date) {
            return
        }

        const draftRange = this.draftRange()
        // the first pick opens a range, the second one closes it — picking before the start opens a new one
        const isRangeEnd = !!draftRange?.start && !draftRange.end && !date.isBefore(draftRange.start)

        this.draftRange.set(
            isRangeEnd
                ? new DateRange<Moment>(draftRange.start, date)
                : new DateRange<Moment>(date, null),
        )
    }

    onClear(): void {
        this.draftRange.set(null)
    }

    onApply(): void {
        const draftRange = this.draftRange()

        // a range left half open covers that single day
        this.value = draftRange?.start
            ? {
                from: draftRange.start.clone().startOf('day').toISOString(),
                to: (draftRange.end || draftRange.start).clone().startOf('day').toISOString(),
            }
            : null

        this.onChange(this.value)
    }

    onPanelOpened(): void {
        this.resetDraftRange()
    }

    onPanelClosed(): void {
        this.resetDraftRange()
    }

    override writeValue(value: EpicInlineFilterDateRange.Value | null): void {
        super.writeValue(value)
        this.resetDraftRange()
    }

    protected resetDraftRange(): void {
        this.draftRange.set(
            EpicInlineFilterDateRange.isEmpty(this.value)
                ? null
                : new DateRange<Moment>(
                    this.value!.from ? moment(this.value!.from) : null,
                    this.value!.to ? moment(this.value!.to) : null,
                ),
        )
    }

}
