#ifndef SVT_DB_AGENT_REQUEST_H
#define SVT_DB_AGENT_REQUEST_H

#include <map>
#include <string_view>

namespace SvtDbAgent
{
  enum RequestType
  {
    //! Enums
    GetAllEnums = 0,
    //! WaferTypes
    GetAllWaferTypes,
    CreateWaferType,
    //! Wafers
    GetAllWafers,
    CreateWafer,
    UpdateWafer,
    UpdateWaferLocation,
    //! Asics
    GetAllAsics,
    CreateAsic,
    //! Wafer Probe Machines
    GetAllWaferProbeMachines,
    CreateWaferProbeMachine,
    UpdateWaferProbeMachine,
    UpdateWpMachineLoadedWafer,
    UpdateWpMachineInstalledProbeCard,
    //! Wafer Probe Projects
    GetAllWaferProbeProjects,
    CreateWaferProbeProject,
    //! Probe Cards
    GetAllProbeCards,
    NotFound,
  };

  static std::map<RequestType, std::string_view> m_requestType = {
      //! Enums
      {GetAllEnums, "GetAllEnums"},
      //! WaferTypes
      {GetAllWaferTypes, "GetAllWaferTypes"},
      {CreateWaferType, "CreateWaferType"},
      //! Wafers
      {GetAllWafers, "GetAllWafers"},
      {CreateWafer, "CreateWafer"},
      {UpdateWafer, "UpdateWafer"},
      {UpdateWaferLocation, "UpdateWaferLocation"},
      //! Asics
      {GetAllAsics, "GetAllAsics"},
      {CreateAsic, "CreateAsic"},
      //! Wafer Probe Machines
      {GetAllWaferProbeMachines, "GetAllWaferProbeMachines"},
      {CreateWaferProbeMachine, "CreateWaferProbeMachine"},
      {UpdateWaferProbeMachine, "UpdateWaferProbeMachine"},
      {UpdateWpMachineLoadedWafer, "UpdateWpMachineLoadedWafer"},
      {UpdateWpMachineInstalledProbeCard, "UpdateWpMachineInstalledProbeCard"},
      //! Wafer Probe Projects
      {GetAllWaferProbeProjects, "GetAllWaferProbeProjects"},
      {CreateWaferProbeProject, "CreateWaferProbeProject"},
      //! Probe Cards
      {GetAllProbeCards, "GetAllProbeCards"},
      //! Others
      {NotFound, "NotFound"},
  };

  RequestType getRequestType(std::string_view type_req);

};  // namespace SvtDbAgent

#endif  //! SVT_DB_AGENT_REQUEST_H
