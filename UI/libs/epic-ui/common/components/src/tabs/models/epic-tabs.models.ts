export namespace EpicTabs {

    export type TabInfo = {
        id: string
        label: string
        icon?: string
        isActive?: boolean
        disabled?: boolean
        color?: string
    }

    export type ActiveTabChangedEvent = {
        tabInfo: TabInfo
    }

    export type HorizontalTabsStyle = 'primary' | 'secondary'
    export const HorizontalTabsStyle = {
        primary: 'primary' as HorizontalTabsStyle,
        secondary: 'secondary' as HorizontalTabsStyle,
    }

}
