#ifndef ITSBITSMANAGER_H
#define ITSBITSMANAGER_H



class ItsBitsManager{
 private:	
	uint32_t NewTerm;
	uint32_t Position;      //bit address
	uint32_t Nbit;
	uint32_t NShift;
	uint32_t CleanerWord;

	uint8_t BMOperation;   //0 = change content, 1 = shift, 2 = all

  public:
	ItsBitsManager(void);
	~ItsBitsManager(void);
	
	void ShiftNewTerm(void){NewTerm <<= Position;}; 
	void SetClWord(void){CleanerWord = _lrotl((0xffffffff - ((1<< Nbit) - 1)), Position);};
	void SetClWord(uint32_t ClWord){CleanerWord = ClWord;};
	void ModifyUInt32(uint32_t &OldUInt32);   
	void ModifyUInt32(uint32_t &OldUInt32, uint32_t NewEle, uint8_t position, uint8_t bitNumber);
	uint32_t ExtractFromUInt32(uint32_t Input, uint8_t position, uint8_t bitNumber);

    
	uint32_t UInt8ToUInt32(uint8_t * DataIn);
	void UInt32ToUInt8(uint8_t * DataOut, uint32_t DataIn);
};
#endif