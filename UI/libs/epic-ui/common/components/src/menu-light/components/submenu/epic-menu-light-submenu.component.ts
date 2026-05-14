import { Component, Input, ViewChild, EventEmitter, Output } from '@angular/core'
import { MatMenu } from '@angular/material/menu'


import { EpicMenuLightSideAction, EpicMenuLightSubmenuItem, EpicMenuLightActionEventInfo } from '../../models'


@Component({
    selector: 'epic-menu-light-submenu',
    templateUrl: './epic-menu-light-submenu.component.html',
    standalone: false,
})
export class EpicMenuLightSubmenuComponent {

    @ViewChild('menu', { static: true }) menu: MatMenu

    @Input() header: string
    @Input() subheader: string
    @Input() items: EpicMenuLightSubmenuItem[]
    @Output() sideActionEvent$ = new EventEmitter<EpicMenuLightActionEventInfo>()

    onItemClick(item: EpicMenuLightSubmenuItem, event: MouseEvent): void {
        if (item.clickFn) {
            item.clickFn(event)
        }
    }

    onSideActionClick(action: EpicMenuLightSideAction, event: MouseEvent): void {
        event.preventDefault()
        event.stopPropagation()

        const actionEventInfo = action.onClick()
        this.sideActionEvent$.emit(actionEventInfo)
    }

}
