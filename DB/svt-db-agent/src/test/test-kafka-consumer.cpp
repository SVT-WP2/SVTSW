#include "SvtLogger.h"

#include <iostream>
#include <string>
#include <thread>  // For std::this_thread::sleep_for
#include <vector>

#include <librdkafka/rdkafkacpp.h>

class MyEventCb : public RdKafka::EventCb
{
 public:
  void event_cb(RdKafka::Event &event) override
  {
    switch (event.type())
    {
    case RdKafka::Event::EVENT_ERROR:
      std::cerr << "ERROR (" << RdKafka::err2str(event.err())
                << "): " << event.str() << std::endl;
      break;
    case RdKafka::Event::EVENT_STATS:
      std::cerr << "STATS: " << event.str() << std::endl;
      break;
    case RdKafka::Event::EVENT_LOG:
      std::cerr << "LOG-" << event.severity() << "-" << event.fac() << ": "
                << event.str() << std::endl;
      break;
    // case RdKafka::Event::EVENT_THROTTLED:
    //   std::cerr << "THROTTLED: " << event.throttle_time() << "ms by "
    //             << event.broker_name() << " id " << (int) event.broker_id()
    //             << std::endl;
    //   break;
    default:
      std::cerr << "EVENT: " << event.str() << std::endl;
      break;
    }
  }
};

int main()
{
  // Kafka broker address
  std::string brokers = "localhost:9095";
  // Consumer group ID
  std::string group_id = "test-db-agent";
  // Topic to subscribe to
  const std::string topic_name = "svt.db-agent.request";

  // Create configuration object
  RdKafka::Conf *conf = RdKafka::Conf::create(RdKafka::Conf::CONF_GLOBAL);
  RdKafka::Conf *tconf = RdKafka::Conf::create(RdKafka::Conf::CONF_TOPIC);

  // Set global configuration properties
  std::string errstr;
  if (conf->set("bootstrap.servers", brokers, errstr) !=
      RdKafka::Conf::CONF_OK)
  {
    std::cerr << "Failed to set bootstrap.servers: " << errstr << std::endl;
    return 1;
  }
  if (conf->set("group.id", group_id, errstr) != RdKafka::Conf::CONF_OK)
  {
    std::cerr << "Failed to set group.id: " << errstr << std::endl;
    return 1;
  }

  // Set event callback
  MyEventCb ex_event_cb;
  if (conf->set("event_cb", &ex_event_cb, errstr) != RdKafka::Conf::CONF_OK)
  {
    std::cerr << "Failed to set event_cb: " << errstr << std::endl;
    return 1;
  }

  // Create KafkaConsumer instance
  RdKafka::KafkaConsumer *consumer =
      RdKafka::KafkaConsumer::create(conf, errstr);
  if (!consumer)
  {
    std::cerr << "Failed to create consumer: " << errstr << std::endl;
    return 1;
  }

  // Start consuming messages
  std::vector<RdKafka::TopicPartition *> topics = {
      RdKafka::TopicPartition::create(topic_name, 0, RdKafka::Topic::OFFSET_END)};
  consumer->assign(topics);

  // Or let kafka to do it automatically
  //  Subscribe to the topic
  // std::vector<std::string> topics = {topic_name};
  // RdKafka::ErrorCode err = consumer->subscribe(topics);
  // if (err != RdKafka::ERR_NO_ERROR) {
  //     std::cerr << "Failed to subscribe to topics: " << RdKafka::err2str(err)
  //     <<
  // std::endl; consumer->close(); delete consumer; delete conf; delete tconf;
  //     return 1;
  // }

  std::cout << "Consumer subscribed to topic " << topic_name << " in group "
            << group_id << std::endl;

  // Start consuming messages
  while (true)
  {
    RdKafka::Message *msg =
        consumer->consume(1000);  // Poll for messages with a timeout of 1000ms
    if (msg->err() == RdKafka::ERR_NO_ERROR)
    {
      // Process the message
      std::cout << "Message from topic " << msg->topic_name() << " ["
                << msg->partition() << "] at offset " << msg->offset()
                << std::endl;
      std::cout << "Message Payload: "
                << static_cast<const char *>(msg->payload()) << std::endl;
    }
    else if (msg->err() == RdKafka::ERR__PARTITION_EOF)
    {
      // End of partition event, not an error
      std::cout << "Reached end of partition " << msg->partition() << std::endl;
    }
    else if (msg->err() == RdKafka::ERR__TIMED_OUT)
    {
      std::this_thread::sleep_for(
          std::chrono::milliseconds(100));  // Small delay
      continue;
    }
    delete msg;  // Free the message object
  }

  // if (msg->err())
  // {
  //   else
  //   {
  //     std::cerr << "Consume error: " << msg->errstr() << std::endl;
  //   }
  // }
  // else
  // {
  //   // Message received
  // }

  // Close and clean up
  consumer->close();
  delete consumer;
  delete conf;
  delete tconf;

  closeLogFile();

  return 0;
}
