/**
 * The message headers of SVTSW beyond those of the request-reply convention (`kafka_correlationId`,
 * `kafka_replyTopic`, `kafka_replyPartition`). `Documentation/Kafka/SvtKafkaConventions.md` describes them.
 */
export enum SvtKafkaHeader {
    /**
     * The user that a request is for: the `id` of a row of `SvtUser`, as a decimal string in UTF-8 (`42`). Optional.
     * A reply does not repeat it.
     */
    UserId = 'svt_userId',
}
