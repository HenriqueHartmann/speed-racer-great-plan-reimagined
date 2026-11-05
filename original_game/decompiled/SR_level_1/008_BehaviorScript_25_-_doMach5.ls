property pIsLanding, pIsLandingTIMER, pTurnBuild, pTrackFace, pTrackFacePrev, forwardVel, pBladesTIMER, pDeflectorTIMER, pGripTIMER, pSEG, pSEG_PREV, pTrack, pSourceMember, pChassisName, pCarCollider, pCarBody, pLocalDown, pLocalForward, pLocalRight, pUserCar, pCarName, pCarShadow, pBumperPos, pParticlePos, pEffectFactor, pWheelNameA, pWheelNameB, pWheelNameC, pWheelNameD, pwidth, pFrontWheelBase, pBackWheelBase, pWheelRadius, pStrength, pDamping, pHoverDist, pMaxWheelTurn, pWheelSpinCoeff, pWheelList, pWheelPointList, pIsHoveringList, pHoverDistList, pGravityStrength, pChassisWeigth, pMaxSpeed, pMaxTurnSpeed, pMinTurnSpeed, pAccGain, pDecGain, pBrakeGain, pTurnGain, pXtraTurnGain, pGrip, pDrag, pBoost, pScalar, pCarMass, pMember, pSprite, spriteNum, pChassisRB, pChassisMass, pChassisMDL, pWheelTurn, pWheelSpin, pLastCarTransform, pIsPrepared, pIsStarted, pIsReady, pCollisionTimeout, pmrDirtKick, pDirtKick, pParticlePosDirt, pParticlePosWater, pParticlePosBubbles, pHasBlades, pHasGrip, pHasLights, pHasScope, pHasJacks, pHasShield, pCarShell, pPowerCoeff, pCarWindshield, pCarJacks, pCarShield, pSheildRotate, pBladeFactor, pCarSaws, pCarLights, pCarScopeDoor, pCarScopeTop, pCarScopeBar, pCarSpeed, pGripA, pGripB, pGripC, pGripD, pCarTop, pGrass, jacks_TIMER, posRobotStart, pHasRobot, pRobotTargetID, lastHitModel, deflectorStack, speedScreamPlayed, pmrSparks, pSparks, pTurnBuildFactor, angDashpot, tMaxY, kRightIsDown, kLeftIsDown, kForwardIsDown, kBackwardIsDown, pShadowVisible, pShadowPnt_3, pShadowPnt_4
global mMach5Blades, gEffects, SEG_TRE, SEG_TRK, SEG_OBJ, SEG_PIC, gSEG, gDamage, gOxygen, isPlaying, SCOPEMODE, isUnderWater, gHavok, g3DWorld, gTextures, mCamera, mCamera2, mRobot, mMach5, mMach5Shadow, mMach5Shell, Snd_WrongWay, mBridge, mDirtKick, mrDirtKick, gameLighting, theAmbientLight, wasUnderWater, gMach5InAir, gCarsPrepared, gCarsReady, PREPMODE, gROBOTMODE, gRobotTarget, gRobotTarget_z, gRobotTarget_Cur, gRobotTarget_Ideal, gRobotTarget_Step, enemyContolTIMER, levelstartTIMER, enemyDistArr, enemyScriptArr, InterfaceTxtTEXT, InterfaceTxtMODE, InterfacePicMODE, InterfacepicIMG, gLevelStartTIMER, gOxygenMODE, ovOxygen_Panel, ovInterface_OxygenBar, ovInterface_OxygenBarEnd, kForward, kBackward, kRight, kLeft, kJacks, gEffectImage, gEffectBlack, gEffectRoad, gEffectDirt, gEffectMud, gEffectSnow, gEffectGrass, gEffectTallGrass, gEffectWater, gEffectDeepWater, effectID, SndC_Music, SndC_M5Grnd, SndC_M5FX, SndC_EnemyFX, SndC_VO, SndC_M5Engine, SndC_M5FX2, Snd_MusicLoop1, Snd_MusicLoop2, Snd_MusicLoop3, Snd_MusicLoop4, Snd_MusicLoop5, Snd_Robot1, Snd_Robot2, Snd_MusicGoSpeedGo, Snd_MusicLoop, Snd_Crash1, Snd_Crash2, Snd_M5Jump, Snd_M5BladesOn, Snd_M5BladesLoop, Snd_M5BladesOff, Snd_M5Grip, Snd_M5Parascope, Snd_M5EngineStart, Snd_M5EngineLoop, Snd_SkidPav, Snd_SkidDrt, Snd_FX_Underwater, Snd_FX_Splash, Snd_FX_InWater, Snd_MusicTitle, Snd_MusicGameOver, Snd_HitReaction_1, Snd_HitReaction_2, Snd_HitReaction_3, Snd_HitReaction_4, Snd_HitReaction_5, Snds_HitReactions, Snd_EnemyScream, Snd_ThatsaRobot, Snd_WhereistheCar, Snd_NowitsGone, Snd_M5Lights, Snd_FX_Chirp, gPosition, isGameOver, gM5Speed, gM5MaxSpeed

on startCar me
  pIsStarted = 1
end

on checkPrepared me
  if pIsPrepared = 0 then
    gCarsPrepared = 0
  end if
end

on checkReady me
  put "MACH 5 " & pIsReady
  if pIsReady = 0 then
    gCarsReady = 0
  end if
end

on beginSprite me
  tMaxY = 0
  gROBOTMODE = 0
  deflectorStack = 0
  pSprite = sprite(me.spriteNum)
  pMember = pSprite.member
  pIsPrepared = 0
  pIsStarted = 0
  pIsReady = 0
  gMach5InAir = 0
  wasUnderWater = 0
  pHasBlades = 0
  pHasGrip = 0
  pHasLights = 0
  pHasScope = 0
  pHasJacks = 0
  pHasRobot = 0
  pROBOTMODE = 0
  jacks_TIMER = the ticks
  speedScreamPlayed = 0
  pTrackFace = 0
  pTrackFaceLast = 99
  pTurnBuild = 0
  pTurnBuildFactor = 0.29999999999999999
  pIsLanding = 0
  pIsLandingTIMER = 0
  pAccGain = 0.10000000000000001
  pDecGain = 0.02
  pTurnBuild = 0
  pMaxSpeed = 69
  gM5MaxSpeed = pMaxSpeed
  pTurnBuildFactor = 0.29999999999999999
  pGripFactor = 10
  pBrakeGain = 0.29999999999999999
  pCarMass = 30000
  pwidth = 1.55
  pFrontWheelBase = 1.2
  pBackWheelBase = 1.2
  pWheelRadius = 0.34999999999999998
  pStrength = 3.0
  pDamping = 0.050000000000000003
  pScalar = 1.0
  pHoverDist = 1.2
  pMaxWheelTurn = 45
  pWheelSpinCoeff = 2
  pWheelSpin = 0
end

on enterFrame me
  if pIsStarted = 0 then
    return 
  end if
  me.updateHover()
end

