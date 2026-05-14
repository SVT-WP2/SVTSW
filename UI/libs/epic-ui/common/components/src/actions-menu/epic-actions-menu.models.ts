import { GenericEventInfo } from 'epic-ui/utils'
import { Observable } from 'rxjs'


export namespace EpicActionsMenu {

    export type ActionSimpleLinkInfo = {
        url: string
        target?: string
        disabled?: boolean
    }

    export type ActionRouterLinkInfo = {
        routerLink: string | any[]
        routerQueryParams?: any[]
        target?: string
        disabled?: boolean
    }

    export type ActionEventInfo = GenericEventInfo
    export type ActionClickInfo = {
        onClick?: () => ActionEventInfo
        disabled?: boolean
    }

    export type ActionBase = {
        title: string
        icon?: string
        imageUrl?: string
        defaultImageUrl?: string
    }

    export type ActionWithChildren =
        & ActionBase
        &
        {
            children?: ActionsList
            children$?: Observable<ActionsList>
        }

    export type ActionLink = ActionBase & (ActionSimpleLinkInfo | ActionRouterLinkInfo)
    export type ActionButton = ActionBase & ActionClickInfo

    export type ActionDivider = {
        divider?: boolean
    }

    export type Action = ActionLink | ActionWithChildren | ActionButton | ActionDivider

    export type ActionsList = Action[]

}
