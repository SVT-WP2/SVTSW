import { Injectable } from '@angular/core'
import { IndividualConfig, ToastrService } from 'ngx-toastr'

import { EpicToastr } from '../models'


@Injectable({ providedIn: 'root' })
export class EpicNotificationService {

    constructor(protected readonly toastrService: ToastrService) {
    }

    error(
        message: string,
        title: string | null = null, // null => use default title
        hideAllOpenedNotifications = true,
        override?: Partial<IndividualConfig>): void {
        this.showMessage(
            EpicToastr.EpicToastrType.Error,
            title === null ? 'COMMON.NOTIFICATIONS.STATE__ERROR' : title,
            message,
            hideAllOpenedNotifications,
            override,
        )
    }

    info(
        message: string,
        title: string | null = null, // null => use default title
        hideAllOpenedNotifications = true,
        override?: Partial<IndividualConfig>): void {
        this.showMessage(
            EpicToastr.EpicToastrType.Info,
            title === null ? 'COMMON.NOTIFICATIONS.STATE__INFO' : title,
            message,
            hideAllOpenedNotifications,
            override,
        )
    }

    warning(
        message: string,
        title: string | null = null, // null => use default title
        hideAllOpenedNotifications = true,
        override?: Partial<IndividualConfig>): void {
        this.showMessage(
            EpicToastr.EpicToastrType.Warning,
            title === null ? 'COMMON.NOTIFICATIONS.STATE__WARNING' : title,
            message,
            hideAllOpenedNotifications,
            override,
        )
    }

    success(
        message: string,
        title: string | null = null, // null => use default title
        hideAllOpenedNotifications = true,
        override?: Partial<IndividualConfig>): void {
        this.showMessage(
            EpicToastr.EpicToastrType.Success,
            title === null ? 'COMMON.NOTIFICATIONS.STATE__DONE' : title,
            message,
            hideAllOpenedNotifications,
            override,
        )
    }

    processingMessage(hideAllOpenedNotifications = true): void {
        const title = 'COMMON.NOTIFICATIONS.STATE__PROCESSING'
        const message = 'COMMON.NOTIFICATIONS.MESSAGE__PROCESSING'

        this.info(message, title, hideAllOpenedNotifications)
    }

    doneMessage(hideAllOpenedNotifications = true) {
        const message = 'COMMON.NOTIFICATIONS.MESSAGE__DONE'
        this.success(message, null, hideAllOpenedNotifications)
    }

    serverCommunicationError(hideAllOpenedNotifications = true) {
        const message = 'COMMON.NOTIFICATIONS.MESSAGE__SERVER_ERROR'
        this.error(message, null, hideAllOpenedNotifications)
    }

    hideAllOpened() {
        this.toastrService.toasts
            .forEach(
                (toast) => this.toastrService.remove(toast.toastId),
            )
    }

    /**
     * Shows notification message using Toaster plugin
     */
    showMessage(
        toastrType: EpicToastr.EpicToastrType,
        title: string,
        message: string,
        hideAllOpenedNotifications = true,
        override?: Partial<IndividualConfig>): void {

        if (hideAllOpenedNotifications) {
            this.hideAllOpened()
        }
        this.toastrService.show(message, title, override, toastrType)
    }

}
