
#include <getopt.h>
#include <chrono>

#include <kafka/KafkaConsumer.h>
#include <kafka/Properties.h>

#include "DbAgentService/DbAgentService.h"

using namespace kafka;
using namespace kafka::clients::consumer;
//========================================================================+
int main(int argc, char** argv)
{
  // Kafka broker address
  std::string broker = "localhost:9095";
  // Topic to subscribe to
  std::string topic_name = topicNames[DbAgentTopicEnum::Heartbeat];
  // timeout in seconds
  uint32_t timeout = 10;

  int opt;
  while ((opt = getopt(argc, argv, ":b:")) != -1)
  {
    switch (opt)
    {
    case 'b':
      broker = optarg;
      break;
    case 't':
      timeout = std::stoi(optarg);
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

  std::map<std::string, std::string> configs = {
      {"bootstrap.servers", broker},
      {"log_level", "4"},  // supress NOTICE log, set log_level = 4 (WARNING)
      {"enable.auto.commit", "false"}};

  Properties props;
  for (const auto& [key, value] : configs)
  {
    props.put(key, value);
  }
  KafkaConsumer consumer(props);

  int32_t partition = 0;
  kafka::TopicPartition tp(topic_name, partition);
  consumer.assign({tp});
  consumer.seekToEnd();

  // Start consuming messages
  logInfo("Consumer subscribed to topic " + topic_name);

  auto startTime = std::chrono::steady_clock::now();
  auto timeoutDuration = std::chrono::seconds(timeout);  // timeout

  auto exit_code = EXIT_SUCCESS;

  bool exit_while = false;
  while (!exit_while)
  {
    auto now = std::chrono::steady_clock::now();

    // 1. Check for timeout
    if (now - startTime >= timeoutDuration)
    {
      std::cout << "Timeout reached!\n";
      exit_code = EXIT_FAILURE;
      break;
    }

    const auto& records = consumer.poll(std::chrono::milliseconds(100));

    for (const auto& record : records)
    {
      exit_while = true;
      if (!record.error())
      {
        const auto timestamp = nlohmann::json::parse(record.value().toString())["timestamp"];
        logInfo(timestamp);
        break;
      }
      else
      {
        logError(record.toString());
        exit_code = EXIT_FAILURE;
        break;
      }
    }
    // 2. Wait exactly 1 second (or remainder of a second)
    std::this_thread::sleep_for(std::chrono::seconds(1));
  }

  // Close and clean up
  consumer.close();

  closeLogFile();

  return exit_code;
}
