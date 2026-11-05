global gScore, isProjector, windowMODE, gPosition, gLevel

on beginSprite me
  sprite(me.spriteNum).setVariable("gScore", string(gScore))
  if (gScore >= 30000) and (gPosition = 1) then
    sprite(me.spriteNum).setVariable("gHasWallpaper", "yes")
  else
    sprite(me.spriteNum).setVariable("gHasWallpaper", "no")
  end if
  if isProjector = 0 then
    sprite(me.spriteNum).setVariable("gUnlocked", "locked")
  else
    sprite(me.spriteNum).setVariable("gUnlocked", "unlocked")
  end if
  if (isProjector = 0) or (windowMODE <> 2) then
    sprite(5).visible = 0
    sprite(6).visible = 0
  else
    sprite(5).visible = 1
    sprite(6).visible = 1
  end if
end
