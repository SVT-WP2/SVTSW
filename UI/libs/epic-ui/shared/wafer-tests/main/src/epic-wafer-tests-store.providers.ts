import { EnvironmentProviders } from '@angular/core'
import { provideEffects } from '@ngrx/effects'
import { provideState } from '@ngrx/store'

import { EpicWaferTestsEffects, EpicWaferTestsStore } from './store'


export function provideEpicWaferTestsStore(): EnvironmentProviders[] {
    return [
        provideState({
            name: EpicWaferTestsStore.FEATURE_NAME,
            reducer: EpicWaferTestsStore.reducer,
        }),
        provideEffects(
            EpicWaferTestsEffects,
        ),
    ]
}
