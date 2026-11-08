import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { MatCard, MatCardContent } from '@angular/material/card'
import { MatFormField, MatHint, MatLabel, MatPrefix } from '@angular/material/form-field'
import { MatOption, MatSelect } from '@angular/material/select'
import { EpicIconComponent, EpicButtonModule } from 'epic-ui/common/components'
import { BaseComponent } from 'epic-ui/utils'
import { EpicWpMachine, EpicWpMachineUpdateLoadedWaferRequest } from 'svt-ts-types'


@Component({
    selector: 'epic-wp-machine-card',
    templateUrl: 'epic-wp-machine-card.component.html',
    standalone: true,
    imports: [
        MatCardContent,
        MatCard,
        EpicIconComponent,
        EpicButtonModule,
        FormsModule,
        MatFormField,
        MatSelect,
        MatOption,
        MatLabel,
        MatPrefix,
        MatHint,
    ],
    host: {
        class: 'd-block',
    },
})
export class EpicWpMachineCardComponent extends BaseComponent implements OnChanges {

    @Input({ required: true }) entity!: EpicWpMachine
    /** The values of the `waferMapOrientation` enum (`EpicEnumsFacade`). */
    @Input() orientationOptions: string[] = []

    /** The body of `POST /api/wp-machines/:id/loaded-wafer`: a load (wafer + orientation) or an unload (`null`). */
    @Output() loadedWaferChanged$ = new EventEmitter<EpicWpMachineUpdateLoadedWaferRequest>()
    @Output() installedProbeCardChanged$ = new EventEmitter<number | null>()

    /** A wafer picked before its orientation: the load waits for one (the DB agent requires it). */
    pendingWaferId: number | undefined
    /** An orientation picked while no wafer is loaded: used by the next load. */
    pendingOrientation: string | undefined

    get selectedWaferId(): number | null {
        return this.pendingWaferId ?? this.entity.loadedWaferId
    }

    get selectedOrientation(): string | null {
        return this.pendingOrientation ?? this.entity.loadedWaferOrientation
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['entity']) {
            this.pendingWaferId = undefined
            this.pendingOrientation = undefined
        }
    }

    onProbeCardChanged(loadedProbeCardId: number | null): void {
        this.installedProbeCardChanged$.emit(loadedProbeCardId)
    }

    onLoadedWaferChanged(loadedWaferId: number | null): void {
        if (loadedWaferId === null) {
            this.pendingWaferId = undefined
            this.loadedWaferChanged$.emit({ loadedWaferId: null, loadedWaferOrientation: null })
            return
        }
        const orientation = this.selectedOrientation
        if (!orientation) {
            this.pendingWaferId = loadedWaferId
            return
        }
        this.loadedWaferChanged$.emit({ loadedWaferId, loadedWaferOrientation: orientation })
    }

    /** With a wafer loaded (or picked), a new orientation loads it in that orientation; otherwise it is kept for the next load. */
    onOrientationChanged(orientation: string): void {
        const waferId = this.selectedWaferId
        if (waferId === null) {
            this.pendingOrientation = orientation
            return
        }
        this.pendingOrientation = orientation
        this.loadedWaferChanged$.emit({ loadedWaferId: waferId, loadedWaferOrientation: orientation })
    }

}
