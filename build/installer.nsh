!macro customInstall
  WriteRegStr SHELL_CONTEXT "Software\Classes\tech-cc-hub" "" "URL:tech-cc-hub Protocol"
  WriteRegStr SHELL_CONTEXT "Software\Classes\tech-cc-hub" "URL Protocol" ""
  WriteRegStr SHELL_CONTEXT "Software\Classes\tech-cc-hub\DefaultIcon" "" '"$appExe",0'
  WriteRegStr SHELL_CONTEXT "Software\Classes\tech-cc-hub\shell\open\command" "" '"$appExe" "%1"'
!macroend

!macro customUnInstall
  DeleteRegKey SHELL_CONTEXT "Software\Classes\tech-cc-hub"
!macroend
