import { Provider } from '@angular/core'

import { EPIC_DEFAULT_ICONS, EPIC_ICON_DEFAULT_BASE_PATH, EPIC_ICON_PROVIDER, EpicIconsProvider } from './models'


export function provideEpicDefaultIcons(): Provider {
    return {
        provide: EPIC_ICON_PROVIDER,
        useValue: {
            iconNames: EPIC_DEFAULT_ICONS,
            basePath: EPIC_ICON_DEFAULT_BASE_PATH,
        } as EpicIconsProvider,
        multi: true,
    }
}

