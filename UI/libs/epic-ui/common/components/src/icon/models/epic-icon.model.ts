import { InjectionToken } from '@angular/core'


export const EPIC_DEFAULT_ICONS: string[] = [
    'epic-arrow-chevron-down',
    'epic-dashboard',
    'epic-line-chart',
    'epic-view-table',
    'epic-arrow-chevron-down',
    'epic-arrow-chevron-left',
    'epic-arrow-chevron-right',
    'epic-arrow-chevron-up',
    'epic-step-approve-done',
    'epic-attention',
    'epic-close',
    'epic-close-outline',
    'epic-info',
    'epic-copy',
    'epic-delete',
    'epic-eye-open',
    'epic-eye-close',
    'epic-more-actions',
    'epic-refresh',
    'epic-pencil',
    'epic-gear',
    'epic-tools',
    'epic-experiment',
    'epic-machine',
    'epic-clean-filter',
    'epic-report',
]

export const EPIC_ICON_PROVIDER = new InjectionToken<EpicIconsProvider>('EPIC_ICON_NAME_PROVIDER')

export type EpicIconsProvider = {
    basePath?: string
    iconNames: string[]
}

export const EPIC_ICON_DEFAULT_BASE_PATH = './assets/images/epic-common.components/icon'

export const EPIC_ICON_SUFFIX__SEPARATOR = '--'
export const EPIC_ICON_SUFFIX__MAT_OUTLINED = `${EPIC_ICON_SUFFIX__SEPARATOR}mat-outlined`
export const EPIC_ICON_SUFFIX__SVG = `${EPIC_ICON_SUFFIX__SEPARATOR}svg`

export function isMatOutlined(iconAlias: string): boolean {
    return iconAlias.includes(EPIC_ICON_SUFFIX__MAT_OUTLINED)
}

export function isEpicSvgIcon(iconAlias: string): boolean {
    return iconAlias.includes(EPIC_ICON_SUFFIX__SVG)
}

export function toEpicSvgIcon(iconName: string): string {
    return `${iconName}${EPIC_ICON_SUFFIX__SVG}`
}

export function toEpicMatOutlinedIcon(iconName: string): string {
    return `${iconName}${EPIC_ICON_SUFFIX__MAT_OUTLINED}`
}

export function extractIconName(iconAlias: string): string {
    return iconAlias.includes(EPIC_ICON_SUFFIX__SEPARATOR)
        ? iconAlias.split(EPIC_ICON_SUFFIX__SEPARATOR)[0]
        : iconAlias
}
