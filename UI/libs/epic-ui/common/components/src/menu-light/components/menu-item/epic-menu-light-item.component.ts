import { Component, Input, EventEmitter, Output, ViewChild } from '@angular/core'
import { MatMenuTrigger } from '@angular/material/menu'

import { EpicMenuLightItem, EpicMenuLightActionEventInfo } from '../../models'


@Component({
    selector: 'epic-menu-light-item',
    templateUrl: './epic-menu-light-item.component.html',
    standalone: false,
})
export class EpicMenuLightItemComponent {

    @ViewChild('menuTrigger') trigger: MatMenuTrigger

    @Input() item: EpicMenuLightItem
    @Output() sideActionEvent$ = new EventEmitter<EpicMenuLightActionEventInfo>()

    onItemClick(event: MouseEvent): void {
        if (this.item.clickFn) {
            this.item.clickFn(event)
        }
    }

    onSideActionClick(action: EpicMenuLightActionEventInfo): void {
        this.trigger.closeMenu()
        this.sideActionEvent$.emit(action)
    }

}
