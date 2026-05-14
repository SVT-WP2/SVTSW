import { Component, EventEmitter, Input, Output, ViewChild } from '@angular/core'
import { MatMenu, MatMenuTrigger } from '@angular/material/menu'
import { BaseComponent } from 'epic-ui/utils'

import { EpicActionsMenu } from './epic-actions-menu.models'


@Component({
    selector: 'epic-actions-menu',
    templateUrl: './epic-actions-menu.component.html',
    standalone: false,
})
export class EpicActionsMenuComponent extends BaseComponent {

    // It is needed to make possible triggering onHover actions
    // TODO: fix it. We need to make content projection possible for the parent menu item.
    //      It is kind of known issue: https://github.com/angular/components/issues/18123, but we need to decide what to do with that.
    //      for now, our fix allows us to support just the first level of nested menu.
    @ViewChild('matMenuRef') matMenuRef?: MatMenu

    @Input() actionList: EpicActionsMenu.ActionsList = []
    @Input() matMenuTrigger?: MatMenuTrigger

    @Output() actionEvent$ = new EventEmitter<EpicActionsMenu.ActionEventInfo>()

    onActionClicked(action: EpicActionsMenu.ActionButton): void {
        if ((action).onClick) {
            const actionEventInfo = action.onClick()
            this.actionEvent$.emit(actionEventInfo)
        }
    }

}
