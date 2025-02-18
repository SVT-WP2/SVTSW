#include "ITSUtilities/ItsUtility.h"

#include <cstdio>
#include <iostream>
#include <sstream>
#include <cctype>
#include <algorithm>

ItsUtility::ItsUtility(){

}

ItsUtility::~ItsUtility(){

}

void ItsUtility::removeWhiteSpaces(std::string& text){
    ItsUtility::removeComments(text);
    text.erase(remove_if(text.begin(), text.end(), [](unsigned char c){return isspace(c);}), text.end());
    text.erase(remove_if(text.begin(), text.end(), [](unsigned char c){return iscntrl(c);}), text.end());
}

void ItsUtility::removeComments(std::string& text){
    size_t index = text.find("#");
    if(index != std::string::npos) text = text.substr(0, index);
}








