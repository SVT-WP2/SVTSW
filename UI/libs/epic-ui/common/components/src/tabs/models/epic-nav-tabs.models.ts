import { IsActiveMatchOptions } from '@angular/router'


export namespace EpicNavTabs {

    export type NavTabInfo<TData = unknown> = {
        label: string
        routerLink: string | any[]
        routerQueryParams?: Record<string, any>
        routerLinkActiveOptions?: { exact: boolean} | IsActiveMatchOptions
        active?: boolean
        icon?: string
        disabled?: boolean
        urlPattern?: string
        additionalData?: TData
    }

    export function decorateNavTabActive(tab: NavTabInfo, url: string): NavTabInfo {
        return {
            ...tab,
            active: tab?.urlPattern
                ? !!new RegExp(tab.urlPattern).exec(url)
                : tab?.active,
        }
    }

}
