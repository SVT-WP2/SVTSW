import { EnvironmentProviders } from '@angular/core'
import { provideEffects } from '@ngrx/effects'
import { provideState } from '@ngrx/store'

import { EpicSvtTestSetupsEffects, EpicSvtTestSetupsStore } from './store'


export function provideEpicSvtTestSetupsStore(): EnvironmentProviders[] {
    return [
        provideState({
            name: EpicSvtTestSetupsStore.FEATURE_NAME,
            reducer: EpicSvtTestSetupsStore.reducer,
        }),
        provideEffects(
            EpicSvtTestSetupsEffects,
        ),
    ]
}
