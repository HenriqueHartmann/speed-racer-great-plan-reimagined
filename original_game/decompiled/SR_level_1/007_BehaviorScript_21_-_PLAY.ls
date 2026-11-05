global gDeadTreeList, myNetID, SEG_TRK, SEG_OBJ, SEG_PIC, gSEG, lLightSource, mCamera, InterfaceTxtMODE, InterfaceTxtTEXT, InterfacePicMODE, InterfacepicIMG, InterfacePicTIMER, ovInterface_Pic, gCameraMODE, gPrepMODE, g3DWorld, gWaterObj, cDirection, isPlaying, isUnderWater, gPosition, ovBlack1, ovBlack2, ovPlace_L, ovPlace_R, gDamage, gDamageDisplayed, gOxygenMODE, gOxygen, gOxygenDisplayed, gTextures, mCamera2, mMach5, kForward, pickupObj, SndC_Music, Snd_Effect, Snd_MusicGoSpeedGo, Snd_MusicLoop1, Snd_MusicLoop2, Snd_MusicLoop3, Snd_MusicLoop4, Snd_MusicLoop5, SndC_M5Engine, SndC_M5Grnd, SndC_VO, gHelpToggle, ovHelp, hasFinished, gGoPlayed, isGameOver, isStarted, gSCRIPTS, isProjector, windowRect, windowMODE

on exitFrame
  if keyPressed(53) then
    if isProjector = 1 then
      if (_player.activeWindow.sizeState = #normal) and (_player.activeWindow.titlebarOptions.visible = 1) then
        _player.activeWindow.restore()
        _player.activeWindow.rect = windowRect
      end if
    end if
    SndC_Music.stop()
    myNetID = gotoNetMovie("SR_MAIN.dcr#MAIN")
    go("DOWNLOAD")
    _player.cursor(0)
    exit
  end if
  if gHelpToggle = 1 then
    mCamera.overlay[ovHelp].blend = min(100, mCamera.overlay[ovHelp].blend + 10)
  else
    if gHelpToggle = 0 then
      mCamera.overlay[ovHelp].blend = max(0, mCamera.overlay[ovHelp].blend - 8)
    end if
  end if
  if keyPressed("h") then
    if (gHelpToggle = 1) and (mCamera.overlay[ovHelp].blend = 100) then
      gHelpToggle = 0
    else
      if (gHelpToggle = 0) and (mCamera.overlay[ovHelp].blend = 0) then
        gHelpToggle = 1
      end if
    end if
  end if
  if (isPlaying = 0) and (isStarted = 0) then
    if keyPressed(kForward) then
      isPlaying = 1
      isStarted = 1
      gHelpToggle = 0
    end if
    if gGoPlayed = 0 then
      SndC_Music.volume = 255
      SndC_VO.play(member("announcer_Go"))
      SndC_Music.volume = 100
      SndC_Music.play(Snd_MusicLoop1)
      gGoPlayed = 1
    end if
  end if
  doCamera()
  repeat with tObj in gWaterObj
    myPos = tObj.userData.myPos
    tObj.transform.position = vector(myPos[1] + (sin(cDirection / 180.0 * 3.1400000000000001) * 1.0), myPos[2], myPos[3])
  end repeat
  cDirection = cDirection + 8
  if cDirection >= 360 then
    cDirection = cDirection - 360
  end if
  repeat with tObj in SEG_PIC[gSEG]
    tObj.rotate(0, 0, 10)
  end repeat
  if gDeadTreeList.count > 0 then
    repeat with i = 1 to gDeadTreeList.count
      tObj = gDeadTreeList[i]
      tObj.rotate(10, 10, 0)
      tObj.transform.position[3] = tObj.transform.position[3] + 0.75
      if tObj.transform.position[3] >= (tObj.userData.myPos[3] + 10) then
        tObj.removeFromWorld()
        gDeadTreeList.deleteAt(i)
      end if
    end repeat
  end if
  doInterfaceTxt()
  doInterfacePic()
  if mCamera.overlay[ovPlace_L].blend > 0 then
    mCamera.overlay[ovPlace_L].blend = max(0, mCamera.overlay[ovPlace_L].blend - 10)
    mCamera.overlay[ovPlace_R].blend = max(0, mCamera.overlay[ovPlace_R].blend - 10)
  end if
  if gOxygenMODE <> 0 then
    doDisplayOxygen()
    if gOxygenDisplayed <= 0 then
      gDamage = max(0, gDamage + 0.29999999999999999)
    end if
  end if
  if gDamage <> gDamageDisplayed then
    doDisplayDamage()
    if (gDamageDisplayed >= 100) and (isGameOver = 0) then
      isGameOver = 1
      isPlaying = 0
      SndC_Music.fadeOut(1000)
      SndC_M5Engine.fadeOut(1000)
      SndC_M5Grnd.fadeOut(1000)
      BlackImage1 = image(512, 384, 8)
      BlackImage1.copyPixels(member("Black2x2").image, rect(0, 0, 512, 384), rect(0, 0, 2, 2))
      ovBlack1 = createOverlay(mCamera, "ovBlack1", "Black2x2", #rgba4444, 0, #low, 0, point(0, 0), 0)
      gTextures.getProp("ovBlack1").image = BlackImage1
      mCamera.overlay[ovBlack1].source = gTextures.getProp("ovBlack1")
      BlackImage2 = image(137, 103, 8)
      BlackImage2.copyPixels(member("Black2x2").image, rect(0, 0, 137, 103), rect(0, 0, 2, 2))
      ovBlack2 = createOverlay(mCamera2, "ovBlack2", "Black2x2", #rgba4444, 0, #low, 0, point(0, 0), 0)
      gTextures.getProp("ovBlack2").image = BlackImage2
      mCamera2.overlay[ovBlack2].source = gTextures.getProp("ovBlack2")
    end if
  end if
  if isGameOver = 1 then
    mCamera.overlay[ovBlack1].blend = min(100, mCamera.overlay[ovBlack1].blend + 5)
    mCamera2.overlay[ovBlack2].blend = min(100, mCamera2.overlay[ovBlack2].blend + 5)
    if (mCamera2.overlay[ovBlack2].blend = 100) and not SndC_VO.isBusy() then
      if isProjector = 1 then
        if (_player.activeWindow.sizeState = #normal) and (_player.activeWindow.titlebarOptions.visible = 1) then
          _player.activeWindow.restore()
          _player.activeWindow.rect = windowRect
        end if
        _movie.centerStage = 0
      end if
      if hasFinished = 1 then
        if gPosition = 1 then
          put "WIN"
          myNetID = gotoNetMovie("SR_MAIN.dcr#WIN")
        else
          put "LOSE"
          myNetID = gotoNetMovie("SR_MAIN.dcr#LOSE")
        end if
      else
        put "DIE"
        myNetID = gotoNetMovie("SR_MAIN.dcr#DIE")
      end if
      _player.cursor(0)
      go("DOWNLOAD")
    end if
  end if
  go(the frame)
end
