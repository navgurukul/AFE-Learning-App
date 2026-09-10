; Custom NSIS Script for AFE Installer
; This script handles NGO key input in silent mode (/S /NGO_KEY=xxx) and protects existing config on update

!include "MUI2.nsh"
!include "LogicLib.nsh"

; Variables
Var NGO_KEY

!macro customInit
    ; Parse command line for /NGO_KEY parameter
    ${GetParameters} $R0
    ${GetOptions} $R0 "/NGO_KEY=" $NGO_KEY
    
    ; If not found or empty, use default
    ${If} $NGO_KEY == ""
        StrCpy $NGO_KEY "D3F41T-K37"
    ${EndIf}
!macroend

; After installation, write config file ONLY if it does not exist yet (preserves school setup on updates)
!macro customInstall
    ${IfNot} ${FileExists} "$APPDATA\OfflineLearningApp\config.json"
        CreateDirectory "$APPDATA\OfflineLearningApp"
        FileOpen $0 "$APPDATA\OfflineLearningApp\config.json" w
        FileWrite $0 '{"ngoKey": "$NGO_KEY"}'
        FileClose $0
        DetailPrint "Initial config created with NGO Key: $NGO_KEY"
    ${Else}
        DetailPrint "Existing config.json preserved during update."
    ${EndIf}
!macroend

; Custom uninstallation logic
!macro customUnInstall
    ${if} $isDeleteAppData == "1"
        RMDir /r "$APPDATA\OfflineLearningApp"
        DetailPrint "Application data deleted from: $APPDATA\OfflineLearningApp"
    ${endif}
!macroend
