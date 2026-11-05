global mCamera, ovInterface_DamageBar, ovInterface_DamageBarEnd, gDamage, gDamageDisplayed, DamageImage, damageImageSource, gTextures

on doDisplayDamage me
  gDamageDisplayed = min(100, max(0, gDamageDisplayed + ((gDamage - gDamageDisplayed) * 0.29999999999999999)))
  if abs(gDamageDisplayed - gDamage) <= 0.5 then
    gDamageDisplayed = gDamage
  end if
  tScaleX = gDamageDisplayed * 0.01 * 366
  DamageImage = image(tScaleX, 11, 24)
  DamageImage.copyPixels(damageImageSource, rect(0, 0, tScaleX, 11), rect(366 - tScaleX, 0, 366, 11))
  gTextures.getProp("Interface_DamageBar").image = DamageImage
  mCamera.overlay[ovInterface_DamageBar].source = gTextures.getProp("Interface_DamageBar")
  mCamera.overlay[ovInterface_DamageBarEnd].loc = point(8 + tScaleX, 365)
end
