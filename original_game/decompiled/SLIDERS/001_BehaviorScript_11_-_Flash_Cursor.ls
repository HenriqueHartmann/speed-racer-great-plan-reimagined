property pActive, pframecursor, pInitialized, pMember, pprevcursor, pSprite, pStateOK

on beginSprite me
  pSprite = sprite(me.spriteNum)
  pMember = pSprite.member
  pStateOK = me.isStateOK(pMember, pSprite)
  if pStateOK then
    pInitialized = me.Initialize()
  else
    pInitialized = 0
  end if
end

on endSprite me
  me.restorecursor()
end

on mouseEnter me
  pActive = 1
end

on mouseLeave me
  pActive = 0
  me.restorecursor()
end

on enterFrame me
  if pStateOK then
    if pInitialized then
      if pActive then
        me.setcursor()
      end if
    else
      pInitialized = me.Initialize()
    end if
  else
    pStateOK = me.isStateOK(pMember, pSprite)
  end if
end

on Initialize me
  tinitialized = 1
  pActive = 0
  pframecursor = sprite(0).cursor
  if pSprite.cursor <> pframecursor then
    pprevcursor = pSprite.cursor
  else
    pprevcursor = pframecursor
  end if
  return tinitialized
end

on isStateOK me, amember, asprite
  tstateok = 1
  return tstateok
end

on restorecursor me
  if pprevcursor <> pframecursor then
    cursor(pframecursor)
    pprevcursor = pframecursor
  end if
end

on setcursor me
  tflashcursor = pSprite.getFlashProperty(EMPTY, #cursor)
  case tflashcursor of
    0:
      tdirectorcursor = 200
    1:
      tdirectorcursor = -1
    2:
      tdirectorcursor = 280
    3:
      tdirectorcursor = 260
    4:
      tdirectorcursor = 1
    otherwise:
      tdirectorcursor = pSprite.cursor
  end case
  if pprevcursor <> tdirectorcursor then
    cursor(tdirectorcursor)
    pprevcursor = tdirectorcursor
  end if
end

on isOKToAttach me, aSpriteType, aSpriteNum
  if aSpriteType = #graphic then
    if sprite(aSpriteNum).member.type = #flash then
      return 1
    end if
  end if
  return 0
end

on getBehaviorTooltip me
  tString1 = "Allows Director's cursor to obey the Flash movie's cursor setting." & RETURN & RETURN & "PERMITTED SPRITE TYPES: Flash." & RETURN & RETURN & "USAGE: Apply to a Flash sprite. " & EMPTY & RETURN & RETURN & "DEPENDENCIES: None."
  return tString1
end

on getBehaviorDescription me
  tString1 = "FLASH CURSOR" & RETURN & RETURN & "Drop the behavior onto a Flash sprite to allow Director to maintain the Flash movie's cursor settings." & RETURN & RETURN & "Apply this behavior to a Flash sprite." & RETURN & RETURN & "PERMITTED MEMBER TYPES:" & RETURN & "Flash" & RETURN & RETURN & "PARAMETERS:" & RETURN & "None."
  return tString1
end
