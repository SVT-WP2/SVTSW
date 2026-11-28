import { EpicUser } from 'svt-ts-types'


/** The data of the dialogs of the users page. */
export namespace EpicUserDialogs {

    export type UpdateData = {
        user: EpicUser
        /** The own user: the role cannot be changed. */
        isOwnUser: boolean
    }

    export type PasswordData = {
        user: EpicUser
    }

    export type SwitchOffData = {
        user: EpicUser
    }

}
