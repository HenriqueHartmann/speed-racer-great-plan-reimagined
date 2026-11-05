property pSpinner, pCarShell, pCarWindshield, pCarShield, pCarJacks, pCarScopeDoor, pCarScopeTop, pCarScopeBar, pCarSaws, pCarLights, pGripA, pGripB, pGripC, pGripD, pRobot, pWheelA, pWheelB, pWheelC, pWheelD, pShadow, pSprite, pSpriteRect, pSpriteLoc, pSpriteLocH
global mSpinner, spinnerBack, gotSpinnerBack, isGamePlaying, SpinnerMODE, spinnerOverlay, ovSpinner, bkSpinner, mSpinnerScene, isProjector

on beginSprite me
  pSprite = sprite(me.spriteNum)
  mSpinnerScene = member("Car_Mach5")
  mSpinnerScene.resetWorld()
  pSprite.visible = 0
  pSpriteRect = rect(pSprite.left, pSprite.top, pSprite.right, pSprite.bottom)
  SpinnerMODE = 0
  if isProjector = 1 then
    rs = getRendererServices()
    rs.renderer = #directX7_0
    rs.hardwareAntialiasing = #fullScene
  end if
end

on exitFrame
  case SpinnerMODE of
    0:
      updateStage()
      SpinnerMODE = 1
    1:
      newImage = image(512, 512, 24)
      currentStage = (the stage).image
      newImage.copyPixels(currentStage, rect(0, 0, pSprite.width, pSprite.height), pSpriteRect)
      spinnerBack = mSpinnerScene.newTexture("spinnerBack", #fromImageObject, newImage)
      spinnerBack.renderFormat = #rgba8880
      mSpinnerScene.camera(1).addBackdrop(spinnerBack, point(0, 0), 0)
      bkSpinner = mSpinnerScene.camera(1).overlay.count
      mSpinnerScene.camera(1).addOverlay(spinnerBack, point(0, 0), 0)
      ovSpinner = mSpinnerScene.camera(1).overlay.count
      pCarCollider = mSpinnerScene.model("collider")
      pCarShell = mSpinnerScene.model("mach5_body")
      pCarWindshield = mSpinnerScene.model("windshield")
      pCarShield = mSpinnerScene.model("windshield_top")
      pCarJacks = mSpinnerScene.model("jacks")
      pCarScopeDoor = mSpinnerScene.model("scope_door")
      pCarScopeTop = mSpinnerScene.model("scope_top")
      pCarScopeBar = mSpinnerScene.model("scope_bar")
      pCarSaws = mSpinnerScene.model("saw")
      pCarLights = mSpinnerScene.model("lights")
      pGripA = mSpinnerScene.model("mach5_grip_FL")
      pGripB = mSpinnerScene.model("mach5_grip_FR")
      pGripC = mSpinnerScene.model("mach5_grip_RR")
      pGripD = mSpinnerScene.model("mach5_grip_RL")
      pRobot = mSpinnerScene.model("robot")
      pShadow = mSpinnerScene.model("car_shadow")
      pWheelA = mSpinnerScene.model("mach5_wheel_FL")
      pWheelB = mSpinnerScene.model("mach5_wheel_FR")
      pWheelC = mSpinnerScene.model("mach5_wheel_RR")
      pWheelD = mSpinnerScene.model("mach5_wheel_RL")
      pShadow.visibility = #none
      pCarCollider.visibility = #none
      pCarWindshield.visibility = #both
      pRobot.visibility = #none
      pRobot.scale(2, 2, 2)
      pRobot.pointAtOrientation = [vector(0.0, 1.0, 0.0), vector(0.0, 0.0, 1.0)]
      pCarJacks.visibility = #none
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
      pCarSaws.shaderList[7].texture.renderFormat = #rgba4444
      pCarSaws.shaderList[7].blend = 60
      pCarShield.visibility = #none
      pSpinner = mSpinnerScene.newGroup("spinnerGroup")
      pSpinner.addChild(pCarShell)
      pSpinner.addChild(pCarWindshield)
      pSpinner.addChild(pCarShield)
      pSpinner.addChild(pCarJacks)
      pSpinner.addChild(pCarScopeDoor)
      pSpinner.addChild(pCarScopeTop)
      pSpinner.addChild(pCarScopeBar)
      pSpinner.addChild(pCarSaws)
      pSpinner.addChild(pCarLights)
      pSpinner.addChild(pGripA)
      pSpinner.addChild(pGripB)
      pSpinner.addChild(pGripC)
      pSpinner.addChild(pGripD)
      pSpinner.addChild(pWheelA)
      pSpinner.addChild(pWheelB)
      pSpinner.addChild(pWheelC)
      pSpinner.addChild(pWheelD)
      pSpinner.addChild(pRobot)
      pSpinner.addChild(pShadow)
      mSpinnerScene.camera(1).transform.position = vector(-3, -3, 1.5)
      mSpinnerScene.camera(1).pointAt(pSpinner.transform.position + vector(0, 0, -0.5), vector(0, 0, 1))
      theAmbientLight = mSpinnerScene.newLight("dirAmbient", #ambient)
      theAmbientLight.color = rgb(255, 255, 255)
      pSprite.visible = 1
      SpinnerMODE = 2
    2:
      pSpinner.transform.rotation[3] = pSpinner.transform.rotation[3] - 2
      mSpinnerScene.camera(1).overlay[ovSpinner].blend = mSpinnerScene.camera(1).overlay[ovSpinner].blend - 10
      if mSpinnerScene.camera(1).overlay[ovSpinner].blend <= 0 then
        mSpinnerScene.camera(1).overlay[ovSpinner].blend = 0
        SpinnerMODE = 3
      end if
    3:
      pSpinner.transform.rotation[3] = pSpinner.transform.rotation[3] - 2
  end case
end
