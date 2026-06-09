import { Component, inject, signal } from '@angular/core'
import { FormGroup } from '@angular/forms'
import { Router } from '@angular/router'
import { EpicAuthLoginForm, EpicAuthLoginFormComponent, EpicAuthService } from 'epic-ui/common/auth'
import { EpicIconComponent, EpicAlertModule, EpicButtonModule } from 'epic-ui/common/components'
import { BaseComponent, ProcessingStore } from 'epic-ui/utils'
import { catchError, delay, throwError } from 'rxjs'


@Component({
    selector: 'app-login-page',
    templateUrl: 'app-login-page.component.html',
    imports: [
        EpicButtonModule,
        EpicAuthLoginFormComponent,
        EpicAlertModule,
        EpicIconComponent,
    ],
})
export class AppLoginPageComponent extends BaseComponent {

    readonly loginProcessing = signal<ProcessingStore.EventProcessingState>(ProcessingStore.getDefaultProcessingState())

    formGroup: FormGroup<EpicAuthLoginForm.FormGroupControls>

    // DI
    protected readonly epicAuthService = inject(EpicAuthService)
    protected readonly router = inject(Router)

    onLogin(): void {
        this.loginProcessing.set(
            ProcessingStore.eventProcessingStart(this.loginProcessing()),
        )
        this.formGroup.disable()

        this.epicAuthService.login(
            this.formGroup.value.login,
            this.formGroup.value.password,
        )
            .pipe(
                delay(500),
                catchError((error: Error) => {
                    this.loginProcessing.set(
                        ProcessingStore.eventProcessingFinish(this.loginProcessing(), error),
                    )
                    this.formGroup.enable()
                    return throwError(() => error)
                }),
            )
            .subscribe((user) => {
                this.loginProcessing.set(
                    ProcessingStore.eventProcessingFinish(this.loginProcessing()),
                )
                void this.router.navigate(['/'])
            })

    }

    onFormReady(formGroup: FormGroup<EpicAuthLoginForm.FormGroupControls>): void {
        this.formGroup = formGroup
    }

}
