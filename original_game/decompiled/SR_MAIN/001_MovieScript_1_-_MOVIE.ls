global gGameMODE, gLevel, gPosition, isUnlocked, hasReported, myNetID, myStreamState, myStreamError, myBytesLoaded, myBytesTotal, myNetURL, gSCRIPTS, isProjector, windowRect, windowMODE, win

on prepareMovie me
  the romanLingo = 1
  gGameMODE = "INIT"
  gLevel = 1
  tellStreamStatus(0)
  tellStreamStatus(1)
  hasReported = 0
  if isProjector = 1 then
    rs = getRendererServices()
    rs.renderer = #directX7_0
    rs.hardwareAntialiasing = #fullScene
  end if
end

on streamStatus url, state, bytesSoFar, bytesTotal, error
  put "URL=" & url & ", " & bytesSoFar & ", " & bytesTotal
  myBytesLoaded = bytesSoFar
  myBytesTotal = bytesTotal
  myStreamState = state
  myStreamError = error
end

on closeRequest
  if keyPressed(53) = 0 then
    gSCRIPTS.doQuit()
  end if
end

on startMovie
  _movie.exitLock = 1
  if (isProjector = 0) or (windowMODE <> 2) then
    sprite(5).visible = 0
    sprite(6).visible = 0
  end if
  if gSCRIPTS.ilk = #script then
    if gSCRIPTS.doCheck() <> 1 then
      go("ERROR")
      abort()
      gotoNetPage("http://www.shockwave.com")
    end if
  else
    go("ERROR")
    abort()
    gotoNetPage("http://www.shockwave.com")
  end if
end

on doLaunchMiniGame myGame
  if isProjector = 1 then
    win = window(the applicationPath & "MEDIA\" & myGame & ".DCR")
    win.name = "MINIGAME"
    win.open()
  end if
end

on zoomWindow
  if isProjector = 1 then
    if (_player.activeWindow.sizeState = #maximized) and (windowMODE <> 2) then
      gSCRIPTS.doChangeMode(2)
    end if
  end if
end

on moveWindow me
  if isProjector = 1 then
    if (_player.activeWindow.sizeState = #normal) and (_player.activeWindow.titlebarOptions.visible = 1) then
      windowRect = _player.activeWindow.rect
    end if
  end if
end

on doGetWallpaper myImage
  if isProjector = 1 then
    gSCRIPTS.fn_SetMember(member(myImage, "Graphics"), "wallpaper_" & myImage, #stretch, 1)
  else
    gotoNetPage("WALLPAPERS/" & myImage, "_new")
  end if
end

on doBuyNow
  gotoNetPage("http://gameblast.shockwave.com/servlet/updateCart?action=addItem&site=sw&sku=speedracer-pc", "_new")
end

on doQuit me
  if isProjector = 1 then
    quit()
  end if
end

on gotoMain
  go("MAIN")
end

on gotoGame gLevel
  put "1.0 DOING: gotoGame"
  updateStage()
  put "1.1 DOING: gotoGame"
  myNetURL = "SR_LEVEL_" & gLevel & ".dcr"
  myNetID = gotoNetMovie("SR_LEVEL_" & gLevel & ".dcr")
  go("DOWNLOAD")
  put "1.2 DOING: gotoGame"
  if isProjector = 1 then
    if (_player.activeWindow.sizeState = #normal) and (_player.activeWindow.titlebarOptions.visible = 1) then
      _player.activeWindow.restore()
      _player.activeWindow.rect = windowRect
    end if
  end if
end

on toggleSpinner mySwitch
  if (mySwitch = "on") and (the frame = 1) then
    go("ABOUTM5")
  else
    if (mySwitch = "off") and (the frame <> 1) then
      go(1)
    end if
  end if
end
