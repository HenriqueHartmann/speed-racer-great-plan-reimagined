property tTreeArr, tTrackArr, tPickupArr, tWallArr, tInvArr
global gDeadTreeList, gSEG, mSky, SEG_TRK, SEG_OBJ, SEG_PIC, gHelpToggle, ovHelp, gEffects, gProgBar, gProgSteps, gProgStep, isPlaying, gameLevel, gameLighting, gTextures, gOverlays, cDirection, gHavok, g3DWorld, mCamera2, mCameraSpot, GAMEMODE, PREPMODE, CAMERAMODE, SCOPEMODE, mCamera, mMach5, mTrack, mBridge, mDirtKick, mrDirtKick, gCarsList, gCarsPrepared, gCarsReady, ovInterface, theAmbientLight, gExplosionSet, SEG_TRE, gEffectImage, gEffectBlack, gEffectRoad, gEffectDirt, gEffectMud, gEffectSnow, gEffectGrass, gEffectTallGrass, gEffectWater, gEffectDeepWater, gWaterObj, pathList, SndC_Music, SndC_M5Grnd, SndC_M5FX, SndC_M5Engine, SndC_EnemyFX, SndC_VO, SndC_M5FX2, Snd_Robot1, Snd_Robot2, Snd_Effect, Snd_MusicGoSpeedGo, Snd_MusicLoop1, Snd_MusicLoop2, Snd_MusicLoop3, Snd_MusicLoop4, Snd_MusicLoop5, Snd_Crash1, Snd_Crash2, Snd_Crash3, Snd_M5Jump, Snd_M5BladesOn, Snd_M5BladesLoop, Snd_M5BladesOff, Snd_M5Grip, Snd_M5Parascope, Snd_M5EngineStart, Snd_M5EngineLoop, Snd_SkidPav, Snd_SkidDrt, Snd_FX_Underwater, Snd_FX_Splash, Snd_FX_InWater, Snd_MusicTitle, Snd_MusicGameOver, Snd_HitReaction_1, Snd_HitReaction_2, Snd_HitReaction_3, Snd_HitReaction_4, Snd_HitReaction_5, Snd_WrongWay, Snds_HitReactions, Snd_WhereistheCar, Snd_NowitsGone, Snd_EnemyScream, Snd_ThatsaRobot, Snd_FX_Pass1, Snd_FX_Pass2, Snd_Saw, Snd_M5Lights, Snd_FX_Chirp, Snd_EnemyScream_1, Snd_Candy, Snd_Repair, Flare_1_Blend, Flare_2_Blend, Flare_3_Blend, enemyDistArr, enemyScriptArr, ovInterface_bracket_L, ovInterface_bracket_R, ovLens1, ovLens2, ovLens3, ovInterface_Txt, InterfaceTxtMODE, ovInterface_DamageBar, ovInterface_DamageBarEnd, gDamage, gDamageDisplayed, ovOxygen_Panel, ovInterface_OxygenBar, ovInterface_OxygenBarEnd, gOxygenMODE, gOxygen, gOxygenDisplayed, OxygenImage, ovInterface_Pic, InterfacePicMODE, gLevelStartTIMER, pickupObj, ovScore_6, ovScore_5, ovScore_4, ovScore_3, ovScore_2, ovScore_1, ovPlace_4, ovPlace_3, ovPlace_2, ovPlace_1, ovPlace_L, ovPlace_R, gScore, enemyPositionsList, enemiesRemaining, enemiesFinished, damageImageSource, hasFinished, gPosition, gGoPlayed, isGameOver, gCarDuggery, isStarted, gCarSkinsArr, myNetID, windowRect, isProjector

