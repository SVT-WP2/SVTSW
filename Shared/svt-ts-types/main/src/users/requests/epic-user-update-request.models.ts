import { EpicUserRole } from '../enums'


/**
 * Body of `PATCH /api/users/:id` (an Admin only). An absent key keeps the value. The login cannot be changed.
 * `isActive: false` switches the user off: it cannot log in, and its session ends with its next request.
 */
export type EpicUserUpdateRequest = {
    name?: string
    role?: EpicUserRole
    isActive?: boolean
}
