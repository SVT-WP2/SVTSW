import { Component, inject, signal } from '@angular/core'
import { FormGroup } from '@angular/forms'
import { MatButton } from '@angular/material/button'
import { MatCard, MatCardContent } from '@angular/material/card'
import {
    EpicInstConnectionType,
    EpicIvDataRecord,
    EpicIvMnt,
    EpicIvMntApiClient,
    EpicIvMntCreateRequestPayload,
    EpicIvMntWs,
    EpicIvMntWsFacade,
    EpicMntStatus,
    EpicSourceMeterType,
} from 'epic-ui/api'
import { EpicIconComponent, EpicAlertModule, EpicNotificationService } from 'epic-ui/common/components'
import { BaseComponent, ProcessingStore } from 'epic-ui/utils'
import { catchError, filter, Subscription, takeUntil, tap, throwError, timer } from 'rxjs'
import { switchMap } from 'rxjs/operators'

import { EpicIvMntChartComponent } from '../../components'
import { EpicIvMntNewFormComponent } from '../../forms'
import { EpicIvMntNewForm } from '../../models'


@Component({
    selector: 'epic-iv-mnt-container',
    templateUrl: 'epic-iv-mnt-container.component.html',
    standalone: true,
    imports: [
        MatButton,
        MatCard,
        MatCardContent,
        EpicIvMntNewFormComponent,
        EpicIvMntChartComponent,
        EpicAlertModule,
        EpicIconComponent,
    ],
})
export class EpicIvMntContainerComponent extends BaseComponent {

    formGroup: FormGroup<EpicIvMntNewForm.FormGroupControls>

    readonly chartData = signal<EpicIvDataRecord[]>([
        {
            voltage: 0,
            current: 0,
        },
    ])

    readonly mntProcessing = signal<ProcessingStore.EventProcessingState>(ProcessingStore.getDefaultProcessingState())
    readonly isAbortProcessing = signal<boolean>(false)

    readonly initFormData: EpicIvMntNewForm.FormValue = {
        name: 'Some Name',
        voltageStart: 0,
        voltageStop: 20,
        voltageStep: 5,
        sweepDelayInMs: 500,
        initDelayInMs: 1000,
        complianceInA: 1e-5,
    }

    // DI
    protected readonly epicIvMntApiClient = inject(EpicIvMntApiClient)
    protected readonly epicIvMntWsFacade = inject(EpicIvMntWsFacade)
    protected readonly epicNotificationService = inject(EpicNotificationService)

    protected fakeDataSub: Subscription
    protected wsSub: Subscription
    protected currentMeasurement: EpicIvMnt

    onSubmitBtnClicked(): void {
        this.mntProcessing.set(ProcessingStore.eventProcessingStart(this.mntProcessing()))
        this.chartData.set([])
        this.formGroup.disable()
        this.createAndStartMeasurement()
        // this.startFakeDataGeneration()
    }

    onStopBtnClicked(): void {
        this.processMntStop()
    }

    onFormGroupReady(formGroup: FormGroup<EpicIvMntNewForm.FormGroupControls>): void {
        this.formGroup = formGroup
    }

    private createAndStartMeasurement(): void {
        const createRequest: EpicIvMntCreateRequestPayload = {
            name: this.formGroup.value.name!,
            settings: {
                voltageStart: this.formGroup.value.voltageStart!,
                voltageStop: this.formGroup.value.voltageStop!,
                voltageStep: this.formGroup.value.voltageStep!,
                sweepDelayInMs: this.formGroup.value.sweepDelayInMs!,
                initDelayInMs: this.formGroup.value.initDelayInMs!,
                complianceInA: this.formGroup.value.complianceInA!,
            },
            labels: [],
            sourceMeterConfig: {
                connectionType: EpicInstConnectionType.None,
                instrumentType: EpicSourceMeterType.FakeSource,
            },
        }

        this.epicIvMntApiClient.create(createRequest)
            .pipe(
                tap(measurement => this.currentMeasurement = measurement),
                tap(measurement => this.startWatchingEvents(measurement.id)),
                switchMap((measurement) => this.epicIvMntApiClient.start(measurement.id)),
                catchError(error => {
                    return throwError(error)
                }),
            )
            .subscribe(() => {

            })
    }

    private startWatchingEvents(measurementId: string): void {
        this.wsSub?.unsubscribe()
        this.wsSub = this.epicIvMntWsFacade.createConnection()
            .pipe(
                takeUntil(this.destroyed$),
                filter((message: EpicIvMntWs.Message) => message.data!.measurementId === measurementId),
            )
            .subscribe((message: EpicIvMntWs.Message) => {
                switch (message.eventName) {
                    case EpicIvMntWs.EventName.NewData:
                        this.processNewDataMessage(message)
                        break
                    case EpicIvMntWs.EventName.StatusChanged:
                        this.processStatusChangedMessage(message)
                        break
                }
            })
    }

    private processNewDataMessage(message: EpicIvMntWs.NewDataMessage): void {
        this.chartData.set([
            ...this.chartData(),
            ...message.data!.dataRecords,
        ])
    }

    private processStatusChangedMessage(message: EpicIvMntWs.StatusChangedMessage): void {
        switch (message.data!.status) {
            case EpicMntStatus.Aborted:
                this.processMntAborted()
                break
            case EpicMntStatus.Done:
                this.processMntDone()
                break
            case EpicMntStatus.Error:
                this.processMntError(message.data!.errorMessage!)
                break
        }
    }

    private processMntAborted(): void {
        this.finishMeasurements()
    }

    private processMntError(errorMessage: string): void {
        this.finishMeasurements(errorMessage)
        this.epicNotificationService.error(
            errorMessage,
            'Measurement Processing Error',
        )
    }

    private processMntDone(): void {
        this.finishMeasurements()
        this.epicNotificationService.doneMessage()
    }

    private finishMeasurements(errorMessage: string | null = null): void {
        this.mntProcessing.set(
            ProcessingStore.eventProcessingFinish(this.mntProcessing(), errorMessage ? new Error(errorMessage) : null),
        )
        this.isAbortProcessing.set(false)
        this.formGroup.enable()
    }

    private processMntStop(): void {
        this.isAbortProcessing.set(true)
        this.epicIvMntApiClient.abort(this.currentMeasurement.id)
            .pipe(
                catchError(error => {
                    // TODO: not sure what to do
                    return throwError(() => error)
                }),
            )
            .subscribe(() => {
                this.finishMeasurements()
            })
    }

    private startFakeDataGeneration(): void {
        this.fakeDataSub = timer(this.formGroup.controls.sweepDelayInMs.value!, this.formGroup.controls.sweepDelayInMs.value!)
            .pipe(
                takeUntil(this.destroyed$),
            )
            .subscribe(() => {
                const message: EpicIvMntWs.NewDataMessage = {
                    eventName: EpicIvMntWs.EventName.NewData,
                    data: {
                        measurementId: 'test',
                        dataRecords: [
                            {
                                current: Math.random() * 1e-6 + Math.random() * 6e-6,
                                voltage: this.chartData().length
                                    ? this.chartData()[this.chartData().length - 1].voltage + 1
                                    : 0,
                            },
                        ],
                    },
                }
                this.processNewDataMessage(message)
            })
    }

}
