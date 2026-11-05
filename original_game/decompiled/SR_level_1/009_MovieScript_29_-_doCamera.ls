global CAMERAMODE, SCOPEMODE, SCOPETIMER_1, SCOPETIMER_2, ovScopeUnder, ovScopeStatic, ovScopeFrame, isUnderWater, g3DWorld, mCamera2, mCamera, mMach5, mMach5Shadow, mTrack, mSky, scopeFactor, scopeRotate, TargetPos_Cur, CameraPos_Cur, TargetPos_Ideal, CameraPos_Ideal, TargetPos_Step, CameraPos_Step, kForward, _PI180, gMach5InAir, mRobot, cameraDummy

on doCamera me
  tPos = mMach5.transform.position
  case CAMERAMODE of
    0:
      t = transform()
      t.rotation = mMach5.transform.rotation
      cameraDummy_r = g3DWorld.newModelResource("cameraDummy_r", #box, #front)
      cameraDummy_r.height = 0.20000000000000001
      cameraDummy_r.width = 0.20000000000000001
      cameraDummy_r.length = 0.20000000000000001
      cameraDummy = g3DWorld.newModel("cameraDummy", cameraDummy_r)
      gCameraStep = 0.0
      gTargetStep = 0.0
      t = transform()
      t.rotation = mMach5.transform.rotation
      TargetPos_Cur = tPos + (t * vector(0, 0.0, 0))
      CameraPos_Cur = tPos + vector(-10, 0, 2.0)
      TargetPos_Ideal = tPos + (t * vector(0, 0.0, 1))
      CameraPos_Ideal = tPos + vector(-10, 0, 2.0)
      TargetPos_Step = TargetPos_Cur
      CameraPos_Step = CameraPos_Cur
      mCamera.transform.position = CameraPos_Step
      mCamera.pointAt(TargetPos_Step, vector(0, 0, 1))
      cameraDummy.transform.position = mCamera.transform.position
      CAMERAMODE = 1
    1:
      t = transform()
      t.rotation = mMach5.transform.rotation
      cameraPos = cameraDummy.transform.position
      targetPos = mMach5.transform.position
      curDist = cameraPos.distanceTo(targetPos)
      idealDist = 5
      stepDist = ((idealDist - curDist) * 0.29999999999999999) + curDist
      if gMach5InAir = 0 then
        curZ = cameraPos.z
        tempPOS = targetPos + (t * vector(0, -5, 2.5))
        idealZ = tempPOS.z
        stepZ = ((idealZ - curZ) * 0.5) + curZ
      else
        curZ = cameraPos.z
        tempPOS = targetPos + (t * vector(0, -5, 2.5))
        idealZ = tempPOS.z
        stepZ = ((idealZ - curZ) * 0.40000000000000002) + curZ
      end if
      curAngle = cameraDummy.transform.rotation.z
      idealAngle = mMach5.transform.rotation.z
      stepAngle = curAngle + getRotStep(curAngle, idealAngle, 0.20000000000000001)
      cameraDummy.transform.rotation.z = stepAngle
      cameraDummy.transform.position = targetPos
      cameraDummy.transform.position.z = stepZ
      cameraDummy.translate(0, -stepDist, 0)
      mCamera.transform.position = cameraDummy.transform.position
      mCamera.pointAt(targetPos, vector(0, 0, 1))
      mSky.transform.position = mCamera.transform.position
  end case
  if SCOPEMODE = 0 then
    return 
  end if
  case SCOPEMODE of
    1:
      sprite(2).addCamera(mCamera2, 2)
      ovScopeUnder = createOverlay(mCamera, "ovScopeUnder", "ov_scopecam_under", #rgba4444, 0, #low, 100, point(347, 0), 0)
      ovScopeStatic = createOverlay(mCamera2, "ovScopeStatic", "ov_scopecam_static", #rgba5550, 0, #low, 100, point(0, 0), 0)
      ovScopeFrame = createOverlay(mCamera2, "ovScopeFrame", "ov_scopecam_frame", #rgba4444, 0, #low, 100, point(0, 0), 0)
      scopeFactor = 0.01
      g3DWorld.model("Mach5CarScopeDoor").visibility = #none
      g3DWorld.model("Mach5CarScopeTop").visibility = #front
      g3DWorld.model("Mach5CarScopeBar").visibility = #front
      g3DWorld.model("Mach5CarScopeTop").transform = mMach5.transform
      g3DWorld.model("Mach5CarScopeBar").transform = mMach5.transform
      g3DWorld.model("Mach5CarScopeTop").translate(-0.29999999999999999, -0.90000000000000002, 0.246)
      g3DWorld.model("Mach5CarScopeBar").translate(-0.29999999999999999, -0.90000000000000002, 0.246)
      g3DWorld.model("Mach5CarScopeBar").scale(1, 1, 0.01)
      g3DWorld.model("Mach5CarScopeTop").rotate(0, 0, 0)
      scopeRotate = 0
      SCOPEMODE = 2
      SCOPETIMER_1 = the ticks + 30
    2:
      if scopeFactor >= 1 then
        g3DWorld.model("Mach5CarScopeTop").transform = mMach5.transform
        g3DWorld.model("Mach5CarScopeBar").transform = mMach5.transform
        g3DWorld.model("Mach5CarScopeTop").translate(-0.29999999999999999, -0.90000000000000002, 0.246 + scopeFactor)
        g3DWorld.model("Mach5CarScopeBar").translate(-0.29999999999999999, -0.90000000000000002, 0.246)
        g3DWorld.model("Mach5CarScopeBar").scale(1, 1, 1 * scopeFactor)
        scopeFactor = min(1, scopeFactor + 0.050000000000000003)
        SCOPEMODE = 3
      else
        mCamera2.overlay[ovScopeStatic].loc = point(0 - random(20), 0)
        g3DWorld.model("Mach5CarScopeTop").transform = mMach5.transform
        g3DWorld.model("Mach5CarScopeBar").transform = mMach5.transform
        g3DWorld.model("Mach5CarScopeTop").translate(-0.29999999999999999, -0.90000000000000002, 0.246 + scopeFactor)
        g3DWorld.model("Mach5CarScopeBar").translate(-0.29999999999999999, -0.90000000000000002, 0.246)
        g3DWorld.model("Mach5CarScopeBar").scale(1, 1, 1 * scopeFactor)
        scopeFactor = min(1, scopeFactor + 0.050000000000000003)
      end if
    3:
      if mCamera2.overlay[ovScopeStatic].blend > 0 then
        mCamera2.overlay[ovScopeStatic].loc = point(0 - random(20), 0)
        mCamera2.overlay[ovScopeStatic].blend = mCamera2.overlay[ovScopeStatic].blend - 2.5
      end if
      mCamera2.transform.position = mMach5.transform.position + vector(0, 0, 2)
      TargetPos_Scope = mCamera2.transform.position + (t * vector(0, 6.0, 0))
      mCamera2.pointAt(TargetPos_Scope, vector(0, 0, 1))
      g3DWorld.model("Mach5CarScopeTop").transform = mMach5.transform
      g3DWorld.model("Mach5CarScopeBar").transform = mMach5.transform
      g3DWorld.model("Mach5CarScopeTop").translate(-0.29999999999999999, -0.90000000000000002, 0.246 + scopeFactor)
      g3DWorld.model("Mach5CarScopeBar").translate(-0.29999999999999999, -0.90000000000000002, 0.246)
      g3DWorld.model("Mach5CarScopeBar").scale(1, 1, 1 * scopeFactor)
      g3DWorld.model("Mach5CarScopeTop").rotate(0, 0, scopeRotate)
      scopeRotate = min(360, scopeRotate + 20)
      if isUnderWater = 1 then
        if mCamera2.transform.position.z > 3 then
          mCamera2.transform.position.z = min(3, mCamera2.transform.position.z + 0.29999999999999999)
        else
          if mCamera2.transform.position.z < 3 then
            mCamera2.transform.position.z = max(3, mCamera2.transform.position.z - 0.29999999999999999)
          end if
        end if
      end if
      if scopeRotate = 360 then
        if isUnderWater = 1 then
          scopeFactor = min(3, scopeFactor + 0.050000000000000003)
        else
          scopeFactor = max(1, scopeFactor - 0.050000000000000003)
        end if
      end if
    4:
      if scopeFactor > 0.01 then
        mCamera2.overlay[ovScopeStatic].loc = point(0 - random(20), 0)
        mCamera2.overlay[ovScopeStatic].blend = mCamera2.overlay[ovScopeStatic].blend + 10
        mCamera2.transform.position = mMach5.transform.position + vector(0, 0, 2)
        if isUnderWater = 1 then
          if mCamera2.transform.position.z > 9 then
            mCamera2.transform.position.z = min(9, mCamera2.transform.position.z + 0.29999999999999999)
          else
            if mCamera2.transform.position.z < 9 then
              mCamera2.transform.position.z = max(9, mCamera2.transform.position.z - 0.29999999999999999)
            end if
          end if
        end if
        TargetPos_Scope = mCamera2.transform.position + (t * vector(0, 6.0, 0))
        mCamera2.pointAt(TargetPos_Scope, vector(0, 0, 1))
        g3DWorld.model("Mach5CarScopeTop").transform = mMach5.transform
        g3DWorld.model("Mach5CarScopeBar").transform = mMach5.transform
        g3DWorld.model("Mach5CarScopeTop").translate(-0.29999999999999999, -0.90000000000000002, 0.246 + scopeFactor)
        g3DWorld.model("Mach5CarScopeBar").translate(-0.29999999999999999, -0.90000000000000002, 0.246)
        g3DWorld.model("Mach5CarScopeBar").scale(1, 1, 1 * scopeFactor)
        scopeFactor = max(0.01, scopeFactor - 0.080000000000000002)
      else
        g3DWorld.model("Mach5CarScopeDoor").visibility = #front
        mCamera2.removeOverlay(ovScopeFrame)
        mCamera2.removeOverlay(ovScopeStatic)
        g3DWorld.model("Mach5CarScopeTop").visibility = #none
        g3DWorld.model("Mach5CarScopeBar").visibility = #none
        sprite(2).deleteCamera(2)
        SCOPEMODE = 5
      end if
    5:
      if mCamera.overlay[ovScopeUnder].blend > 0 then
        mCamera.overlay[ovScopeUnder].blend = mCamera.overlay[ovScopeUnder].blend - 20
      else
        mCamera.removeOverlay(ovScopeUnder)
        SCOPEMODE = 0
      end if
  end case
end