on exitFrame me
  if pIsStarted = 0 then
    return 
  end if
  kRightIsDown = keyPressed(kRight)
  kLeftIsDown = keyPressed(kLeft)
  kForwardIsDown = keyPressed(kForward)
  kBackwardIsDown = keyPressed(kBackward)
  me.updateCar()
end

on prepareCar me
  pSheildRotate = 80
  pAccGain = 0.070000000000000007
  pDecGain = 0.040000000000000001
  pLocalDown = vector(0, 0, -1)
  pLocalForward = vector(0, 1, 0)
  member(pSourceMember).resetWorld()
  member(pSourceMember).revertToWorldDefaults()
  pCarBody = g3DWorld.cloneModelFromCastmember(pCarName & pChassisName, "collider", member("Car_Mach5"))
  pCarBody.addModifier(#meshDeform)
  pCarBody.visibility = #none
  pCarBody.userData.addProp(#kind, "userCar")
  pCarBody.userData.addProp(#blades, 0)
  pCarBody.userData.addProp(#stepPos, vector(0, 0, 0))
  mMach5 = pCarBody
  pCarShell = g3DWorld.cloneModelFromCastmember(pCarName & pChassisName & "shell", pChassisName, member(pSourceMember))
  mMach5Shell = pCarShell
  pCarWindshield = g3DWorld.cloneModelFromCastmember(pCarName & "CarWindshield", "windshield", member(pSourceMember))
  pCarShield = g3DWorld.cloneModelFromCastmember(pCarName & "CarShield", "windshield_top", member(pSourceMember))
  pCarWindshield.visibility = #both
  pCarJacks = g3DWorld.cloneModelFromCastmember(pCarName & "carJacks", "jacks", member(pSourceMember))
  pCarScopeDoor = g3DWorld.cloneModelFromCastmember(pCarName & "CarScopeDoor", "scope_door", member(pSourceMember))
  pCarScopeTop = g3DWorld.cloneModelFromCastmember(pCarName & "CarScopeTop", "scope_top", member(pSourceMember))
  pCarScopeBar = g3DWorld.cloneModelFromCastmember(pCarName & "CarScopeBar", "scope_bar", member(pSourceMember))
  pCarSaws = g3DWorld.cloneModelFromCastmember(pCarName & "CarSaws", "saw", member(pSourceMember))
  pCarSaws.shaderList[7].texture.renderFormat = #rgba4444
  pCarSaws.shaderList[7].blend = 60
  pCarSaws.addModifier(#collision)
  pCarSaws.collision.resolve = 0
  pCarSaws.collision.mode = #sphere
  pCarSaws.userData.addProp(#kind, "m5Blades")
  mMach5Blades = pCarSaws
  pCarLights = g3DWorld.cloneModelFromCastmember(pCarName & "CarLights", "lights", member(pSourceMember))
  pGripA = g3DWorld.cloneModelFromCastmember(pCarName & "grip_FL", "mach5_grip_FL", member(pSourceMember))
  pGripB = g3DWorld.cloneModelFromCastmember(pCarName & "grip_FR", "mach5_grip_FR", member(pSourceMember))
  pGripC = g3DWorld.cloneModelFromCastmember(pCarName & "grip_RR", "mach5_grip_RR", member(pSourceMember))
  pGripD = g3DWorld.cloneModelFromCastmember(pCarName & "grip_RL", "mach5_grip_RL", member(pSourceMember))
  mRobot = g3DWorld.cloneModelFromCastmember(pCarName & "Robot", "robot", member(pSourceMember))
  mRobot.visibility = #none
  mRobot.scale(2, 2, 2)
  mRobot.pointAtOrientation = [vector(0.0, 1.0, 0.0), vector(0.0, 0.0, 1.0)]
  pCarScopeDoor.visibility = #front
  pCarScopeTop.visibility = #none
  pCarScopeBar.visibility = #none
  pCarSaws.visibility = #none
  pCarLights.visibility = #none
  pCarLights.shader.texture.renderFormat = #rgba4444
  pGripA.visibility = #none
  pGripB.visibility = #none
  pGripC.visibility = #none
  pGripD.visibility = #none
  pCarSaws.shaderList[3].texture.renderFormat = #rgba5551
  pCarSaws.shaderList[3].texture.quality = #medium
  pCarSaws.shaderList[3].texture.nearFiltering = 0
  pSEG = (integer(g3DWorld.model("carPos_Mach5").transform.position.y) / 300) + 1
  gSEG = pSEG
  pTrack = SEG_TRK[pSEG]
  pSEG_PREV = 0
  details = pMember.modelsUnderRay(g3DWorld.model("carPos_Mach5").transform.position, vector(0, 0, -1), [#maxNumberOfModels: 1, #levelOfDetail: #detailed, #modelList: [pTrack], #maxDistance: 2])
  pCarBody.transform.position = details[1][3] + vector(0, 0, 1)
  pCarShadow = g3DWorld.cloneModelFromCastmember(pCarName & "Shadow", "car_shadow", member(pSourceMember))
  pCarShadow.transform.position = g3DWorld.model("carPos_Mach5").transform.position
  pCarShadow.shader.texture.renderFormat = #rgba4444
  pCarShadow.shader.texture.nearFiltering = 0
  mMach5Shadow = pCarShadow
  pWheelA = g3DWorld.cloneModelFromCastmember(pCarName & pWheelNameA, pWheelNameA, member(pSourceMember))
  pWheelB = g3DWorld.cloneModelFromCastmember(pCarName & pWheelNameB, pWheelNameB, member(pSourceMember))
  pWheelC = g3DWorld.cloneModelFromCastmember(pCarName & pWheelNameC, pWheelNameC, member(pSourceMember))
  pWheelD = g3DWorld.cloneModelFromCastmember(pCarName & pWheelNameD, pWheelNameD, member(pSourceMember))
  pWheelNameA = pCarName & pWheelNameA
  pWheelNameB = pCarName & pWheelNameB
  pWheelNameC = pCarName & pWheelNameC
  pWheelNameD = pCarName & pWheelNameD
  pChassisName = pCarName & pChassisName
  updateStage()
  gHavok.makeMovableRigidBody(pCarBody.name, pCarMass, 1)
  gHavok.registerInterest(pCarBody.name, #all, 5, 0.5, #collisionHandler, me)
  pChassisRB = gHavok.rigidBody(pChassisName)
  pChassisMass = pChassisRB.mass
  pChassisRB.friction = 0
  pChassisRB.restitution = 0
  doM5ChangeSegment(pCarBody, 0, pSEG)
  pGravityStrength = gHavok.gravity.length
  pChassisWeigth = pChassisMass * pGravityStrength
  pChassisMDL = pMember.model(pChassisName)
  pWheelList = [pMember.model(pWheelNameA), pMember.model(pWheelNameB), pMember.model(pWheelNameC), pMember.model(pWheelNameD)]
  pIsHoveringList = [0, 0, 0, 0]
  pHoverDistList = [0.0, 0.0, 0.0, 0.0]
  com = pChassisRB.centerOfMass
  pLocalForward.normalize()
  pLocalDown.normalize()
  pLocalRight = pLocalDown.cross(pLocalForward)
  pLocalRight.normalize()
  posA = com + (pFrontWheelBase * pLocalForward) + (pwidth * 0.5 * -pLocalRight)
  posB = com + (pFrontWheelBase * pLocalForward) + (pwidth * 0.5 * pLocalRight)
  posC = com + (pBackWheelBase * -pLocalForward) + (pwidth * 0.5 * pLocalRight)
  posD = com + (pBackWheelBase * -pLocalForward) + (pwidth * 0.5 * -pLocalRight)
  pWheelPointList = [posA, posB, posC, posD]
  pBumperPos = com + (pBackWheelBase * -pLocalForward)
  pParticlePosDirt = com + ((pBackWheelBase + 0.80000000000000004) * -pLocalForward)
  pParticlePosWater = com + (pFrontWheelBase * pLocalForward)
  pParticlePosBubbles = com + vector(0, 0, 0.5)
  pmrDirtKick = g3DWorld.newModelResource(pCarName & "mrDirtKick", #particle)
  pmrDirtKick.emitter.region = [vector(-0.80000000000000004, 0, 0), vector(0.80000000000000004, 0, 0)]
  pmrDirtKick.emitter.direction = vector(0, 0, 1)
  pmrDirtKick.lifeTime = 400.0
  pmrDirtKick.emitter.angle = 90
  pDirtKick = g3DWorld.newModel(pCarName & "mDirtKick", pmrDirtKick)
  pDirtKick.addToWorld()
  pDirtKick.visibility = #none
  pIsPrepared = 1
end

on collisionHandler me, collisionDetails
  hitmodel = collisionDetails[2]
  hitforce = collisionDetails[5]
  hitKind = g3DWorld.model(hitmodel).userData.kind
  if the ticks >= (pCollisionTimeout + 60) then
    if hitKind = "track" then
      put "HIT TRACK"
      return 
    else
      if hitKind = "faller" then
        gDamage = gDamage + min(30, hitforce * 10)
        SndC_M5FX.volume = 255
        SndC_M5FX.play(Snd_Crash1)
      else
        if hitKind = "enemyCar" then
          if pHasBlades = 1 then
            gDamage = gDamage + min(5, hitforce * 10)
          else
            gDamage = gDamage + min(30, hitforce * 10)
            if SndC_VO.isBusy() = 0 then
              SndC_VO.volume = 255
              SndC_VO.play(Snds_HitReactions[random(Snds_HitReactions.count)])
            end if
          end if
          SndC_M5FX.volume = 255
          SndC_M5FX.play(Snd_Crash1)
        else
          pChassisRB.angularVelocity[3] = pChassisRB.angularVelocity[3] * 0.20000000000000001
          if kBackwardIsDown = 0 then
            tHitMag = abs(forwardVel / 90)
            gDamage = gDamage + min(10, 30 * tHitMag)
            if not SndC_M5FX.isBusy() then
              SndC_M5FX.volume = min(255, 255 * (tHitMag * 4))
              SndC_M5FX.play(Snd_Crash1)
            end if
          end if
        end if
      end if
    end if
    pCollisionTimeout = the ticks
    lastHitModel = hitmodel
  end if
end

on keyDown
  if isPlaying = 0 then
    return 
  end if
  if (the key = "g") or (the key = "7") then
    if gROBOTMODE = 0 then
      tdist = min(enemyDistArr)
      pRobotTargetID = enemyDistArr.getPos(tdist)
      gRobotTarget = enemyScriptArr[pRobotTargetID].pCarShell
      gRobotTargetPos = enemyScriptArr[pRobotTargetID].pCarShell.transform.position
      targetPos = mCamera.worldSpaceToSpriteSpace(gRobotTargetPos)
      if targetPos = VOID then
        repeat with pRobotTargetID = 1 to 3
          gRobotTarget = enemyScriptArr[pRobotTargetID].pCarShell
          gRobotTargetPos = enemyScriptArr[pRobotTargetID].pCarShell.transform.position
          targetPos = mCamera.worldSpaceToSpriteSpace(gRobotTargetPos)
          if targetPos <> VOID then
            exit repeat
          end if
        end repeat
      end if
      if targetPos = VOID then
        SndC_VO.volume = 255
        SndC_VO.play(Snd_WhereistheCar)
      else
        tmodels = mCamera.modelsUnderLoc(targetPos)
        if (tmodels[1] = enemyScriptArr[pRobotTargetID].pCarShell) or (tmodels[2] = enemyScriptArr[pRobotTargetID].pCarShell) then
          SndC_M5FX2.volume = 255
          SndC_M5FX.volume = 255
          SndC_M5FX.play(Snd_Robot1)
          SndC_M5FX2.play(Snd_Robot2)
          gROBOTMODE = 1
          gRobotTarget_z = 2
          mRobot.visibility = #both
          mRobot.transform.position = mMach5.transform.position
          mRobot.transform.rotation = mMach5.transform.rotation
          mRobot.translate(0, 1.2, 0.59999999999999998)
          InterfaceTxtTEXT = "Robot"
          InterfaceTxtMODE = 1
          InterfacepicIMG = "Robot"
          InterfacePicMODE = 1
        else
          SndC_VO.volume = 255
          SndC_VO.play(Snd_WhereistheCar)
          put mCamera.modelUnderLoc(targetPos) & ", " & enemyScriptArr[pRobotTargetID].pCarShell
        end if
      end if
    else
      SndC_VO.volume = 255
      SndC_VO.play(Snd_NowitsGone)
    end if
  end if
  if (the key = "d") or (the key = "4") then
    if pHasShield = 0 then
      SndC_M5FX.volume = 255
      SndC_M5FX.play(Snd_M5Parascope)
      pDeflectorTIMER = the ticks + 500
      deflectorStack = deflectorStack + 1
      pHasShield = 1
      InterfaceTxtTEXT = "Deflector"
      InterfaceTxtMODE = 1
      InterfacepicIMG = "Deflector"
      InterfacePicMODE = 1
    else
      deflectorStack = deflectorStack - 1
      pHasShield = 0
    end if
  end if
  if (the key = "f") or (the key = "6") then
    if pHasScope = 0 then
      deflectorStack = deflectorStack + 1
      SndC_M5FX.volume = 255
      SndC_M5FX.play(Snd_M5Parascope)
      pHasScope = 1
      pHasShield = 1
      if SCOPEMODE = 0 then
        if isUnderWater = 0 then
          gOxygen = 100
        end if
        SCOPEMODE = 1
        InterfaceTxtTEXT = "Frogger"
        InterfaceTxtMODE = 1
        InterfacepicIMG = "Frogger"
        InterfacePicMODE = 1
      end if
    else
      deflectorStack = deflectorStack - 1
      pHasScope = 0
      pHasShield = 0
      if SCOPEMODE <> 0 then
        SCOPEMODE = 4
      end if
    end if
  end if
  if (the key = "c") or (the key = "3") then
    if pHasBlades = 0 then
      pBladesTIMER = the ticks + 240
      pCarBody.userData.blades = 1
      SndC_M5FX.volume = 255
      SndC_M5FX.play(Snd_M5BladesOn)
      SndC_M5FX.queue(Snd_M5BladesLoop)
      pBladeFactor = 0.10000000000000001
      pHasBlades = 1
      InterfaceTxtTEXT = "Blades"
      InterfaceTxtMODE = 1
      InterfacepicIMG = "Blades"
      InterfacePicMODE = 1
      if SEG_TRE[gSEG].count <> 0 then
        repeat with i = 1 to SEG_TRE[gSEG].count
          gHavok.disableCollision(pCarBody.name, SEG_TRE[gSEG][i].name)
          SEG_TRE[gSEG][i].collision.enabled = 1
        end repeat
      end if
    else
      if SEG_TRE[gSEG].count <> 0 then
        repeat with i = 1 to SEG_TRE[gSEG].count
          gHavok.enableCollision(pCarBody.name, SEG_TRE[gSEG][i].name)
          SEG_TRE[gSEG][i].collision.enabled = 0
        end repeat
      end if
      pCarBody.userData.blades = 0
      SndC_M5FX.volume = 255
      SndC_M5FX.play(Snd_M5BladesOff)
      pHasBlades = 0
    end if
  end if
  if (the key = "b") or (the key = "2") then
    if pHasGrip = 0 then
      pGripTIMER = the ticks + 500
      pHasGrip = 1
      SndC_M5FX.volume = 255
      SndC_M5FX.play(Snd_M5Grip)
      pGripA.visibility = #front
      pGripB.visibility = #front
      pGripC.visibility = #front
      pGripD.visibility = #front
      InterfaceTxtTEXT = "Grip"
      InterfaceTxtMODE = 1
      InterfacepicIMG = "Grip"
      InterfacePicMODE = 1
    else
      pHasGrip = 0
      pGripA.visibility = #none
      pGripB.visibility = #none
      pGripC.visibility = #none
      pGripD.visibility = #none
    end if
  end if
  if (the key = "e") or (the key = "5") then
    if pHasLights = 0 then
      SndC_M5FX.volume = 255
      SndC_M5FX.play(Snd_M5Lights)
      pHasLights = 1
      pCarLights.shaderList[1].blend = 20
      pCarLights.shaderList[2].blend = 30
      pCarLights.visibility = #front
      InterfaceTxtTEXT = "Lights"
      InterfaceTxtMODE = 1
      InterfacepicIMG = "Lights"
      InterfacePicMODE = 1
    else
      pHasLights = 0
      theAmbientLight.color = gameLighting
    end if
  end if
  if ((the key = kJacks) or (the key = "a") or (the key = "1")) and (pHasJacks = 0) and (pPowerCoeff = 1) then
    pHasJacks = 1
    pCarJacks.visibility = #front
    SndC_M5FX.volume = 255
    SndC_M5FX.play(Snd_M5Jump)
    pChassisRB.applyImpulse(vector(0, 0, pChassisMass * 40))
    jacks_TIMER = the ticks + 80
    InterfaceTxtTEXT = "Jacks"
    InterfaceTxtMODE = 1
    InterfacepicIMG = "Jacks"
    InterfacePicMODE = 1
  end if
end

on updateHover me
  tempTrans = pChassisMDL.transform.duplicate()
  tempTrans2 = tempTrans.duplicate()
  tempTrans.position = vector(0, 0, 0)
  tempTrans.scale = vector(1, 1, 1)
  worldDownDir = tempTrans * pLocalDown
  worldDownDir.normalize()
  linVel = pChassisRB.linearVelocity
  angVel = pChassisRB.angularVelocity
  chassisPos = pChassisRB.position + pChassisRB.centerOfMass
  repeat with i = 1 to pWheelPointList.count
    worldWheelPoint = tempTrans2 * pWheelPointList[i]
    tWheelSEG = (integer(worldWheelPoint.y) / 300) + 1
    pSEGpart = (tWheelSEG * 300) - worldWheelPoint.y
    if pSEGpart >= 298 then
      tTrackModel_1 = SEG_TRK[tWheelSEG]
      tTrackModel_2 = SEG_TRK[max(1, tWheelSEG - 1)]
      details = pMember.modelsUnderRay(worldWheelPoint, worldDownDir, [#maxNumberOfModels: 1, #levelOfDetail: #detailed, #modelList: [tTrackModel_1, tTrackModel_2], #maxDistance: 1])
    else
      if pSEGpart <= 2 then
        tTrackModel_1 = SEG_TRK[tWheelSEG]
        tTrackModel_2 = SEG_TRK[min(SEG_TRK.count, tWheelSEG + 1)]
        details = pMember.modelsUnderRay(worldWheelPoint, worldDownDir, [#maxNumberOfModels: 1, #levelOfDetail: #detailed, #modelList: [tTrackModel_1, tTrackModel_2], #maxDistance: 1])
      else
        tTrackModel = SEG_TRK[tWheelSEG]
        details = pMember.modelsUnderRay(worldWheelPoint, worldDownDir, [#maxNumberOfModels: 1, #levelOfDetail: #detailed, #modelList: [tTrackModel], #maxDistance: 1])
      end if
    end if
    if details <> [] then
      if i = 4 then
        pTrackFacePrev = pTrackFace
        pTrackFace = details[1][5]
        pShadowPnt_4 = details[1][3]
      else
        if i = 3 then
          pShadowPnt_3 = details[1][3]
        end if
      end if
      hoverDst = details[1][2]
      hoverPnt = details[1][3]
      pShadowVisible = 1
      if hoverDst < pHoverDist then
        pointVelocity = linVel + angVel.cross(worldWheelPoint - chassisPos)
        diff = hoverPnt - worldWheelPoint
        f = -pStrength * (pHoverDist - hoverDst)
        f = f - (pDamping * pointVelocity.dot(diff))
        pChassisRB.applyImpulseAtPoint(diff * f * pChassisMass, pWheelPointList[i])
        pIsHoveringList[i] = 1
        pHoverDistList[i] = hoverDst
      else
        pIsHoveringList[i] = 0
        pHoverDistList[i] = pHoverDist
      end if
      next repeat
    end if
    pShadowVisible = 0
    pIsHoveringList[i] = 0
    pHoverDistList[i] = pHoverDist
    pTrackFace = 99
  end repeat
end

on updateCar me
  tTrans = pCarBody.transform
  tPosition = tTrans.position
  tRotation = tTrans.rotation
  ty = tPosition.y
  tMaxY = max(ty, tMaxY)
  if (tPosition.y < (tMaxY - 100)) and (InterfaceTxtMODE = 0) then
    tMaxY = ty
    InterfaceTxtTEXT = "WrongWay"
    InterfaceTxtMODE = 1
    SndC_VO.play(Snd_WrongWay)
  end if
  if tPosition.y > (mMach5.userData.stepPos.y + 20) then
    mMach5.userData.stepPos = tPosition
  end if
  tSEG = (integer(ty) / 300) + 1
  if tSEG <> pSEG then
    pSEG_PREV = pSEG
    pSEG = tSEG
    gSEG = tSEG
    doM5ChangeSegment(pCarBody, pSEG_PREV, pSEG)
  end if
  if (ty >= 10921) and (isPlaying = 1) then
    put "CALLING: doFinish()"
    isPlaying = 0
    doFinish()
  end if
  pCarShell.transform = tTrans
  pCarWindshield.transform = tTrans
  pCarScopeDoor.transform.position = tPosition
  pCarScopeDoor.transform.rotation = tRotation
  case gROBOTMODE of
    0:
      nothing()
    1:
      t = transform()
      t.rotation = mMach5.transform.rotation
      gRobotTarget_Step = tPosition + (t * vector(0, 7, 3))
      mRobot.transform.rotation = mMach5.transform.rotation
      gRobotTarget_z = 9
      gROBOTMODE = 2
    2:
      gRobotTarget_z = 2
      gRobotTarget_Cur = gRobotTarget_Step
      gRobotTarget_Ideal = gRobotTarget.transform.position + vector(0, 0, gRobotTarget_z)
      gRobotTarget_Step = ((gRobotTarget_Ideal - gRobotTarget_Cur) * 0.90000000000000002) + gRobotTarget_Cur
      mRobot.pointAt(gRobotTarget_Step, vector(0, 0, 90))
      mRobot.translate(0, 3, 0)
      if mRobot.transform.position.distanceTo(gRobotTarget.transform.position + vector(0, 0, gRobotTarget_z)) < 2 then
        gROBOTMODE = 3
      end if
    3:
      gRobotTarget_z = 0.20000000000000001
      gRobotTarget_Cur = gRobotTarget_Step
      gRobotTarget_Ideal = gRobotTarget.transform.position + vector(0, 0, gRobotTarget_z)
      gRobotTarget_Step = ((gRobotTarget_Ideal - gRobotTarget_Cur) * 0.59999999999999998) + gRobotTarget_Cur
      mRobot.pointAt(gRobotTarget_Step, vector(0, 0, 90))
      tdist = mRobot.transform.position.distanceTo(gRobotTarget.transform.position)
      mRobot.translate(0, 5, 0)
      if tdist < 5 then
        mRobot.visibility = #none
        tvol = max(10, 100 - mMach5.transform.position.distanceTo(gRobotTarget.transform.position))
        SndC_EnemyFX.volume = 255 * (tvol / 100)
        enemyScriptArr[pRobotTargetID].controlMODE = 0
        if enemyScriptArr[pRobotTargetID].pCarBody.userData.isDuggary = 1 then
          SndC_VO.play(member("duggery_scream"))
        else
          SndC_EnemyFX.play(Snd_EnemyScream)
        end if
        enemyContolTIMER = the ticks
        gROBOTMODE = 4
      end if
    4:
      nothing()
  end case
  if (pSheildRotate = 0) and (pHasScope = 1) then
    gOxygenMODE = 1
    gOxygen = max(0, gOxygen - 0.20000000000000001)
  else
    gOxygenMODE = 2
  end if
  if (pHasShield = 1) or (pHasScope = 1) then
    pCarShield.visibility = #both
    pCarShield.transform = tTrans
    pCarShield.translate(0, -0.23799999999999999, -0.313)
    pSheildRotate = max(0, pSheildRotate - 5)
    pCarShield.rotate(pSheildRotate, 0, 0)
    if the ticks >= pDeflectorTIMER then
      pHasShield = 0
    end if
  else
    if pCarShield.visibility <> #none then
      pCarShield.transform = tTrans
      pCarShield.translate(0, -0.23799999999999999, -0.313)
      pSheildRotate = min(80, pSheildRotate + 5)
      pCarShield.rotate(pSheildRotate, 0, 0)
      if pSheildRotate = 80 then
        pCarShield.visibility = #none
      end if
    end if
  end if
  pCarSaws.transform = tTrans
  if pHasBlades = 1 then
    pCarSaws.visibility = #both
    pCarSaws.transform = tTrans
    pBladeFactor = min(1, pBladeFactor + 0.10000000000000001)
    pCarSaws.scale(pBladeFactor, pBladeFactor, pBladeFactor)
    pCarSaws.shaderList[3].textureTransform.translate(-0.5, -0.5, 0)
    pCarSaws.shaderList[3].textureTransform.rotate(0, 0, 52)
    pCarSaws.shaderList[3].textureTransform.translate(0.5, 0.5, 0)
    if pPowerCoeff <> 1 then
      pCarSaws.shaderList[7].blend = 0
    else
      pCarSaws.shaderList[7].blend = 60
    end if
    if the ticks >= pBladesTIMER then
      pCarBody.userData.blades = 0
      SndC_M5FX.volume = 255
      SndC_M5FX.play(Snd_M5BladesOff)
      pHasBlades = 0
    end if
  else
    if pCarSaws.visibility <> #none then
      pCarSaws.transform = tTrans
      pBladeFactor = max(0.10000000000000001, pBladeFactor - 0.10000000000000001)
      pCarSaws.scale(pBladeFactor, pBladeFactor, pBladeFactor)
      if pBladeFactor = 0.10000000000000001 then
        if SEG_TRE[gSEG].count <> 0 then
          repeat with i = 1 to SEG_TRE[gSEG].count
            gHavok.enableCollision(pCarBody.name, SEG_TRE[gSEG][i].name)
            SEG_TRE[gSEG][i].collision.enabled = 0
          end repeat
        end if
        pCarSaws.visibility = #none
      end if
    end if
  end if
  if pHasLights = 1 then
    pCarLights.transform = tTrans
  else
    if pCarLights.visibility <> #none then
      pCarLights.transform = tTrans
      pCarLights.shaderList[1].blend = pCarLights.shaderList[1].blend * 0.69999999999999996
      pCarLights.shaderList[2].blend = pCarLights.shaderList[2].blend * 0.69999999999999996
      if pCarLights.shaderList[2].blend <= 2 then
        pCarLights.shaderList[1].blend = 0
        pCarLights.shaderList[2].blend = 0
        pCarLights.visibility = #none
      end if
    end if
  end if
  if pHasJacks = 1 then
    pCarJacks.transform = tTrans
    if (the ticks > jacks_TIMER) and (pPowerCoeff > 0) then
      pCarJacks.visibility = #none
      pHasJacks = 0
    end if
  end if
  if pHasGrip = 1 then
    pGrip = 1
    if the ticks >= pGripTIMER then
      pHasGrip = 0
      pGripA.visibility = #none
      pGripB.visibility = #none
      pGripC.visibility = #none
      pGripD.visibility = #none
    end if
  end if
  tempTrans = tTrans.duplicate()
  if tempTrans = VOID then
    tempTrans = pLastCarTransform.duplicate()
  end if
  tempTrans2 = tempTrans.duplicate()
  tempTrans.position = vector(0, 0, 0)
  tempTrans.scale = vector(1, 1, 1)
  worldAxis = tempTrans * -pLocalDown
  worldForward = tempTrans * pLocalForward
  worldRight = worldForward.cross(worldAxis)
  worldDownDir = tempTrans * pLocalDown
  worldAxis.normalize()
  worldForward.normalize()
  worldRight.normalize()
  worldDownDir.normalize()
  chassisPos = pChassisRB.position + pChassisRB.centerOfMass
  linVel = pChassisRB.linearVelocity
  forwardVel = linVel.dot(worldForward)
  angVel = pChassisRB.angularVelocity
  tAngVel = pChassisRB.angularVelocity.z
  tAngMom = pChassisRB.angularmomentum.z
  gM5Speed = forwardVel
  if (chassisPos.z <= -10) and (pPowerCoeff = 0) and (pTrackFace = 99) and (speedScreamPlayed = 0) then
    isGameOver = 1
    isPlaying = 0
    SndC_Music.fadeOut(1000)
    SndC_M5Engine.fadeOut(1000)
    SndC_M5Grnd.fadeOut(1000)
    go("CLIFF")
    return 
    speedScreamPlayed = 1
  end if
  pPowerCoeff = pIsHoveringList[1] + pIsHoveringList[2] + pIsHoveringList[3] + pIsHoveringList[4]
  if not pPowerCoeff = 0 then
    pIsReady = 1
    pPowerCoeff = pPowerCoeff / 4.0
  end if
  if isPlaying = 1 then
    if forwardVel >= 0 then
      if kRightIsDown then
        pTurnBuild = min(0.75, pTurnBuild + (pTurnBuildFactor * 0.029999999999999999))
        if tAngVel = 0 then
          tPercentAng = 1
        else
          tPercentAng = min(1, 1 - min(1, tAngVel / (-forwardVel * 0.070000000000000007)))
        end if
        pChassisRB.applyAngularImpulse(vector(0, 0, -pChassisMass * tPercentAng * pTurnBuild))
      else
        if kLeftIsDown then
          pTurnBuild = min(0.75, pTurnBuild + (pTurnBuildFactor * 0.029999999999999999))
          if tAngVel = 0 then
            tPercentAng = 1
          else
            tPercentAng = min(1, 1 - min(1, tAngVel / (forwardVel * 0.070000000000000007)))
          end if
          pChassisRB.applyAngularImpulse(vector(0, 0, pChassisMass * tPercentAng * pTurnBuild))
        else
          pTurnBuild = max(0.20000000000000001, pTurnBuild - 0.20000000000000001)
        end if
      end if
    else
      if (forwardVel < 0) and (pPowerCoeff > 0) and (kForwardIsDown = 0) then
        if kRightIsDown then
          pTurnBuild = min(1, pTurnBuild + 0.20000000000000001)
          if tAngVel = 0 then
            tPercentAng = 1
          else
            tPercentAng = min(1, 1 - min(1, tAngVel / (-forwardVel * 0.070000000000000007)))
          end if
          pChassisRB.applyAngularImpulse(vector(0, 0, pChassisMass * tPercentAng * pTurnBuild))
        else
          if kLeftIsDown then
            pTurnBuild = min(1, pTurnBuild + 0.20000000000000001)
            if tAngVel = 0 then
              tPercentAng = 1
            else
              tPercentAng = min(1, 1 - min(1, tAngVel / (forwardVel * 0.070000000000000007)))
            end if
            pChassisRB.applyAngularImpulse(vector(0, 0, -pChassisMass * tPercentAng * pTurnBuild))
          else
            pTurnBuild = max(0.20000000000000001, pTurnBuild - 0.20000000000000001)
          end if
        end if
      end if
    end if
  else
    if abs(forwardVel) > 1 then
      imp = forwardVel * pChassisMass * worldForward * 0.059999999999999998 * pPowerCoeff
      pChassisRB.applyImpulse(-imp)
    else
      imp = forwardVel * pChassisMass * worldForward * 0.90000000000000002 * pPowerCoeff
      pChassisRB.applyImpulse(-imp)
    end if
  end if
  if (pPowerCoeff > 0) and kForwardIsDown then
    if (forwardVel < 20) and (SndC_M5Engine.member <> Snd_M5EngineStart) then
      SndC_M5Engine.volume = 255
      SndC_M5Engine.play(Snd_M5EngineStart)
    else
      if (forwardVel < (pMaxSpeed - 5)) and (SndC_M5Engine.member <> Snd_M5EngineStart) then
        SndC_M5Engine.volume = 255
        SndC_M5Engine.play(Snd_M5EngineStart)
        SndC_M5Engine.fadeIn(2000)
      end if
    end if
    if forwardVel < 0 then
      imp = pAccGain * 2 * pMaxSpeed * pChassisMass * worldForward
      pChassisRB.applyForce(imp * min(1, pGrip) * 60)
    else
      diff = (pMaxSpeed * pDrag) - forwardVel
      imp = diff * pAccGain * pChassisMass * worldForward
      pChassisRB.applyForce(imp * min(1, pGrip) * 60)
    end if
  else
    if (pPowerCoeff > 0) and kBackwardIsDown then
      diff = (-pMaxSpeed * pDrag) - forwardVel
      imp = diff * (pAccGain * 1.1000000000000001) * pChassisMass * worldForward
      pChassisRB.applyImpulse(imp)
    else
      if abs(forwardVel) > 1 then
        imp = forwardVel * pChassisMass * worldForward * 0.059999999999999998 * pPowerCoeff
        pChassisRB.applyImpulse(-imp)
      else
        imp = forwardVel * pChassisMass * worldForward * 0.90000000000000002 * pPowerCoeff
        pChassisRB.applyImpulse(-imp)
      end if
    end if
  end if
  RotX = pChassisMDL.transform.rotation.x
  RotY = pChassisMDL.transform.rotation.y
  rotz = pChassisMDL.transform.rotation.z
  if (pPowerCoeff < 1) and ((abs(RotX) > 80) or (abs(RotY) > 45)) then
    if gHavok.angularDashpot("m5Corrector") = VOID then
      angDashpot = gHavok.makeAngularDashpot("m5Corrector", pChassisRB.name)
    end if
    tPercent = max(abs(RotX), abs(RotY)) / 90
    angDashpot.rotation = [vector(50, 0, rotz), 1]
    angDashpot.strength = pChassisRB.mass * tPercent
    angDashpot.damping = 1000
  else
    if gHavok.angularDashpot("m5Corrector") <> VOID then
      gHavok.deleteAngularDashpot("m5Corrector")
    end if
  end if
  if (pPowerCoeff < 1) and ((abs(RotX) > 30) or (abs(RotY) > 30)) then
    pChassisRB.angularVelocity = pChassisRB.angularVelocity * 0.10000000000000001
    pChassisRB.applyAngularImpulse(-pChassisRB.angularmomentum * 0.5)
  end if
  if pPowerCoeff = 0 then
    pIsLanding = 1
  else
    if pIsLanding = 1 then
      landingMODE = 1
      pChassisRB.angularVelocity = vector(0, 0, 0)
      if (SndC_M5FX2.member <> Snd_FX_Chirp) and (isPlaying = 1) then
        SndC_M5FX2.volume = 255
        SndC_M5FX2.play(Snd_FX_Chirp)
      end if
      pIsLanding = 0
    end if
    slideSpeed = worldRight.dot(linVel)
    if forwardVel < 5 then
      imp = worldRight * (-slideSpeed * pChassisMass)
    else
      imp = worldRight * (-slideSpeed * pChassisMass * pGrip)
    end if
    pChassisRB.applyImpulse(imp)
  end if
  pChassisRB.angularVelocity[3] = pChassisRB.angularVelocity[3] * 0.83999999999999997
  pLastCarTransform = pChassisMDL.transform.duplicate()
  if isPlaying = 1 then
    if (pPowerCoeff > 0) and (forwardVel > 0) then
      pEffectFactor = forwardVel / pMaxSpeed
    else
      pEffectFactor = pEffectFactor * 0.84999999999999998
    end if
    preveffectID = effectID
    effectID = pTrackFace
    if (wasUnderWater = 1) and ((effectID <> 12) or (mCamera.transform.position.z > 1)) then
      isUnderWater = 0
      SndC_M5Grnd.volume = 255
      SndC_Music.volume = 100
      SndC_M5Engine.volume = 255
      if SndC_M5Grnd.member <> Snd_FX_Splash then
        SndC_M5Grnd.play(Snd_FX_Splash)
      end if
      mCamera.fog.enabled = 0
      wasUnderWater = 0
    end if
    case effectID of
      8, 9, 14, 15:
        pDrag = 1
        if effectID <> preveffectID then
          pGrip = 0.016
          if pmrDirtKick.emitter.numParticles <> 30 then
            pmrDirtKick.emitter.numParticles = 30
          end if
          if pmrDirtKick.texture <> gTextures[#txWater] then
            pmrDirtKick.texture = gTextures[#txWater]
          end if
          pDirtKick.visibility = #front
          pmrDirtKick.gravity = vector(0, 0, -0.029999999999999999)
          pmrDirtKick.lifeTime = 400
          SndC_M5Grnd.volume = 255
          if SndC_M5Grnd.member <> Snd_SkidPav then
            SndC_M5Grnd.play(Snd_SkidPav)
          end if
        end if
        SndC_M5Grnd.volume = min(40, abs(slideSpeed)) / 40.0 * 255
        pmrDirtKick.emitter.minSpeed = pEffectFactor * 0.5
        pmrDirtKick.emitter.maxSpeed = pEffectFactor * 1
        pmrDirtKick.sizeRange.start = pEffectFactor * 0.5
        pmrDirtKick.sizeRange.end = pEffectFactor * 0.80000000000000004
        pmrDirtKick.blendRange.start = pEffectFactor * 20
        pmrDirtKick.blendRange.end = pEffectFactor * 0
        pDirtKick.transform.position = tempTrans2 * pParticlePosDirt
        pDirtKick.transform.position.z = pDirtKick.transform.position.z - 0.29999999999999999
        pDirtKick.transform.rotation = mMach5.transform.rotation
      4:
        pDrag = 1
        if effectID <> preveffectID then
          pGrip = 0.80000000000000004
          if pmrDirtKick.emitter.numParticles <> 20 then
            pmrDirtKick.emitter.numParticles = 20
          end if
          if pmrDirtKick.texture <> gTextures[#txDirt] then
            pmrDirtKick.texture = gTextures[#txDirt]
          end if
          pDirtKick.visibility = #front
          pmrDirtKick.gravity = vector(0, 0, -0.029999999999999999)
          pmrDirtKick.lifeTime = 400
          SndC_M5Grnd.volume = 0
          if SndC_M5Grnd.member <> Snd_SkidPav then
            SndC_M5Grnd.play(Snd_SkidPav)
          end if
        end if
        SndC_M5Grnd.volume = min(30, abs(slideSpeed)) / 30.0 * 255
        pmrDirtKick.emitter.minSpeed = pEffectFactor * 0.5
        pmrDirtKick.emitter.maxSpeed = pEffectFactor * 1
        pmrDirtKick.sizeRange.start = pEffectFactor * 0.5
        pmrDirtKick.sizeRange.end = pEffectFactor * 1.5
        pmrDirtKick.blendRange.start = pEffectFactor * 20
        pmrDirtKick.blendRange.end = pEffectFactor * 0
        pDirtKick.transform.position = tempTrans2 * pParticlePosDirt
        pDirtKick.transform.position.z = pDirtKick.transform.position.z - 0.29999999999999999
        pDirtKick.transform.rotation = mMach5.transform.rotation
      12:
        pGrip = 1
        pDrag = 0.75
        if effectID <> preveffectID then
          SndC_M5Grnd.volume = 255
          if SndC_M5Grnd.member <> Snd_FX_Splash then
            SndC_M5Grnd.play(Snd_FX_Splash)
          end if
        end if
        if mMach5.transform.position.z <= 0 then
          isUnderWater = 1
          if pHasScope = 0 then
            gDamage = min(100, gDamage + 0.29999999999999999)
          end if
          if (wasUnderWater = 0) and (SndC_M5Grnd.member <> Snd_FX_Underwater) then
            if SndC_M5Grnd.member = Snd_FX_Splash then
              SndC_M5Grnd.queue(Snd_FX_Underwater)
            end if
            wasUnderWater = 1
            pmrDirtKick.emitter.numParticles = 8
            pmrDirtKick.texture = gTextures[#txBubble]
            pDirtKick.visibility = #front
            pmrDirtKick.lifeTime = 1800
            mCamera.fog.enabled = 1
            SndC_Music.volume = 0
            SndC_M5Engine.volume = 0
          end if
          if pHasLights = 1 then
            mCamera.fog.near = 40
            mCamera.fog.far = 200
            mCamera.fog.color = rgb(100, 150, 255)
          else
            mCamera.fog.near = 0
            mCamera.fog.far = 40
            mCamera.fog.color = rgb(100, 150, 255)
          end if
          pmrDirtKick.gravity = vector(0, 0, 0.050000000000000003)
          pmrDirtKick.emitter.minSpeed = 0
          pmrDirtKick.emitter.maxSpeed = 0
          pmrDirtKick.sizeRange.start = 0.050000000000000003
          pmrDirtKick.sizeRange.end = 0.14999999999999999
          pmrDirtKick.blendRange.start = 80
          pmrDirtKick.blendRange.end = 80
          pDirtKick.transform.position = tempTrans2 * pParticlePosDirt
          pDirtKick.transform.rotation.z = mMach5.transform.rotation.z
        end if
      1, 2, 6, 7, 10, 13:
        if (effectID = 7) and (preveffectID <> 7) then
          SndC_Music.fadeTo(60, 500)
        else
          if (effectID <> 7) and (preveffectID = 7) then
            if (chassisPos.y > 4900) and (chassisPos.y < 7300) then
              if (SndC_Music.member <> Snd_MusicLoop4) and (SndC_Music.member <> Snd_MusicLoop5) then
                SndC_Music.play(Snd_MusicLoop2)
              end if
            else
              if (SndC_Music.member <> Snd_MusicLoop4) and (SndC_Music.member <> Snd_MusicLoop5) then
                SndC_Music.play(Snd_MusicLoop1)
              end if
            end if
            SndC_Music.volume = 100
          end if
        end if
        if effectID <> preveffectID then
          SndC_M5Grnd.volume = 0
          if SndC_M5Grnd.member <> Snd_SkidPav then
            SndC_M5Grnd.play(Snd_SkidPav)
          end if
        end if
        SndC_M5Grnd.volume = min(8, abs(slideSpeed)) / 8.0 * 255
        pGrip = 1
        pDrag = 1.0
        pmrDirtKick.emitter.minSpeed = max(0, pmrDirtKick.emitter.minSpeed * 0.90000000000000002)
        pmrDirtKick.emitter.maxSpeed = max(0, pmrDirtKick.emitter.maxSpeed * 0.90000000000000002)
        pmrDirtKick.sizeRange.start = max(0, pmrDirtKick.sizeRange.start * 0.90000000000000002)
        pmrDirtKick.sizeRange.end = max(0, pmrDirtKick.sizeRange.end * 0.90000000000000002)
        pmrDirtKick.blendRange.start = max(0, pmrDirtKick.blendRange.start * 0.90000000000000002)
        pmrDirtKick.blendRange.end = max(0, pmrDirtKick.blendRange.end * 0.90000000000000002)
        pDirtKick.transform.position = tempTrans2 * pParticlePosDirt
        pDirtKick.transform.position.z = pDirtKick.transform.position.z - 0.29999999999999999
        pDirtKick.transform.rotation = mMach5.transform.rotation
      3:
        pGrip = 1
        pDrag = 0.5
        pmrDirtKick.emitter.minSpeed = max(0, pmrDirtKick.emitter.minSpeed * 0.90000000000000002)
        pmrDirtKick.emitter.maxSpeed = max(0, pmrDirtKick.emitter.maxSpeed * 0.90000000000000002)
        pmrDirtKick.sizeRange.start = max(0, pmrDirtKick.sizeRange.start * 0.90000000000000002)
        pmrDirtKick.sizeRange.end = max(0, pmrDirtKick.sizeRange.end * 0.90000000000000002)
        pmrDirtKick.blendRange.start = max(0, pmrDirtKick.blendRange.start * 0.90000000000000002)
        pmrDirtKick.blendRange.end = max(0, pmrDirtKick.blendRange.end * 0.90000000000000002)
        pDirtKick.transform.position = tempTrans2 * pParticlePosDirt
        pDirtKick.transform.position.z = pDirtKick.transform.position.z - 0.29999999999999999
        pDirtKick.transform.rotation = mMach5.transform.rotation
        SndC_M5Grnd.fadeOut(200)
      otherwise:
        pGrip = 1
        pDrag = 1.0
        pmrDirtKick.emitter.minSpeed = max(0, pmrDirtKick.emitter.minSpeed * 0.90000000000000002)
        pmrDirtKick.emitter.maxSpeed = max(0, pmrDirtKick.emitter.maxSpeed * 0.90000000000000002)
        pmrDirtKick.sizeRange.start = max(0, pmrDirtKick.sizeRange.start * 0.90000000000000002)
        pmrDirtKick.sizeRange.end = max(0, pmrDirtKick.sizeRange.end * 0.90000000000000002)
        pmrDirtKick.blendRange.start = max(0, pmrDirtKick.blendRange.start * 0.90000000000000002)
        pmrDirtKick.blendRange.end = max(0, pmrDirtKick.blendRange.end * 0.90000000000000002)
        pDirtKick.transform.position = tempTrans2 * pParticlePosDirt
        pDirtKick.transform.position.z = pDirtKick.transform.position.z - 0.29999999999999999
        pDirtKick.transform.rotation = mMach5.transform.rotation
        SndC_M5Grnd.fadeOut(200)
    end case
    if pHasGrip = 1 then
      pDrag = 1
    end if
  end if
  if kRightIsDown then
    pWheelTurn = ((1 - pWheelTurn) * 0.20000000000000001) + pWheelTurn
  else
    if kLeftIsDown then
      pWheelTurn = ((-1 - pWheelTurn) * 0.20000000000000001) + pWheelTurn
    else
      pWheelTurn = ((0 - pWheelTurn) * 0.20000000000000001) + pWheelTurn
    end if
  end if
  pWheelSpin = pWheelSpin - (forwardVel * pWheelSpinCoeff)
  if pWheelSpin > 360 then
    pWheelSpin = pWheelSpin - 360
  else
    if pWheelSpin < -360 then
      pWheelSpin = pWheelSpin - 360
    end if
  end if
  repeat with i = 1 to 4
    worldWheelPoint = pChassisMDL.transform * pWheelPointList[i]
    t = max(0.75, pHoverDistList[i])
    pWheelList[i].transform.position = worldWheelPoint + (t * worldDownDir) - (pWheelRadius * worldDownDir)
    pWheelList[i].transform.rotation = pChassisMDL.transform.rotation
    if (i = 1) or (i = 2) then
      pWheelList[i].rotate(pWheelSpin, 0, -pWheelTurn * pMaxWheelTurn)
      next repeat
    end if
    pWheelList[i].rotate(pWheelSpin, 0, 0)
  end repeat
  if pHasGrip = 1 then
    pGripA.transform = pWheelList[1].transform
    pGripB.transform = pWheelList[2].transform
    pGripC.transform = pWheelList[3].transform
    pGripD.transform = pWheelList[4].transform
  end if
  transform1 = pWheelList[3].transform
  transform2 = pWheelList[4].transform
  transform1.interpolate(transform2, 50)
  if pPowerCoeff = 1 then
    if pCarShadow.shader.blend <> 100 then
      pCarShadow.shader.blend = 100
    end if
    pCarShadow.transform.position = transform1.interpolate(transform2, 50).position + vector(0, 0, -0.20000000000000001)
    pCarShadow.transform.rotation = pChassisMDL.transform.rotation
  else
    pCarShadow.shader.blend = 0
  end if
end

on getPropertyDescriptionList aScript
  if the currentSpriteNum > 0 then
    tGPDList = [:]
    tGPDList[#pSourceMember] = [#comment: "Source Member for Car", #format: #string, #default: EMPTY]
    tGPDList[#pChassisName] = [#comment: "Chassis", #format: #string, #default: EMPTY]
    tGPDList[#pWheelNameA] = [#comment: "Front Left Wheel", #format: #string, #default: EMPTY]
    tGPDList[#pWheelNameB] = [#comment: "Front Right Wheel", #format: #string, #default: EMPTY]
    tGPDList[#pWheelNameC] = [#comment: "Back Right Wheel", #format: #string, #default: EMPTY]
    tGPDList[#pWheelNameD] = [#comment: "Back Left Wheel", #format: #string, #default: EMPTY]
    tGPDList[#pCarName] = [#comment: "Unique name for this car", #format: #string, #default: EMPTY]
    return tGPDList
  end if
end
