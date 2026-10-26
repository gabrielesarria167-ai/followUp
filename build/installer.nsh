; Installer page "Archivio fatture Wincar": picks wcFatture.mdb on each PC and saves it to followup.ini,
; which main.js reads. All-users installs save to C:\ProgramData\FollowUp, per-user ones to %APPDATA%\FollowUp.
; Silent installs (auto-updates) skip the page and keep the saved file.

!ifndef BUILD_UNINSTALLER
  !include nsDialogs.nsh
  !include LogicLib.nsh

  Var DbPath
  Var DbPathField

  ; The page functions live in the macro: this file is included before MUI2, the macro expands after it.
  !macro customPageAfterChangeDir
    Page custom DbPageCreate DbPageLeave

  ; A previous choice wins, then <drive>:\Wincar\Archivi\wcFatture.mdb on any drive.
  Function DbDetect
    ReadINIStr $DbPath "$APPDATA\FollowUp\followup.ini" archivio path
    ${If} $DbPath != ""
    ${AndIf} ${FileExists} $DbPath
      Return
    ${EndIf}
    StrCpy $DbPath ""
    StrCpy $1 "CDEFGHIJKLMNOPQRSTUVWXYZ"
    StrCpy $2 0
    loop:
      StrCpy $3 $1 1 $2
      StrCmp $3 "" done
      ${If} ${FileExists} "$3:\Wincar\Archivi\wcFatture.mdb"
        StrCpy $DbPath "$3:\Wincar\Archivi\wcFatture.mdb"
        Return
      ${EndIf}
      IntOp $2 $2 + 1
      Goto loop
    done:
  FunctionEnd

  Function DbPageCreate
    ${If} $DbPath == ""
      Call DbDetect
    ${EndIf}
    !insertmacro MUI_HEADER_TEXT "Archivio fatture Wincar" "Dove si trova il file wcFatture.mdb?"
    nsDialogs::Create 1018
    Pop $0
    ${If} $0 == error
      Abort
    ${EndIf}
    ${NSD_CreateLabel} 0 0 100% 24u "Seleziona l'archivio fatture di Wincar (wcFatture.mdb). FollowUp lo legge in sola lettura, senza modificarlo."
    Pop $0
    ${NSD_CreateText} 0 32u 76% 13u "$DbPath"
    Pop $DbPathField
    ${NSD_CreateButton} 78% 31u 22% 15u "Sfoglia..."
    Pop $0
    ${NSD_OnClick} $0 DbBrowse
    ${NSD_CreateLabel} 0 56u 100% 24u "Puo' trovarsi anche su un altro PC della rete, ad esempio \\SERVER\Wincar\Archivi\wcFatture.mdb"
    Pop $0
    nsDialogs::Show
  FunctionEnd

  Function DbBrowse
    Pop $0 ; the button
    ${NSD_GetText} $DbPathField $0
    nsDialogs::SelectFileDialog open "$0" "Archivio Access (*.mdb)|*.mdb"
    Pop $0
    ${If} $0 != ""
      ${NSD_SetText} $DbPathField $0
    ${EndIf}
  FunctionEnd

  Function DbPageLeave
    ${NSD_GetText} $DbPathField $DbPath
    StrCpy $0 $DbPath 4 -4
    ${If} $DbPath == ""
    ${OrIfNot} ${FileExists} $DbPath
    ${OrIf} $0 != ".mdb"
      MessageBox MB_OK|MB_ICONEXCLAMATION "Seleziona un file wcFatture.mdb esistente."
      Abort
    ${EndIf}
  FunctionEnd
  !macroend

  ; Runs inside the install section, after the all-users/per-user choice has set $APPDATA.
  ; UTF-16 with BOM so paths with accents survive; main.js reads both encodings.
  !macro customInstall
    ${If} $DbPath != ""
      CreateDirectory "$APPDATA\FollowUp"
      FileOpen $0 "$APPDATA\FollowUp\followup.ini" w
      FileWriteWord $0 0xFEFF
      FileWriteUTF16LE $0 "[archivio]$\r$\npath=$DbPath$\r$\n"
      FileClose $0
    ${EndIf}
  !macroend
!endif
