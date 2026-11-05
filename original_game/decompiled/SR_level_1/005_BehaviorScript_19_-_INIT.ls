global gameLevel, gameLighting, gTextures, gOverlays, gHavok, g3DWorld, gProgBar, gCarsList, mCamera, mMach5, mTrack, GAMEMODE, PREPMODE, CAMERAMODE, isUnderWater, gProgSteps, gProgStep, ovInterface, isProjector

on prepareFrame me
  sprite(2).locH = 1000
  sprite(2).visible = 0
end

on exitFrame me
  gTextures = [:]
  gOverlays = [:]
  gameLevel = 1
  gameLighting = rgb(255, 255, 255)
  isUnderWater = 0
  GAMEMODE = 0
  PREPMODE = 1
  CAMERAMODE = 0
  g3DWorld = sprite(2).member
  g3DWorld.resetWorld()
  gHavok = member("Havok")
  gHavok.deactivationParameters = [5.0, 0.10000000000000001]
  if isProjector = 1 then
    rs = getRendererServices()
    rs.renderer = #directX7_0
    rs.hardwareAntialiasing = #fullScene
    put rs.renderer
    put rs.hardwareAntialiasing
  end if
  _player.cursor(4)
end
