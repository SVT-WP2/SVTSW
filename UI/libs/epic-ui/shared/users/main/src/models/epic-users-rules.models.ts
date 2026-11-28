import { EpicUser, EpicUserRole, EpicUserUpdateRequest } from 'svt-ts-types'


/**
 * The rules of the users page that the SPA applies itself. They help the Admin; the real protection is in the BFF
 * (Admin only) and in the DB agent (one active Admin stays).
 */
export namespace EpicUsersRules {

    /** The hint of the controls that are disabled for the own user. */
    export const OWN_USER_HINT = 'You cannot change your own role or switch yourself off'

    /** The roles from the lowest to the highest: the options of the role select. */
    export const ROLES: readonly EpicUserRole[] = [
        EpicUserRole.User,
        EpicUserRole.Expert,
        EpicUserRole.Developer,
        EpicUserRole.Admin,
    ]

    /** True when `user` is the logged-in user: its role and its state cannot be changed on the page. */
    export function isOwnUser(user: Pick<EpicUser, 'id'>, currentUserId: number | null | undefined): boolean {
        return currentUserId !== null && currentUserId !== undefined && user.id === currentUserId
    }

    /**
     * The body of `PATCH /api/users/:id` for the edit dialog: only what changed. The role of the own user is never
     * sent, whatever the form holds. `null` when nothing changed.
     */
    export function toUpdateRequest(
        user: Pick<EpicUser, 'name' | 'role'>,
        formData: { name: string; role: EpicUserRole },
        isOwn: boolean,
    ): EpicUserUpdateRequest | null {
        const request: EpicUserUpdateRequest = {}
        const name = formData.name.trim()
        if (name !== user.name) {
            request.name = name
        }
        if (!isOwn && formData.role !== user.role) {
            request.role = formData.role
        }
        return Object.keys(request).length ? request : null
    }

}
