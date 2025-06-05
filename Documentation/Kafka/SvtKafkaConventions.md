# SVT Kafka Conventions

## Topic Name Format
- dash-case
- section separator: `.`
- example: `service-name.group-name.event-name.suffix`, `svt.db-agent.request`
- reply topic name should have the suffix `*.reply`, example: `svt.db-agent.request` => reply topic name `svt.db-agent.request.reply`


## Message Structure

- message body: **is stringified JSON**
- key naming: **camelCased first lower**
- message structure
``` 
{
  type: string // some enum,
  data?: { [key: string]: unknown } // some JSON, NOT REQUIRED
}
```

## Request/Reply

Kafka does not support request-reply scenario as it is not designed in that way. However, we can simulate request-reply behaviour in places where it is needed in the following way:

- Let's say there is some Service #1 that can consume some Request Message can produce another Reply Message, then another Service #2 who can produce the Request Message can observe the relevant topic and catch the relevant Reply Message produced by the Service #1.  
- To be able to catch the right Reply Message (we can produce a batch of request messages, so we need to distinguish the correct Reply) we need to mark these messages somehow

**How do we mark our Request/Reply messages?**
- The Request Message defines some information in the message header that will be then used in the relevant Reply Message
- The Reply message is always emmited to another topic. The name of the topic for Reply Message should has the `.reply` suffix to the Request message topic.
  - example: Request Message topic name `svt.db-agent.request` => Reply Message topic name `svt.db-agent.request.reply`

### Request
```
// REFERENCE HEADER NAMES

const KAFKA_HEADER__CORRELATION_ID    = 'kafka_correlationId'
const KAFKA_HEADER__REPLY_TOPIC       = 'kafka_replyTopic'
const KAFKA_HEADER__REPLY_PARTITION   = 'kafka_replyPartition'
```
### Request Message

```
// REQUEST MESSAGE

Topic Name: 'svt.db-agent.request'
Headers:
{
  // some UUID string, this is kind of unique message id
  'kafka_correlationId': '1647f30ff6d9acbea7ce5',
  // reply topic name format: *.reply
  'kafka_replyTopic': 'svt.db-agent.request.reply',
  // just current sender service partition
  'kafka_replyPartition': 0, 
}

Message: 
{
  type: string // some enum,
  data?: { [key: string]: unknown } // some JSON, NOT REQUIRED
}
```
### Reply Message

```
// REPLY MESSAGE

Topic Name: 'svt.db-agent.request.reply'
Headers:
{
  'kafka_correlationId': '1647f30ff6d9acbea7ce5', // the value taken from the relevant Request Message 
  'kafka_replyPartition': 0, 
}

Reply Message: 
{
  status: SvtDbAgentMessageStatus // Ok, BadRequest, NotFound, ...
  type: string // some enum,
  data?: { [key: string]: unknown } // some JSON, NOT REQUIRED
  error?: {
    code?: number // in ideal case we can define the list of posible errors
    message: string | string[] // error message
  }
}

enum SvtDbAgentMessageStatus {
  // sucess
  Success = 'Success',
  // message data has invalid format
  BadRequest = 'BadRequest', 
  // requested entity does not exist 
  NotFound = 'NotFound', 
  // is not able to process the request, some unexpected error
  UnexpectedError = 'UnexpectedError', 
}
```
## Error Reply Message

```

// EXAMPLE OF ERROR REPLY

Topic Name: 'svt.db-agent.request.reply'
Headers:
{
  'kafka_correlationId': '1647f30ff6d9acbea7ce5', // the value taken from the relevant Request Message 
  'kafka_replyPartition': 0, 
}

Error Reply Message: {
  status: 'UnexpectedError',
  error: {
    message: "Unable to precess request, something happen ...",
  }
}

```