on doUpdateProgress me
  tPercent = gProgStep / gProgSteps * 100
  sprite(3).setVariable("progressTxt", string("preparing level..."))
  sprite(3).setFlashProperty("progBar", #scaleX, min(100, integer(tPercent)))
end

on exitFrame me
  if keyPressed(53) then
    if isProjector = 1 then
      if (_player.activeWindow.sizeState = #normal) and (_player.activeWindow.titlebarOptions.visible = 1) then
        _player.activeWindow.restore()
        _player.activeWindow.rect = windowRect
      end if
      _movie.centerStage = 0
    end if
    SndC_Music.stop()
    myNetID = gotoNetMovie("SR_MAIN.dcr#MAIN")
    go("DOWNLOAD")
    exit
  end if
  if gProgStep > 0 then
    doUpdateProgress()
  end if
  case PREPMODE of
    1:
      gHelpToggle = 1
      isStarted = 0
      gProgSteps = 13.0
      gProgStep = 1
      gGoPlayed = 0
      cDirection = 0
      isPlaying = 0
      SCOPEMODE = 0
      isGameOver = 0
      InterfaceTxtMODE = 0
      InterfacePicMODE = 0
      gScore = 0
      hasFinished = 0
      gDamage = 0
      gDamageDisplayed = 0
      gOxygen = 100
      gOxygenDisplayed = 1
      gOxygenMODE = 0
      enemyDistArr = []
      enemyScriptArr = []
      enemiesRemaining = 19
      gPosition = enemiesRemaining + 1
      enemiesFinished = 0
      enemyPositionsList = [0, 0, 0]
      SndC_Music = sound(1)
      SndC_M5Grnd = sound(2)
      SndC_M5FX = sound(3)
      SndC_M5FX2 = sound(7)
      SndC_M5Engine = sound(4)
      SndC_EnemyFX = sound(5)
      SndC_VO = sound(6)
      gProgStep = gProgStep + 1
      gCarSkinsArr = ["EnemyMap_1", "EnemyMap_2", "EnemyMap_3", "EnemyMap_4"]
      PREPMODE = 10
    10:
      mSky = g3DWorld.model("Sphere01")
      mSky.shader.emissive = rgb(150, 150, 150)
      member("Car_Enemy").resetWorld()
      mCamera = g3DWorld.camera[1]
      mCamera.yon = 300
      mCamera.colorBuffer.clearAtRender = 0
      mCamera.projectionAngle = 40
      g3DWorld.newCamera("scopeCam")
      mCamera2 = g3DWorld.camera[2]
      mCamera2.yon = 300
      mCamera2.colorBuffer.clearAtRender = 0
      mCamera2.projectionAngle = 60
      pLeft = 362
      pTop = 12
      pwidth = 137
      pheight = 103
      pRight = pLeft + pwidth
      pBottom = pTop + pheight
      mCamera2.rect = rect(pLeft, pTop, pRight, pBottom)
      mCamera2.transform = mCamera.transform.duplicate()
      repeat with i = 1 to g3DWorld.light.count
        g3DWorld.deleteLight(i)
      end repeat
      g3DWorld.directionalPreset = #topLeft
      theAmbientLight = g3DWorld.newLight("dirAmbient", #ambient)
      theAmbientLight.color = rgb(185, 185, 255)
      gProgStep = gProgStep + 1
      PREPMODE = 20
    20:
      createTexture("txDirt", "particle_dirt", #rgba4444, 0, #low)
      createTexture("txMud", "particle_mud", #rgba4444, 0, #low)
      createTexture("txWater", "particle_water", #rgba4444, 0, #low)
      createTexture("txSnow", "snow_flake", #rgba4444, 0, #low)
      createTexture("txRipple", "water_ripple", #rgba4444, 0, #low)
      createTexture("txBubble", "particle_bubble", #rgba4444, 0, #low)
      gExplosionSet = []
      repeat with i = 18 to 50
        t = g3DWorld.newTexture("txExplosion" & i, #fromCastMember, member("kaboom00" & i))
        t.renderFormat = #rgba4444
        t.quality = #low
        t.nearFiltering = 0
        gExplosionSet.append(t)
      end repeat
      gTextures.addProp("txExplosion", gExplosionSet)
      gProgStep = gProgStep + 1
      PREPMODE = 21
    21:
      ovInterface_bracket_L = createOverlay(mCamera, "ovInterface_bracket_L", "Interface_bracket_L", #rgba4444, 0, #low, 0, point(8, 9), 0)
      ovInterface_bracket_R = createOverlay(mCamera, "ovInterface_bracket_R", "Interface_bracket_R", #rgba4444, 0, #low, 0, point(8, 9), 0)
      ovInterface_Txt = createOverlay(mCamera, "ovInterface_Txt", "Interface_Txt_Blades", #rgba4444, 0, #low, 0, point(20, 24), 0)
      ovInterface_Panel = createOverlay(mCamera, "ovInterface_Info", "Interface_Info", #rgba4444, 0, #low, 100, point(6, 350), 0)
      tName = "Interface_DamageBar"
      if not g3DWorld.texture(tName) then
        DamageImage = image(0, 11, 24)
        DamageImage.copyPixels(member(tName).image, rect(365, 0, 366, 11), rect(0, 0, 0, 11))
        t = g3DWorld.newTexture("ovInterface_DamageBar", #fromImageObject, DamageImage)
        t.renderFormat = #rgba8880
        t.nearFiltering = 0
        t.quality = #low
        gTextures.addProp(tName, t)
      else
        t = g3DWorld.texture(tName)
      end if
      ovInterface_DamageBar = createOverlay(mCamera, "ovInterface_DamageBar", "Interface_DamageBar", #rgba4444, 0, #low, 100, point(8, 365), 0)
      ovInterface_DamageBarEnd = createOverlay(mCamera, "ovInterface_DamageBarEnd", "Interface_DamageBarEnd", #rgba4444, 0, #low, 100, point(9, 365), 0)
      damageImageSource = member("Interface_DamageBar").image
      ovOxygen_Panel = createOverlay(mCamera, "ovInterface_OxygenPanel", "Interface_OxygenPanel", #rgba4444, 0, #low, 0, point(6, 320), 0)
      tName = "Interface_OxygenBar"
      if not g3DWorld.texture(tName) then
        OxygenImage = image(0, 11, 24)
        OxygenImage.copyPixels(member(tName).image, rect(365, 0, 366, 11), rect(0, 0, 0, 11))
        t = g3DWorld.newTexture("ovInterface_OxygenBar", #fromImageObject, OxygenImage)
        t.renderFormat = #rgba8880
        t.nearFiltering = 0
        t.quality = #low
        gTextures.addProp(tName, t)
      else
        t = g3DWorld.texture(tName)
      end if
      ovInterface_OxygenBar = createOverlay(mCamera, "ovInterface_OxygenBar", "Interface_OxygenBar", #rgba4444, 0, #low, 0, point(8, 335), 0)
      ovInterface_OxygenBarEnd = createOverlay(mCamera, "ovInterface_OxygenBarEnd", "Interface_OxygenBarEnd", #rgba4444, 0, #low, 0, point(9, 335), 0)
      ovInterface_Pic = createOverlay(mCamera, "ovInterface_Pic", "Interface_Pic_Candy", #rgba4444, 0, #low, 0, point(284, 250), 0)
      createTexture("Digit_0", "Digit_0", #rgba4444, 0, #low)
      createTexture("Digit_1", "Digit_1", #rgba4444, 0, #low)
      createTexture("Digit_2", "Digit_2", #rgba4444, 0, #low)
      createTexture("Digit_3", "Digit_3", #rgba4444, 0, #low)
      createTexture("Digit_4", "Digit_4", #rgba4444, 0, #low)
      createTexture("Digit_5", "Digit_5", #rgba4444, 0, #low)
      createTexture("Digit_6", "Digit_6", #rgba4444, 0, #low)
      createTexture("Digit_7", "Digit_7", #rgba4444, 0, #low)
      createTexture("Digit_8", "Digit_8", #rgba4444, 0, #low)
      createTexture("Digit_9", "Digit_9", #rgba4444, 0, #low)
      createTexture("BigDigit_0", "BigDigit_0", #rgba4444, 0, #low)
      createTexture("BigDigit_1", "BigDigit_1", #rgba4444, 0, #low)
      createTexture("BigDigit_2", "BigDigit_2", #rgba4444, 0, #low)
      createTexture("BigDigit_3", "BigDigit_3", #rgba4444, 0, #low)
      createTexture("BigDigit_4", "BigDigit_4", #rgba4444, 0, #low)
      createTexture("BigDigit_5", "BigDigit_5", #rgba4444, 0, #low)
      createTexture("BigDigit_6", "BigDigit_6", #rgba4444, 0, #low)
      createTexture("BigDigit_7", "BigDigit_7", #rgba4444, 0, #low)
      createTexture("BigDigit_8", "BigDigit_8", #rgba4444, 0, #low)
      createTexture("BigDigit_9", "BigDigit_9", #rgba4444, 0, #low)
      createTexture("BigDigit_rd", "BigDigit_rd", #rgba4444, 0, #low)
      createTexture("BigDigit_st", "BigDigit_st", #rgba4444, 0, #low)
      createTexture("BigDigit_nd", "BigDigit_nd", #rgba4444, 0, #low)
      createTexture("BigDigit_th", "BigDigit_th", #rgba4444, 0, #low)
      tPos = 491
      tStep = 13
      ovScore_6 = createOverlay(mCamera, "ovScore_6", "Digit_0", #rgba4444, 0, #low, 100, point(tPos - (tStep * 5), 365), 0)
      ovScore_5 = createOverlay(mCamera, "ovScore_5", "Digit_0", #rgba4444, 0, #low, 100, point(tPos - (tStep * 4), 365), 0)
      ovScore_4 = createOverlay(mCamera, "ovScore_4", "Digit_0", #rgba4444, 0, #low, 100, point(tPos - (tStep * 3), 365), 0)
      ovScore_3 = createOverlay(mCamera, "ovScore_3", "Digit_0", #rgba4444, 0, #low, 100, point(tPos - (tStep * 2), 365), 0)
      ovScore_2 = createOverlay(mCamera, "ovScore_2", "Digit_0", #rgba4444, 0, #low, 100, point(tPos - (tStep * 1), 365), 0)
      ovScore_1 = createOverlay(mCamera, "ovScore_1", "Digit_0", #rgba4444, 0, #low, 100, point(tPos - (tStep * 0), 365), 0)
      ovPlace_1 = createOverlay(mCamera, "ovPlace_1", "BigDigit_0", #rgba4444, 0, #low, 100, point(430, 24), 0)
      ovPlace_2 = createOverlay(mCamera, "ovPlace_2", "BigDigit_0", #rgba4444, 0, #low, 100, point(455, 24), 0)
      ovPlace_3 = createOverlay(mCamera, "ovPlace_3", "BigDigit_st", #rgba4444, 0, #low, 100, point(479, 24), 0)
      ovPlace_L = createOverlay(mCamera, "ovPlace_bracket_L", "Interface_bracket_L", #rgba4444, 0, #low, 100, point(420, 9), 0)
      ovPlace_R = createOverlay(mCamera, "ovPlace_bracket_R", "Interface_bracket_R", #rgba4444, 0, #low, 100, point(496, 9), 0)
      if gPosition < 10 then
        mCamera.overlay[ovPlace_1].blend = 0
        mCamera.overlay[ovPlace_2].source = gTextures.getProp("BigDigit_" & string(gPosition).char[1..1])
      else
        mCamera.overlay[ovPlace_1].blend = 100
        mCamera.overlay[ovPlace_1].source = gTextures.getProp("BigDigit_" & string(gPosition).char[1..1])
        mCamera.overlay[ovPlace_2].source = gTextures.getProp("BigDigit_" & string(gPosition).char[2..2])
      end if
      case gPosition of
        1:
          mCamera.overlay[ovPlace_3].source = gTextures.getProp("BigDigit_st")
        2:
          mCamera.overlay[ovPlace_3].source = gTextures.getProp("BigDigit_nd")
        3:
          mCamera.overlay[ovPlace_3].source = gTextures.getProp("BigDigit_rd")
        otherwise:
          mCamera.overlay[ovPlace_3].source = gTextures.getProp("BigDigit_th")
      end case
      ovHelp = createOverlay(mCamera, "ovHelp", "helpPanel", #rgba4444, 0, #low, 100, point(8, 180), 0)
      ovInterface = createOverlay(mCamera, "ovInterface", "TITLE_" & gameLevel, #rgba5550, 0, #low, 100, point(0, 0), 0)
      gProgStep = gProgStep + 1
      PREPMODE = 40
    40:
      Snd_EnemyScream = member("enemy_scream")
      Snd_WhereistheCar = member("sp_where_is_car")
      Snd_NowitsGone = member("sp_now_its_gone")
      Snd_ThatsaRobot = member("sp_a_remote_robot")
      Snd_WrongWay = member("sp_get_back_into_race")
      Snd_Saw = member("saw")
      Snd_Robot1 = member("robot_launch")
      Snd_Robot2 = member("robot_fly")
      Snd_Candy = [member("spr_isnt_that_delicious"), member("spr_laugh"), member("spr_save_some"), member("spr_yummy")]
      Snd_Repair = [member("sp_its_fine_now"), member("spa_fixing_is_my_job")]
      Snd_Effect = member("effect")
      Snd_MusicGoSpeedGo = member("music_gospeed")
      Snd_MusicLoop1 = member("sr_loop_1_1")
      Snd_MusicLoop2 = member("sr_loop_1_2")
      Snd_MusicLoop3 = member("sr_loop_1_3")
      Snd_MusicLoop4 = member("duggaryBuild")
      Snd_MusicLoop5 = member("duggaryIntro")
      Snd_MusicGameOver = member("music_gameover")
      Snd_Crash1 = member("crash_sm")
      Snd_Crash2 = member("crash_sm2")
      Snd_Crash3 = member("crash_lg")
      Snd_M5Jump = member("m5_jump")
      Snd_M5BladesOn = member("m5_blades_on")
      Snd_M5BladesLoop = member("m5_blades_loop")
      Snd_M5BladesOff = member("m5_blades_off")
      Snd_M5Grip = member("m5_grip_tires")
      Snd_M5Parascope = member("m5_parascope")
      Snd_M5Lights = member("m5_headlights")
      Snd_M5EngineStart = member("drive_takeoff")
      Snd_M5EngineLoop = member("drive_loop")
      Snd_SkidPav = member("loop_skid_pavement")
      Snd_SkidDrt = member("loop_skid_dirt")
      Snd_FX_Underwater = member("loop_underwater")
      Snd_FX_Splash = member("_inwater_splash")
      Snd_FX_InWater = member("_inwater_loop")
      Snd_FX_Chirp = member("m5_chirp")
      Snd_FX_Pass1 = member("m5_drive_by1")
      Snd_FX_Pass2 = member("m5_drive_by2")
      Snd_EnemyScream_1 = member("enemy_scream3")
      Snd_HitReaction_1 = member("sp_aawww")
      Snd_HitReaction_2 = member("sp_got_to_pass")
      Snd_HitReaction_3 = member("spr_aww")
      Snd_HitReaction_4 = member("spr_look_out")
      Snd_HitReaction_5 = member("spr_their_up_to")
      Snds_HitReactions = [Snd_HitReaction_1, Snd_HitReaction_3, Snd_HitReaction_4, Snd_HitReaction_5]
      gProgStep = gProgStep + 1
      PREPMODE = 50
    50:
      gWaterObj = []
      pathList = []
      pickupObj = []
      gDeadTreeList = []
      SEG_TRK = [[], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], []]
      SEG_OBJ = [[], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], []]
      SEG_PIC = [[], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], []]
      SEG_TRE = [[], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], []]
      gCarDuggery = g3DWorld.cloneModelFromCastmember("carDuggery", "car_bodyDuggery", member("Car_Enemy"))
      gCarDuggery.visibility = #none
      tTreeArr = []
      tTrackArr = []
      tPickupArr = []
      tWallArr = []
      tInvArr = []
      repeat with i = 1 to g3DWorld.model.count
        tmodel = g3DWorld.model[i]
        tName = chars(tmodel.name, 1, 3)
        tSEG = (integer(tmodel.transform.position.y) / 300) + 1
        if tName = "FAL" then
          myID = integer(chars(tmodel.name, 8, 9))
          if chars(tmodel.name, 11, 13) = "TGR" then
            tmodel.userData.addProp(#kind, "trigger")
            tmodel.userData.addProp(#myID, myID)
            tmodel.userData.addProp(#myFaller, g3DWorld.model("FALLER_" & chars(tmodel.name, 8, 9) & "_OBJ").name)
            tmodel.visibility = #none
            tmodel.addModifier(#collision)
            tmodel.collision.resolve = 0
            tmodel.collision.enabled = 0
            tmodel.collision.mode = #box
            tmodel.collision.immovable = 1
            tmodel.collision.setCollisionCallback(#doFaller, member("handlePickups"))
            SEG_PIC[tSEG].append(tmodel)
          else
            if chars(tmodel.name, 11, 13) = "OBJ" then
              tmodel.userData.addProp(#myID, myID)
              tmodel.addModifier(#meshDeform)
              tmodel.userData.addProp(#kind, "faller")
              tRB = gHavok.makeMovableRigidBody(tmodel.name, 508500, 0)
              tRB.pinned = 1
              tmodel.visibility = #front
            end if
          end if
          next repeat
        end if
        if chars(tmodel.name, 1, 6) = "Finish" then
          tmodel.visibility = #none
          next repeat
        end if
        if tName = "Car" then
          tmodel.visibility = #none
          next repeat
        end if
        if tName = "pat" then
          pntLoc = point(integer(tmodel.transform.position.x), integer(tmodel.transform.position.y))
          pntNum = integer(chars(tmodel.name, 6, 8))
          pathList[pntNum] = [pntLoc, 0, ceil(tmodel.transform.position.z)]
          tmodel.removeFromWorld()
          tmodel.visibility = #none
          next repeat
        end if
        if tName = "Wat" then
          tmodel.userData.addProp(#myPos, tmodel.transform.position)
          tmodel.visibility = #both
          gWaterObj.append(tmodel)
          next repeat
        end if
        if tName = "RAI" then
          tmodel.addModifier(#meshDeform)
          t = gHavok.makeFixedRigidBody(tmodel.name, 0)
          t.restitution = 0
          t.friction = 0
          tmodel.visibility = #both
          tmodel.userData.addProp(#kind, "solid")
          SEG_OBJ[tSEG].append(tmodel)
          next repeat
        end if
        if tName = "INV" then
          tInvArr.append(tmodel)
          next repeat
        end if
        if tName = "WAL" then
          tWallArr.append(tmodel)
          next repeat
        end if
        if tName = "pic" then
          tPickupArr.append(tmodel)
          next repeat
        end if
        if tName = "Tre" then
          tTreeArr.append(tmodel)
          next repeat
        end if
        if tName = "SEG" then
          tTrackArr.append(tmodel)
        end if
      end repeat
      gProgStep = gProgStep + 1
      PREPMODE = 51
    51:
      put "> 51"
      repeat with tmodel in tTreeArr
        tSEG = (integer(tmodel.transform.position.y) / 300) + 1
        tmodel.visibility = #front
        tmodel.shader.texture.renderFormat = #rgba4444
        tmodel.shader.texture.nearFiltering = 0
        tmodel.addModifier(#meshDeform)
        test = gHavok.makeFixedRigidBody(tmodel.name, 1)
        tmodel.userData.addProp(#kind, "tree")
        tmodel.userData.addProp(#myPos, tmodel.transform.position)
        tmodel.addModifier(#collision)
        tmodel.collision.resolve = 0
        tmodel.collision.enabled = 0
        tmodel.collision.mode = #sphere
        tmodel.collision.immovable = 1
        tmodel.collision.setCollisionCallback(#doHitTree, member("handlePickups"))
        SEG_TRE[tSEG].append(tmodel)
      end repeat
      tTreeArr = VOID
      gProgStep = gProgStep + 1
      PREPMODE = 52
    52:
      put "> 52"
      repeat with tmodel in tTrackArr
        tSEG = integer(chars(tmodel.name, 5, 6))
        tmodel.addModifier(#meshDeform)
        tmodel.userData.addProp(#kind, "track")
        t = gHavok.makeFixedRigidBody(tmodel.name, 0)
        t.restitution = 0
        t.friction = 0
        tmodel.shader.texture.renderFormat = #rgba5550
        tmodel.shader.texture.nearFiltering = 0
        tmodel.visibility = #front
        SEG_TRK[tSEG] = tmodel
      end repeat
      tTrackArr = VOID
      gProgStep = gProgStep + 1
      PREPMODE = 53
    53:
      put "> 53"
      repeat with tmodel in tPickupArr
        tSEG = (integer(tmodel.transform.position.y) / 300) + 1
        pickupObj.append(tmodel)
        tmodel.visibility = #front
        tmodel.addModifier(#collision)
        tmodel.collision.resolve = 0
        tmodel.collision.enabled = 0
        tmodel.collision.mode = #sphere
        tmodel.collision.immovable = 1
        if chars(tmodel.name, 8, 13) = "Wrench" then
          tmodel.collision.setCollisionCallback(#doPickupWrench, member("handlePickups"))
          tmodel.shaderList[1].texture.renderFormat = #rgba4444
        else
          if chars(tmodel.name, 8, 18) = "CandyPurple" then
            tmodel.collision.setCollisionCallback(#doPickupCandyPurple, member("handlePickups"))
            tmodel.shaderList[1].texture.renderFormat = #rgba4444
          else
            if chars(tmodel.name, 8, 15) = "CandyRed" then
              tmodel.collision.setCollisionCallback(#doPickupCandyRed, member("handlePickups"))
              tmodel.shaderList[1].texture.renderFormat = #rgba4444
            else
              if chars(tmodel.name, 8, 13) = "Oxegen" then
                tmodel.collision.setCollisionCallback(#doPickupOxegen, member("handlePickups"))
                tmodel.shaderList[1].texture.renderFormat = #rgba4444
              else
                if chars(tmodel.name, 8, 12) = "Robot" then
                  tmodel.collision.setCollisionCallback(#doPickupRobot, member("handlePickups"))
                  tmodel.shaderList[1].texture.renderFormat = #rgba4444
                end if
              end if
            end if
          end if
        end if
        SEG_PIC[tSEG].append(tmodel)
      end repeat
      tPickupArr = VOID
      gProgStep = gProgStep + 1
      PREPMODE = 54
    54:
      repeat with tmodel in tWallArr
        tSEG = (integer(tmodel.transform.position.y) / 300) + 1
        tmodel.addModifier(#meshDeform)
        t = gHavok.makeFixedRigidBody(tmodel.name, 0)
        t.friction = 0
        tmodel.visibility = #front
        tmodel.userData.addProp(#kind, "solid")
        SEG_OBJ[tSEG].append(tmodel)
      end repeat
      tWallArr = VOID
      gProgStep = gProgStep + 1
      PREPMODE = 55
    55:
      repeat with tmodel in tInvArr
        tSEG = (integer(tmodel.transform.position.y) / 300) + 1
        tmodel.addModifier(#meshDeform)
        t = gHavok.makeFixedRigidBody(tmodel.name, 0)
        t.friction = 0
        tmodel.userData.addProp(#kind, "solid")
        tmodel.visibility = #none
        SEG_OBJ[tSEG].append(tmodel)
      end repeat
      tInvArr = VOID
      gProgStep = gProgStep + 1
      PREPMODE = 60
    60:
      sendSprite(2, #prepareCar)
      gProgStep = gProgStep + 1
      PREPMODE = PREPMODE + 1
    61:
      gCarsPrepared = 1
      sendSprite(2, #checkPrepared)
      if gCarsPrepared = 1 then
        sendSprite(2, #startCar)
        gProgStep = gProgStep + 1
        PREPMODE = PREPMODE + 1
      end if
    62:
      gCarsReady = 1
      sendSprite(2, #checkReady)
      if gCarsReady = 1 then
        doCamera()
        sprite(2).locH = 256
        sprite(2).visible = 1
        isPlaying = 0
        gLevelStartTIMER = the ticks
        _player.cursor(200)
        PREPMODE = PREPMODE + 1
      end if
    63:
      doCamera()
      mCamera.overlay[ovInterface].blend = max(0, mCamera.overlay[ovInterface].blend - 5)
      if (mCamera.overlay[ovInterface].blend <= 0) and (SndC_Music.isBusy() = 0) then
        mCamera.removeOverlay(ovInterface)
        gGoPlayed = 0
        PREPMODE = 100
        go("PLAY")
      end if
  end case
  go(the frame)
end
