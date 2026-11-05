property pSEG, pSEG_PREV, pTrack, gExplosionSetPos, pStartingPosition, pSourceMember, pChassisName, pCarCollider, pCarBody, pLocalDown, pLocalForward, pLocalRight, pUserCar, pCarName, pCarShadow, pBumperPos, pParticlePos, pEffectFactor, pWheelA, pWheelB, pWheelC, pWheelD, pWheelNameA, pWheelNameB, pWheelNameC, pWheelNameD, pwidth, pFrontWheelBase, pBackWheelBase, pWheelRadius, pStrength, pDamping, pHoverDist, pMaxWheelTurn, pWheelSpinCoeff, pWheelList, pWheelPointList, pIsHoveringList, pHoverDistList, pGravityStrength, pChassisWeigth, pMaxSpeed, pMaxTurnSpeed, pMinTurnSpeed, pAccGain, pDecGain, pBrakeGain, pTurnGain, pXtraTurnGain, pGrip, pDrag, pBoost, pScalar, pCarMass, pMember, pSprite, pCreated, spriteNum, pChassisRB, pChassisMass, pChassisMDL, pWheelTurn, pWheelSpin, pLastCarTransform, pIsPrepared, pIsStarted, pIsReady, pmrDirtKick, pDirtKick, pParticlePosDirt, pParticlePosWater, pParticlePosBubbles, pStartingPathStep, pNextPathStep, pCurPnt, pNextPnt, pDupCount, tCar, pmrExplosion, pExplosion, explosionMODE, rbCarBodyDEAD, rbCarWheelDEAD, pCarBodyDEAD, pCarWheelDEAD, pCarShellDEAD, pCarShell, pExplosionTIMER, controlMODE, pScreenPos, pEnemyID, pRobot, pRobotRotation, pRobotRotation_y, gROBOTMODE, isBehind, isPassed, pIsJumping, pmrSmoke, pIsAlive, pSmoke, pSmartEnemy, pSmartTIMER, pPassMODE, pJustJumped, isStuckTIMER, isStuck, lastYPos, thisYPos, pCarWindshield, pUsePassMODE, duggerySmartTimer
global isPlaying, SEG_TRK, SEG_OBJ, SEG_PIC, gSEG, gCarDuggery, gHavok, g3DWorld, gTextures, gScore, mMach5, mMach5Shadow, mCamera, mBridge, mDirtKick, mrDirtKick, gameLighting, theAmbientLight, wasUnderWater, gMach5InAir, gCarsPrepared, gCarsReady, gExplosionSet, kForward, kBackward, kRight, kLeft, kJacks, gEffectImage, gEffectBlack, gEffectRoad, gEffectDirt, gEffectMud, gEffectSnow, gEffectGrass, gEffectTallGrass, gEffectWater, gEffectDeepWater, effectID, pathList, SndC_Music, SndC_M5Grnd, SndC_M5FX, SndC_M5FX2, SndC_EnemyFX, SndC_VO, Snd_MusicLoop, Snd_Crash1, Snd_MusicLoop1, Snd_MusicLoop2, Snd_MusicLoop3, Snd_MusicLoop4, Snd_MusicLoop5, Snds_HitReactions, Snd_EnemyScream, Snd_Crash3, Snd_M5Jump, Snd_M5EngineStart, Snd_M5EngineLoop, Snd_SkidPav, Snd_FX_Underwater, Snd_FX_Pass1, Snd_FX_Pass2, Snd_EnemyScream_1, enemyDistArr, enemyScriptArr, enemyContolTIMER, enemyPositionsList, enemiesRemaining, enemiesFinished, duggaryCreated, gPosition, loop5Played, gM5Speed, gM5MaxSpeed, gCarSkinsArr

on beginSprite me
  duggerySmartTimer = the ticks
  isStuckTIMER = the ticks
  pJustJumped = 0
  pSmartEnemy = 1
  pSmartTIMER = 0
  duggaryCreated = 0
  loop5Played = 0
  pPassMODE = 0
  isStuck = 0
  controlMODE = 1
  explosionMODE = 0
  pDupCount = 0
  pNextPathStep = pStartingPathStep + 1
  pRobotRotation = 0
  pRobotRotation_y = 0
  pSprite = sprite(me.spriteNum)
  pMember = pSprite.member
  pIsPrepared = 0
  pIsStarted = 0
  pIsReady = 0
  pIsJumping = 0
  pUsePassMODE = 0
  pIsAlive = 1
  enemyFirstPoint = 0
  enemyLastPoint = 100
  isBehind = 0
  isPassed = 0
  pAccGain = 0.080000000000000002
  pDecGain = 0.02
  pTurnBuild = 0
  pMaxSpeed = gM5MaxSpeed * 0.80000000000000004
  pTurnBuildFactor = 0.29999999999999999
  pGripFactor = 10
  pCarMass = 20000
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

on exitFrame me
  pJustJumped = 0
  if (pIsStarted = 0) or (pIsAlive = 0) then
    return 
  end if
  me.updateCar()
