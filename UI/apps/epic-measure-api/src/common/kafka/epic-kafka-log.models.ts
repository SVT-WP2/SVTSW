/** The keys whose values never go into a log line: the password hashes of the user messages, and plain passwords. */
const SECRET_KEYS: ReadonlySet<string> = new Set(['passwordHash', 'password', 'currentPassword', 'newPassword'])

export const EPIC_REDACTED_VALUE = '[redacted]'

/**
 * A copy of a Kafka message (or any JSON value) for a log line, with the value of every key of `SECRET_KEYS`
 * replaced by `EPIC_REDACTED_VALUE`, at any depth. `CreateUser` and `UpdateUserPassword` carry `passwordHash`, and
 * the BFF prints the requests of the topic `svt.db-agent.request` (ticket 396).
 */
export function redactEpicKafkaSecrets(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map((item) => redactEpicKafkaSecrets(item))
    }
    if (value !== null && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value).map(([key, item]) => [key, SECRET_KEYS.has(key) ? EPIC_REDACTED_VALUE : redactEpicKafkaSecrets(item)]),
        )
    }
    return value
}
