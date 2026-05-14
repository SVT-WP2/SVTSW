import { GenericEventInfo } from 'epic-ui/utils'


export namespace EpicBreadcrumbs {

    export type Size = 'basic' | 'small' | 'large'

    export const Size: Record<Size, Size> = {
        basic: 'basic',
        small: 'small',
        large: 'large',
    }

    export type Breadcrumb = {
        id: string
        label: string
        routerLink?: string
        disabled?: boolean
        active?: boolean
        onClick?: () => GenericEventInfo
    }

}
