#ifndef SVTDB_AGENT_H
#define SVTDB_AGENT_H

/*!
 * @file svtdb_agent.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @data Mar 2025
 * @brief Db agent manager
 */

class SvtDbAgentService;

class SvtDbAgent
{
 public:
  SvtDbAgent();
  ~SvtDbAgent();

  SvtDbAgentService *getAgentService() { return m_service; }

 private:
  SvtDbAgentService *m_service = nullptr;
};

#endif  // !SVTDB_AGENT_H
