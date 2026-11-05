property myY
global gSCRIPTS, isProjector, windowRect, windowMODE

on beginSprite me
  myY = sprite(me.spriteNum).locV
  if (isProjector = 0) or (windowMODE <> 2) then
    sprite(me.spriteNum).visible = 0
  else
    sprite(me.spriteNum).visible = 1
  end if
end

on mouseEnter me
  sprite(me.spriteNum).member = "button_min_1"
end

on mouseLeave me
  sprite(me.spriteNum).member = "button_min_0"
end

on mouseDown me
  sprite(me.spriteNum).locV = myY + 2
end

on mouseUpOutSide me
  sprite(me.spriteNum).locV = myY
  sprite(me.spriteNum).member = "button_min_0"
end

on mouseUp me
  sprite(me.spriteNum).locV = myY
  sprite(me.spriteNum).member = "button_min_0"
  put "CALLING: doChangeMode(1)"
  gSCRIPTS.doChangeMode(1)
end
