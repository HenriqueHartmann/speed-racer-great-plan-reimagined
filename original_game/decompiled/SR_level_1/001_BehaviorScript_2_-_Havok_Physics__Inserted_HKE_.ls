property pSprite, pHavok, pTimeStep, pSubSteps, pPaused, pScale, pTolerance
global gHavok

on beginSprite me
  pHavok = me.getHavokCastMemberName(pHavok)
  pSprite = sprite(me.spriteNum)
  pHavok = member(pHavok)
  if pHavok.initialized then
    pHavok.shutDown()
  end if
  pHavok.Initialize(pSprite.member, pTolerance, pScale)
  gHavok = pHavok
  gHavok.gravity = vector(0, 0, -90.810000000000002)
  pPaused = 0
end

on exitFrame me
  if not pPaused then
    pHavok.step(pTimeStep, pSubSteps)
  end if
end

on endSprite me
  if pHavok.initialized then
    pHavok.shutDown()
  end if
end

on setPause me, flag
  put "setPause"
  pPaused = 1 = flag
end

on isOKToAttach aScript, aSpriteType, aSpriteNum
  case aSpriteType of
    #graphic:
      case sprite(aSpriteNum).member.type of
        #shockwave3d:
          return 1
        #text:
          if sprite(aSpriteNum).member.displayMode = #mode3d then
            return 1
          else
            return 0
          end if
      end case
    #script:
      return 0
  end case
  return 0
end

on getPropertyDescriptionList aScript
  if the currentSpriteNum > 0 then
    tGPDList = [:]
    tList = []
    tList = aScript.getHavokCastMemberNameList(tList)
    tGPDList[#pHavok] = [#comment: "Which Havok Cast Member", #format: #string, #range: tList, #default: tList[1]]
    tGPDList[#pTolerance] = [#comment: "Tolerance", #format: #float, #default: 4]
    tGPDList[#pTimeStep] = [#comment: "Time Step", #format: #float, #default: 0.025000000000000001]
    tGPDList[#pSubSteps] = [#comment: "Substeps", #format: #integer, #default: 5]
    tGPDList[#pScale] = [#comment: "World Scale", #format: #float, #default: 1.0]
    return tGPDList
  end if
end

on getBehaviorTooltip aScript
  tString1 = "Setup Havok Physics" & RETURN & RETURN
  tString2 = "-" && "Type" && ":" && "Independent Action" & RETURN
  tString3 = "-" && "Dependencies" && ":" && "None" & RETURN
  return tString1 & tString2 & tString3
end

on getBehaviorDescription aScript
  tString1 = "HAVOK PHYSICS" & RETURN & RETURN & "Enables the Havok engine for the sprite. " & "Any created rigid bodies from Shockwave 3D models are then updated based on a physics simulation." & EMPTY & RETURN & RETURN & "This independent behavior does not require a trigger." & RETURN & RETURN & "ACTIONS AND THEIR REQUIRED TRIGGERS:" & RETURN & "- None" & RETURN & RETURN & "PARAMETERS:" & RETURN & "- Havok Cast Member" & RETURN & RETURN & "- Tolerance" & RETURN & RETURN & "- Timestep" & RETURN & RETURN & "- Substeps" & RETURN & RETURN & "- World Scale" & RETURN & RETURN & "PERMITTED SPRITE TYPES:" & RETURN & "- Shockwave 3D"
  return tString1
end

on getHavokCastMemberNameList me, aList
  repeat with j = 1 to the number of castMembers
    if member(j).type = #havok then
      aList.add(j & ":" & member(j).name)
    end if
  end repeat
  return aList
end

on getHavokCastMemberName me, memberName
  nameStr = chars(memberName, offset(":", memberName) + 1, memberName.length)
  nameInt = chars(memberName, 1, offset(":", memberName) - 1)
  nameInt = integer(nameInt)
  return member(nameInt)
end
