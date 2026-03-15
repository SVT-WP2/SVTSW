
#include <atomic>
#include <csignal>
#include <cstdlib>

#include <getopt.h>

#include <chrono>
#include <iostream>
#include <memory>
#include <sstream>
#include <string>
#include <thread>  // For std::this_thread::sleep_for

#include <librdkafka/rdkafkacpp.h>

#include "SvtKafkaUtils.h"
#include "SvtLogger.h"

static volatile std::atomic<bool> run = true;
//========================================================================+
void sigterm_handler(int sig)
{
  std::ostringstream ss;
  ss << "Caught signal " << sig << ", initiating shutdown...";
  logWarning(ss.str());
  run = false;
}

int main(int argc, char **argv)
{
  // Register signal handlers for graceful shutdown
  std::signal(SIGINT, sigterm_handler);   // Ctrl+C
  std::signal(SIGTERM, sigterm_handler);  // kill command

  // Kafka broker address
  std::string brokers = "localhost:9095";
  // Consumer group ID
  std::string group_id = "test-db-agent";
  // Topic to subscribe to
  std::string topic_name = "svt.db-agent.request";
  bool verbose = false;

  int opt;
  while ((opt = getopt(argc, argv, ":b:g:t:v")) != -1)
  {
    switch (opt)
    {
    case 'v':
      verbose = true;
      break;
    case 'b':
      brokers = optarg;
      break;
    case 't':
      topic_name = optarg;
      break;
    case 'g':
      group_id = optarg;
      break;
    case ':':
    {
      std::ostringstream ss;
      ss << "Option -" << char(optopt) << " requires an operand";
      logError(ss.str());
      return EXIT_FAILURE;
      break;
    }
    case '?':
    {
      std::ostringstream ss;
      ss << "Unrecognized option: -" << char(optopt);
      logError(ss.str());
      return EXIT_FAILURE;
      break;
    }
    default:
      return EXIT_FAILURE;
      break;
    }
  }

  // Create configuration object
  std::unique_ptr<RdKafka::Conf> conf(RdKafka::Conf::create(RdKafka::Conf::CONF_GLOBAL));
  std::unique_ptr<RdKafka::Conf> tconf(RdKafka::Conf::create(RdKafka::Conf::CONF_TOPIC));

  // Set global configuration properties
  std::string errstr;
  if (conf->set("metadata.broker.list", brokers, errstr) !=
      RdKafka::Conf::CONF_OK)
  {
    std::cerr << "Failed to set bootstrap.servers: " << errstr << std::endl;
    return EXIT_FAILURE;
  }
  // Set event callback
  SvtKafka::SvtKafkaEventCb ex_event_cb(NULL);
  if (conf->set("event_cb", &ex_event_cb, errstr) != RdKafka::Conf::CONF_OK)
  {
    std::cerr << "Failed to set event_cb: " << errstr << std::endl;
    return EXIT_FAILURE;
  }

  // Before create consumer check cluster status
  if (!SvtKafka::checkKafkaConnection(conf.get(), verbose))
  {
    logError("Failed to connect to broker: " + brokers);
    return EXIT_FAILURE;
  }

  if (conf->set("group.id", group_id, errstr) != RdKafka::Conf::CONF_OK)
  {
    std::cerr << "Failed to set group.id: " << errstr << std::endl;
    return 1;
  }

  // Create KafkaConsumer instance
  std::unique_ptr<RdKafka::KafkaConsumer> consumer(RdKafka::KafkaConsumer::create(conf.get(), errstr));
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

  // Start consuming messages
  logInfo("Consumer subscribed to topic " + topic_name + " in group " + group_id);
  logInfo("press Ctrl+C to stop.");

  while (run)
  {
    RdKafka::Message *msg =
        consumer->consume(1000);  // Poll for messages with a timeout of 1000ms
    if (msg->err() == RdKafka::ERR_NO_ERROR)
    {
      // Process the message
      std::cout << "Message from topic " << msg->topic_name() << " ["
                << msg->partition() << "] at offset " << msg->offset()
                << std::endl;
      std::string bufferPayload(static_cast<const char *>(msg->payload()), msg->len());
      std::cout << "Message Payload: " << bufferPayload << std::endl;
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

  // Close and clean up
  consumer->close();

  closeLogFile();

  return EXIT_SUCCESS;
}
