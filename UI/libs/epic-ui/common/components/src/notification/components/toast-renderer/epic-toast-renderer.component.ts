import { Component, OnDestroy } from '@angular/core'
import { Toast } from 'ngx-toastr'

import { EpicToastr } from '../../models'


@Component({
    selector: 'epic-toast-renderer',
    templateUrl: './epic-toast-renderer.component.html',
    standalone: false,
})
export class EpicToastRendererComponent extends Toast implements OnDestroy {

    iconName: string
    actions: EpicToastr.Action[] = []

    constructor() {
        super()

        this.iconName = EpicToastr.getToastrTypeIconName(this.toastPackage.toastType as EpicToastr.EpicToastrType)
        this.actions = EpicToastr.extractActions(this.toastPackage.config.payload)
    }

    handleCloseBtnClicked() {
        this.toastrService.remove(this.toastPackage.toastId)
    }

    handleActionClick(action: EpicToastr.Action): void {
        action.onClick({ toastPackage: this.toastPackage })
    }

}
