import { EnvironmentProviders } from '@angular/core'
import { provideEffects } from '@ngrx/effects'
import { provideState } from '@ngrx/store'

import {
    EpicWpMachinesEffects,
    EpicWpMachinesStore,
    EpicWpProbeCardsEffects,
    EpicWpProbeCardsStore,
    EpicWpProjectsEffects,
    EpicWpProjectsStore,
} from './store'


export function provideEpicWpStore(): EnvironmentProviders[] {
    return [
        provideState({
            name: EpicWpMachinesStore.FEATURE_NAME,
            reducer: EpicWpMachinesStore.reducer,
        }),
        provideState({
            name: EpicWpProbeCardsStore.FEATURE_NAME,
            reducer: EpicWpProbeCardsStore.reducer,
        }),
        provideState({
            name: EpicWpProjectsStore.FEATURE_NAME,
            reducer: EpicWpProjectsStore.reducer,
        }),
        provideEffects(
            EpicWpMachinesEffects,
            EpicWpProbeCardsEffects,
            EpicWpProjectsEffects,
        ),
    ]
}
