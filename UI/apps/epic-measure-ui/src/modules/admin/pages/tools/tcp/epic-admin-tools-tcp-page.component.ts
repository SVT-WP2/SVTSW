import { AsyncPipe } from '@angular/common'
import { Component, inject, OnDestroy, signal } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { MatButton } from '@angular/material/button'
import { MatCardModule } from '@angular/material/card'
import { MatDivider } from '@angular/material/divider'
import { MatFormField, MatLabel } from '@angular/material/form-field'
import { MatInput } from '@angular/material/input'
import { EpicTcpApiClient } from 'epic-ui/api'
import { EpicTabsModule } from 'epic-ui/common/components'
import { EpicLayoutLightModule } from 'epic-ui/common/layout'
import { EpicTcpSendMessageForm, EpicTcpSendMessageFormComponent } from 'epic-ui/shared/tcp'
import { BaseComponent } from 'epic-ui/utils'
import { BehaviorSubject, catchError, concat, finalize, Observable, of, Subject, switchMap, takeUntil, tap, throwError } from 'rxjs'


@Component({
    selector: 'epic-admin-tools-tcp-page',
    templateUrl: 'epic-admin-tools-tcp-page.component.html',
    imports: [
        EpicTabsModule,
        EpicLayoutLightModule,
        MatCardModule,
        EpicTcpSendMessageFormComponent,
        MatDivider,
        ReactiveFormsModule,
        MatFormField,
        FormsModule,
        AsyncPipe,
        MatInput,
        MatButton,
        MatLabel,
    ],
})
export class EpicAdminToolsTcpPageComponent extends BaseComponent implements OnDestroy {

    readonly tcpMessages$ = new BehaviorSubject<string>('')
    readonly cancelTcpProcessing$ = new Subject<void>()

    readonly isTcpSendMessageProcessing = signal<boolean>(false)

    // DI
    private readonly epicTcpApiClient = inject(EpicTcpApiClient)

    constructor() {
        super()
    }

    override ngOnDestroy(): void {
        super.ngOnDestroy()
    }

    onSendTcpMessage(formValue: EpicTcpSendMessageForm.FormValue) {
        this.isTcpSendMessageProcessing.set(true)
        const newRecord = `[${formValue.ipAddress}:${formValue.portNumber}]: ${formValue.message}`
        this.addTcpLogRecord(newRecord)

        this.epicTcpApiClient.send({
            ipAddress: formValue.ipAddress,
            portNumber: formValue.portNumber,
            message: formValue.message,
        })
            .pipe(
                finalize(() => this.isTcpSendMessageProcessing.set(false)),
                takeUntil(this.destroyed$),
                takeUntil(this.cancelTcpProcessing$),
                catchError((error) => {
                    this.addTcpLogRecord('>>>> ERROR')
                    console.error('Unable to Send a Message via TCP', error)
                    return throwError(() => error)
                }),
            )
            .subscribe(response => {
                console.log('TCP RESPONSE', response)
            })
    }

    onSendAndReadTcpMessage(formValue: EpicTcpSendMessageForm.FormValue) {
        const messagesList = formValue.message.split('\n')
            .filter((msg) => !msg.startsWith('//'))

        this.isTcpSendMessageProcessing.set(true)
        concat(
            ...messagesList
                .map(message => this.sendAndReadOneLine(formValue.ipAddress, formValue.portNumber, message)),
        )
            .pipe(
                takeUntil(this.destroyed$),
                takeUntil(this.cancelTcpProcessing$),
                finalize(() => this.isTcpSendMessageProcessing.set(false)),
            )
            .subscribe()
    }

    onReadTcpMessage(formValue: EpicTcpSendMessageForm.FormValue) {
        this.isTcpSendMessageProcessing.set(true)
        this.epicTcpApiClient.read({
            ipAddress: formValue.ipAddress,
            portNumber: formValue.portNumber,
        })
            .pipe(
                finalize(() => this.isTcpSendMessageProcessing.set(false)),
                takeUntil(this.destroyed$),
                takeUntil(this.cancelTcpProcessing$),
                catchError((error) => {
                    this.addTcpLogRecord('>>>> ERROR')
                    console.error('Unable to Send a Message via TCP', error)
                    return throwError(() => error)
                }),
            )
            .subscribe(response => {
                this.addTcpLogRecord(`>>>> ${response}`)
                console.log('TCP RESPONSE', response)
            })
    }

    onClearTcpLogBtnClicked(): void {
        this.tcpMessages$.next('')
    }

    onCancelTcpProcessing(): void {
        this.cancelTcpProcessing$.next()
    }

    private addTcpLogRecord(message: string): void {
        this.tcpMessages$.next(
            this.tcpMessages$.value + '\n' + message,
        )
    }

    private sendAndReadOneLine(ipAddress: string, portNumber: number, message: string): Observable<string> {
        const start$ = of('')
            .pipe(
                tap(() => {
                    const newRecord = `[${ipAddress}:${portNumber}]: ${message}`
                    this.addTcpLogRecord(newRecord)
                }),
                // delay(1000),
                // map(() => 'dummy response'),
                // tap((response) => this.addTcpLogRecord(`>>>> ${response}`)),
            )

        return start$
            .pipe(
                switchMap(() => this.epicTcpApiClient.sendAndRead({ ipAddress, portNumber, message })),
                finalize(() => this.isTcpSendMessageProcessing.set(false)),
                catchError((error) => {
                    this.addTcpLogRecord('>>>> ERROR')
                    console.error('Unable to Send a Message via TCP', error)
                    return throwError(() => error)
                }),
                tap((response) => this.addTcpLogRecord(`>>>> ${response}`)),
            )

    }

}