end

on startCar me
  pIsStarted = 1
  enemyDistArr.append(0)
  pEnemyID = enemyDistArr.count
  enemyScriptArr[pEnemyID] = me
  enemyPositionsList[pEnemyID] = pStartingPathStep
end

on checkPrepared me
  if pIsPrepared = 0 then
    gCarsPrepared = 0
  end if
end

on checkReady me
  if pIsReady = 0 then
    gCarsReady = 0
  end if
end

on prepareCar me
  pAccGain = 0.070000000000000007
  pDecGain = 0.040000000000000001
  pLocalDown = vector(0, 0, -1)
  pLocalForward = vector(0, 1, 0)
  member(pSourceMember).resetWorld()
  pCarBody = g3DWorld.cloneModelFromCastmember(pCarName & pChassisName, "collider", member("Car_Mach5"))
  pCarBody.addModifier(#meshDeform)
  pCarBody.visibility = #none
  pCarBody.userData.addProp(#kind, "enemyCar")
  pCarBody.userData.addProp(#damage, 0)
  pCarBody.userData.addProp(#isDuggary, 0)
  pCarShell = g3DWorld.cloneModelFromCastmember(pCarName & pChassisName & "shell", pChassisName, member(pSourceMember))
  pCarBodyDEAD = g3DWorld.cloneModelFromCastmember(pCarName & pChassisName & "shellDEAD", pChassisName, member(pSourceMember))
  pCarWheelDEAD = g3DWorld.cloneModelFromCastmember(pCarName & pWheelNameA & "DEAD", pWheelNameA, member(pSourceMember))
  pCarBodyDEAD.visibility = #none
  pCarWheelDEAD.visibility = #none
  pCarWindshield = g3DWorld.cloneModelFromCastmember(pCarName & "CarWindshield", "car_windshield", member(pSourceMember))
  pCarWindshield.visibility = #both
  pCurPnt = pathList[pStartingPathStep][1]
  if pNextPathStep > pathList.count then
    pNextPathStep = 1
  end if
  pNextPnt = pathList[pNextPathStep][1]
  pCurVect = vector(pCurPnt[1], pCurPnt[2], pathList[pStartingPathStep][3])
  pSEG = (integer(pCurVect.y) / 300) + 1
  pSEG_PREV = 0
  pTrack = SEG_TRK[pSEG]
  details = pMember.modelsUnderRay(pCurVect, vector(0, 0, -1), [#maxNumberOfModels: 1, #levelOfDetail: #detailed, #modelList: [pTrack], #maxDistance: 50])
  pCarBody.transform.position = details[1][3] + vector(0, 0, 1)
  pCarBody.transform.rotation = vector(0, 0, -getAngle(pCurPnt[1], pCurPnt[2], pNextPnt[1], pNextPnt[2]))
  pCarShadow = g3DWorld.cloneModelFromCastmember(pCarName & "Shadow", "car_shadow", member(pSourceMember))
  pCarShadow.transform.position = pCarBody.transform.position
  pCarShadow.shader.texture.renderFormat = #rgba4444
  pCarShadow.shader.texture.nearFiltering = 0
  pWheelA = g3DWorld.cloneModelFromCastmember(pCarName & pWheelNameA, pWheelNameA, member(pSourceMember))
  pWheelB = g3DWorld.cloneModelFromCastmember(pCarName & pWheelNameB, pWheelNameB, member(pSourceMember))
  pWheelC = g3DWorld.cloneModelFromCastmember(pCarName & pWheelNameC, pWheelNameC, member(pSourceMember))
  pWheelD = g3DWorld.cloneModelFromCastmember(pCarName & pWheelNameD, pWheelNameD, member(pSourceMember))
  pChassisName = pCarName & pChassisName
  pWheelNameA = pCarName & pWheelNameA
  pWheelNameB = pCarName & pWheelNameB
  pWheelNameC = pCarName & pWheelNameC
  pWheelNameD = pCarName & pWheelNameD
  skinID = random(gCarSkinsArr.count - 2)
  skinMember = gCarSkinsArr[skinID]
  gCarSkinsArr.deleteAt(skinID)
  gCarSkinsArr.append(skinMember)
  pCarShell.shader.textureList[1].member = member(skinMember)
  pRobot = g3DWorld.cloneModelFromCastmember(pCarName & "Robot", "robot", member(pSourceMember))
  pRobot.visibility = #none
  updateStage()
  gHavok.makeMovableRigidBody(pCarBody.name, pCarMass, 1, #box)
  pChassisRB = gHavok.rigidBody(pCarBody.name)
  pChassisRB.friction = 0
  gHavok.registerInterest(pCarBody.name, #all, 0, 1, #collisionHandler, me)
  doEnemyChangeSegment(pCarBody, pSEG_PREV, pSEG)
  pChassisMass = pChassisRB.mass
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
  pmrSmoke = g3DWorld.newModelResource(pCarName & "mrSmoke", #particle)
  pmrExplosion = g3DWorld.newModelResource(pCarName & "mrExplosion", #particle)
  pIsPrepared = 1
  enemiesRemaining = enemiesRemaining - 1
end

on collisionHandler me, collisionDetails
  if (collisionDetails[1] = collisionDetails[2]) or (collisionDetails[2] = pCarBody.name) then
    return 
  end if
  hitmodel = collisionDetails[2]
  hitforce = collisionDetails[5]
  hitKind = g3DWorld.model(hitmodel).userData.kind
  if hitKind = "userCar" then
    if pCarBody.userData.isDuggary = 1 then
      if SndC_VO.isBusy() = 0 then
        SndC_VO.volume = 255
        SndC_VO.play(member("HitDuggary_" & random(3)))
      end if
    else
      if (random(3) = 1) and (SndC_VO.isBusy() = 0) then
        SndC_VO.volume = 255
        SndC_VO.play(Snds_HitReactions[random(Snds_HitReactions.count)])
      end if
    end if
  end if
  if pCarBody.userData.isDuggary = 1 then
    return 
  end if
  if controlMODE = 0 then
    explosionMODE = 5
  end if
  if hitKind = "track" then
    return 
  end if
  if hitKind = "enemyCar" then
    if pCarBody.transform.position.y < g3DWorld.model(hitmodel).transform.position.y then
      pSmartEnemy = 0
      pCarBody.userData.damage = pCarBody.userData.damage + (hitforce * 0.5)
      if pCarBody.userData.damage >= 100 then
        explosionMODE = 5
      else
        if (pCarBody.userData.damage >= 30) and (explosionMODE = 0) then
          explosionMODE = 1
        end if
      end if
    end if
  else
    if hitKind = "userCar" then
      if g3DWorld.model(hitmodel).userData.blades = 1 then
        pCarBody.userData.damage = pCarBody.userData.damage + 15
        if pCarBody.userData.damage >= 100 then
          explosionMODE = 5
        else
          if (pCarBody.userData.damage >= 30) and (explosionMODE = 0) then
            explosionMODE = 1
          end if
        end if
      else
        pCarBody.userData.damage = pCarBody.userData.damage + 2.5
        if pCarBody.userData.damage >= 100 then
          explosionMODE = 5
        else
          if (pCarBody.userData.damage >= 30) and (explosionMODE = 0) then
            explosionMODE = 1
          end if
        end if
      end if
    else
      if (hitKind = "solid") or (hitKind = "tree") then
        if (hitforce > 10) and (the milliSeconds > (pExplosionTIMER + 1000)) then
          pCarBody.userData.damage = 100
          explosionMODE = 5
        end if
      end if
    end if
  end if
  imp = collisionDetails[4] * pChassisMass * 2
  pChassisRB.applyImpulse(imp)
end

on doJump me
  if isBehind = 0 then
    gPosition = gPosition - 1
    doUpdatePlace(gPosition)
  end if
  nextStep = max(enemyPositionsList) + 2
  pCarBody.userData.damage = 0
  pSmartEnemy = 1
  controlMODE = 1
  isPassed = 0
  if pmrSmoke <> VOID then
    pmrSmoke.emitter.loop = 0
  end if
  if enemiesRemaining <= 0 then
    pIsAlive = 0
    if pCarBody.userData.isDuggary = 0 then
      pCarBody.removeFromWorld()
      pCarShell.removeFromWorld()
      pCarShadow.removeFromWorld()
      pCarWindshield.removeFromWorld()
      pWheelA.removeFromWorld()
      pWheelB.removeFromWorld()
      pWheelC.removeFromWorld()
      pWheelD.removeFromWorld()
    end if
    gHavok.deleteRigidBody(pChassisRB.name)
    return 
  else
    if nextStep >= pathList.count then
      enemiesFinished = enemiesFinished + 1
      if pCarBody.userData.isDuggary = 0 then
        pCarBody.removeFromWorld()
        pCarShell.removeFromWorld()
        pCarShadow.removeFromWorld()
        pCarWindshield.removeFromWorld()
        pWheelA.removeFromWorld()
        pWheelB.removeFromWorld()
        pWheelC.removeFromWorld()
        pWheelD.removeFromWorld()
      end if
      gHavok.deleteRigidBody(pChassisRB.name)
      pIsAlive = 0
    else
      pCurPnt = pathList[nextStep][1]
      pCurVect = vector(pCurPnt[1], pCurPnt[2], pathList[nextStep][3])
      tSEG = (integer(pCurPnt[2]) / 300) + 1
      if tSEG <> pSEG then
        pSEG_PREV = pSEG
        pSEG = tSEG
        doEnemyChangeSegment(pCarBody, pSEG_PREV, pSEG)
      end if
      pNextPathStep = nextStep + 1
      pNextPnt = pathList[pNextPathStep][1]
      pNextPnt = point(pNextPnt[1] + (1 - random(2)), pNextPnt[2] + (1 - random(2)))
      tTrackModel_1 = g3DWorld.model("SEG_" & min(SEG_TRK.count, pSEG))
      tTrackModel_2 = g3DWorld.model("SEG_" & min(SEG_TRK.count, pSEG + 1))
      tTrackModel_3 = g3DWorld.model("SEG_" & max(1, pSEG - 1))
      details = pMember.modelsUnderRay(pCurVect, vector(0, 0, -1), [#maxNumberOfModels: 1, #levelOfDetail: #detailed, #modelList: [tTrackModel_1, tTrackModel_2, tTrackModel_3], #maxDistance: 3])
      if details = [] then
        tPos = pCurVect
      else
        tPos = details[1][3] + vector(0, 0, 1)
      end if
      tRot = -getAngle(pCurPnt[1], pCurPnt[2], pNextPnt[1], pNextPnt[2])
      t = pChassisRB.linearVelocity
      pChassisRB.linearVelocity = vector(0, 0, 0)
      pChassisRB.attemptMoveTo(tPos, [vector(0, 0, 1), tRot])
      if (enemiesRemaining = 1) and (duggaryCreated = 0) then
        duggaryCreated = 1
        pCarBody.userData.isDuggary = 1
        gCarDuggery.visibility = #front
        pCarShell.visibility = #none
        pCarShell = gCarDuggery
      else
        skinID = random(gCarSkinsArr.count - 2)
        skinMember = gCarSkinsArr[skinID]
        gCarSkinsArr.deleteAt(skinID)
        gCarSkinsArr.append(skinMember)
        pCarShell.shader.textureList[1].member = member(skinMember)
        pCarShell.visibility = #front
      end if
      isBehind = 0
      pIsJumping = 1
      pJustJumped = 1
    end if
  end if
  enemiesRemaining = enemiesRemaining - 1
end

on doResetDuggary me
  put "doResetDuggary"
  tPathStep = 1
  tCheckPos = integer(mMach5.userData.stepPos.y)
  repeat while tPathStep < pathList.count
    if (pathList[tPathStep][1][2] >= tCheckPos) or (pathList[tPathStep][1][2] >= mMach5.transform.position.y) then
      nextStep = tPathStep - 1
      exit repeat
    end if
    tPathStep = tPathStep + 1
  end repeat
  pCurPnt = pathList[nextStep][1]
  pNextPathStep = nextStep + 1
  pNextPnt = pathList[pNextPathStep][1]
  pNextPnt = point(pNextPnt[1] + (1 - random(2)), pNextPnt[2] + (1 - random(2)))
  pCurVect = vector(pCurPnt[1], pCurPnt[2], pathList[nextStep][3])
  tSEG = (integer(pNextPnt[2]) / 300) + 1
  if tSEG <> pSEG then
    pSEG_PREV = pSEG
    pSEG = tSEG
    doEnemyChangeSegment(pCarBody, pSEG_PREV, pSEG)
  end if
  tTrackModel_1 = g3DWorld.model("SEG_" & min(SEG_TRK.count, pSEG))
  tTrackModel_2 = g3DWorld.model("SEG_" & min(SEG_TRK.count, pSEG + 1))
  tTrackModel_3 = g3DWorld.model("SEG_" & max(1, pSEG - 1))
  details = pMember.modelsUnderRay(pCurVect, vector(0, 0, -1), [#maxNumberOfModels: 1, #levelOfDetail: #detailed, #modelList: [tTrackModel_1, tTrackModel_2, tTrackModel_3], #maxDistance: 3])
  if details = [] then
    tPos = pCurVect
  else
    tPos = details[1][3] + vector(0, 0, 1)
  end if
  tRot = -getAngle(pCurPnt[1], pCurPnt[2], pNextPnt[1], pNextPnt[2])
  t = pChassisRB.linearVelocity
  pChassisRB.linearVelocity = vector(0, 0, 0)
  t = pChassisRB.attemptMoveTo(tPos, [vector(0, 0, 1), tRot])
  if t = 0 then
    put "MOVE FAILED"
  end if
  thisYPos = integer(pCarBody.transform.position.y)
  lastYPos = thisYPos
  controlMODE = 1
  pRobot.visibility = #none
end

on updateCar me
  pCarShell.transform = pCarBody.transform
  pCarWindshield.transform = pCarBody.transform
  pScreenPos = mCamera.worldSpaceToSpriteSpace(pCarShell.transform.position)
  if not pScreenPos = VOID then
    enemyDistArr[pEnemyID] = pCarBody.transform.position.distanceTo(mMach5.transform.position)
  else
    enemyDistArr[pEnemyID] = 1000
  end if
  tempTrans = pChassisMDL.transform.duplicate()
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
  pPowerCoeff = pIsHoveringList[1] + pIsHoveringList[2] + pIsHoveringList[3] + pIsHoveringList[4]
  if not pPowerCoeff = 0 then
    pIsReady = 1
    pPowerCoeff = pPowerCoeff / 4.0
  end if
  thisYPos = integer(chassisPos.y)
  lastYPos = thisYPos
  if pCarBody.userData.isDuggary = 1 then
    if (thisYPos <= (lastYPos + 2)) or (chassisPos.z <= -30) then
      if the ticks > (isStuckTIMER + (60 * 5)) then
        isStuck = 1
      end if
    else
      isStuck = 0
      isStuckTIMER = the ticks
    end if
  end if
  tSEG = (thisYPos / 300) + 1
  if tSEG <> pSEG then
    pSEG_PREV = pSEG
    pSEG = tSEG
    doEnemyChangeSegment(pCarBody, pSEG_PREV, pSEG)
  end if
  if controlMODE = 1 then
    pCurPnt = point(chassisPos[1], chassisPos[2])
    pCurVect = vector(pCurPnt[1], pCurPnt[2], 0)
    goto_rot = -getAngle(pCurPnt[1], pCurPnt[2], pNextPnt[1], pNextPnt[2])
    goto_dist = pCurVect.distanceTo(vector(pNextPnt[1], pNextPnt[2], 0))
    if goto_dist < 10 then
      pNextPathStep = pNextPathStep + 1
      enemyPositionsList[pEnemyID] = pNextPathStep
      if pNextPathStep > pathList.count then
        pNextPathStep = pNextPathStep - 1
        enemiesFinished = enemiesFinished + 1
        if pCarBody.userData.isDuggary = 0 then
          pCarBody.removeFromWorld()
          pCarShell.removeFromWorld()
          pCarShadow.removeFromWorld()
          pCarWindshield.removeFromWorld()
          pWheelA.removeFromWorld()
          pWheelB.removeFromWorld()
          pWheelC.removeFromWorld()
          pWheelD.removeFromWorld()
        else
          pCarBody.transform.rotation.z = 90
        end if
        gHavok.deleteRigidBody(pChassisRB.name)
        pIsAlive = 0
        return 
      end if
      pNextPnt = pathList[pNextPathStep][1]
    end if
    dif = goto_rot - pChassisMDL.transform.rotation.z
    if dif > 180 then
      dif = 180 - dif
    else
      if dif < -180 then
        dif = dif + 360
      end if
    end if
    absDif = abs(dif)
    turnFactor = min(40, absDif) / 40
    distFactor = 1 - (min(50, goto_dist) / 50)
    if dif < 0 then
      pChassisRB.applyAngularImpulse(vector(0, 0, -pChassisMass * turnFactor) + vector(0, 0, -tAngMom * 0.25))
    else
      if dif > 0 then
        pChassisRB.applyAngularImpulse(vector(0, 0, pChassisMass * turnFactor) + vector(0, 0, -tAngMom * 0.25))
      end if
    end if
  else
    if pCarBody.userData.isDuggary = 1 then
      pPassMODE = 2
      if (the ticks mod 60) < 30 then
        pRobotRotation_y = pRobotRotation_y + 5
        turnFactor = min(1, turnFactor + 0.20000000000000001)
        pChassisRB.applyAngularImpulse(vector(0, 0, pChassisMass * turnFactor * 0.29999999999999999) + vector(0, 0, -tAngMom * 0.25))
      else
        pRobotRotation_y = pRobotRotation_y - 5
        turnFactor = max(-1, turnFactor - 0.20000000000000001)
        pChassisRB.applyAngularImpulse(vector(0, 0, pChassisMass * turnFactor * 0.29999999999999999) + vector(0, 0, -tAngMom * 0.25))
      end if
      pRobotRotation = pRobotRotation + 20
      pRobot.visibility = #front
      pRobot.transform.position = pCarBody.transform.position
      pRobot.transform.rotation = pCarBody.transform.rotation
      pRobot.rotate(0, pRobotRotation_y, pRobotRotation)
      if the ticks > (enemyContolTIMER + (60 * 0.40000000000000002)) then
        controlMODE = 1
        pRobot.visibility = #none
      end if
    else
      if (the ticks mod 60) < 30 then
        pRobotRotation_y = pRobotRotation_y + 5
        turnFactor = min(1, turnFactor + 0.20000000000000001)
        pChassisRB.applyAngularImpulse(vector(0, 0, pChassisMass * turnFactor) + vector(0, 0, -tAngMom * 0.25))
      else
        pRobotRotation_y = pRobotRotation_y - 5
        turnFactor = max(-1, turnFactor - 0.20000000000000001)
        pChassisRB.applyAngularImpulse(vector(0, 0, pChassisMass * turnFactor) + vector(0, 0, -tAngMom * 0.25))
      end if
      pRobotRotation = pRobotRotation + 20
      pRobot.visibility = #front
      pRobot.transform.position = pCarBody.transform.position
      pRobot.transform.rotation = pCarBody.transform.rotation
      pRobot.rotate(0, pRobotRotation_y, pRobotRotation)
    end if
  end if
  if (pIsReady = 1) and (isPlaying = 1) then
    diff = pMaxSpeed - forwardVel
    imp = diff * pAccGain * pChassisMass * worldForward * pPowerCoeff
    pChassisRB.applyImpulse(imp)
  end if
  if pPowerCoeff = 0 then
    RotX = pChassisMDL.transform.rotation.x
    RotY = pChassisMDL.transform.rotation.y
    if RotX < -10 then
      imp = worldRight * pChassisMass
      pChassisRB.applyAngularImpulse(imp)
    else
      if RotX > 10 then
        imp = worldRight * pChassisMass
        pChassisRB.applyAngularImpulse(-imp)
      end if
    end if
    if RotY < -10 then
      imp = worldForward * pChassisMass
      pChassisRB.applyAngularImpulse(imp)
    else
      if RotY > 10 then
        imp = worldForward * pChassisMass
        pChassisRB.applyAngularImpulse(-imp)
      end if
    end if
    pChassisRB.applyAngularImpulse(-pChassisRB.angularmomentum * 0.29999999999999999)
  else
    slideSpeed = worldRight.dot(linVel)
    imp = worldRight * (-slideSpeed * pChassisMass * pGrip * pPowerCoeff)
    pChassisRB.applyImpulse(imp)
  end if
  pLastCarTransform = pChassisMDL.transform.duplicate()
  repeat with i = 1 to pWheelPointList.count
    pIsHoveringList[i] = 0
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
      hoverDst = details[1][2]
      hoverPnt = details[1][3]
      if hoverDst < pHoverDist then
        pointVelocity = linVel + angVel.cross(worldWheelPoint - chassisPos)
        diff = hoverPnt - worldWheelPoint
        f = -pStrength * (pHoverDist - hoverDst)
        f = f - (pDamping * pointVelocity.dot(diff))
        pChassisRB.applyImpulseAtPoint(diff * f * pChassisMass, pWheelPointList[i])
        pIsHoveringList[i] = 1
        pHoverDistList[i] = hoverDst
      end if
    end if
  end repeat
  if tAngVel >= 0 then
    tWheelTurn = -min(0.29999999999999999, tAngVel)
  else
    if tAngVel < 0 then
      tWheelTurn = -max(-0.29999999999999999, tAngVel)
    end if
  end if
  if tWheelTurn < pWheelTurn then
    pWheelTurn = max(tWheelTurn, pWheelTurn - 2)
  else
    if tWheelTurn > pWheelTurn then
      pWheelTurn = min(tWheelTurn, pWheelTurn + 2)
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
    pWheelList[i].transform.position = worldWheelPoint + (pHoverDistList[i] * worldDownDir) - (pWheelRadius * worldDownDir)
    pWheelList[i].transform.rotation = pChassisMDL.transform.rotation
    if (i = 1) or (i = 2) then
      pWheelList[i].rotate(pWheelSpin, 0, -pWheelTurn * pMaxWheelTurn)
      next repeat
    end if
    pWheelList[i].rotate(pWheelSpin, 0, 0)
  end repeat
  transform1 = pWheelList[3].transform
  transform2 = pWheelList[4].transform
  transform1.interpolate(transform2, 50)
  pCarShadow.transform.position = transform1.interpolate(transform2, 50).position + vector(0, 0, -0.20000000000000001)
  pCarShadow.transform.rotation = pChassisMDL.transform.rotation
  case explosionMODE of
    0:
      nothing()
    1:
      pSmoke = g3DWorld.newModel(pCarName & "mSmoke" & pDupCount, pmrSmoke)
      pSmoke.addToWorld()
      pDupCount = pDupCount + 1
      SndC_EnemyFX.volume = 200
      SndC_EnemyFX.play(Snd_EnemyScream_1)
      pmrSmoke.emitter.numParticles = 40
      pmrSmoke.emitter.region = [vector(-0.80000000000000004, 0, 0), vector(0.80000000000000004, 0, 0)]
      pmrSmoke.emitter.direction = vector(0, 0, 1)
      pmrSmoke.emitter.minSpeed = 0
      pmrSmoke.emitter.maxSpeed = 0
      pmrSmoke.lifeTime = 400
      pmrSmoke.sizeRange.start = 2
      pmrSmoke.sizeRange.end = 5
      pmrSmoke.blendRange.start = 10
      pmrSmoke.blendRange.end = 0
      pmrSmoke.texture = gTextures[#txExplosion][1]
      pmrSmoke.emitter.loop = 1
      pSmoke.transform.position = tempTrans2 * (pBumperPos + vector(0, -1, 0))
      pSmoke.visibility = #front
      gExplosionSetPos = 28
      explosionMODE = 2
    2:
      gExplosionSetPos = gExplosionSetPos + 1
      if gExplosionSetPos > gTextures[#txExplosion].count then
        gExplosionSetPos = 28
      end if
      pmrSmoke.sizeRange.start = 0.5
      pmrSmoke.sizeRange.end = 5
      pmrSmoke.blendRange.start = max(10, pCarBody.userData.damage * 0.01 * 20)
      pmrSmoke.blendRange.end = 0
      pmrSmoke.texture = gTextures[#txExplosion][gExplosionSetPos]
      pSmoke.transform.position = tempTrans2 * (pBumperPos + vector(0, -1, 0))
    5:
      gScore = gScore + 1000
      doUpdateScore()
      SndC_M5FX2.stop()
      pRobot.visibility = #none
      tshader = pCarShell.shader.textureList[1].member
      tTransform = pCarShell.transform
      pCarShell.visibility = #none
      doJump()
      pCarBodyDEAD.visibility = #front
      pCarWheelDEAD.visibility = #front
      pCarBodyDEAD.transform = tTransform
      pCarWheelDEAD.transform.position = pWheelList[random(4)].transform.position + vector(0, 0, 1)
      pCarBodyDEAD.shader.textureList[1].member = tshader
      pCarBodyDEAD.addModifier(#meshDeform)
      pCarWheelDEAD.addModifier(#meshDeform)
      if gHavok.rigidBody(pCarBodyDEAD.name) <> VOID then
        gHavok.deleteRigidBody(rbCarBodyDEAD.name)
        gHavok.deleteRigidBody(rbCarWheelDEAD.name)
      end if
      rbCarBodyDEAD = gHavok.makeMovableRigidBody(pCarBodyDEAD.name, pCarMass, 1)
      rbCarWheelDEAD = gHavok.makeMovableRigidBody(pCarWheelDEAD.name, 50, 1, #box)
      rbCarBodyDEAD.applyImpulse(vector(0, 0, rbCarBodyDEAD.mass * 15))
      rbCarBodyDEAD.applyAngularImpulse(vector(rbCarBodyDEAD.mass * 10, 0, 0))
      rbCarWheelDEAD.applyImpulse(vector(-50, -50, rbCarBodyDEAD.mass))
      pExplosion = g3DWorld.newModel(pCarName & "mExplosion" & pDupCount, pmrExplosion)
      pExplosion.addToWorld()
      pDupCount = pDupCount + 1
      pmrExplosion.emitter.numParticles = 150
      pmrExplosion.emitter.angle = 60
      pmrExplosion.emitter.minSpeed = 0
      pmrExplosion.emitter.maxSpeed = 6
      pmrExplosion.emitter.wind = vector(120, -16, 0)
      pmrExplosion.emitter.gravity = vector(0, 0, 0)
      pmrExplosion.sizeRange.start = 12
      pmrExplosion.sizeRange.end = 2
      pmrExplosion.blendRange.start = 80
      pmrExplosion.blendRange.end = 0
      pmrExplosion.texture = gTextures[#txExplosion][1]
      pmrExplosion.lifeTime = 5000.0
      pmrExplosion.emitter.loop = 0
      pExplosionTIMER = the milliSeconds
      pExplosion.transform.position = rbCarBodyDEAD.position
      pExplosion.visibility = #front
      gExplosionSetPos = 1
      SndC_EnemyFX.volume = 255
      SndC_EnemyFX.play(Snd_Crash3)
      explosionMODE = 6
    6:
      pExplosion.transform.position = rbCarBodyDEAD.position
      pmrExplosion.texture = gTextures[#txExplosion][gExplosionSetPos]
      gExplosionSetPos = gExplosionSetPos + 1
      pmrExplosion.sizeRange.start = max(4, pmrExplosion.sizeRange.start - 1)
      pmrExplosion.blendRange.start = max(20, pmrExplosion.blendRange.start - 1)
      pmrExplosion.emitter.maxSpeed = max(2, pmrExplosion.emitter.maxSpeed - 1)
      rbCarBodyDEAD.linearVelocity = rbCarBodyDEAD.linearVelocity * 0.80000000000000004
      rbCarBodyDEAD.angularVelocity = rbCarBodyDEAD.angularVelocity * 0.80000000000000004
      if gExplosionSetPos >= gTextures[#txExplosion].count then
        explosionMODE = 7
      end if
    7:
      pExplosion.transform.position = rbCarBodyDEAD.position
      pmrExplosion.sizeRange.start = max(4, pmrExplosion.sizeRange.start - 1)
      pmrExplosion.blendRange.start = max(20, pmrExplosion.blendRange.start - 1)
      pmrExplosion.emitter.maxSpeed = max(2, pmrExplosion.emitter.maxSpeed - 1)
      rbCarBodyDEAD.linearVelocity = rbCarBodyDEAD.linearVelocity * 0.80000000000000004
      rbCarBodyDEAD.angularVelocity = rbCarBodyDEAD.angularVelocity * 0.80000000000000004
      if the milliSeconds > (pExplosionTIMER + 8000) then
        explosionMODE = 8
      end if
    8:
      gHavok.deleteRigidBody(rbCarBodyDEAD.name)
      gHavok.deleteRigidBody(rbCarWheelDEAD.name)
      pCarBodyDEAD.transform.position = vector(0, 0, 0)
      pCarWheelDEAD.transform.position = vector(0, 0, 0)
      pCarBodyDEAD.visibility = #none
      pCarWheelDEAD.visibility = #none
      explosionMODE = 0
  end case
  tYOffset = chassisPos.y - mMach5.transform.position.y
  tXOffset = chassisPos.x - mMach5.transform.position.x
  if isPlaying = 0 then
    return 
  end if
  if pCarBody.userData.isDuggary = 1 then
    if pUsePassMODE = 1 then
      if tYOffset < -50 then
        pPassMODE = 3
      else
        if tYOffset < 1 then
          pPassMODE = 1
        else
          if tYOffset > 100 then
            pPassMODE = 2
          else
            if tYOffset > 15 then
              pPassMODE = 0
            else
              pPassMODE = 4
            end if
          end if
        end if
      end if
      if (pPassMODE = 2) or (pSmartEnemy = 0) then
        ts = gM5MaxSpeed * 0.5
        pMaxSpeed = ts - (ts * turnFactor * distFactor)
      else
        if pPassMODE = 1 then
          ts = gM5MaxSpeed * 1.2
          pMaxSpeed = ts - (ts * turnFactor * distFactor)
        else
          if pPassMODE = 3 then
            ts = gM5MaxSpeed * 1.3
            pMaxSpeed = ts - (ts * turnFactor * distFactor)
          else
            if pPassMODE = 0 then
              ts = gM5MaxSpeed * 0.84999999999999998
              pMaxSpeed = ts - (ts * turnFactor * distFactor)
            else
              if pPassMODE = 4 then
                if the ticks > (duggerySmartTimer + (60 * 4)) then
                  ts = gM5Speed - 5 + random(12)
                  pMaxSpeed = ts - (ts * turnFactor * distFactor)
                  duggerySmartTimer = the ticks
                end if
              end if
            end if
          end if
        end if
      end if
    else
      ts = gM5MaxSpeed * 0.80000000000000004
      pMaxSpeed = ts - (ts * turnFactor * distFactor)
    end if
  else
    tSpeedReg = gM5MaxSpeed * 0.72999999999999998
    tSpeedTop = gM5MaxSpeed * 1.03
    tSpeedMin = gM5MaxSpeed * 0.59999999999999998
    if pSmartEnemy = 0 then
      pPassMODE = 2
    else
      if tYOffset < 1 then
        if pPassMODE <> 1 then
          pSmartTIMER = the ticks + random(100) + 100
        end if
        pPassMODE = 1
      else
        pPassMODE = 0
      end if
    end if
    if (pPassMODE = 1) and (the ticks < pSmartTIMER) then
      pMaxSpeed = tSpeedTop - (tSpeedTop * turnFactor * distFactor)
      if tYOffset > 5 then
        pPassMODE = 0
      end if
    else
      if pPassMODE = 2 then
        pMaxSpeed = tSpeedMin - (tSpeedMin * turnFactor * distFactor)
      else
        pMaxSpeed = tSpeedReg - (tSpeedReg * turnFactor * distFactor)
      end if
    end if
  end if
  if (tYOffset < 30) and (pJustJumped = 0) and (pCarBody.userData.isDuggary = 1) and (SndC_Music.member <> Snd_MusicLoop4) and (SndC_Music.member <> Snd_MusicLoop5) then
    SndC_Music.play([#member: Snd_MusicLoop4, #loopCount: 4])
    SndC_Music.fadeIn(500)
    SndC_Music.queue(Snd_MusicLoop5)
    SndC_Music.queue(Snd_MusicLoop4)
    SndC_VO.play(member("spark_duggary"))
    pUsePassMODE = 1
  end if
  if tYOffset < 0 then
    if isBehind = 0 then
      isPassed = 1
      gPosition = gPosition - 1
      doUpdatePlace(gPosition)
      if abs(tXOffset) <= 10 then
        SndC_M5FX.volume = 255
        SndC_M5FX.play(Snd_FX_Pass2)
      end if
    end if
    isBehind = 1
  else
    if isBehind = 1 then
      isPassed = 0
      if pIsJumping = 0 then
        gPosition = gPosition + 1
        doUpdatePlace(gPosition)
        if (pPassMODE = 1) and (pCarBody.userData.isDuggary = 1) and (SndC_Music.member <> Snd_MusicLoop5) then
          SndC_Music.play(Snd_MusicLoop5)
          SndC_Music.queue(Snd_MusicLoop4)
        end if
        if abs(tXOffset) <= 10 then
          SndC_M5FX.volume = 255
          SndC_M5FX.play(Snd_FX_Pass1)
          if (pCarBody.userData.isDuggary = 1) and (pPassMODE = 1) and (random(2) = 1) then
            SndC_VO.play(member("duggaryPass_" & random(2)))
          end if
        end if
      end if
      isBehind = 0
    end if
  end if
  pIsJumping = 0
  if (tYOffset < -40) or (chassisPos.z < -30) then
    if pCarBody.userData.isDuggary = 0 then
      SndC_M5FX2.stop()
      controlMODE = 1
      pRobot.visibility = #none
      doJump()
    else
      if isStuck = 1 then
        isStuck = 0
        isStuckTIMER = the ticks
        doResetDuggary()
      end if
    end if
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
    tGPDList[#pStartingPathStep] = [#comment: "Starting Path Step", #format: #integer, #default: 1]
    return tGPDList
  end if
end
