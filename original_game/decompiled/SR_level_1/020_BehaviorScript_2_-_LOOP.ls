global gSCRIPTS, isProjector, windowRect, windowMODE

on exitFrame me
  if sprite(2).playing = 0 then
    if isProjector = 1 then
      if (_player.activeWindow.sizeState = #normal) and (_player.activeWindow.titlebarOptions.visible = 1) then
        _player.activeWindow.restore()
        _player.activeWindow.rect = windowRect
      end if
    end if
    myNetID = gotoNetMovie("SR_MAIN.dcr#DIE")
    go("DOWNLOAD")
  else
    go(the frame)
  end if
end
