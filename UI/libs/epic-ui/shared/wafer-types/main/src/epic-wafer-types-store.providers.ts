import { EnvironmentProviders } from '@angular/core'
import { provideEffects } from '@ngrx/effects'
import { provideState } from '@ngrx/store'

import { EpicWaferTypesEffects, EpicWaferTypesStore } from './store'


export function provideEpicWaferTypesStore(): EnvironmentProviders[] {
    return [
        provideState({
            name: EpicWaferTypesStore.FEATURE_NAME,
            reducer: EpicWaferTypesStore.reducer,
        }),
        provideEffects(
            EpicWaferTypesEffects,
        ),
    ]
}
