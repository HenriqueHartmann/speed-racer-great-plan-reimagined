global mCamera, ovOxygen_Panel, ovInterface_OxygenBar, ovInterface_OxygenBarEnd, gOxygen, gOxygenDisplayed, OxygenImage, gTextures, gOxygenMODE, SndC_VO

on doDisplayOxygen me
  case gOxygenMODE of
    0:
      nothing()
    1:
      if mCamera.overlay[ovOxygen_Panel].blend < 100 then
        mCamera.overlay[ovOxygen_Panel].blend = min(100, mCamera.overlay[ovOxygen_Panel].blend + 30)
        mCamera.overlay[ovInterface_OxygenBar].blend = min(100, mCamera.overlay[ovInterface_OxygenBar].blend + 30)
        mCamera.overlay[ovInterface_OxygenBarEnd].blend = min(100, mCamera.overlay[ovInterface_OxygenBarEnd].blend + 30)
      end if
      t = gOxygenDisplayed
      gOxygenDisplayed = min(100, max(0, gOxygenDisplayed + ((gOxygen - gOxygenDisplayed) * 0.29999999999999999)))
      if abs(gOxygenDisplayed - gOxygen) <= 0.5 then
        gOxygenDisplayed = gOxygen
      end if
      tScaleX = gOxygenDisplayed * 0.01 * 366
      OxygenImage = image(tScaleX, 11, 24)
      OxygenImage.copyPixels(member("Interface_OxygenBar").image, rect(0, 0, tScaleX, 11), rect(366 - tScaleX, 0, 366, 11))
      gTextures.getProp("Interface_OxygenBar").image = OxygenImage
      mCamera.overlay[ovInterface_OxygenBar].source = gTextures.getProp("Interface_OxygenBar")
      mCamera.overlay[ovInterface_OxygenBarEnd].loc = point(8 + tScaleX, 335)
      if (gOxygenDisplayed < 25) and (t > 25) then
        pHasPlayedWarning = 1
        SndC_VO.play(member("sp_o2_low"))
      end if
    2:
      mCamera.overlay[ovOxygen_Panel].blend = max(0, mCamera.overlay[ovOxygen_Panel].blend - 10)
      mCamera.overlay[ovInterface_OxygenBar].blend = max(0, mCamera.overlay[ovInterface_OxygenBar].blend - 10)
      mCamera.overlay[ovInterface_OxygenBarEnd].blend = max(0, mCamera.overlay[ovInterface_OxygenBarEnd].blend - 10)
      if mCamera.overlay[ovOxygen_Panel].blend <= 0 then
        gOxygenDisplayed = 1
        gOxygenMODE = 0
      end if
  end case
end
