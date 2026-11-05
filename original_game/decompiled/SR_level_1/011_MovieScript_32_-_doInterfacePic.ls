global mCamera, InterfacePicMODE, InterfacepicIMG, InterfaceTxt, InterfacePicTIMER, ovInterface_Pic, gTextures, PicX

on doInterfacePic
  case InterfacePicMODE of
    1:
      PicX = 284
      mCamera.overlay[ovInterface_Pic].blend = 100
      mCamera.overlay[ovInterface_Pic].loc = point(PicX, 230)
      gTextures.getProp("ovInterface_Pic").member = member("Interface_Pic_" & InterfacepicIMG)
      InterfacePicMODE = 2
    2:
      PicX = max(284, PicX - 40)
      mCamera.overlay[ovInterface_Pic].loc = point(PicX, 230)
      if PicX = 284 then
        InterfacePicTIMER = the ticks + (60 * 1.5)
        InterfacePicMODE = 3
      end if
    3:
      if the ticks >= InterfacePicTIMER then
        InterfacePicMODE = 4
      end if
    4:
      mCamera.overlay[ovInterface_Pic].blend = max(0, mCamera.overlay[ovInterface_Pic].blend - 5)
      if mCamera.overlay[ovInterface_Pic].blend <= 0 then
        mCamera.overlay[ovInterface_Pic].blend = 0
        InterfacePicMODE = 0
      end if
    otherwise:
      nothing()
  end case
end
