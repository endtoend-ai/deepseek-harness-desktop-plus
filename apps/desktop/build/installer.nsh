!macro customCheckAppRunning
  # The assisted uninstaller checks processes before multi-user initialization,
  # so $INSTDIR can still be the default when the app lives in a custom folder.
  !ifdef BUILD_UNINSTALLER
    StrCpy $3 "$EXEDIR"
  !else
    StrCpy $3 "$INSTDIR"
  !endif

  ${If} ${FileExists} "$3\${APP_EXECUTABLE_FILENAME}"
    ExecWait '"$3\${APP_EXECUTABLE_FILENAME}" --dsh-installer-quit'
    Sleep 3000

    # Do not gate forced cleanup on nsProcess: public preview builds can leave
    # a process tree that its filename-only probe does not report reliably.
    nsExec::ExecToLog '"$SYSDIR\taskkill.exe" /T /F /IM "${APP_EXECUTABLE_FILENAME}"'
    Pop $0
    Sleep 1000
  ${EndIf}

  nsProcess::_FindProcess /NOUNLOAD "${APP_EXECUTABLE_FILENAME}"
  Pop $0
  ${If} $0 == 0
    nsExec::ExecToLog '"$SYSDIR\taskkill.exe" /T /F /IM "${APP_EXECUTABLE_FILENAME}"'
    Pop $0
    Sleep 1000
  ${EndIf}

  nsProcess::_FindProcess /NOUNLOAD "${APP_EXECUTABLE_FILENAME}"
  Pop $0
  ${If} $0 == 0
    ${IfNot} ${Silent}
      MessageBox MB_OK|MB_ICONEXCLAMATION "$(appCannotBeClosed)"
    ${EndIf}
    SetErrorLevel 2
    Abort
  ${EndIf}

  !ifndef BUILD_UNINSTALLER
    # Public preview uninstallers can leave their registration behind after a
    # failed same-directory removal. Let the replacement payload repair that
    # exact location without invoking the failed uninstaller again.
    ReadRegStr $1 SHELL_CONTEXT "${UNINSTALL_REGISTRY_KEY}" "DisplayVersion"
    ${If} $1 == "0.1.0-rc.5"
    ${OrIf} $1 == "0.1.0-rc.6"
    ${OrIf} $1 == "0.1.0-rc.7"
      ReadRegStr $2 SHELL_CONTEXT "${INSTALL_REGISTRY_KEY}" "InstallLocation"
      ${If} $2 == $INSTDIR
        DeleteRegValue SHELL_CONTEXT "${UNINSTALL_REGISTRY_KEY}" "UninstallString"
        DeleteRegValue SHELL_CONTEXT "${UNINSTALL_REGISTRY_KEY}" "QuietUninstallString"
        SetOverwrite on
      ${EndIf}
    ${EndIf}
  !endif
!macroend
