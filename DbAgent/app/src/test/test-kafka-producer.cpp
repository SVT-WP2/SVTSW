#include <getopt.h>
#include <iostream>
#include <string>

#include "SvtLogger.h"

#include "SvtKafkaMessage.h"
#include "SvtKafkaProducer.h"

void print_help(const char *prog)
{
  std::cout
      << "Usage: " << prog << " <>\n"
      << "\n"
      << "Test Kafka consumer that subscribes to a topic and prints incoming records.\n"
      << "\n"
      << "Options:\n"
      << "  -b <broker>    Kafka broker address     (default: localhost:9095)\n"
      << "  -t <topic>     Topic to subscribe to    (default: svt.db-agent.request)\n"
      << "  -h             Show this help message and exit\n"
      << "\n"
      << "Press Ctrl+C to stop consuming.\n";
}

int main(int argc, char **argv)
{
  // Kafka broker address
  std::string broker = "localhost:9095";
  // Topic to subscribe to
  std::string topic_name = "svt.db-agent.request";

  int opt;
  while ((opt = getopt(argc, argv, ":b:ht:")) != -1)
  {
    switch (opt)
    {
    case 'b':
      broker = optarg;
      break;
    case 't':
      topic_name = optarg;
      break;
    case 'h':
      print_help(argv[0]);
      return EXIT_SUCCESS;
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
  if (optind != argc - 1)
  {
    std::string msg1 = optind == argc ? "one" : "only one";
    std::string msg2 = optind == argc ? "required" : "allowed";

    logError("Error: " + msg1 + " positional argument " + msg2 + ". entered " + std::to_string(argc - optind));
    return EXIT_FAILURE;
  }

  std::string json_script_name = std::string(argv[optind]);
  logInfo("Using json file: " + json_script_name);
  std::ifstream json_script(json_script_name);
  const auto data_j = nlohmann::json::parse(json_script);

  // Create Producer
  std::unique_ptr<SvtKafka::SvtKafkaProducer> producer = std::make_unique<SvtKafka::SvtKafkaProducer>(broker);
  // producer->start();

  // Send Message
  for (auto it = data_j.begin(); it != data_j.end(); ++it)
  {
    SvtKafka::SvtKafkaMessage msg;
    msg.setPayload(it.value());
    msg.AddHeader("kafka_replyPartition", "0");
    msg.AddHeader("kafka_correlationId", "ebac231a9f3ab10fb41b8");
    msg.AddHeader("kafka_replyTopic", "svt.db-agent.request.reply");

    producer->send(topic_name, msg.getHeaders(), msg.getPayload().dump());

    std::this_thread::sleep_for(std::chrono::milliseconds(1000));
  }

  closeLogFile();
  return EXIT_SUCCESS;
}
