import { Component, Input, OnChanges, SimpleChanges, Output, EventEmitter } from '@angular/core'

import { EpicMenuLightItem, EpicMenuLightActionEventInfo } from '../../models'


@Component({
    selector: 'epic-menu-light',
    templateUrl: './epic-menu-light.component.html',
    standalone: false,
})
export class EpicMenuLightComponent implements OnChanges {

    @Input() items: EpicMenuLightItem[]
    @Output() sideActionEvent$ = new EventEmitter<EpicMenuLightActionEventInfo>()

    ngOnChanges(changes: SimpleChanges): void {
        const { items } = changes
        if (items?.currentValue) {
            const itemsValue = items.currentValue as EpicMenuLightItem[]

            this.validateItems(itemsValue)
        }
    }

    onSideActionClick(action: EpicMenuLightActionEventInfo): void {
        this.sideActionEvent$.emit(action)
    }

    private validateItems(items: EpicMenuLightItem[]): void {
        items.forEach(item => {
            if (item.routerLink && item.submenu) {
                console.error('Item cannot have routerLink and submenu:', item)
            }

            if (item.submenu?.items?.length) {
                this.validateItems(item.submenu?.items)
            }
        })
    }

}
