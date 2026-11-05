global pickupObj, mMach5, SndC_VO, Snd_MusicGoSpeedGo, gDamage, gOxygen, gScore, InterfacepicIMG, InterfacePicMODE, SndC_M5FX, mCamera, InterfaceTxtMODE, InterfaceTxtTEXT, hasFinished, gHavok, gPosition, gCameraMODE, gPrepMODE, g3DWorld, gWaterObj, cDirection, isPlaying, isUnderWater, ovBlack1, ovBlack2, gDamageDisplayed, gOxygenMODE, gOxygenDisplayed, gTextures, mCamera2, gROBOTMODE, SndC_Music, SndC_M5Engine, SndC_M5Grnd, Snd_Candy, Snd_Repair, Snd_Effect, Snd_ThatsaRobot, Snd_M5BladesOn, Snd_M5BladesLoop, Snd_Saw, mMach5Shell, mMach5Blades, isGameOver, gDeadTreeList

on doHitTree me, collisionDetails
  pickupModel = collisionDetails.modelA
  carModel = collisionDetails.modelB
  if (mMach5.userData.blades = 0) or (mMach5.transform.position.distanceTo(pickupModel.transform.position) > 4) then
    return 
  end if
  pickupModel = collisionDetails.modelA
  carModel = collisionDetails.modelB
  SndC_M5FX.play(Snd_Saw)
  SndC_M5FX.volume = 255
  SndC_M5FX.queue(Snd_M5BladesLoop)
  gDeadTreeList.append(pickupModel)
  pickupModel.collision.enabled = 0
  gHavok.disableAllCollisions(pickupModel.name)
end

on doPickupWrench me, collisionDetails
  if collisionDetails.modelA = mMach5Blades then
    pickupModel = collisionDetails.modelB
  else
    if collisionDetails.modelB = mMach5Blades then
      pickupModel = collisionDetails.modelA
    else
      return 
    end if
  end if
  if pickupModel.visibility = #none then
    return 
  end if
  pickupModel.visibility = #none
  InterfacepicIMG = "Sparky"
  InterfacePicMODE = 1
  gDamage = max(0, gDamage - 50)
  SndC_VO.volume = 255
  if SndC_VO.member <> member("spark_duggary") then
    if gDamage = 0 then
      SndC_VO.play(member("sp_its_fine_now"))
    else
      SndC_VO.play(member("spa_fixing_is_my_job"))
    end if
  end if
  gScore = gScore + 500
  doUpdateScore()
end

on doPickupRobot me, collisionDetails
  if collisionDetails.modelA = mMach5Blades then
    pickupModel = collisionDetails.modelB
  else
    if collisionDetails.modelB = mMach5Blades then
      pickupModel = collisionDetails.modelA
    else
      return 
    end if
  end if
  if pickupModel.visibility = #none then
    return 
  end if
  pickupModel.visibility = #none
  SndC_VO.volume = 255
  if SndC_VO.member <> member("spark_duggary") then
    SndC_VO.play(Snd_ThatsaRobot)
  end if
  if gROBOTMODE = 4 then
    gROBOTMODE = 0
  end if
  gScore = gScore + 1000
  doUpdateScore()
end

on doPickupCandyPurple me, collisionDetails
  if collisionDetails.modelA = mMach5Blades then
    pickupModel = collisionDetails.modelB
  else
    if collisionDetails.modelB = mMach5Blades then
      pickupModel = collisionDetails.modelA
    else
      return 
    end if
  end if
  if pickupModel.visibility = #none then
    return 
  end if
  pickupModel.visibility = #none
  SndC_VO.volume = 255
  if SndC_VO.member <> member("spark_duggary") then
    SndC_VO.play(Snd_Candy[random(Snd_Candy.count)])
  end if
  InterfacepicIMG = "Candy"
  InterfacePicMODE = 1
  gScore = gScore + 1000
  doUpdateScore()
end

on doPickupCandyRed me, collisionDetails
  if collisionDetails.modelA = mMach5Blades then
    pickupModel = collisionDetails.modelB
  else
    if collisionDetails.modelB = mMach5Blades then
      pickupModel = collisionDetails.modelA
    else
      return 
    end if
  end if
  if pickupModel.visibility = #none then
    return 
  end if
  pickupModel.visibility = #none
  SndC_VO.volume = 255
  if SndC_VO.member <> member("spark_duggary") then
    SndC_VO.play(Snd_Candy[random(Snd_Candy.count)])
  end if
  InterfacepicIMG = "Candy"
  InterfacePicMODE = 1
  gScore = gScore + 500
  doUpdateScore()
end

on doPickupOxegen me, collisionDetails
  if collisionDetails.modelA = mMach5Blades then
    pickupModel = collisionDetails.modelB
  else
    if collisionDetails.modelB = mMach5Blades then
      pickupModel = collisionDetails.modelA
    else
      return 
    end if
  end if
  if pickupModel.visibility = #none then
    return 
  end if
  pickupModel.visibility = #none
  SndC_VO.volume = 255
  SndC_VO.play(Snd_Effect)
  InterfacepicIMG = "O2"
  InterfacePicMODE = 1
  gOxygen = min(100, gOxygen + 50)
  gScore = gScore + 500
  doUpdateScore()
end

on doFaller me, collisionDetails
  if collisionDetails.modelA = mMach5Blades then
    pickupModel = collisionDetails.modelB
  else
    if collisionDetails.modelB = mMach5Blades then
      pickupModel = collisionDetails.modelA
    else
      return 
    end if
  end if
  pickupModel.collision.enabled = 0
  gHavok.rigidBody(pickupModel.userData.myFaller).pinned = 0
end

on doFinish me
  put "DOING: doFinish"
  hasFinished = 1
  if gPosition = 1 then
    SndC_VO.volume = 255
    SndC_VO.play(member("announcer_m5_wins"))
    gScore = gScore + 5000
    doUpdateScore()
  else
    SndC_VO.volume = 255
    SndC_VO.play(member("duggery_too_bad"))
  end if
  isGameOver = 1
  isPlaying = 0
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
  SndC_Music.fadeOut(1000)
  SndC_M5Engine.fadeOut(1000)
  SndC_M5Grnd.fadeOut(1000)
end
