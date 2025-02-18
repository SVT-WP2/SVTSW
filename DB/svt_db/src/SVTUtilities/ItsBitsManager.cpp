
#include "ITSUtilities/ItsBitsManager.h"

ItsBitsManager::ItsBitsManager(void){
}

ItsBitsManager::~ItsBitsManager(void){
}

uint32_t ItsBitsManager::ExtractFromUInt32(uint32_t Input, uint8_t position, uint8_t bitNumber){
	Position = position;
	Nbit = bitNumber;
	SetClWord();
	return (uint32_t)((Input & (~CleanerWord) ) >> position);
}

void ItsBitsManager::ModifyUInt32(uint32_t &OldUInt32, uint32_t NewEle, uint8_t position, uint8_t bitNumber){
	NewTerm = NewEle;
	Position = position;
	Nbit = bitNumber;
	SetClWord();
	BMOperation = 0;
	ModifyUInt32(OldUInt32);
}



void ItsBitsManager::ModifyUInt32(uint32_t &OldUInt32){
	if(BMOperation == 0 || BMOperation == 2){
		OldUInt32 = (OldUInt32 & CleanerWord) + (((uint32_t)NewTerm << Position)& ~CleanerWord);
	}
	if(BMOperation == 1 || BMOperation == 2){
		OldUInt32 <<= NShift;
	}
}

uint32_t ItsBitsManager::UInt8ToUInt32(uint8_t * dataIn){
	uint32_t DataOut = 0;
	for(uint32_t i = 0; i< 4; i++){
		DataOut += (uint32_t)dataIn[3-i] << (i*8);
	}
	return DataOut;
}

void ItsBitsManager::UInt32ToUInt8(uint8_t * dataOut, uint32_t dataIn){
	for(uint8_t i = 0; i< 4; i++){
		dataOut[3-i] = (uint8_t)dataIn;
		dataIn >>=8;
	}
}