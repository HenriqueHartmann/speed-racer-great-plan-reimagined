global gSEG, SEG_TRK, SEG_OBJ, SEG_PIC, SEG_TRE, gHavok, kForward, kBackward, kRight, kLeft, kJacks, gTextures, gOverlays, ovPlace_1, ovPlace_2, ovPlace_3, ovPlace_L, ovPlace_R, g3DWorld, mCamera, mMach5, SndC_Music, Snd_MusicLoop1, Snd_MusicLoop2, Snd_MusicLoop3, myNetID, myStreamState, myStreamError, myBytesLoaded, myBytesTotal, gSCRIPTS, isProjector, windowRect, windowMODE, _PI, _PI2, _PI180, _180PI

on prepareMovie me
  if isProjector = 1 then
    rs = getRendererServices()
    rs.renderer = #directX7_0
    rs.hardwareAntialiasing = #fullScene
  end if
  the romanLingo = 1
  tellStreamStatus(1)
  kForward = 126
  kBackward = 125
  kRight = 124
  kLeft = 123
  kJacks = SPACE
  _PI = PI
  _PI2 = 0.5 * PI
  _180PI = 180.0 / PI
  _PI180 = PI / 180
end

on startMovie
  _movie.exitLock = 1
  if (isProjector = 0) or (windowMODE <> 2) then
    sprite(5).visible = 0
    sprite(6).visible = 0
  else
    sprite(5).visible = 1
    sprite(6).visible = 1
  end if
  if (the environment).runMode = "Author" then
    return 
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

on closeRequest
  if keyPressed(53) = 0 then
    gSCRIPTS.doQuit()
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

on streamStatus url, state, bytesSoFar, bytesTotal, error
  myStreamState = state
  myStreamError = error
  myBytesLoaded = bytesSoFar
  myBytesTotal = bytesTotal
end

on doUpdatePlace myPlace
  mCamera.overlay[ovPlace_L].blend = 100
  mCamera.overlay[ovPlace_R].blend = 100
  if myPlace < 10 then
    mCamera.overlay[ovPlace_1].blend = 0
    mCamera.overlay[ovPlace_2].source = gTextures.getProp("BigDigit_" & string(myPlace).char[1..1])
  else
    mCamera.overlay[ovPlace_1].blend = 100
    mCamera.overlay[ovPlace_1].source = gTextures.getProp("BigDigit_" & string(myPlace).char[1..1])
    mCamera.overlay[ovPlace_2].source = gTextures.getProp("BigDigit_" & string(myPlace).char[2..2])
  end if
  case myPlace of
    1:
      mCamera.overlay[ovPlace_3].source = gTextures.getProp("BigDigit_st")
    2:
      mCamera.overlay[ovPlace_3].source = gTextures.getProp("BigDigit_nd")
    3:
      mCamera.overlay[ovPlace_3].source = gTextures.getProp("BigDigit_rd")
    otherwise:
      mCamera.overlay[ovPlace_3].source = gTextures.getProp("BigDigit_th")
  end case
end

on doM5ChangeSegment tCar, tSEG1, tSEG2
  if (tSEG1 = 0) and (tSEG2 = 1) then
    if SEG_PIC[tSEG2].count <> 0 then
      repeat with i = 1 to SEG_PIC[tSEG2].count
        SEG_PIC[tSEG2].collision.enabled = 1
      end repeat
    end if
    repeat with i = 2 to SEG_TRK.count
      gHavok.disableCollision(tCar.name, SEG_TRK[i].name)
    end repeat
    repeat with i = 2 to SEG_OBJ.count
      if SEG_OBJ[i].count <> 0 then
        repeat with ii = 1 to SEG_OBJ[i].count
          gHavok.disableCollision(tCar.name, SEG_OBJ[i][ii].name)
        end repeat
      end if
    end repeat
    repeat with i = 2 to SEG_TRE.count
      if SEG_TRE[i].count <> 0 then
        repeat with ii = 1 to SEG_TRE[i].count
          gHavok.disableCollision(tCar.name, SEG_TRE[i][ii].name)
          SEG_TRE[i][ii].collision.enabled = 0
        end repeat
      end if
    end repeat
  else
    if SEG_PIC[tSEG1].count <> 0 then
      repeat with i = 1 to SEG_PIC[tSEG1].count
        SEG_PIC[tSEG1][i].collision.enabled = 0
      end repeat
    end if
    if SEG_PIC[tSEG2].count <> 0 then
      repeat with i = 1 to SEG_PIC[tSEG2].count
        SEG_PIC[tSEG2][i].collision.enabled = 1
      end repeat
    end if
    gHavok.disableCollision(tCar.name, SEG_TRK[tSEG1].name)
    gHavok.enableCollision(tCar.name, SEG_TRK[tSEG2].name)
    if SEG_OBJ[tSEG1].count <> 0 then
      repeat with i = 1 to SEG_OBJ[tSEG1].count
        gHavok.disableCollision(tCar.name, SEG_OBJ[tSEG1][i].name)
      end repeat
    end if
    if SEG_OBJ[tSEG2].count <> 0 then
      repeat with i = 1 to SEG_OBJ[tSEG2].count
        gHavok.enableCollision(tCar.name, SEG_OBJ[tSEG2][i].name)
      end repeat
    end if
    if SEG_TRE[tSEG1].count <> 0 then
      repeat with i = 1 to SEG_TRE[tSEG1].count
        gHavok.disableCollision(tCar.name, SEG_TRE[tSEG1][i].name)
        SEG_TRE[tSEG1][i].collision.enabled = 0
      end repeat
    end if
    if tCar.userData.blades = 0 then
      if SEG_TRE[tSEG2].count <> 0 then
        repeat with i = 1 to SEG_TRE[tSEG2].count
          gHavok.enableCollision(tCar.name, SEG_TRE[tSEG2][i].name)
          SEG_TRE[tSEG2][i].collision.enabled = 0
        end repeat
      end if
    else
      if SEG_TRE[tSEG2].count <> 0 then
        repeat with i = 1 to SEG_TRE[tSEG2].count
          gHavok.disableCollision(tCar.name, SEG_TRE[tSEG2][i].name)
          SEG_TRE[tSEG2][i].collision.enabled = 1
        end repeat
      end if
    end if
  end if
