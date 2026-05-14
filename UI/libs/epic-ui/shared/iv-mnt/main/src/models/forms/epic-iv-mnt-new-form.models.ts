import { FormControl, FormGroup, Validators } from '@angular/forms'


export namespace EpicIvMntNewForm {

    export enum FormField {
        name = 'name',
        voltageStart = 'voltageStart',
        voltageStop = 'voltageStop',
        voltageStep = 'voltageStep',
        sweepDelayInMs = 'sweepDelayInMs',
        initDelayInMs = 'initDelayInMs',
        complianceInA = 'complianceInA',
    }

    export type FormValue = {
        name: string
        voltageStart: number
        voltageStop: number
        voltageStep: number
        sweepDelayInMs: number
        initDelayInMs: number
        complianceInA: number
    }

    export type FormGroupControls = {
        name: FormControl<string | null>
        voltageStart: FormControl<number | null>
        voltageStop: FormControl<number | null>
        voltageStep: FormControl<number | null>
        sweepDelayInMs: FormControl<number | null>
        initDelayInMs: FormControl<number | null>
        complianceInA: FormControl<number | null>
    }

    export type FormOptions = Record<string, any>

    export function createFromGroup(): FormGroup<FormGroupControls> {
        return new FormGroup({
            name: new FormControl<string| null>('', Validators.required),
            voltageStart: new FormControl<number | null>(null, Validators.required),
            voltageStop: new FormControl<number | null>(null, Validators.required),
            voltageStep: new FormControl<number | null>(null, [Validators.required, Validators.min(0)]),
            sweepDelayInMs: new FormControl<number | null>(null, [Validators.required, Validators.min(0)]),
            initDelayInMs: new FormControl<number | null>(null, [Validators.required, Validators.min(0)]),
            complianceInA: new FormControl<number | null>(null, [Validators.required, Validators.min(0)]),
        })
    }


}
