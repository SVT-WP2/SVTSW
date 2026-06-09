import { Params } from '@angular/router'
import { GenericEventInfo } from 'epic-ui/utils'


export type EpicMenuLightItemBase = {
    id?: string
    routerLink?: string
    routerQueryParams?: Params
    routerUrlPattern?: string
    icon?: string
    label: string
    clickFn?: (event: MouseEvent) => void
    submenu?: EpicMenuLightSubmenu
}

export type EpicMenuLightSubmenuItem =
    & EpicMenuLightItemBase
    & {
        sideActions?: EpicMenuLightSideAction[]
    }

export type EpicMenuLightItem =
    & EpicMenuLightItemBase
    &
    {
        badge?: number
    }

export type EpicMenuLightSubmenu = {
    header?: string
    subheader?: string
    items: EpicMenuLightSubmenuItem[]
}

export type EpicMenuLightActionEventInfo = GenericEventInfo

export type EpicMenuLightSideAction = {
    icon: string
    onClick: () => EpicMenuLightActionEventInfo
    tooltip?: string
}
