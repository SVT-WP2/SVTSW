import { Component, Input } from '@angular/core'
import { BaseComponent } from 'epic-ui/utils'


@Component({
    selector: 'epic-selection-list-box-wrapper',
    templateUrl: './epic-selection-list-box-wrapper.component.html',
})
export class EpicSelectionListBoxWrapperComponent extends BaseComponent {

    @Input() stickyHeader = true

}
