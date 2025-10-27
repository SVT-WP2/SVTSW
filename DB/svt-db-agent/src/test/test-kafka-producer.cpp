#include <fstream>
#include <memory>
#include <string>

#include <librdkafka/rdkafkacpp.h>
#include <nlohmann/json.hpp>

#include "SVTDbAgentService/SvtDbAgentMessage.h"
#include "SVTDbAgentService/SvtDbAgentProducer.h"
#include "SVTUtilities/SvtDbAgentGlobal.h"
#include "nlohmann/json_fwd.hpp"

std::string SvtDbAgent::db_name;
std::string SvtDbAgent::db_schema;
std::string SvtDbAgent::kafka_server;
std::string SvtDbAgent::kafka_port;

SvtLogger *logger = Singleton<SvtLogger>::instance();
int main(int argc, char *argv[])
{
  // Kafka broker address
  std::string brokers = "localhost:9095";
  // Topic to subscribe to
  const std::string topic_name = "svt.db-agent.request";

  std::string json_script_name = "create_wafer.json";
  if (argc > 2)
  {
    logger->logError("Error: only one argument allowed. entered " + std::to_string(argc));
    return EXIT_FAILURE;
  }
  else if (argc == 2)
  {
    json_script_name = std::string(argv[1]);
  }

  const std::string json_script_path = "/Users/ycorrales/Work/EIC/SVT/json_scripts";

  std::ifstream json_script(json_script_path + "/" + json_script_name);
  const auto data_j = nlohmann::json::parse(json_script);

  std::unique_ptr<SvtDbAgent::SvtDbAgentProducer> producer = std::make_unique<SvtDbAgent::SvtDbAgentProducer>(brokers);

  SvtDbAgent::SvtDbAgentMessage msg;
  msg.setPayload(data_j);
  msg.AddHeader("kafka_replyPartition", "0");
  msg.AddHeader("kafka_correlationId", "ebac231a9f3ab10fb41b8");
  msg.AddHeader("kafka_replyTopic", "svt.db-agent.request.reply");

  producer->push(topic_name, msg);
  return 0;
}
