import { EnvironmentProviders } from '@angular/core'
import { provideEffects } from '@ngrx/effects'
import { provideState } from '@ngrx/store'

import { EpicSvtTestTypesEffects, EpicSvtTestTypesStore } from './store'


export function provideEpicSvtTestTypesStore(): EnvironmentProviders[] {
    return [
        provideState({
            name: EpicSvtTestTypesStore.FEATURE_NAME,
            reducer: EpicSvtTestTypesStore.reducer,
        }),
        provideEffects(
            EpicSvtTestTypesEffects,
        ),
    ]
}
