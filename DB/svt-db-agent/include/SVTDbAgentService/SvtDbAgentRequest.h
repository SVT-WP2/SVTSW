#ifndef SVT_DB_AGENT_REQUEST_H
#define SVT_DB_AGENT_REQUEST_H

#include <SVTUtilities/SvtLogger.h>
#include <SVTUtilities/SvtUtilities.h>

#include <map>
#include <string_view>

// enum RequestType
// {
//   //! Enums
//   GetAllEnums = 0,
//   //! WaferTypes
//   GetAllWaferTypes,
//   CreateWaferType,
//   //! Wafers
//   GetAllWafers,
//   CreateWafer,
//   UpdateWafer,
//   UpdateWaferLocation,
//   //! Asics
//   GetAllAsics,
//   CreateAsic,
//   //! Wafer Probe Machines
//   GetAllWaferProbeMachines,
//   CreateWaferProbeMachine,
//   UpdateWaferProbeMachine,
//   UpdateWpMachineLoadedWafer,
//   UpdateWpMachineInstalledProbeCard,
//   //! Wafer Probe Projects
//   GetAllWaferProbeProjects,
//   CreateWaferProbeProject,
//   //! Probe Cards
//   GetAllProbeCards,
//   CreateProbeCard,
//   NotFound,
// };
//
// static std::map<RequestType, std::string_view> m_requestType = {
//     //! Enums
//     {GetAllEnums, "GetAllEnums"},
//     //! WaferTypes
//     {GetAllWaferTypes, "GetAllWaferTypes"},
//     {CreateWaferType, "CreateWaferType"},
//     //! Wafers
//     {GetAllWafers, "GetAllWafers"},
//     {CreateWafer, "CreateWafer"},
//     {UpdateWafer, "UpdateWafer"},
//     {UpdateWaferLocation, "UpdateWaferLocation"},
//     //! Asics
//     {GetAllAsics, "GetAllAsics"},
//     {CreateAsic, "CreateAsic"},
//     //! Wafer Probe Machines
//     {GetAllWaferProbeMachines, "GetAllWaferProbeMachines"},
//     {CreateWaferProbeMachine, "CreateWaferProbeMachine"},
//     {UpdateWaferProbeMachine, "UpdateWaferProbeMachine"},
//     {UpdateWpMachineLoadedWafer, "UpdateWpMachineLoadedWafer"},
//     {UpdateWpMachineInstalledProbeCard, "UpdateWpMachineInstalledProbeCard"},
//     //! Wafer Probe Projects
//     {GetAllWaferProbeProjects, "GetAllWaferProbeProjects"},
//     {CreateWaferProbeProject, "CreateWaferProbeProject"},
//     //! Probe Cards
//     {GetAllProbeCards, "GetAllProbeCards"},
//     {CreateProbeCard, "CreateProbeCard"},
//     //! Others
//     {NotFound, "NotFound"},
//
// RequestType getRequestType(std::string_view type_req);

namespace SvtDbAgent
{
  class SvtDbBaseDto;
  class SvtDbAgentMessage;
  class SvtDbAgentReplyMsg;

  class SvtDbAgentRequest
  {
   public:
    SvtDbAgentRequest();
    virtual ~SvtDbAgentRequest() = default;

    SvtDbBaseDto *getDto(std::string_view);

    bool findAndRun(std::string_view, const SvtDbAgentMessage &,
                    SvtDbAgentReplyMsg &);

   private:
    void createAllDtos();

    std::map<std::string_view, SvtDbAgent::SvtDbBaseDto *> dtoList;
  };
}  // namespace SvtDbAgent

#endif  //! SVT_DB_AGENT_REQUEST_H
