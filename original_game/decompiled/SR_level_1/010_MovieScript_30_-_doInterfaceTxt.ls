global mCamera, InterfaceTxtMODE, InterfaceTxtTEXT, InterfaceTxt, InterfaceTxtTIMER, ovInterface_bracket_L, ovInterface_bracket_R, ovInterface_Txt, bracketX, bracketWidth, gTextures, ovHelp, gHelpToggle

on doInterfaceTxt
  case InterfaceTxtMODE of
    1:
      bracketX = 8
      bracketWidth = 325
      mCamera.overlay[ovInterface_Txt].blend = 0
      mCamera.overlay[ovInterface_bracket_L].blend = 0
      mCamera.overlay[ovInterface_bracket_R].blend = 0
      mCamera.overlay[ovInterface_bracket_R].loc = point(bracketX, 9)
      gTextures.getProp("ovInterface_Txt").member = member("Interface_Txt_" & InterfaceTxtTEXT)
      InterfaceTxtMODE = 2
    2:
      bracketX = bracketX + min(30, (bracketWidth - bracketX) * 0.29999999999999999)
      mCamera.overlay[ovInterface_bracket_L].blend = min(60, mCamera.overlay[ovInterface_bracket_L].blend + 10)
      mCamera.overlay[ovInterface_bracket_R].blend = min(60, mCamera.overlay[ovInterface_bracket_L].blend + 10)
      mCamera.overlay[ovInterface_bracket_R].loc = point(bracketX, 9)
      if bracketX >= (bracketWidth - 10) then
        mCamera.overlay[ovInterface_Txt].blend = min(80, mCamera.overlay[ovInterface_Txt].blend + 20)
      end if
      if bracketX >= (bracketWidth - 1) then
        InterfaceTxtMODE = 3
      end if
    3:
      mCamera.overlay[ovInterface_Txt].blend = min(80, mCamera.overlay[ovInterface_Txt].blend + 20)
      if mCamera.overlay[ovInterface_Txt].blend >= 80 then
        InterfaceTxtMODE = 4
        InterfaceTxtTIMER = the ticks + (60 * 1)
      end if
    4:
      if the ticks >= InterfaceTxtTIMER then
        InterfaceTxtMODE = 5
      end if
    5:
      mCamera.overlay[ovInterface_bracket_L].blend = max(0, mCamera.overlay[ovInterface_bracket_L].blend - 5)
      mCamera.overlay[ovInterface_bracket_R].blend = max(0, mCamera.overlay[ovInterface_bracket_R].blend - 5)
      mCamera.overlay[ovInterface_Txt].blend = max(0, mCamera.overlay[ovInterface_Txt].blend - 5)
      if mCamera.overlay[ovInterface_Txt].blend <= 0 then
        mCamera.overlay[ovInterface_Txt].blend = 0
        mCamera.overlay[ovInterface_bracket_L].blend = 0
        mCamera.overlay[ovInterface_bracket_R].blend = 0
        InterfaceTxtMODE = 0
      end if
    otherwise:
      nothing()
  end case
end
