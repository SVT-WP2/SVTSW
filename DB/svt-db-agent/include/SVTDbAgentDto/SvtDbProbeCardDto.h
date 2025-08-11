#ifndef SVT_DB_PROBE_CARD_DTO_H
#define SVT_DB_PROBE_CARD_DTO_H

/*!
 * @file SvtDbProbeCard.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Aug-2025
 * @brief Svt Db Probe Card DTO
 * */

#include <vector>

#include <nlohmann/json.hpp>

namespace SvtDbAgent
{
  class SvtDbAgentMessage;
  class SvtDbAgentReplyMsg;
};  // namespace SvtDbAgent

namespace SvtDbProbeCardDto
{
  //! ProbeCard
  using dbProbeCardRecords = struct dbProbeCardRecords
  {
    int id = -1;
    std::string serialNumber;
    std::string vendor;
    std::string name;
    std::string model;
    int version;
    std::string arrivalDate;
    std::string location;
    std::string type;
    int vendorCleaningInterval;

    static constexpr std::initializer_list<const char *> val_names = {
        "id",
        "serialNumber",
        "vendor",
        "name",
        "model",
        "version",
        "arrivalDate",
        "location",
        "type",
        "vendorCleaningInterval",
    };
  };

  //! SvtDbProbeCardDto
  bool getAllProbeCardsFromDB(std::vector<dbProbeCardRecords> &probCards,
                              const std::vector<int> &id_filters);
  bool getProbeCardFromDB(dbProbeCardRecords &probeCard, int id);

  bool createProbeCardInDB(const dbProbeCardRecords &probeCard);

  void getAllProbeCards(const SvtDbAgent::SvtDbAgentMessage &msg,
                        SvtDbAgent::SvtDbAgentReplyMsg &replyMsg);

  void createProbeCard(const SvtDbAgent::SvtDbAgentMessage &msg,
                       SvtDbAgent::SvtDbAgentReplyMsg &replyMsg);

  void getAllProbeCardsReplyMsg(const std::vector<dbProbeCardRecords> &probeCards,
                                SvtDbAgent::SvtDbAgentReplyMsg &msgReply);

  void createProbeCardReplyMsg(const dbProbeCardRecords &probeCard,
                               SvtDbAgent::SvtDbAgentReplyMsg &msgReply);
};  // namespace SvtDbProbeCardDto

#endif  //! SVT_DB_PROBE_CARD_DTO_H
