import { Component, Input } from '@angular/core'

import { EpicAlert } from '../models'


@Component({
    selector: 'epic-alert',
    templateUrl: './epic-alert.component.html',
    standalone: false,
})
export class EpicAlertComponent {

    @Input() severity: EpicAlert.Severity = EpicAlert.Severity.warning

    readonly Severity = EpicAlert.Severity

}