end

on doEnemyChangeSegment tCar, tSEG1, tSEG2
  if (tSEG1 = 0) and (tSEG2 = 1) then
    repeat with i = 2 to SEG_TRK.count
      gHavok.disableCollision(tCar.name, SEG_TRK[i].name)
    end repeat
    repeat with i = 2 to SEG_OBJ.count
      if SEG_OBJ[i].count <> 0 then
        repeat with ii = 1 to SEG_OBJ[i].count
          gHavok.disableCollision(tCar.name, SEG_OBJ[i][ii].name)
        end repeat
      end if
    end repeat
    repeat with i = 2 to SEG_TRE.count
      if SEG_TRE[i].count <> 0 then
        repeat with ii = 1 to SEG_OBJ[i].count
          gHavok.disableCollision(tCar.name, SEG_TRE[i][ii].name)
        end repeat
      end if
    end repeat
  else
    gHavok.disableCollision(tCar.name, SEG_TRK[tSEG1].name)
    gHavok.enableCollision(tCar.name, SEG_TRK[tSEG2].name)
    if SEG_OBJ[tSEG1].count <> 0 then
      repeat with i = 1 to SEG_OBJ[tSEG1].count
        gHavok.disableCollision(tCar.name, SEG_OBJ[tSEG1][i].name)
      end repeat
    end if
    if SEG_OBJ[tSEG2].count <> 0 then
      repeat with i = 1 to SEG_OBJ[tSEG2].count
        gHavok.enableCollision(tCar.name, SEG_OBJ[tSEG2][i].name)
      end repeat
    end if
    if SEG_TRE[tSEG1].count <> 0 then
      repeat with i = 1 to SEG_TRE[tSEG1].count
        gHavok.disableCollision(tCar.name, SEG_TRE[tSEG1][i].name)
      end repeat
    end if
    if SEG_TRE[tSEG2].count <> 0 then
      repeat with i = 1 to SEG_TRE[tSEG2].count
        gHavok.enableCollision(tCar.name, SEG_TRE[tSEG2][i].name)
      end repeat
    end if
  end if
end

on gotoMain
  go("MAIN")
end

on createTexture tName, tmember, tRenderFormat, tFiltering, tQuality
  t = g3DWorld.newTexture(tName, #fromCastMember, member(tmember))
  t.renderFormat = tRenderFormat
  t.nearFiltering = tFiltering
  t.quality = tQuality
  gTextures.addProp(tName, t)
  return t
end

on createOverlay tCam, tName, tmember, tRenderFormat, tFiltering, tQuality, tBlend, tPos, tRot
  if not g3DWorld.texture(tName) then
    t = createTexture(tName, tmember, tRenderFormat, tFiltering, tQuality)
  else
    t = g3DWorld.texture(tName)
  end if
  tCam.addOverlay(t, tPos, tRot)
  t1 = tCam.overlay.count
  tCam.overlay[t1].blend = tBlend
  gOverlays.addProp(tName, t1)
  return t1
end

on getRotStep rot, goto_rot, stepFactor
  if rot > 180 then
    rot = rot - 360
  end if
  if rot >= goto_rot then
    stepNeg = rot - goto_rot
    stepPos = 360 - stepNeg
  else
    if goto_rot > rot then
      stepPos = goto_rot - rot
      stepNeg = 360 - stepPos
    end if
  end if
  if stepNeg < stepPos then
    step = stepNeg * -stepFactor
  else
    step = stepPos * stepFactor
  end if
  return step
end

on ceil f
  int = integer(f)
  if int = f then
    return int
  else
    if f > 0 then
      return integer(f + 0.5)
    else
      return integer(f - 0.5)
    end if
  end if
end

on floor f
  int = integer(f)
  if int = f then
    return int
  else
    if f > 0 then
      return integer(f - 0.5)
    else
      return integer(f + 0.5)
    end if
  end if
end

on getAngle x1, y1, x2, y2
  xoff = x2 - x1
  yoff = y2 - y1
  if xoff > 0 then
    tAngle = 90 - (atan(yoff / xoff) * _180PI)
  else
    if (xoff = 0) and (yoff >= 0) then
      tAngle = 0
    else
      if (xoff = 0) and (yoff < 0) then
        tAngle = 180
      else
        if xoff < 0 then
          tAngle = -90 - (atan(yoff / xoff) * _180PI)
        end if
      end if
    end if
  end if
  return tAngle
end

on normalizeAngle a
  if a < 0 then
    a = 360 + a
  end if
  a = a mod 360
  return a
end
