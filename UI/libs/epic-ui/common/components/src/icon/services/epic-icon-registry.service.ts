import { Inject, Injectable, Optional } from '@angular/core'
import { MatIconRegistry } from '@angular/material/icon'
import { DomSanitizer } from '@angular/platform-browser'

import { EPIC_ICON_DEFAULT_BASE_PATH, EPIC_ICON_PROVIDER, EpicIconsProvider } from '../models'


@Injectable({ providedIn: 'root' })
export class EpicIconRegistry {

    protected readonly defaultBasePath: string = EPIC_ICON_DEFAULT_BASE_PATH
    protected readonly iconsSet = new Set<string>()

    constructor(
        @Inject(EPIC_ICON_PROVIDER) @Optional() protected iconsProviders: EpicIconsProvider[],
        protected iconRegistry: MatIconRegistry,
        protected sanitizer: DomSanitizer) {

        this.registerAllProviders()

    }

    get allIcons(): string[] {
        return Array.from<string>(this.iconsSet)
    }

    registerIcons(iconNames: string[], basePath?: string): void {
        iconNames
            .forEach(iconName => {
                this.iconsSet.add(iconName)
                const iconUrl = `${(basePath || this.defaultBasePath)}/${iconName}.svg`
                this.iconRegistry.addSvgIcon(
                    iconName,
                    this.sanitizer.bypassSecurityTrustResourceUrl(iconUrl),
                )
            })
    }

    doesIconExist(iconName: string): boolean {
        return this.iconsSet.has(iconName)
    }

    protected registerAllProviders(): void {
        (this.iconsProviders || [])
            .forEach(iconsProvider => {
                if (iconsProvider.iconNames.length && !this.iconsSet.has(iconsProvider.iconNames[0])) {
                    this.registerIcons(iconsProvider.iconNames, iconsProvider.basePath)
                }
            })
    }

}
