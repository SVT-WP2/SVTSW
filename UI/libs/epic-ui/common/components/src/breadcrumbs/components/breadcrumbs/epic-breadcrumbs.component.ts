import { Component, EventEmitter, Input, Output } from '@angular/core'
import { BaseComponent, GenericEventInfo } from 'epic-ui/utils'

import { EpicBreadcrumbs } from '../../models'


@Component({
    selector: 'epic-breadcrumbs',
    templateUrl: './epic-breadcrumbs.component.html',
    standalone: false,
})
export class EpicBreadcrumbsComponent extends BaseComponent {

    @Input() breadcrumbs: EpicBreadcrumbs.Breadcrumb[]
    @Input() size: EpicBreadcrumbs.Size = EpicBreadcrumbs.Size.basic

    @Output() breadcrumbClick$ = new EventEmitter<GenericEventInfo>()

    onBreadcrumbClick(breadcrumb: EpicBreadcrumbs.Breadcrumb): void {
        if (breadcrumb.onClick) {
            const eventInfo = breadcrumb.onClick()
            this.breadcrumbClick$.emit(eventInfo)
        }
    }

}
