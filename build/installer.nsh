!macro customInstall
  WriteRegStr SHELL_CONTEXT "Software\Classes\tech-cc-hub" "" "URL:tech-cc-hub Protocol"
  WriteRegStr SHELL_CONTEXT "Software\Classes\tech-cc-hub" "URL Protocol" ""
  WriteRegStr SHELL_CONTEXT "Software\Classes\tech-cc-hub\DefaultIcon" "" '"$appExe",0'
  WriteRegStr SHELL_CONTEXT "Software\Classes\tech-cc-hub\shell\open\command" "" '"$appExe" "%1"'

  # Windows link tracking can retarget preserved shortcuts to the temporary
  # old-install directory while electron-builder replaces an existing app.
  # Rewrite only shortcuts that already exist so user-deleted links stay deleted.
  ${If} ${FileExists} "$newStartMenuLink"
    Delete "$newStartMenuLink"
    CreateShortCut "$newStartMenuLink" "$appExe" "" "$appExe" 0 "" "" "${APP_DESCRIPTION}"
    ClearErrors
    WinShell::SetLnkAUMI "$newStartMenuLink" "${APP_ID}"
  ${EndIf}

  ${If} ${FileExists} "$newDesktopLink"
    Delete "$newDesktopLink"
    CreateShortCut "$newDesktopLink" "$appExe" "" "$appExe" 0 "" "" "${APP_DESCRIPTION}"
    ClearErrors
    WinShell::SetLnkAUMI "$newDesktopLink" "${APP_ID}"
  ${EndIf}

  System::Call 'Shell32::SHChangeNotify(i 0x8000000, i 0, i 0, i 0)'
!macroend

!macro customUnInstall
  DeleteRegKey SHELL_CONTEXT "Software\Classes\tech-cc-hub"
!macroend
