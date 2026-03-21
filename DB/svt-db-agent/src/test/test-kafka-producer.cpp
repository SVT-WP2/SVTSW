#include <chrono>
#include <cstdlib>
#include <fstream>
#include <string>
#include <thread>

#include <librdkafka/rdkafkacpp.h>
#include <nlohmann/json.hpp>

#include "SvtKafkaMessage.h"
#include "SvtKafkaProducer.h"
#include "SvtLogger.h"

int main(int argc, char **argv)
{
  // Kafka broker address
  std::string brokers = "localhost:9095";
  // Topic to subscribe to
  const std::string topic_name = "svt.db-agent.request";

  if (argc != 2)
  {
    logError("Error: only one argument allowed. entered " + std::to_string(argc - 1));
    return EXIT_FAILURE;
  }
  std::string json_script_name = std::string(argv[1]);
  logInfo("Using json file: " + json_script_name);
  std::ifstream json_script(json_script_name);
  const auto data_j = nlohmann::json::parse(json_script);

  // Create Producer
  std::unique_ptr<SvtKafka::SvtKafkaProducer> producer = std::make_unique<SvtKafka::SvtKafkaProducer>(brokers);
  producer->start();

  // Send Message
  for (auto it = data_j.begin(); it != data_j.end(); ++it)
  {
    SvtKafka::SvtKafkaMessage msg;
    msg.setPayload(it.value());
    msg.AddHeader("kafka_replyPartition", "0");
    msg.AddHeader("kafka_correlationId", "ebac231a9f3ab10fb41b8");
    msg.AddHeader("kafka_replyTopic", "svt.db-agent.request.reply");

    producer->send(topic_name, msg);

    std::this_thread::sleep_for(std::chrono::milliseconds(1000));
  }

  closeLogFile();
  return EXIT_SUCCESS;
}
