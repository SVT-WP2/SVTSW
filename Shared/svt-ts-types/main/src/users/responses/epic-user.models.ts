import { EpicDateTimeString } from '../../common'
import { EpicUserRole } from '../enums'


/** A user as every service may see it. It never holds the password hash. */
export type EpicUser = {
    id: number
    /** The name the user types at log-in, in lower case. */
    login: string
    /** The name shown to people. */
    name: string
    role: EpicUserRole
    /** `false`: the user cannot log in. */
    isActive: boolean
    /** ISO 8601 UTC. */
    createdAt: EpicDateTimeString
}
