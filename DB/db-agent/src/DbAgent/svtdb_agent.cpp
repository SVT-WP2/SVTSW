/*!
 * @file svtdb_agent.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @data Mar 2025
 * @brief Db agent
 */

#include "DbAgent/svtdb_agent.h"
#include "DbAgent/svtdb_service.h"

SvtDbAgent::SvtDbAgent() { m_service = new SvtDbAgentService(); }
SvtDbAgent::~SvtDbAgent() { delete m_service; }
